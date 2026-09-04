import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { captureError } from "@/lib/sentry";

type Client = SupabaseClient<Database>;

export async function postToGeneral(
  supabase: Client,
  args: {
    userId: string;
    body: string;
    taskId?: string | null;
    viaAssistant: boolean;
  },
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("kind", "channel")
    .eq("slug", "general")
    .maybeSingle();
  if (chatError || !chat) {
    captureError(chatError, { where: "postToGeneral.chat" });
    return { ok: false };
  }
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      chat_id: chat.id,
      sender_id: args.userId,
      content: args.body,
      via_assistant: args.viaAssistant,
      task_id: args.taskId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    captureError(error, { where: "postToGeneral.insert" });
    return { ok: false };
  }
  return { ok: true, id: data.id };
}
