"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crRelativeStamp, crInstantYmd, todayYmd } from "@/lib/agent/dates";
import { cn } from "@/lib/utils";
import type { Email } from "@/lib/db/types";

function fromName(raw: string) {
  const trimmed = raw.trim();
  const quoted = trimmed.match(/^"?([^"<]+)"?\s*</);
  if (quoted) return quoted[1].trim();
  return trimmed.split("@")[0] ?? trimmed;
}

export function InboxList({ rows }: { rows: Email[] }) {
  const path = usePathname();
  const today = todayYmd();

  return (
    <ul>
      {rows.map((row) => {
        const href = `/correo/${row.id}`;
        const on = path === href;
        return (
          <li key={row.id}>
            <Link
              href={href}
              prefetch={false}
              className={cn(
                "block border-b border-line px-3.5 py-3 hover:bg-hover",
                on ? "bg-wash" : "",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "min-w-0 truncate text-[13px]",
                    row.unread ? "font-semibold text-ink" : "font-medium text-ink",
                  )}
                >
                  {fromName(row.from_address)}
                </p>
                <span className="shrink-0 font-mono text-[10px] text-ink/40">
                  {crRelativeStamp(crInstantYmd(row.occurred_at), today)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-ink">{row.subject || "—"}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-ink/50">
                {row.summary ?? row.snippet}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
