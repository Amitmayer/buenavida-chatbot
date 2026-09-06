"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NavLinks } from "@/components/nav/nav-links";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileMenu } from "@/components/nav/profile-menu";
import { AreaLinks } from "@/components/nav/area-links";
import { MailBoxes } from "@/components/correo/mail-boxes";
import { isFocusPath, SidebarUi } from "@/components/nav/sidebar-ui";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import type { MailCounts } from "@/lib/email/mailbox";
import type { Team } from "@/lib/db/types";

const ITEMS = [
  { href: "/hoy", label: es.nav.hoy },
  { href: "/mensajes", label: es.nav.mensajes },
  { href: "/correo", label: es.nav.correo },
  { href: "/chat", label: es.nav.chat },
  { href: "/tareas", label: es.nav.tareas },
  { href: "/archivos", label: es.nav.archivos },
] as const;

const LOGO =
  "https://buenavida.coffee/cdn/shop/files/Buena_Vida_Logo_4d308f3b-91f9-4cd8-8293-5ee218e7fa08.png?v=1785126762";

export function AppShell({
  children,
  name,
  roleLabel,
  teams,
  showEquipo,
  showArchivos,
  showCorreo = false,
  conversationId,
  mailCounts,
}: {
  children: ReactNode;
  name: string;
  roleLabel: string;
  teams: Pick<Team, "id" | "slug" | "name">[];
  showEquipo: boolean;
  showArchivos: boolean;
  showCorreo?: boolean;
  conversationId: string | null;
  mailCounts?: MailCounts | null;
}) {
  const path = usePathname();
  const hideHeader = path.startsWith("/correo");
  const collapsed = isFocusPath(path);
  const [open, setOpen] = useState(false);
  const items = [
    ...ITEMS.filter((item) => {
      if (item.href === "/archivos") return showArchivos;
      if (item.href === "/correo") return showCorreo;
      return true;
    }),
    ...(showEquipo ? [{ href: "/equipo", label: es.nav.equipo }] : []),
  ];

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const sidebar = useMemo(
    () => ({
      collapsed,
      open,
      show: () => setOpen(true),
      hide: () => setOpen(false),
    }),
    [collapsed, open],
  );

  return (
    <SidebarUi.Provider value={sidebar}>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper md:flex-row">
        {collapsed && open ? (
          <button
            type="button"
            aria-label={es.nav.hideSidebar}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 hidden bg-ink/35 md:block"
          />
        ) : null}
        <aside
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className={cn(
            "relative flex-col bg-pine px-3.5 pb-3.5 pt-[18px] text-cream",
            collapsed
              ? open
                ? "fixed inset-y-0 left-0 z-40 flex w-[252px] shadow-[8px_0_32px_rgba(0,0,0,0.18)]"
                : "hidden"
              : "hidden w-[252px] shrink-0 md:flex",
          )}
        >
          {collapsed ? (
            <button
              type="button"
              aria-label={es.nav.hideSidebar}
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-cream/70 hover:bg-cream/10 hover:text-cream"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
          <Link href="/hoy" className="relative mb-5 block px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO}
              alt={es.appName}
              className="h-[88px] w-full object-contain object-left opacity-90 brightness-0 invert"
            />
            <span className="absolute right-1 top-3 font-mono text-[13px] font-medium leading-none tracking-[0.16em] text-[#E07A3D]">
              OS
            </span>
          </Link>
          <div className="mx-1.5 mb-3.5 h-px bg-cream/30" />
          <p className="px-2 pb-2 font-mono text-[9.5px] tracking-[0.16em] text-cream/40">
            {es.nav.work.toUpperCase()}
          </p>
          <NavLinks
            items={items}
            variant="side"
            badges={mailCounts && mailCounts.unread > 0 ? { "/correo": mailCounts.unread } : undefined}
          />
          {showCorreo && mailCounts ? (
            <Suspense fallback={null}>
              <MailBoxes counts={mailCounts} />
            </Suspense>
          ) : null}
          {teams.length > 0 ? (
            <>
              <p className="px-2 pb-2 pt-[22px] font-mono text-[9.5px] tracking-[0.16em] text-cream/40">
                {es.nav.areas.toUpperCase()}
              </p>
              <AreaLinks teams={teams} />
            </>
          ) : null}
          <div className="mt-auto pt-4">
            <ProfileMenu name={name} roleLabel={roleLabel} />
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {hideHeader ? null : <PageHeader conversationId={conversationId} teams={teams} />}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
          <nav className="z-20 shrink-0 border-t border-ink/10 bg-paper px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-0.5 md:hidden">
            <NavLinks
              items={items}
              variant="tab"
              badges={mailCounts && mailCounts.unread > 0 ? { "/correo": mailCounts.unread } : undefined}
            />
          </nav>
        </div>
      </div>
    </SidebarUi.Provider>
  );
}
