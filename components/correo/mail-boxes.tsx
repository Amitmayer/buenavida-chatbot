"use client";

import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import {
  correoHref,
  FOLDER_LABEL,
  MAIL_FOLDERS,
  type MailCounts,
  type MailFilter,
  type MailFolder,
} from "@/lib/email/mailbox";

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
}: {
  counts: MailCounts;
  folder: MailFolder;
  filter?: MailFilter;
  query?: string;
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
      <p className="px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-gold">
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
                  "flex h-[44px] items-center gap-3 rounded-[11px] px-3",
                  on ? "bg-cream text-pine" : "text-cream/90 hover:bg-cream/[0.09]",
                )}
              >
                <span className={cn("h-[11px] w-[11px] shrink-0 rounded-full", DOT[id])} />
                <span className={cn("min-w-0 flex-1 truncate text-[15px]", on ? "font-semibold" : "font-normal")}>
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
    </div>
  );
}
