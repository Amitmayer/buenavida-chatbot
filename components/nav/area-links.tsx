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
    <div className="flex flex-col gap-px">
      {teams.map((team) => {
        const on = path.startsWith("/areas/") && current === team.slug;
        return (
          <Link
            key={team.id}
            href={`/areas/${team.slug}`}
            prefetch={false}
            onClick={() => setCurrent(team.slug)}
            className={
              on
                ? "relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[12.5px] text-cream"
                : "flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[12.5px] text-cream/78 hover:bg-cream/[0.06] hover:text-cream"
            }
          >
            {on ? (
              <span className="absolute inset-0 rounded-[8px] bg-cream/[0.11] shadow-[inset_2px_0_0_#C79350]" />
            ) : null}
            <span
              className="relative h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: teamEdge(team.slug) }}
            />
            <span className="relative min-w-0 flex-1 truncate">{team.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
