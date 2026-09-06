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
import { MailListScroll } from "@/components/correo/mail-list-scroll";
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
    <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
      <aside className="hidden w-[264px] shrink-0 flex-col bg-forest text-cream md:flex">
        <div className="flex items-center gap-1.5 px-4 pt-5">
          <SidebarToggle className="h-9 w-9 text-cream hover:bg-cream/10 hover:text-cream" />
          <h1 className="text-[22px] font-semibold tracking-[0.01em]">{es.correo.title}</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pt-[34px]">
          {connect ? null : (
            <Suspense fallback={null}>
              <MailBoxes
                counts={counts}
                folder={folder}
                filter={filter}
                query={query}
              />
            </Suspense>
          )}
        </div>
        {connect ? null : (
          <div className="px-4 pb-6">
            <div className="rounded-[14px] bg-cream/[0.08] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold font-mono text-[14px] font-semibold text-pine">
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-cream">{name}</p>
                  <p className="truncate font-mono text-[13px] text-cream/65">{address}</p>
                </div>
              </div>
              <MailDisconnect />
            </div>
          </div>
        )}
      </aside>

      <section
        className={`min-w-0 border-r-2 border-ink/15 bg-wash ${selected || connect ? "hidden md:flex md:w-[340px] md:shrink-0 md:flex-col xl:w-[440px]" : "flex flex-1 flex-col"}`}
      >
        <div className="flex flex-col gap-3 px-4 pb-3 pt-5 md:px-5">
          <div className="flex items-center justify-between md:hidden">
            <h1 className="text-[22px] font-semibold text-ink">{es.correo.title}</h1>
          </div>
          {connect ? null : (
            <ComposeButton className="flex h-[44px] w-full items-center justify-center rounded-[11px] bg-ink text-[16px] font-semibold text-cream hover:bg-pine md:h-[48px] md:text-[17px]" />
          )}
          {connect ? null : <MailSearch folder={folder} filter={filter} query={query} />}
          <div className="flex gap-1 overflow-auto md:hidden">
            {MAIL_FOLDERS.map((id) => (
              <Link
                key={id}
                href={correoHref({ folder: id, filter: "all" })}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px]",
                  folder === id ? "bg-ink text-cream" : "border-2 border-ink/20 text-ink",
                )}
              >
                {FOLDER_LABEL[id]}
              </Link>
            ))}
          </div>
          {connect ? null : (
            <div className="flex flex-nowrap gap-2.5 overflow-x-auto">
              {filters.map((item) => (
                <Link
                  key={item.id}
                  href={correoHref({ folder, filter: item.id, query })}
                  className={cn(
                    "flex h-[34px] items-center rounded-full px-4 text-[13px] md:h-[36px] md:text-[14px]",
                    filter === item.id
                      ? "bg-ink font-semibold text-cream"
                      : "border-2 border-ink/20 font-medium text-ink hover:border-ink",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          {canModify ? null : connect ? null : (
            <a href="/api/correo/connect" className="text-[13px] font-medium text-overdue">
              {es.correo.reconnect}
            </a>
          )}
        </div>
        <Suspense fallback={null}>
          <AutoSync run={autoSync} live={!connect} />
        </Suspense>
        <MailListScroll resetKey={`${folder}:${filter}:${query}`}>
          {connect ? (
            <div className="px-5">{connect}</div>
          ) : rows.length === 0 ? (
            <div className="px-5">
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
        </MailListScroll>
        {connect || folder === "sent" ? null : (
          <p className="border-t-2 border-ink/10 px-5 py-3.5 font-mono text-[12px] font-medium text-ink/70 md:text-[13px]">
            {es.correo.countLine.replace("{n}", String(rows.length)).replace("{u}", String(counts.unread))}
          </p>
        )}
      </section>

      {selected ? (
        <MailThread mail={selected} html={html ?? ""} folder={folder} filter={filter} query={query} />
      ) : connect ? null : (
        <div className="hidden min-w-0 flex-1 items-center justify-center bg-paper md:flex">
          <p className="text-[16px] text-ink/55">{es.correo.pick}</p>
        </div>
      )}
    </div>
  );
}
