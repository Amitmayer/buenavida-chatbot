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
  drafts: "bg-[#5B8FA8]",
  archived: "bg-gold",
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
    sent: counts.sent,
    drafts: counts.drafts,
    archived: counts.archived,
  };

  return (
    <div className="px-3">
      <p className="px-2 pb-2 font-mono text-[9.5px] tracking-[0.16em] text-cream/45">
        {es.correo.boxes.toUpperCase()}
      </p>
      <ul className="flex flex-col gap-1">
        {MAIL_FOLDERS.map((id) => {
          const on = folder === id;
          return (
            <li key={id}>
              <Link
                href={correoHref({ folder: id, filter: id === "sent" || id === "drafts" ? "all" : filter, query })}
                className={cn(
                  "flex items-center gap-2 rounded-full px-2.5 py-[9px] text-[13px]",
                  on ? "bg-cream text-pine" : "text-cream/85 hover:bg-cream/[0.08] hover:text-cream",
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[id])} />
                <span className="min-w-0 flex-1 truncate">{FOLDER_LABEL[id]}</span>
                {badge[id] > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 font-mono text-[10px]",
                      on ? "bg-overdue text-paper" : "bg-overdue/90 text-paper",
                    )}
                  >
                    {badge[id]}
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
