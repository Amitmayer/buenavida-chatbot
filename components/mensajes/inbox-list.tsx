"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { inboxHref, type InboxRow } from "@/lib/mensajes";
import { es } from "@/lib/i18n/es";
import { FEEDBACK_CHAT_ID } from "@/lib/constants";
import { crTimeLabel, crInstantYmd, todayYmd, crRelativeStamp } from "@/lib/agent/dates";
import { cn, initials } from "@/lib/utils";
import { teamEdge } from "@/components/tasks/team-colors";

export function InboxList({ rows }: { rows: InboxRow[] }) {
  const path = usePathname();
  const today = todayYmd();
  const unread = rows.filter((row) => row.unread > 0);
  const unreadIds = new Set(unread.map((row) => row.chat.id));
  const rest = rows.filter((row) => !unreadIds.has(row.chat.id));
  const sections = [
    { title: es.mensajes.unread, items: unread },
    {
      title: es.mensajes.announcements,
      items: rest.filter((row) => row.kind === "channel" && row.chat.slug === "general"),
    },
    { title: es.nav.areas, items: rest.filter((row) => row.kind === "team") },
    { title: es.mensajes.direct, items: rest.filter((row) => row.kind === "dm") },
    {
      title: es.mensajes.groups,
      items: rest
        .filter((row) => row.kind === "group")
        .sort((a, b) => Number(b.chat.id === FEEDBACK_CHAT_ID) - Number(a.chat.id === FEEDBACK_CHAT_ID)),
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div>
      {sections.map((section) => (
        <section key={section.title} className="px-3.5 pb-4">
          <p className="px-2 pb-2 font-mono text-[12px] font-medium tracking-[0.18em] text-ink/70">
            {section.title.toUpperCase()}
          </p>
          <ul className="flex flex-col gap-1.5">
            {section.items.map((row) => {
              const when = row.lastAt
                ? crInstantYmd(row.lastAt) === today
                  ? crTimeLabel(row.lastAt)
                  : crRelativeStamp(crInstantYmd(row.lastAt), today)
                : "";
              const announce = row.kind === "channel" && row.chat.slug === "general";
              const color = row.chat.slug ? teamEdge(row.chat.slug) : "#12281C";
              const href = inboxHref(row);
              const selected = path === href || path === `/mensajes/${row.chat.id}`;
              return (
                <li key={row.chat.id}>
                  <Link
                    href={href}
                    prefetch={false}
                    scroll={false}
                    className={
                      announce
                        ? "flex items-center gap-3.5 rounded-[14px] bg-gold px-4 py-3.5 text-ink"
                        : cn(
                            "flex items-center gap-3.5 rounded-[14px] border-2 bg-white px-4 py-3.5 hover:border-ink",
                            selected ? "border-ink" : "border-ink/10",
                          )
                    }
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-[14px] font-semibold text-white"
                      style={{ background: announce ? "#12281C" : color }}
                    >
                      {row.kind === "dm" ? initials(row.title) : row.title.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[17px] ${announce ? "font-bold" : "font-semibold"}`}>
                          {row.title}
                        </span>
                        <span className="shrink-0 font-mono text-[13px] text-ink/70">{when}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-[15px] ${announce ? "text-ink/80" : "text-ink/65"}`}>
                        {row.lastMessage ?? KIND[row.kind]}
                      </span>
                    </span>
                    {row.unread > 0 ? (
                      <span className="flex h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-overdue px-1.5 font-mono text-[13px] text-white">
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
  channel: es.canales.title,
};
