"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTaskSchema, getSessionProfile } from "@/lib/session";
import { accessTokenFor } from "@/lib/email/accounts";
import { draftComposeText, draftReplyText, summarizeEmailText, syncInbox } from "@/lib/email/sync";
import { markGmailRead, sendMessage, setGmailArchived } from "@/lib/email/gmail";
import { sanitizeTitle } from "@/lib/agent/titles";
import { isDraft } from "@/lib/email/mailbox";
import { captureError } from "@/lib/sentry";

export async function syncMailAction(opts?: { watch?: boolean }) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const supabase = await createClient();
  const ready = await accessTokenFor(supabase, profile.id);
  if (!ready) return { ok: false as const, detail: "not_connected" };
  try {
    const result = await syncInbox(supabase, {
      userId: profile.id,
      accountId: ready.account.id,
      accessToken: ready.accessToken,
      watch: opts?.watch,
    });
    revalidatePath("/correo");
    revalidatePath("/", "layout");
    return { ok: true as const, inserted: result.inserted, fresh: result.fresh };
  } catch (error) {
    captureError(error, { where: "syncMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
}

export async function disconnectMailAction() {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("email_accounts").delete().eq("user_id", profile.id);
  if (error) {
    captureError(error, { where: "disconnectMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/correo");
  return { ok: true as const };
}

export async function sendMailAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const parsed = z
    .object({
      email_id: z.string().uuid(),
      body: z.string().trim().min(1).max(8000),
    })
    .safeParse({
      email_id: formData.get("email_id"),
      body: formData.get("body"),
    });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const ready = await accessTokenFor(supabase, profile.id);
  if (!ready) return { ok: false as const, detail: "not_connected" };
  const { data: original, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", parsed.data.email_id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (error || !original) return { ok: false as const, detail: "not_found" };
  const to = original.inbound
    ? (original.from_address.match(/<([^>]+)>/)?.[1] ?? original.from_address)
    : (original.to_addresses[0] ?? "");
  if (!to) return { ok: false as const, detail: "validation" };
  const subject = original.subject.toLowerCase().startsWith("re:")
    ? original.subject
    : `Re: ${original.subject || "(sin asunto)"}`;
  try {
    const sent = await sendMessage(ready.accessToken, {
      from: ready.account.email,
      to,
      subject,
      body: parsed.data.body,
      inReplyTo: original.rfc_message_id,
      threadId: original.thread_id,
    });
    const { error: insertError } = await supabase.from("emails").insert({
      account_id: ready.account.id,
      user_id: profile.id,
      gmail_id: sent.id,
      thread_id: sent.threadId,
      from_address: ready.account.email,
      to_addresses: [to],
      subject,
      snippet: parsed.data.body.slice(0, 400),
      body_text: parsed.data.body,
      occurred_at: new Date().toISOString(),
      unread: false,
      inbound: false,
      is_draft: false,
      archived: false,
    });
    if (insertError) captureError(insertError, { where: "sendMailAction.insert" });
  } catch (sendError) {
    captureError(sendError, { where: "sendMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/correo");
  revalidatePath(`/correo/${original.id}`);
  return { ok: true as const };
}

export async function sendDraftAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const parsed = z
    .object({
      email_id: z.string().uuid(),
      body: z.string().trim().min(1).max(8000),
    })
    .safeParse({
      email_id: formData.get("email_id"),
      body: formData.get("body"),
    });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const ready = await accessTokenFor(supabase, profile.id);
  if (!ready) return { ok: false as const, detail: "not_connected" };
  const { data: draft, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", parsed.data.email_id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (error || !draft || !isDraft(draft)) return { ok: false as const, detail: "not_found" };
  const to = draft.to_addresses[0] ?? "";
  if (!to) return { ok: false as const, detail: "validation" };
  try {
    const sent = await sendMessage(ready.accessToken, {
      from: ready.account.email,
      to,
      subject: draft.subject || "(sin asunto)",
      body: parsed.data.body,
    });
    await supabase
      .from("emails")
      .update({
        gmail_id: sent.id,
        thread_id: sent.threadId,
        body_text: parsed.data.body,
        snippet: parsed.data.body.slice(0, 400),
        is_draft: false,
        inbound: false,
        unread: false,
        occurred_at: new Date().toISOString(),
      })
      .eq("id", draft.id);
  } catch (sendError) {
    captureError(sendError, { where: "sendDraftAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/correo");
  revalidatePath(`/correo/${draft.id}`);
  return { ok: true as const };
}

export async function draftMailAction(emailId: string) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const id = z.string().uuid().safeParse(emailId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("emails")
    .select("*")
    .eq("id", id.data)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return { ok: false as const, detail: "not_found" };
  try {
    const draft = await draftReplyText({
      from: row.from_address,
      subject: row.subject,
      body: row.body_text || row.snippet,
    });
    if (!draft) return { ok: false as const, detail: "server_error" };
    await supabase.from("emails").update({ draft_reply: draft }).eq("id", row.id);
    revalidatePath(`/correo/${row.id}`);
    return { ok: true as const, draft };
  } catch (error) {
    captureError(error, { where: "draftMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
}

export async function composeDraftAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const parsed = z
    .object({
      to: z.string().trim().max(200),
      subject: z.string().trim().max(200),
      prompt: z.string().trim().min(1).max(2000),
    })
    .safeParse({
      to: String(formData.get("to") ?? "").trim(),
      subject: String(formData.get("subject") ?? ""),
      prompt: String(formData.get("prompt") ?? "").trim(),
    });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  try {
    const draft = await draftComposeText(parsed.data);
    if (!draft) return { ok: false as const, detail: "server_error" };
    return { ok: true as const, draft };
  } catch (error) {
    captureError(error, { where: "composeDraftAction" });
    return { ok: false as const, detail: "server_error" };
  }
}

export async function taskFromMailAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const emailId = z.string().uuid().safeParse(formData.get("email_id"));
  if (!emailId.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("emails")
    .select("*")
    .eq("id", emailId.data)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return { ok: false as const, detail: "not_found" };
  const teamId = profile.default_team;
  if (!teamId) return { ok: false as const, detail: "validation" };
  const title = sanitizeTitle(row.subject || row.snippet || "Correo").title;
  const notes = [row.summary, `De: ${row.from_address}`, row.snippet].filter(Boolean).join("\n\n");
  const parsed = createTaskSchema.safeParse({
    title,
    notes,
    team_id: teamId,
  });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const { data, error } = await supabase.rpc("create_task_with_event", {
    p_title: parsed.data.title,
    p_notes: parsed.data.notes ?? null,
    p_team_id: parsed.data.team_id,
    p_area: null,
    p_owner_id: profile.id,
    p_assignee_id: profile.id,
    p_due_date: null,
    p_priority: "medium",
    p_visibility: "team",
    p_source: "email",
  });
  if (error || !data) {
    captureError(error, { where: "taskFromMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
  await supabase.from("emails").update({ task_id: data.id }).eq("id", row.id);
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  revalidatePath("/correo");
  revalidatePath(`/correo/${row.id}`);
  return { ok: true as const, taskId: data.id };
}

export async function summarizeMailAction(emailId: string) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const id = z.string().uuid().safeParse(emailId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("emails")
    .select("*")
    .eq("id", id.data)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return { ok: false as const, detail: "not_found" };
  try {
    const summary = await summarizeEmailText({
      from: row.from_address,
      subject: row.subject,
      body: row.body_text || row.snippet,
    });
    if (!summary) return { ok: false as const, detail: "server_error" };
    await supabase.from("emails").update({ summary }).eq("id", row.id);
    revalidatePath("/correo");
    revalidatePath(`/correo/${row.id}`);
    return { ok: true as const, summary };
  } catch (error) {
    captureError(error, { where: "summarizeMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
}

export async function archiveMailAction(emailId: string, archived = true) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const id = z.string().uuid().safeParse(emailId);
  if (!id.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("emails")
    .select("id, gmail_id, thread_id")
    .eq("id", id.data)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return { ok: false as const, detail: "not_found" };
  const localOnly = row.gmail_id.startsWith("draft-") || row.gmail_id.startsWith("sent-");
  if (!localOnly) {
    const ready = await accessTokenFor(supabase, profile.id);
    if (!ready) return { ok: false as const, detail: "not_connected" };
    const gmailOk = await setGmailArchived(ready.accessToken, {
      gmailId: row.gmail_id,
      threadId: row.thread_id,
      archived,
    });
    if (!gmailOk) return { ok: false as const, detail: "server_error" };
  }
  const { error } = await supabase
    .from("emails")
    .update(archived ? { archived: true, unread: false } : { archived: false })
    .eq("id", row.id)
    .eq("user_id", profile.id);
  if (error) {
    captureError(error, { where: "archiveMailAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath("/correo");
  revalidatePath(`/correo/${row.id}`);
  return { ok: true as const };
}

export async function markReadAction(emailId: string) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const id = z.string().uuid().safeParse(emailId);
  if (!id.success) return { ok: false as const, detail: "forbidden" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("emails")
    .select("id, gmail_id, thread_id, unread")
    .eq("id", id.data)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return { ok: false as const, detail: "not_found" };
  if (row.unread) {
    await supabase.from("emails").update({ unread: false }).eq("id", row.id);
  }
  const ready = await accessTokenFor(supabase, profile.id);
  if (ready) {
    await markGmailRead(ready.accessToken, { gmailId: row.gmail_id, threadId: row.thread_id });
  }
  revalidatePath("/correo");
  revalidatePath(`/correo/${row.id}`);
  return { ok: true as const };
}

export async function composeMailAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile || profile.isGuest) return { ok: false as const, detail: "forbidden" };
  const parsed = z
    .object({
      to: z.string().email(),
      subject: z.string().trim().max(200),
      body: z.string().trim().min(1).max(8000),
      save_draft: z.enum(["0", "1"]).optional(),
    })
    .safeParse({
      to: String(formData.get("to") ?? "").trim(),
      subject: formData.get("subject") ?? "",
      body: formData.get("body"),
      save_draft: formData.get("save_draft") === "1" ? "1" : "0",
    });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const ready = await accessTokenFor(supabase, profile.id);
  if (!ready) return { ok: false as const, detail: "not_connected" };
  const draft = parsed.data.save_draft === "1";
  if (draft) {
    const { error } = await supabase.from("emails").insert({
      account_id: ready.account.id,
      user_id: profile.id,
      gmail_id: `draft-${crypto.randomUUID()}`,
      thread_id: crypto.randomUUID(),
      from_address: ready.account.email,
      to_addresses: [parsed.data.to],
      subject: parsed.data.subject,
      snippet: parsed.data.body.slice(0, 400),
      body_text: parsed.data.body,
      occurred_at: new Date().toISOString(),
      unread: false,
      inbound: false,
      is_draft: true,
      archived: false,
    });
    if (error) {
      captureError(error, { where: "composeMailAction.draft" });
      return { ok: false as const, detail: "server_error" };
    }
    revalidatePath("/correo");
    return { ok: true as const, draft: true };
  }
  try {
    await sendMessage(ready.accessToken, {
      from: ready.account.email,
      to: parsed.data.to,
      subject: parsed.data.subject || "(sin asunto)",
      body: parsed.data.body,
    });
  } catch (error) {
    captureError(error, { where: "composeMailAction.send" });
    return { ok: false as const, detail: "server_error" };
  }
  await supabase.from("emails").insert({
    account_id: ready.account.id,
    user_id: profile.id,
    gmail_id: `sent-${crypto.randomUUID()}`,
    thread_id: crypto.randomUUID(),
    from_address: ready.account.email,
    to_addresses: [parsed.data.to],
    subject: parsed.data.subject,
    snippet: parsed.data.body.slice(0, 400),
    body_text: parsed.data.body,
    occurred_at: new Date().toISOString(),
    unread: false,
    inbound: false,
    is_draft: false,
    archived: false,
  });
  revalidatePath("/correo");
  return { ok: true as const, draft: false };
}
