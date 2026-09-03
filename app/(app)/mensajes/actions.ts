"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { captureError } from "@/lib/sentry";
import { revalidatePath } from "next/cache";

export async function openDmAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const parsed = z.object({ user_id: z.string().uuid() }).safeParse({
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_or_get_dm", {
    p_other: parsed.data.user_id,
  });
  if (error || !data) {
    captureError(error, { where: "openDmAction" });
    return { ok: false as const, detail: "server_error" };
  }
  redirect(`/mensajes/${data}`);
}

export async function createGroupAction(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const title = String(formData.get("title") ?? "").trim();
  const memberIds = formData.getAll("member_ids").map(String).filter(Boolean);
  const parsed = z
    .object({
      title: z.string().min(1).max(80),
      member_ids: z.array(z.string().uuid()),
    })
    .safeParse({ title, member_ids: memberIds });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_chat", {
    p_title: parsed.data.title,
    p_member_ids: parsed.data.member_ids,
  });
  if (error || !data) {
    captureError(error, { where: "createGroupAction" });
    return { ok: false as const, detail: "server_error" };
  }
  redirect(`/mensajes/${data}`);
}

export async function sendChatMessageAction(chatId: string, content: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, detail: "forbidden" };
  const parsed = z
    .object({
      chatId: z.string().uuid(),
      content: z.string().trim().min(1).max(4000),
    })
    .safeParse({ chatId, content });
  if (!parsed.success) return { ok: false as const, detail: "validation" };
  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    chat_id: parsed.data.chatId,
    sender_id: profile.id,
    content: parsed.data.content,
  });
  if (error) {
    captureError(error, { where: "sendChatMessageAction" });
    return { ok: false as const, detail: "server_error" };
  }
  revalidatePath(`/mensajes/${parsed.data.chatId}`);
  revalidatePath("/mensajes");
  revalidatePath("/canales");
  revalidatePath("/areas");
  return { ok: true as const };
}
