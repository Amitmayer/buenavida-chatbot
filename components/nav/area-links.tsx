"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { teamEdge } from "@/components/tasks/team-colors";
import type { Team } from "@/lib/db/types";

export function AreaLinks({ teams }: { teams: Pick<Team, "id" | "slug" | "name">[] }) {
  const path = usePathname();
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const parts = window.location.pathname.split("/");
    setCurrent(parts[1] === "areas" ? (parts[2] ?? null) : null);
  }, [path]);

  return (
    <div className="flex flex-col gap-0.5">
      {teams.map((team) => {
        const on = path.startsWith("/areas/") && current === team.slug;
        const color = teamEdge(team.slug);
        return (
          <Link
            key={team.id}
            href={`/areas/${team.slug}`}
            onClick={() => setCurrent(team.slug)}
            className="flex h-[38px] items-center gap-3 rounded-[11px] px-3.5"
            style={on ? { background: "rgba(246,243,234,0.14)", boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className={`min-w-0 flex-1 truncate text-[16px] text-cream ${on ? "font-semibold" : "font-medium"}`}>
              {team.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
