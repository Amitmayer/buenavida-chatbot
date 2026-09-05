import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { getMessage, listMessageIds } from "@/lib/email/gmail";
import { captureError } from "@/lib/sentry";

type Client = SupabaseClient<Database>;

export async function syncInbox(
  supabase: Client,
  args: { userId: string; accountId: string; accessToken: string },
): Promise<{ inserted: number }> {
  const listed = await listMessageIds(args.accessToken, 40);
  const ids = listed.map((row) => row.id);
  if (ids.length === 0) return { inserted: 0 };
  const { data: existing } = await supabase
    .from("emails")
    .select("gmail_id")
    .eq("account_id", args.accountId)
    .in("gmail_id", ids);
  const have = new Set((existing ?? []).map((row) => row.gmail_id));
  const missing = listed.filter((row) => !have.has(row.id)).slice(0, 15);
  let inserted = 0;
  for (const item of missing) {
    const parsed = await getMessage(args.accessToken, item.id);
    const { error } = await supabase.from("emails").insert({
      account_id: args.accountId,
      user_id: args.userId,
      gmail_id: parsed.gmailId,
      thread_id: parsed.threadId,
      rfc_message_id: parsed.rfcMessageId,
      from_address: parsed.from,
      to_addresses: parsed.to,
      subject: parsed.subject,
      snippet: parsed.snippet,
      body_text: parsed.body,
      occurred_at: parsed.occurredAt,
      unread: parsed.unread,
      inbound: parsed.inbound,
    });
    if (error) {
      captureError(error, { where: "email.sync.insert" });
      continue;
    }
    inserted += 1;
  }
  await summarizeNew(supabase, args.userId);
  return { inserted };
}

async function summarizeNew(supabase: Client, userId: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return;
  const { data } = await supabase
    .from("emails")
    .select("id, subject, snippet, body_text, from_address")
    .eq("user_id", userId)
    .is("summary", null)
    .eq("inbound", true)
    .order("occurred_at", { ascending: false })
    .limit(8);
  if (!data || data.length === 0) return;
  const anthropic = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_DIGEST_MODEL ?? "claude-haiku-4-5";
  for (const row of data) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 160,
        messages: [
          {
            role: "user",
            content: [
              "Resume este correo en dos frases, español latinoamericano neutro.",
              "No inventes. Si pide una acción, dilo.",
              `De: ${row.from_address}`,
              `Asunto: ${row.subject}`,
              row.body_text || row.snippet,
            ].join("\n"),
          },
        ],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      if (!text) continue;
      await supabase.from("emails").update({ summary: text }).eq("id", row.id);
    } catch (error) {
      captureError(error, { where: "email.summarize" });
    }
  }
}

export async function draftReplyText(args: {
  from: string;
  subject: string;
  body: string;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "";
  const anthropic = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_DIGEST_MODEL ?? "claude-haiku-4-5";
  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          "Redactá una respuesta breve en español latinoamericano neutro.",
          "Tono profesional y cercano. Sin firma corporativa larga. No inventes hechos.",
          `De: ${args.from}`,
          `Asunto: ${args.subject}`,
          args.body.slice(0, 6000),
        ].join("\n"),
      },
    ],
  });
  return response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
}
