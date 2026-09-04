import { createClient } from "@/lib/supabase/server";
import type { ChannelSection, Chat, Profile, TaskPriority } from "@/lib/db/types";
import { captureError } from "@/lib/sentry";

export type ChannelRow = {
  chat: Chat;
  slug: string;
  title: string;
  section: ChannelSection;
  purpose: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  members: { user_id: string; full_name: string }[];
};

export type ChannelTask = {
  id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
};

export const SECTION_ORDER: ChannelSection[] = ["strategic", "ops", "company"];

export async function listChannels(userId: string): Promise<ChannelRow[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select("chat_id, last_read_at")
    .eq("user_id", userId);
  if (error) {
    captureError(error, { where: "listChannels.memberships" });
    throw error;
  }
  const chatIds = (memberships ?? []).map((row) => row.chat_id);
  if (chatIds.length === 0) return [];

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("*")
    .in("id", chatIds)
    .eq("kind", "channel")
    .order("sort_order", { ascending: true });
  if (chatsError) {
    captureError(chatsError, { where: "listChannels.chats" });
    throw chatsError;
  }
  const channels = (chats ?? []).filter(
    (chat): chat is Chat & { slug: string; section: ChannelSection } =>
      Boolean(chat.slug && chat.section),
  );
  if (channels.length === 0) return [];

  const ids = channels.map((chat) => chat.id);
  const [{ data: allMembers }, { data: messages }] = await Promise.all([
    supabase.from("chat_members").select("chat_id, user_id").in("chat_id", ids),
    supabase
      .from("chat_messages")
      .select("chat_id, sender_id, content, created_at")
      .in("chat_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  const peopleIds = [...new Set((allMembers ?? []).map((row) => row.user_id))];
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", peopleIds)
    : { data: [] as Pick<Profile, "id" | "full_name">[] };

  const lastByChat = new Map<string, { content: string; created_at: string }>();
  for (const message of messages ?? []) {
    if (!lastByChat.has(message.chat_id)) {
      lastByChat.set(message.chat_id, {
        content: message.content,
        created_at: message.created_at,
      });
    }
  }

  const rows: ChannelRow[] = [];
  for (const chat of channels) {
    const membership = (memberships ?? []).find((row) => row.chat_id === chat.id);
    const memberIds = (allMembers ?? [])
      .filter((row) => row.chat_id === chat.id)
      .map((row) => row.user_id);
    const unread = (messages ?? []).filter(
      (message) =>
        message.chat_id === chat.id &&
        message.sender_id !== userId &&
        membership != null &&
        message.created_at > membership.last_read_at,
    ).length;
    const last = lastByChat.get(chat.id);
    rows.push({
      chat,
      slug: chat.slug,
      title: chat.title ?? chat.slug,
      section: chat.section,
      purpose: chat.purpose,
      lastMessage: last?.content ?? null,
      lastAt: last?.created_at ?? chat.created_at,
      unread,
      members: memberIds.map((id) => ({
        user_id: id,
        full_name: (people ?? []).find((person) => person.id === id)?.full_name ?? "—",
      })),
    });
  }
  return rows;
}

export async function loadChannel(slug: string, userId: string) {
  const supabase = await createClient();
  const { data: chat, error } = await supabase
    .from("chats")
    .select("*")
    .eq("kind", "channel")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    captureError(error, { where: "loadChannel.chat" });
    throw error;
  }
  if (!chat || !chat.slug || !chat.section) return null;

  const [{ data: memberRows }, { data: messages }, { data: files }] = await Promise.all([
    supabase.from("chat_members").select("user_id, last_read_at").eq("chat_id", chat.id),
    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("channel_files")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false }),
  ]);
  const memberIds = (memberRows ?? []).map((row) => row.user_id);
  const { data: people } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] as Pick<Profile, "id" | "full_name">[] };

  await supabase
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("chat_id", chat.id)
    .eq("user_id", userId);

  const taskIds = [...new Set((messages ?? []).map((row) => row.task_id).filter((id): id is string => Boolean(id)))];
  const { data: tasks } = taskIds.length
    ? await supabase.from("tasks").select("id, title, due_date, priority").in("id", taskIds)
    : { data: [] };

  return {
    chat,
    slug: chat.slug,
    title: chat.title ?? chat.slug,
    section: chat.section,
    purpose: chat.purpose,
    members: (people ?? []).map((person) => ({
      user_id: person.id,
      full_name: person.full_name,
    })),
    messages: messages ?? [],
    files: files ?? [],
    tasks: (tasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      priority: task.priority,
    })),
  };
}

export function groupChannels(rows: ChannelRow[]) {
  return SECTION_ORDER.map((section) => ({
    section,
    rows: rows.filter((row) => row.section === section),
  })).filter((group) => group.rows.length > 0);
}
