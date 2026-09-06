"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/nav/nav-links";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileMenu } from "@/components/nav/profile-menu";
import { AreaLinks } from "@/components/nav/area-links";
import { SidebarToggle, SidebarUi } from "@/components/nav/sidebar-ui";
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

const SIDE = 264;

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
  const home = path === "/hoy";
  const hideHeader = path.startsWith("/correo");
  const [open, setOpen] = useState(home);
  const [animate, setAnimate] = useState(false);
  const items = [
    ...ITEMS.filter((item) => {
      if (item.href === "/archivos") return showArchivos;
      if (item.href === "/correo") return showCorreo;
      return true;
    }),
    ...(showEquipo ? [{ href: "/equipo", label: es.nav.equipo }] : []),
  ];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setOpen(home);
  }, [home, path]);

  function persist(next: boolean) {
    if (home) {
      setOpen(true);
      return;
    }
    setOpen(next);
  }

  const sidebar = useMemo(
    () => ({
      open: home || open,
      locked: home,
      show: () => persist(true),
      hide: () => persist(false),
    }),
    [home, open],
  );

  return (
    <SidebarUi.Provider value={sidebar}>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper md:flex-row">
        <aside
          className={cn(
            "hidden h-full min-w-0 shrink-0 overflow-hidden bg-pine text-cream md:flex",
            animate ? "transition-[width] duration-300 ease-in-out" : "",
            home || open ? "w-[264px]" : "w-0",
          )}
        >
          <div
            className="flex h-full min-w-[264px] flex-col overflow-y-auto pb-5 pt-5"
            style={{ width: SIDE }}
          >
            <div className="flex items-start justify-between px-6">
              <Link href="/hoy" onClick={() => persist(true)} className="flex items-start gap-2 text-cream">
                <span>
                  <span className="block text-[22px] font-light leading-[0.94] tracking-[0.02em]">
                    {es.auth.buena.toUpperCase()}
                  </span>
                  <span className="flex items-end gap-1.5">
                    <span className="text-[22px] font-light leading-[0.94] tracking-[0.02em]">
                      {es.auth.vida.toUpperCase()}
                    </span>
                    <span className="pb-[3px] text-[9px] font-normal leading-[1.15] tracking-[0.04em]">
                      {es.auth.specialty.toUpperCase()}
                      <br />
                      {es.auth.coffee.toUpperCase()}
                    </span>
                  </span>
                </span>
                <span className="font-mono text-[12px] font-medium tracking-[0.18em] text-[#E0834A]">
                  {es.auth.os}
                </span>
              </Link>
              <SidebarToggle edge className="mt-1" />
            </div>

            <p className="mt-8 px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-[#E5B978]">
              {es.nav.work.toUpperCase()}
            </p>
            <div className="mt-3 px-4">
              <NavLinks
                items={items}
                variant="side"
                badges={mailCounts && mailCounts.unread > 0 ? { "/correo": mailCounts.unread } : undefined}
              />
            </div>
            {teams.length > 0 ? (
              <>
                <p className="mt-7 px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-[#E5B978]">
                  {es.nav.areas.toUpperCase()}
                </p>
                <div className="mt-2.5 min-h-0 flex-1 overflow-auto px-4">
                  <AreaLinks teams={teams} />
                </div>
              </>
            ) : (
              <div className="flex-1" />
            )}
            <div className="mt-auto px-4 pt-4">
              <ProfileMenu name={name} roleLabel={roleLabel} />
            </div>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {hideHeader ? null : <PageHeader conversationId={conversationId} teams={teams} />}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
          <nav className="z-20 shrink-0 border-t-2 border-ink/10 bg-paper px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-0.5 md:hidden">
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
