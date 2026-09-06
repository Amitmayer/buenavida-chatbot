import { es } from "@/lib/i18n/es";
import type { Email } from "@/lib/db/types";
import { fold } from "@/lib/utils";

export const MAIL_FOLDERS = ["inbox", "sent", "drafts", "archived"] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

export const MAIL_FILTERS = ["all", "unread", "task"] as const;
export type MailFilter = (typeof MAIL_FILTERS)[number];

export const FOLDER_LABEL: Record<MailFolder, string> = {
  inbox: es.correo.inbox,
  sent: es.correo.sent,
  drafts: es.correo.drafts,
  archived: es.correo.archived,
};

export type FolderFlags = Pick<Email, "inbound" | "unread" | "archived" | "is_draft" | "gmail_id">;

export function isDraft(row: Pick<Email, "is_draft" | "gmail_id">) {
  return Boolean(row.is_draft) || row.gmail_id.startsWith("draft-");
}

export function isArchived(row: Pick<Email, "archived">) {
  return Boolean(row.archived);
}

export type MailCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  archived: number;
  unread: number;
};

export function parseFolder(value: string | undefined): MailFolder {
  return MAIL_FOLDERS.includes(value as MailFolder) ? (value as MailFolder) : "inbox";
}

export function parseFilter(value: string | undefined): MailFilter {
  return MAIL_FILTERS.includes(value as MailFilter) ? (value as MailFilter) : "all";
}

export function inFolder(row: FolderFlags, folder: MailFolder): boolean {
  if (folder === "drafts") return isDraft(row);
  if (isDraft(row)) return false;
  if (folder === "archived") return isArchived(row);
  if (isArchived(row)) return false;
  if (folder === "sent") return !row.inbound;
  return row.inbound;
}

export function folderOf(row: FolderFlags): MailFolder {
  if (isDraft(row)) return "drafts";
  if (isArchived(row)) return "archived";
  if (!row.inbound) return "sent";
  return "inbox";
}

export function countFolders(rows: FolderFlags[]): MailCounts {
  return {
    inbox: rows.filter((row) => inFolder(row, "inbox")).length,
    sent: rows.filter((row) => inFolder(row, "sent")).length,
    drafts: rows.filter((row) => inFolder(row, "drafts")).length,
    archived: rows.filter((row) => inFolder(row, "archived")).length,
    unread: rows.filter((row) => inFolder(row, "inbox") && row.unread).length,
  };
}

export function filterMails(
  rows: Email[],
  args: { folder: MailFolder; filter: MailFilter; query: string },
): Email[] {
  const needle = fold(args.query.trim());
  return rows.filter((row) => {
    if (!inFolder(row, args.folder)) return false;
    if (args.filter === "unread" && !row.unread) return false;
    if (args.filter === "task" && !row.task_id) return false;
    if (!needle) return true;
    return fold(
      [row.subject, row.from_address, row.snippet, row.body_text, row.to_addresses.join(" ")].join(" "),
    ).includes(needle);
  });
}

export function displayName(raw: string) {
  const trimmed = raw.trim();
  const quoted = trimmed.match(/^"?([^"<]+)"?\s*</);
  if (quoted) return quoted[1].trim();
  if (trimmed.includes("@")) return trimmed.split("@")[0] ?? trimmed;
  return trimmed || "—";
}

export function displayAddress(raw: string) {
  return raw.match(/<([^>]+)>/)?.[1] ?? raw;
}

export function correoHref(args: {
  id?: string;
  folder: MailFolder;
  filter: MailFilter;
  query?: string;
}) {
  const params = new URLSearchParams();
  if (args.folder !== "inbox") params.set("buzon", args.folder);
  if (args.filter !== "all") params.set("filtro", args.filter);
  if (args.query?.trim()) params.set("q", args.query.trim());
  const qs = params.toString();
  const base = args.id ? `/correo/${args.id}` : "/correo";
  return qs ? `${base}?${qs}` : base;
}
