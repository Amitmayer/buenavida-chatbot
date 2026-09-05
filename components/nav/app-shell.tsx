"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { NavLinks } from "@/components/nav/nav-links";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileMenu } from "@/components/nav/profile-menu";
import { AreaLinks } from "@/components/nav/area-links";
import { es } from "@/lib/i18n/es";
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
}: {
  children: ReactNode;
  name: string;
  roleLabel: string;
  teams: Pick<Team, "id" | "slug" | "name">[];
  showEquipo: boolean;
  showArchivos: boolean;
  showCorreo?: boolean;
  conversationId: string | null;
}) {
  const items = [
    ...ITEMS.filter((item) => {
      if (item.href === "/archivos") return showArchivos;
      if (item.href === "/correo") return showCorreo;
      return true;
    }),
    ...(showEquipo ? [{ href: "/equipo", label: es.nav.equipo }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper md:flex-row">
      <aside className="hidden w-[252px] shrink-0 flex-col bg-pine px-3.5 pb-3.5 pt-[18px] text-cream md:flex">
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
        <NavLinks items={items} variant="side" />
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
        <PageHeader conversationId={conversationId} teams={teams} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        <nav className="z-20 shrink-0 border-t border-ink/10 bg-paper px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-0.5 md:hidden">
          <NavLinks items={items} variant="tab" />
        </nav>
      </div>
    </div>
  );
}
