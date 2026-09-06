import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { cn, initials } from "@/lib/utils";
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
import { MailSearch } from "@/components/correo/mailbox-toolbar";
import { ComposeButton } from "@/components/correo/compose-dialog";
import { MailBoxes } from "@/components/correo/mail-boxes";
import { AutoSync } from "@/components/correo/auto-sync";
import { SidebarToggle } from "@/components/nav/sidebar-ui";
import { MailDisconnect } from "@/components/correo/mail-disconnect";
import { EmptyState } from "@/components/empty-state";
import type { Email } from "@/lib/db/types";

export function MailWorkspace({
  name,
  address,
  rows,
  selected,
  counts,
  folder,
  filter,
  query,
  connect,
  html,
  canModify = false,
  autoSync = false,
}: {
  name: string;
  address: string;
  rows: Email[];
  selected: Email | null;
  counts: MailCounts;
  folder: MailFolder;
  filter: MailFilter;
  query: string;
  connect?: ReactNode;
  html?: string;
  canModify?: boolean;
  autoSync?: boolean;
}) {
  const emptyTitle = folder === "sent" ? es.correo.emptySent : es.correo.empty;
  const emptyHint = folder === "sent" ? es.correo.emptySentHint : es.correo.emptyHint;
  const folderCount =
    folder === "inbox" ? counts.inbox : folder === "drafts" ? counts.drafts : folder === "archived" ? counts.archived : 0;
  const filters: { id: MailFilter; label: string }[] = [
    {
      id: "all",
      label: folder === "sent" ? es.correo.filterAll : es.correo.filterAllCount.replace("{n}", String(folderCount)),
    },
    ...(folder === "sent" || folder === "drafts"
      ? []
      : [{ id: "unread" as const, label: es.correo.filterUnread }]),
    { id: "task", label: es.correo.filterTask },
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-cream">
      <div className="hidden shrink-0 flex-col items-center bg-cream pt-4 md:flex">
        <SidebarToggle className="mx-1.5" />
      </div>
      <aside className="hidden w-[220px] shrink-0 flex-col bg-pine text-cream md:flex">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h1 className="text-[20px] font-semibold tracking-tight">{es.correo.title}</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pt-3">
          {connect ? null : (
            <Suspense fallback={null}>
              <MailBoxes counts={counts} folder={folder} filter={filter} query={query} />
            </Suspense>
          )}
        </div>
        {connect ? null : (
          <div className="mt-auto border-t border-cream/10 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-[11px] font-semibold text-pine">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-cream">{name}</p>
                <p className="truncate font-mono text-[10px] text-cream/50">{address}</p>
              </div>
            </div>
            <MailDisconnect />
          </div>
        )}
      </aside>

      <section
        className={`min-w-0 border-r border-ink/10 bg-cream ${selected || connect ? "hidden md:flex md:w-[340px] md:shrink-0 md:flex-col" : "flex flex-1 flex-col"}`}
      >
        <div className="px-4 pb-3 pt-4 md:px-4">
          <div className="mb-3 flex items-center justify-between md:hidden">
            <h1 className="text-[20px] font-semibold text-ink">{es.correo.title}</h1>
          </div>
          {connect ? null : (
            <ComposeButton className="h-11 w-full rounded-[12px] bg-pine text-[13.5px] font-medium text-cream hover:bg-[#1B3A28]" />
          )}
          {connect ? null : (
            <div className="mt-3">
              <MailSearch folder={folder} filter={filter} query={query} />
            </div>
          )}
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
          {connect ? null : (
            <div className="mt-3 flex gap-1.5">
              {filters.map((item) => (
                <Link
                  key={item.id}
                  href={correoHref({ folder, filter: item.id, query })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px]",
                    filter === item.id ? "bg-pine font-medium text-cream" : "bg-wash text-ink/60 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          {canModify ? null : connect ? null : (
            <a href="/api/correo/connect" className="mt-2 block text-[11px] font-medium text-overdue">
              {es.correo.reconnect}
            </a>
          )}
        </div>
        <Suspense fallback={null}>
          <AutoSync run={autoSync} live={!connect} />
        </Suspense>
        <div className="min-h-0 flex-1 overflow-auto">
          {connect ? (
            <div className="px-4">{connect}</div>
          ) : rows.length === 0 ? (
            <div className="px-4">
              <EmptyState title={emptyTitle} hint={emptyHint} />
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
        {connect || folder === "sent" ? null : (
          <p className="px-4 py-2 text-[11px] text-ink/40">
            {es.correo.countLine.replace("{n}", String(rows.length)).replace("{u}", String(counts.unread))}
          </p>
        )}
      </section>

      {selected ? (
        <MailThread mail={selected} html={html ?? ""} folder={folder} filter={filter} query={query} />
      ) : connect ? null : (
        <div className="hidden min-w-0 flex-1 items-center justify-center bg-cream md:flex">
          <p className="text-[13px] text-ink/40">{es.correo.pick}</p>
        </div>
      )}
    </div>
  );
}
