import { createClient } from "@/lib/supabase/server";
import type { Chat, ChatMessage, Profile } from "@/lib/db/types";
import { captureError } from "@/lib/sentry";
import { es } from "@/lib/i18n/es";
import { FEEDBACK_CHAT_ID } from "@/lib/constants";

export type InboxRow = {
  chat: Chat;
  title: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  kind: Chat["kind"];
};

function titleFor(
  chat: Chat,
  people: Pick<Profile, "id" | "full_name">[],
  memberIds: string[],
  me: string,
): string {
  if (chat.kind === "team" || chat.kind === "group") {
    return chat.title ?? "Grupo";
  }
  const otherId = memberIds.find((id) => id !== me);
  return people.find((p) => p.id === otherId)?.full_name ?? "Chat";
}

export async function listInbox(userId: string, opts?: { isGuest?: boolean }): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select("chat_id, last_read_at")
    .eq("user_id", userId);
  if (error) {
    captureError(error, { where: "listInbox.memberships" });
    throw error;
  }
  const chatIds = (memberships ?? []).map((row) => row.chat_id);
  if (chatIds.length === 0) return [];

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("*")
    .in("id", chatIds);
  if (chatsError) {
    captureError(chatsError, { where: "listInbox.chats" });
    throw chatsError;
  }

  const { data: allMembers } = await supabase
    .from("chat_members")
    .select("chat_id, user_id")
    .in("chat_id", chatIds);
  const peopleIds = [...new Set((allMembers ?? []).map((row) => row.user_id))];
  const [{ data: people }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", peopleIds),
    supabase
      .from("chat_messages")
      .select("chat_id, sender_id, content, created_at, deleted_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false }),
  ]);

  const lastByChat = new Map<string, { content: string; created_at: string }>();
  const unreadByChat = new Map<string, number>();
  for (const message of messages ?? []) {
    if (message.deleted_at) continue;
    if (!lastByChat.has(message.chat_id)) {
      lastByChat.set(message.chat_id, {
        content: message.content,
        created_at: message.created_at,
      });
    }
  }

  const rows: InboxRow[] = [];
  for (const membership of memberships ?? []) {
    const chat = (chats ?? []).find((item) => item.id === membership.chat_id);
    if (!chat) continue;
    if (chat.kind === "channel" && (chat.slug !== "general" || opts?.isGuest)) continue;
    const memberIds = (allMembers ?? [])
      .filter((row) => row.chat_id === chat.id)
      .map((row) => row.user_id);
    let unread = unreadByChat.get(chat.id);
    if (unread === undefined) {
      unread = (messages ?? []).filter(
        (message) =>
          message.chat_id === chat.id &&
          !message.deleted_at &&
          message.sender_id !== userId &&
          message.created_at > membership.last_read_at,
      ).length;
      unreadByChat.set(chat.id, unread);
    }
    const last = lastByChat.get(chat.id);
    rows.push({
      chat,
      title:
        chat.id === FEEDBACK_CHAT_ID
          ? es.mensajes.feedback
          : chat.kind === "channel"
            ? es.mensajes.announcements
            : titleFor(chat, people ?? [], memberIds, userId),
      lastMessage: last?.content ?? null,
      lastAt: last?.created_at ?? chat.created_at,
      unread,
      kind: chat.kind,
    });
  }

  return rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function loadThread(chatId: string, userId: string) {
  const supabase = await createClient();
  const { data: chat, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .maybeSingle();
  if (error) {
    captureError(error, { where: "loadThread.chat" });
    throw error;
  }
  if (!chat) return null;

  const [{ data: memberRows }, { data: messages }] = await Promise.all([
    supabase.from("chat_members").select("user_id, last_read_at").eq("chat_id", chatId),
    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const memberIds = (memberRows ?? []).map((row) => row.user_id);
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", memberIds);

  await supabase
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .eq("user_id", userId);

  return {
    chat,
    title:
      chat.id === FEEDBACK_CHAT_ID
        ? es.mensajes.feedback
        : titleFor(chat, people ?? [], memberIds, userId),
    members: (people ?? []).map((person) => ({
      user_id: person.id,
      full_name: person.full_name,
    })),
    messages: (messages ?? []) as ChatMessage[],
  };
}

export async function loadTeamChat(teamId: string, userId: string) {
  const supabase = await createClient();
  const { data: chat, error } = await supabase
    .from("chats")
    .select("id")
    .eq("kind", "team")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) {
    captureError(error, { where: "loadTeamChat" });
    throw error;
  }
  if (!chat) return null;
  return loadThread(chat.id, userId);
}
