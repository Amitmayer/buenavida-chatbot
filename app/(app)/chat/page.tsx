import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const supabase = await createClient();
  let { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) {
    const inserted = await supabase
      .from("conversations")
      .insert({ user_id: profile.id, title: es.chat.title })
      .select("*")
      .single();
    conversation = inserted.data;
  }
  if (!conversation) return null;
  const { data: messages } = await supabase
    .from("messages")
    .select("*, tool_calls(*)")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  const initial = (messages ?? []).flatMap((message) => {
    const items: Parameters<typeof ChatClient>[0]["initial"] = [
      { type: "text", id: message.id, role: message.role, text: message.content },
    ];
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    for (const call of calls) {
      items.push({
        type: "tool",
        tool: {
          id: call.id,
          name: call.name,
          status: call.status as "pending" | "ok" | "error",
          result: call.result as { ok?: boolean; data?: { id?: string; title?: string }; detail?: string } | undefined,
        },
      });
    }
    return items;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatClient conversationId={conversation.id} initial={initial} />
    </div>
  );
}
