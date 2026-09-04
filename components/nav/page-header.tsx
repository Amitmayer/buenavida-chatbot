"use client";

import { usePathname } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { crStampLabel, todayYmd } from "@/lib/agent/dates";
import { CaptureBox } from "@/components/hoy/capture-box";
import { GlobalSearch } from "@/components/nav/global-search";
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
  const subtitle = area ? es.areas.chat : fallbackSub;

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur-[6px] md:gap-4 md:px-7">
      <div className="min-w-0 flex-1">
        <div className="truncate text-title text-ink">{title}</div>
      </div>
      {subtitle ? (
        <div className="hidden font-mono text-[11px] text-ink/45 md:block">{subtitle}</div>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <GlobalSearch />
        {conversationId ? <CaptureBox conversationId={conversationId} trigger="button" /> : null}
      </div>
    </header>
  );
}
