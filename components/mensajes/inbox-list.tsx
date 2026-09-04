"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InboxRow } from "@/lib/mensajes";
import { es } from "@/lib/i18n/es";
import { crTimeLabel, crInstantYmd, todayYmd, crRelativeStamp } from "@/lib/agent/dates";
import { initials, cn } from "@/lib/utils";

export function InboxList({ rows }: { rows: InboxRow[] }) {
  const path = usePathname();
  const activeId = path.startsWith("/mensajes/") ? path.slice("/mensajes/".length) : "";
  const today = todayYmd();
  const sections = [
    {
      title: es.mensajes.announcements,
      items: rows.filter((row) => row.kind === "channel" && row.chat.slug === "general"),
    },
    { title: es.nav.areas, items: rows.filter((row) => row.kind === "team") },
    { title: es.mensajes.direct, items: rows.filter((row) => row.kind === "dm") },
    { title: es.mensajes.groups, items: rows.filter((row) => row.kind === "group") },
  ].filter((section) => section.items.length > 0);

  return (
    <div>
      {sections.map((section) => (
        <section key={section.title} className="border-b-2 border-line last:border-b-0">
          <p className="bg-wash px-3.5 py-2 font-mono text-[10px] tracking-[0.12em] text-ink/60">
            {section.title.toUpperCase()}
          </p>
          <ul>
            {section.items.map((row) => {
              const when = row.lastAt
                ? crInstantYmd(row.lastAt) === today
                  ? crTimeLabel(row.lastAt)
                  : crRelativeStamp(crInstantYmd(row.lastAt), today)
                : "";
              const square = row.kind !== "dm";
              return (
                <li key={row.chat.id} className="border-b border-line last:border-0">
                  <Link
                    href={`/mensajes/${row.chat.id}`}
                    scroll={false}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 hover:bg-hover",
                      activeId === row.chat.id && "bg-wash",
                    )}
                  >
                    <span
                      className={
                        square
                          ? "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#DDD8C6] text-[11.5px] font-semibold text-[#3C5540]"
                          : "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[11.5px] font-semibold text-[#3C5540]"
                      }
                    >
                      {row.kind === "dm" ? initials(row.title) : row.title.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{row.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-ink/40">{when}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink/55">
                        {row.lastMessage ?? KIND[row.kind]}
                      </span>
                    </span>
                    {row.unread > 0 ? (
                      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-overdue px-1 font-mono text-[10px] text-paper">
                        {row.unread}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const KIND: Record<InboxRow["kind"], string> = {
  team: es.mensajes.teams,
  dm: es.mensajes.direct,
  group: es.mensajes.groups,
  channel: es.nav.canales,
};
