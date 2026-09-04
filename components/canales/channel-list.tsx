import Link from "next/link";
import { es } from "@/lib/i18n/es";
import type { ChannelRow } from "@/lib/canales";
import type { ChannelSection } from "@/lib/db/types";

const SECTION: Record<ChannelSection, string> = {
  strategic: es.canales.strategic,
  ops: es.canales.ops,
  company: es.canales.company,
};

export function ChannelList({
  groups,
  active,
}: {
  groups: { section: ChannelSection; rows: ChannelRow[] }[];
  active?: string;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-auto bg-sheet py-4">
      {groups.length === 0 ? (
        <p className="px-4 text-[13px] text-mute">{es.canales.empty}</p>
      ) : (
        groups.map((group) => (
          <div key={group.section} className="mb-3">
            <p className="px-4 pb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-ink/45">
              {SECTION[group.section].toUpperCase()}
            </p>
            <ul className="flex flex-col gap-px px-2">
              {group.rows.map((row) => {
                const on = active === row.slug;
                return (
                  <li key={row.chat.id}>
                    <Link
                      href={`/canales/${row.slug}`}
                      prefetch={false}
                      className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 ${
                        on ? "bg-wash font-medium text-ink" : "text-ink/70 hover:bg-hover hover:text-ink"
                      }`}
                    >
                      <span className="w-3 shrink-0 font-mono text-[11px] text-gold">#</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">
                        {row.slug === "general" ? es.canales.announcements : row.title}
                      </span>
                      {row.unread > 0 ? (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-overdue px-1 font-mono text-[9px] text-paper">
                          {row.unread}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  );
}
