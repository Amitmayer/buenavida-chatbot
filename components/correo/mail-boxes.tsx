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
  type MailFolder,
} from "@/lib/email/mailbox";

export function MailBoxes({ counts }: { counts: MailCounts }) {
  const path = usePathname();
  const params = useSearchParams();
  if (!path.startsWith("/correo")) return null;

  const folder = parseFolder(params.get("buzon") ?? undefined);
  const badge: Record<MailFolder, number> = {
    inbox: counts.unread,
    sent: 0,
    drafts: counts.drafts,
    archived: 0,
  };

  return (
    <>
      <p className="px-2 pb-2 pt-[22px] font-mono text-[9.5px] tracking-[0.16em] text-cream/40">
        {es.correo.boxes.toUpperCase()}
      </p>
      <ul className="flex flex-col gap-0.5">
        {MAIL_FOLDERS.map((id) => {
          const on = folder === id;
          return (
            <li key={id}>
              <Link
                href={correoHref({ folder: id, filter: "all" })}
                className={cn(
                  "relative flex items-center justify-between rounded-[9px] px-2.5 py-[8px] text-[13px]",
                  on ? "text-cream" : "text-cream/78 hover:bg-cream/[0.07] hover:text-cream",
                )}
              >
                {on ? (
                  <span className="absolute inset-0 rounded-[9px] bg-cream/[0.11] shadow-[inset_2px_0_0_#C79350]" />
                ) : null}
                <span className="relative">{FOLDER_LABEL[id]}</span>
                {badge[id] > 0 ? (
                  <span className="relative rounded-full bg-[#E07A3D] px-1.5 font-mono text-[10px] text-cream">
                    {badge[id]}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
