import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { crStampLabel, todayYmd } from "@/lib/agent/dates";
import { cn } from "@/lib/utils";
import {
  correoHref,
  FOLDER_LABEL,
  MAIL_FOLDERS,
  type MailCounts,
  type MailFilter,
  type MailFolder,
} from "@/lib/email/mailbox";
import { MailList } from "@/components/correo/mail-list";
import { MailThread } from "@/components/correo/mail-thread";
import { MailboxToolbar } from "@/components/correo/mailbox-toolbar";
import { ComposeButton } from "@/components/correo/compose-dialog";
import { EmptyState } from "@/components/empty-state";
import type { Email } from "@/lib/db/types";
import type { ReactNode } from "react";

const FILTERS: { id: MailFilter; label: string }[] = [
  { id: "all", label: es.correo.filterAll },
  { id: "unread", label: es.correo.filterUnread },
  { id: "task", label: es.correo.filterTask },
];

export function MailWorkspace({
  address,
  rows,
  selected,
  counts,
  folder,
  filter,
  query,
  connect,
  html,
}: {
  address: string;
  rows: Email[];
  selected: Email | null;
  counts: MailCounts;
  folder: MailFolder;
  filter: MailFilter;
  query: string;
  connect?: ReactNode;
  html?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <section
        className={`min-w-0 border-r border-ink/10 bg-paper ${selected || connect ? "hidden md:flex md:w-[340px] md:shrink-0 md:flex-col" : "flex flex-1 flex-col"}`}
      >
        <div className="border-b border-ink/[0.06] px-4 pb-3 pt-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-ink">{es.correo.title}</h1>
              <p className="mt-0.5 font-mono text-[10.5px] text-ink/40">{crStampLabel(todayYmd())}</p>
            </div>
            {connect ? null : <ComposeButton />}
          </div>
          <form className="mt-3" action="/correo">
            <input type="hidden" name="buzon" value={folder} />
            <input type="hidden" name="filtro" value={filter} />
            <input
              name="q"
              defaultValue={query}
              placeholder={es.correo.search}
              className="h-10 w-full rounded-full border border-ink/10 bg-sheet px-3.5 text-[13px] outline-none focus:border-ink"
            />
          </form>
          <div className="mt-3 flex gap-1 overflow-auto md:hidden">
            {MAIL_FOLDERS.map((id) => (
              <Link
                key={id}
                href={correoHref({ folder: id, filter: "all" })}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px]",
                  folder === id ? "bg-pine text-cream" : "bg-wash text-ink/70",
                )}
              >
                {FOLDER_LABEL[id]}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-4">
            {FILTERS.map((item) => (
              <Link
                key={item.id}
                href={correoHref({ folder, filter: item.id, query })}
                className={cn(
                  "pb-1 text-[12.5px]",
                  filter === item.id
                    ? "border-b-2 border-pine font-semibold text-ink"
                    : "text-ink/45 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        {connect ? null : <MailboxToolbar address={address} />}
        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="px-4">
              <EmptyState title={es.correo.empty} hint={es.correo.emptyHint} />
            </div>
          ) : (
            <MailList
              rows={rows}
              selectedId={selected?.id}
              folder={folder}
              filter={filter}
              query={query}
            />
          )}
        </div>
        <p className="border-t border-ink/[0.06] px-4 py-2 text-[11px] text-ink/40">
          {es.correo.countLine.replace("{n}", String(rows.length)).replace("{u}", String(counts.unread))}
        </p>
      </section>

      {selected ? (
        <MailThread mail={selected} html={html ?? ""} folder={folder} filter={filter} query={query} />
      ) : connect ? (
        <div className="min-w-0 flex-1 overflow-auto bg-sheet">{connect}</div>
      ) : (
        <div className="hidden min-w-0 flex-1 items-center justify-center bg-sheet md:flex">
          <p className="text-[13px] text-ink/40">{es.correo.pick}</p>
        </div>
      )}
    </div>
  );
}
