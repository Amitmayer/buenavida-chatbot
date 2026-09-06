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
    <ul>
      {rows.map((row) => {
        const href = correoHref({ id: row.id, folder, filter, query });
        const on = selectedId === row.id;
        const who =
          folder === "sent" || folder === "drafts"
            ? row.to_addresses[0] ?? row.from_address
            : row.from_address;
        return (
          <li key={row.id}>
            <Link
              href={href}
              prefetch={false}
              className={cn(
                "flex gap-2.5 border-b border-ink/[0.06] px-4 py-3.5 hover:bg-hover",
                on ? "bg-wash" : "",
              )}
            >
              <span className="mt-1.5 w-2 shrink-0">
                {row.unread && folder === "inbox" ? (
                  <span className="block h-1.5 w-1.5 rounded-full bg-[#E07A3D]" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "min-w-0 truncate text-[13px]",
                      row.unread ? "font-semibold text-ink" : "font-medium text-ink",
                    )}
                  >
                    {displayName(who)}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-ink/40">
                    {stamp(row.occurred_at, today)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-ink">{row.subject || "—"}</p>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-ink/45">
                  {row.summary ?? row.snippet}
                </p>
                {row.task_id ? (
                  <span className="mt-1.5 inline-block rounded-full bg-pine/10 px-2 py-0.5 text-[10.5px] text-pine">
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
