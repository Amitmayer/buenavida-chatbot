"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import {
  correoHref,
  FOLDER_LABEL,
  MAIL_FOLDERS,
  parseFolder,
  type MailCounts,
  type MailFilter,
  type MailFolder,
} from "@/lib/email/mailbox";

export function MailBoxes({
  counts,
  folder: folderProp,
  filter = "all",
  query = "",
  variant = "pine",
}: {
  counts: MailCounts;
  folder?: MailFolder;
  filter?: MailFilter;
  query?: string;
  variant?: "pine" | "paper";
}) {
  const path = usePathname();
  const params = useSearchParams();
  if (variant === "pine" && !path.startsWith("/correo")) return null;

  const folder = folderProp ?? parseFolder(params.get("buzon") ?? undefined);
  const badge: Record<MailFolder, number> = {
    inbox: counts.unread,
    sent: counts.sent,
    drafts: counts.drafts,
    archived: counts.archived,
  };

  return (
    <div className={variant === "paper" ? "px-2 pb-3 pt-4" : undefined}>
      <p
        className={cn(
          "px-2 pb-2 font-mono text-[9.5px] tracking-[0.16em]",
          variant === "pine" ? "pt-[22px] text-cream/40" : "text-ink/40",
        )}
      >
        {es.correo.boxes.toUpperCase()}
      </p>
      <ul className="flex flex-col gap-0.5">
        {MAIL_FOLDERS.map((id) => {
          const on = folder === id;
          return (
            <li key={id}>
              <Link
                href={correoHref({ folder: id, filter: variant === "paper" ? filter : "all", query })}
                className={cn(
                  "relative flex items-center justify-between rounded-[9px] px-2.5 py-[8px] text-[13px]",
                  variant === "pine"
                    ? on
                      ? "text-cream"
                      : "text-cream/78 hover:bg-cream/[0.07] hover:text-cream"
                    : on
                      ? "bg-pine text-cream"
                      : "text-ink/70 hover:bg-wash hover:text-ink",
                )}
              >
                {variant === "pine" && on ? (
                  <span className="absolute inset-0 rounded-[9px] bg-cream/[0.11] shadow-[inset_2px_0_0_#C79350]" />
                ) : null}
                <span className="relative">{FOLDER_LABEL[id]}</span>
                {badge[id] > 0 ? (
                  <span
                    className={cn(
                      "relative rounded-full px-1.5 font-mono text-[10px]",
                      variant === "pine" || on
                        ? "bg-overdue text-paper"
                        : "bg-ink/10 text-ink/70",
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
