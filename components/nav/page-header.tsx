"use client";

import { usePathname } from "next/navigation";
import { es, teamBlurb } from "@/lib/i18n/es";
import { crStampLabel, todayYmd } from "@/lib/agent/dates";
import { CaptureBox } from "@/components/hoy/capture-box";
import { GlobalSearch } from "@/components/nav/global-search";
import { SidebarToggle } from "@/components/nav/sidebar-ui";
import { ChatHistoryButton } from "@/components/chat/chat-history";
import type { Team } from "@/lib/db/types";

const HEADS: Record<string, () => [string, string]> = {
  "/hoy": () => [es.hoy.title, crStampLabel(todayYmd())],
  "/canales": () => [es.canales.title, ""],
  "/mensajes": () => [es.mensajes.title, ""],
  "/chat": () => [es.chat.title, crStampLabel(todayYmd())],
  "/tareas": () => [es.tasks.title, ""],
  "/archivos": () => [es.files.title, ""],
  "/equipo": () => [es.team.title, ""],
};

export function PageHeader({
  conversationId,
  teams = [],
}: {
  conversationId: string | null;
  teams?: Pick<Team, "slug" | "name">[];
}) {
  const path = usePathname();
  const areaSlug = path.startsWith("/areas/") ? path.split("/")[2] : null;
  const area = teams.find((team) => team.slug === areaSlug);
  const key = Object.keys(HEADS).find((href) => path === href || path.startsWith(`${href}/`)) ?? "/hoy";
  const [fallbackTitle, fallbackSub] = HEADS[key]();
  const title = area?.name ?? (path.startsWith("/areas") ? es.nav.areas : fallbackTitle);
  const blurb = teamBlurb(area?.slug);
  const subtitle = area ? "" : fallbackSub;

  return (
    <header className="flex h-[56px] shrink-0 items-center gap-2.5 border-b-2 border-ink/15 bg-wash px-4 md:h-[72px] md:gap-3 md:px-7">
      <SidebarToggle className="-ml-1" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <div className="truncate text-[20px] font-bold tracking-tight text-ink md:text-[26px]">{title}</div>
          {blurb ? (
            <p className="hidden min-w-0 truncate text-[14px] font-normal text-ink/70 md:block">{blurb}</p>
          ) : null}
        </div>
      </div>
      {subtitle ? (
        <div className="hidden font-mono text-[15px] font-medium text-ink/70 md:block">{subtitle}</div>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        {path.startsWith("/chat") ? <ChatHistoryButton /> : null}
        <GlobalSearch />
        {conversationId ? <CaptureBox conversationId={conversationId} trigger="button" /> : null}
      </div>
    </header>
  );
}
