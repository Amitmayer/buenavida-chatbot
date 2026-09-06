"use client";

import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { teamEdge } from "@/components/tasks/team-colors";
import {
  correoHref,
  FOLDER_LABEL,
  MAIL_FOLDERS,
  type MailCounts,
  type MailFilter,
  type MailFolder,
} from "@/lib/email/mailbox";
import type { Team } from "@/lib/db/types";

const DOT: Record<MailFolder, string> = {
  inbox: "bg-overdue",
  sent: "bg-sage",
  drafts: "bg-gold",
  archived: "bg-[#4F7FA8]",
};

export function MailBoxes({
  counts,
  folder,
  filter = "all",
  query = "",
  teams = [],
}: {
  counts: MailCounts;
  folder: MailFolder;
  filter?: MailFilter;
  query?: string;
  teams?: Pick<Team, "id" | "slug" | "name">[];
}) {
  const badge: Record<MailFolder, number> = {
    inbox: counts.unread,
    sent: 0,
    drafts: counts.drafts,
    archived: 0,
  };
  const muted: Record<MailFolder, number> = {
    inbox: 0,
    sent: 0,
    drafts: counts.drafts,
    archived: 0,
  };

  return (
    <div>
      <p className="px-6 font-mono text-[13px] font-medium tracking-[0.18em] text-gold">
        {es.correo.boxes.toUpperCase()}
      </p>
      <ul className="mt-3.5 flex flex-col gap-1.5 px-4">
        {MAIL_FOLDERS.map((id) => {
          const on = folder === id;
          return (
            <li key={id}>
              <Link
                href={correoHref({ folder: id, filter: id === "sent" || id === "drafts" ? "all" : filter, query })}
                className={cn(
                  "flex h-[52px] items-center gap-3.5 rounded-[13px] px-3.5",
                  on ? "bg-cream text-pine" : "text-cream/90 hover:bg-cream/[0.09]",
                )}
              >
                <span className={cn("h-[11px] w-[11px] shrink-0 rounded-full", DOT[id])} />
                <span className={cn("min-w-0 flex-1 truncate text-[18px]", on ? "font-semibold" : "font-normal")}>
                  {FOLDER_LABEL[id]}
                </span>
                {id === "inbox" && badge.inbox > 0 ? (
                  <span className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[9px] bg-overdue px-2 font-mono text-[14px] font-medium text-white">
                    {badge.inbox}
                  </span>
                ) : id !== "inbox" && muted[id] > 0 ? (
                  <span className={cn("font-mono text-[16px]", on ? "text-pine/60" : "text-cream/60")}>
                    {muted[id]}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {teams.length > 0 ? (
        <>
          <p className="mt-[34px] px-6 font-mono text-[13px] font-medium tracking-[0.18em] text-gold">
            {es.nav.areas.toUpperCase()}
          </p>
          <ul className="mt-3.5 flex flex-col gap-1 px-4">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/areas/${team.slug}`}
                  className="flex h-11 items-center gap-3.5 rounded-[11px] px-3.5 text-cream/90 hover:bg-cream/[0.09]"
                >
                  <span
                    className="h-[9px] w-[9px] shrink-0 rounded-full"
                    style={{ background: teamEdge(team.slug) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[17px]">{team.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
