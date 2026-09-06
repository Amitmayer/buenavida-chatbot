"use client";

import { createContext, useContext } from "react";
import { Menu } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export const FOCUS_PATHS = ["/mensajes", "/correo", "/chat"] as const;

export function isFocusPath(path: string) {
  return FOCUS_PATHS.some((href) => path === href || path.startsWith(`${href}/`));
}

export const SidebarUi = createContext<{
  collapsed: boolean;
  open: boolean;
  show: () => void;
  hide: () => void;
}>({
  collapsed: false,
  open: false,
  show: () => undefined,
  hide: () => undefined,
});

export function useSidebarUi() {
  return useContext(SidebarUi);
}

export function SidebarToggle({ className }: { className?: string }) {
  const { collapsed, open, show, hide } = useSidebarUi();
  if (!collapsed) return null;
  return (
    <button
      type="button"
      aria-label={open ? es.nav.hideSidebar : es.nav.showSidebar}
      onClick={open ? hide : show}
      className={cn(
        "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-wash md:flex",
        className,
      )}
    >
      <Menu className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
