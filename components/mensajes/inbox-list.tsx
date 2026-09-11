"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { inboxHref, type InboxRow } from "@/lib/inbox";
import { FEEDBACK_CHAT_ID } from "@/lib/constants";
import { useI18n } from "@/components/i18n/provider";
import { crTimeLabel, crInstantYmd, todayYmd, crRelativeStamp } from "@/lib/agent/dates";
import { cn, initials } from "@/lib/utils";
import { teamEdge } from "@/components/tasks/team-colors";

type Tab = "areas" | "direct";

function matchesQuery(row: InboxRow, query: string) {
  if (!query) return true;
  return `${row.title} ${row.lastMessage ?? ""}`.toLowerCase().includes(query);
}

function byRecency(a: InboxRow, b: InboxRow) {
  const feedback =
    Number(b.chat.id === FEEDBACK_CHAT_ID) - Number(a.chat.id === FEEDBACK_CHAT_ID);
  if (feedback !== 0) return feedback;
  return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  const path = usePathname();
  const { t } = useI18n();
  const today = todayYmd();
  const [tab, setTab] = useState<Tab>("areas");
  const [query, setQuery] = useState("");

  const areasUnread = rows
    .filter((row) => row.kind === "team" || row.kind === "channel")
    .reduce((sum, row) => sum + row.unread, 0);
  const directUnread = rows
    .filter((row) => row.kind === "dm" || row.kind === "group")
    .reduce((sum, row) => sum + row.unread, 0);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inTab = rows.filter((row) =>
      tab === "areas"
        ? row.kind === "team" || row.kind === "channel"
        : row.kind === "dm" || row.kind === "group",
    );
    return inTab.filter((row) => matchesQuery(row, q)).sort(byRecency);
  }, [rows, tab, query]);

  const kindLabel: Record<InboxRow["kind"], string> = {
    team: t.mensajes.teams,
    dm: t.mensajes.direct,
    group: t.mensajes.groups,
    channel: t.canales.title,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3.5 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55"
            strokeWidth={2.5}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.mensajes.search}
            aria-label={t.mensajes.search}
            className="h-[42px] w-full rounded-[11px] border-2 border-ink/15 bg-white pl-10 pr-3 text-[14px] outline-none placeholder:text-ink/55 focus:border-ink"
          />
        </div>
        <div className="mt-3 flex rounded-[11px] border-2 border-ink/15 bg-white p-0.5">
          {(
            [
              { id: "areas" as const, label: t.mensajes.tabAreas, unread: areasUnread },
              { id: "direct" as const, label: t.mensajes.tabDirect, unread: directUnread },
            ] as const
          ).map((option) => {
            const on = tab === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[14px] font-semibold transition-colors",
                  on ? "bg-ink text-cream" : "text-ink/65 hover:text-ink",
                )}
              >
                {option.label}
                {option.unread > 0 ? (
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1 font-mono text-[11px]",
                      on ? "bg-cream/20 text-cream" : "bg-overdue text-white",
                    )}
                  >
                    {option.unread}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-[15px] text-ink/65">
          {query.trim() ? t.mensajes.searchEmpty : t.mensajes.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 px-3.5 pb-4">
          {items.map((row) => {
            const when = row.lastAt
              ? crInstantYmd(row.lastAt) === today
                ? crTimeLabel(row.lastAt)
                : crRelativeStamp(crInstantYmd(row.lastAt), today)
              : "";
            const announce = row.kind === "channel" && row.chat.slug === "general";
            const color = row.chat.slug ? teamEdge(row.chat.slug) : "#12281C";
            const href = inboxHref(row);
            const selected = path === href || path === `/mensajes/${row.chat.id}`;
            const title = announce ? t.mensajes.announcements : row.title;
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
                    {row.kind === "dm" ? initials(title) : title.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[17px] ${announce ? "font-bold" : "font-semibold"}`}>
                        {title}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-ink/70">{when}</span>
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-[15px] ${announce ? "text-ink/80" : "text-ink/65"}`}
                    >
                      {row.lastMessage ?? kindLabel[row.kind]}
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
      )}
    </div>
  );
}
