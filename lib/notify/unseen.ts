import { displayName, inFolder } from "@/lib/email/mailbox";
import { clipPreview } from "@/lib/notify/preview";
import { inboxHref, type InboxRow } from "@/lib/inbox";
import { es } from "@/lib/i18n/es";
import type { Email } from "@/lib/db/types";

export type Notice = {
  id: string;
  kind: "chat" | "mail";
  href: string;
  from: string;
  title: string;
  unread: number;
  at: string;
};

export function noticesFromInbox(rows: InboxRow[]): Notice[] {
  return rows
    .filter((row) => row.unread > 0)
    .map((row) => ({
      id: `chat:${row.chat.id}`,
      kind: "chat" as const,
      href: inboxHref(row),
      from: row.title,
      title: clipPreview(row.lastMessage ?? "") || es.notify.chat,
      unread: row.unread,
      at: row.lastAt ?? "",
    }));
}

export function noticesFromMail(
  rows: Pick<
    Email,
    | "id"
    | "from_address"
    | "subject"
    | "snippet"
    | "occurred_at"
    | "unread"
    | "inbound"
    | "archived"
    | "is_draft"
    | "gmail_id"
  >[],
): Notice[] {
  return rows
    .filter((row) => inFolder(row, "inbox") && row.unread)
    .map((row) => ({
      id: `mail:${row.id}`,
      kind: "mail" as const,
      href: `/correo/${row.id}`,
      from: displayName(row.from_address),
      title: clipPreview(row.subject) || clipPreview(row.snippet) || es.notify.noSubject,
      unread: 1,
      at: row.occurred_at,
    }));
}
