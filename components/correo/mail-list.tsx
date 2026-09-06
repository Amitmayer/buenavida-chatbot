import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { crDateLabel, crInstantYmd, crTimeLabel, todayYmd } from "@/lib/agent/dates";
import { cn } from "@/lib/utils";
import { correoHref, displayName, type MailFilter, type MailFolder } from "@/lib/email/mailbox";
import { mailBar } from "@/components/tasks/team-colors";
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
    <ul className="flex flex-col gap-2 px-4 py-1">
      {rows.map((row) => {
        const href = correoHref({ id: row.id, folder, filter, query });
        const on = selectedId === row.id;
        const who =
          folder === "sent" || folder === "drafts"
            ? row.to_addresses[0] ?? row.from_address
            : row.from_address;
        const unread = folder !== "sent" && folder !== "drafts" && row.unread;
        const bar = on ? "#C79350" : unread ? mailBar(row.from_address) : "rgba(14,33,25,0.2)";
        return (
          <li key={row.id}>
            <Link
              href={href}
              scroll={false}
              prefetch={false}
              className={cn(
                "flex gap-3 rounded-xl px-4 py-3.5",
                on
                  ? "bg-ink text-cream"
                  : unread
                    ? "border-2 border-ink/10 bg-white text-ink hover:border-ink"
                    : "border-2 border-ink/[0.08] bg-white/50 text-ink/80 hover:border-ink hover:bg-white",
              )}
            >
              <span className="w-1 shrink-0 rounded-[3px]" style={{ background: bar }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "min-w-0 truncate text-[14px] md:text-[15px]",
                      on || unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {folder === "sent" || folder === "drafts"
                      ? es.correo.toLine.replace("{name}", displayName(who))
                      : displayName(who)}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[13px]",
                      on ? "text-cream/75" : "text-ink/70",
                    )}
                  >
                    {stamp(row.occurred_at, today)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 truncate text-[13px] md:text-[14px]",
                    on ? "font-medium text-cream" : unread ? "font-medium text-ink" : "font-normal text-ink",
                  )}
                >
                  {row.subject || "—"}
                </p>
                <p
                  className={cn(
                    "mt-1 truncate text-[12px] md:text-[13px]",
                    on ? "text-cream/75" : "text-ink/70",
                  )}
                >
                  {row.summary ?? row.snippet}
                </p>
                {row.task_id ? (
                  <span
                    className={cn(
                      "mt-3 inline-block rounded-full px-3 py-1 text-[13px] font-semibold",
                      on ? "bg-gold text-ink" : "bg-gold/20 text-ink",
                    )}
                  >
                    {es.correo.taskCreated}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
