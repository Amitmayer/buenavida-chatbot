"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/nav/nav-links";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileMenu } from "@/components/nav/profile-menu";
import { AreaLinks } from "@/components/nav/area-links";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { SidebarToggle, SidebarUi } from "@/components/nav/sidebar-ui";
import { IncomingAlerts } from "@/components/nav/incoming-alerts";
import { NoticeProvider } from "@/components/nav/notice-store";
import { NotificationBell } from "@/components/nav/notification-bell";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";
import type { MailCounts } from "@/lib/email/mailbox";
import type { Notice } from "@/lib/notify/unseen";
import type { Team } from "@/lib/db/types";

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
  chatUnread = 0,
  notices = [],
  userId,
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
  chatUnread?: number;
  notices?: Notice[];
  userId: string;
}) {
  const path = usePathname();
  const { t } = useI18n();
  const home = path === "/hoy";
  const section = path.split("/").filter(Boolean)[0] ?? "";
  const hideHeader = path.startsWith("/correo");
  const [open, setOpen] = useState(home);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const items = [
    { href: "/hoy", label: t.nav.hoy },
    { href: "/mensajes", label: t.nav.mensajes },
    ...(showCorreo ? [{ href: "/correo", label: t.nav.correo }] : []),
    { href: "/chat", label: t.nav.chat },
    { href: "/tareas", label: t.nav.tareas },
    ...(showArchivos ? [{ href: "/archivos", label: t.nav.archivos }] : []),
    ...(showEquipo ? [{ href: "/equipo", label: t.nav.equipo }] : []),
  ];
  const badges: Record<string, number> = {};
  if (chatUnread > 0) badges["/mensajes"] = chatUnread;
  if (mailCounts && mailCounts.unread > 0) badges["/correo"] = mailCounts.unread;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setOpen(home);
  }, [home, section]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function show() {
    setOpen(true);
    setMobileOpen(true);
  }

  function hide() {
    setMobileOpen(false);
    if (!home) setOpen(false);
  }

  const sidebar = useMemo(
    () => ({
      open: home || open,
      mobileOpen,
      locked: home,
      show,
      hide,
    }),
    [home, open, mobileOpen],
  );

  return (
    <NoticeProvider initial={notices}>
    <SidebarUi.Provider value={sidebar}>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper md:flex-row">
        <button
          type="button"
          aria-label={t.nav.hideSidebar}
          tabIndex={mobileOpen ? 0 : -1}
          className={cn(
            "fixed inset-0 z-30 bg-ink/40 transition-opacity md:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={hide}
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-full min-w-0 shrink-0 flex-col overflow-hidden bg-pine text-cream transition-transform duration-300 ease-in-out md:static md:z-auto md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
            animate ? "md:transition-[width]" : "md:transition-none",
            home || open ? "md:w-[264px]" : "md:w-0",
          )}
        >
          <div
            className="flex h-full min-w-[264px] flex-col overflow-y-auto pb-5 pt-5"
            style={{ width: SIDE }}
          >
            <div className="flex items-start justify-between px-6">
              <Link href="/hoy" onClick={show} className="flex items-start gap-2 text-cream">
                <span>
                  <span className="block text-[22px] font-light leading-[0.94] tracking-[0.02em]">
                    {t.auth.buena.toUpperCase()}
                  </span>
                  <span className="flex items-end gap-1.5">
                    <span className="text-[22px] font-light leading-[0.94] tracking-[0.02em]">
                      {t.auth.vida.toUpperCase()}
                    </span>
                    <span className="pb-[3px] text-[9px] font-normal leading-[1.15] tracking-[0.04em]">
                      {t.auth.specialty.toUpperCase()}
                      <br />
                      {t.auth.coffee.toUpperCase()}
                    </span>
                  </span>
                </span>
                <span className="font-mono text-[12px] font-medium tracking-[0.18em] text-[#E0834A]">
                  {t.auth.os}
                </span>
              </Link>
              <SidebarToggle edge className="mt-1" />
            </div>

            <p className="mt-8 px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-[#E5B978]">
              {t.nav.work.toUpperCase()}
            </p>
            <div className="mt-3 px-4">
              <NavLinks items={items} variant="side" badges={badges} />
            </div>
            {teams.length > 0 ? (
              <>
                <p className="mt-7 px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-[#E5B978]">
                  {t.nav.areas.toUpperCase()}
                </p>
                <div className="mt-2.5 min-h-0 flex-1 overflow-auto px-4">
                  <AreaLinks teams={teams} />
                </div>
              </>
            ) : (
              <div className="flex-1" />
            )}
            <div className="mt-auto px-4 pt-4">
              <LanguageSwitcher />
              <ProfileMenu name={name} roleLabel={roleLabel} />
            </div>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {hideHeader ? (
            <div className="flex h-[56px] shrink-0 items-center justify-end border-b-2 border-ink/15 bg-wash px-4 md:h-[72px] md:px-7">
              <SidebarToggle className="-ml-1 mr-auto" />
              <NotificationBell />
            </div>
          ) : (
            <PageHeader conversationId={conversationId} teams={teams} />
          )}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
          <IncomingAlerts userId={userId} watchMail={showCorreo} />
          <nav className="z-20 shrink-0 border-t-2 border-ink/10 bg-paper px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-0.5 md:hidden">
            <NavLinks items={items} variant="tab" badges={badges} />
          </nav>
        </div>
      </div>
    </SidebarUi.Provider>
    </NoticeProvider>
  );
}
