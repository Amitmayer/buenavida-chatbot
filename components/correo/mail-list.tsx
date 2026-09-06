import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { crDateLabel, crInstantYmd, crTimeLabel, todayYmd } from "@/lib/agent/dates";
import { cn } from "@/lib/utils";
import { correoHref, displayName, type MailFilter, type MailFolder } from "@/lib/email/mailbox";
import type { Email } from "@/lib/db/types";

function stamp(iso: string, today: string) {
  const ymd = crInstantYmd(iso);
  if (ymd === today) return crTimeLabel(iso);
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const ymdY = yesterday.toISOString().slice(0, 10);
  if (ymd === ymdY) return es.correo.yesterday;
  return crDateLabel(ymd);
}

export function MailList({
  rows,
  selectedId,
  folder,
  filter,
  query,
}: {
  rows: Email[];
  selectedId?: string;
  folder: MailFolder;
  filter: MailFilter;
  query: string;
}) {
  const today = todayYmd();
  return (
    <ul className="flex flex-col gap-2 px-3 py-3">
      {rows.map((row) => {
        const href = correoHref({ id: row.id, folder, filter, query });
        const on = selectedId === row.id;
        const who =
          folder === "sent" || folder === "drafts"
            ? row.to_addresses[0] ?? row.from_address
            : row.from_address;
        const showUnread = folder !== "sent" && folder !== "drafts";
        return (
          <li key={row.id}>
            <Link
              href={href}
              prefetch={false}
              className={cn(
                "block rounded-[14px] border px-3.5 py-3.5",
                on
                  ? "border-pine bg-pine text-cream"
                  : "border-ink/10 bg-sheet text-ink hover:border-ink/20",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "min-w-0 truncate text-[13px]",
                    on
                      ? "font-semibold text-cream"
                      : showUnread && row.unread
                        ? "font-semibold text-ink"
                        : "font-medium text-ink",
                  )}
                >
                  {folder === "sent" || folder === "drafts"
                    ? es.correo.toLine.replace("{name}", displayName(who))
                    : displayName(who)}
                </p>
                <span className={cn("shrink-0 font-mono text-[10px]", on ? "text-cream/55" : "text-ink/40")}>
                  {stamp(row.occurred_at, today)}
                </span>
              </div>
              <p className={cn("mt-1 truncate text-[12.5px]", on ? "text-cream" : "text-ink")}>
                {row.subject || "—"}
              </p>
              <p className={cn("mt-0.5 line-clamp-1 text-[12px]", on ? "text-cream/60" : "text-ink/45")}>
                {row.summary ?? row.snippet}
              </p>
              {row.task_id ? (
                <span
                  className={cn(
                    "mt-2 inline-block rounded-full px-2 py-0.5 text-[10.5px]",
                    on ? "bg-overdue text-paper" : "bg-overdue/15 text-overdue",
                  )}
                >
                  {es.correo.taskCreated}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
