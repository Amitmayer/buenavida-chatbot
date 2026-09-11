import type { Chat } from "@/lib/db/types";

export type InboxRow = {
  chat: Chat;
  title: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  kind: Chat["kind"];
};

export function inboxHref(row: Pick<InboxRow, "kind" | "chat">): string {
  if (row.kind === "channel" && row.chat.slug) return `/canales/${row.chat.slug}`;
  return `/mensajes/${row.chat.id}`;
}

export function unreadChatTotal(rows: InboxRow[]): number {
  return rows.reduce((sum, row) => sum + row.unread, 0);
}
