"use client";

import { createContext, useContext } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export const SidebarUi = createContext<{
  open: boolean;
  mobileOpen: boolean;
  locked: boolean;
  show: () => void;
  hide: () => void;
}>({
  open: false,
  mobileOpen: false,
  locked: false,
  show: () => undefined,
  hide: () => undefined,
});

export function useSidebarUi() {
  return useContext(SidebarUi);
}

export function SidebarToggle({
  className,
  edge = false,
}: {
  className?: string;
  edge?: boolean;
}) {
  const { open, mobileOpen, locked, show, hide } = useSidebarUi();

  if (edge) {
    // Close control inside the pine drawer.
    if (!mobileOpen && (locked || !open)) return null;
    return (
      <button
        type="button"
        aria-label={es.nav.hideSidebar}
        onClick={hide}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-cream/80 hover:bg-cream/10 hover:text-cream",
          !mobileOpen && locked && "md:hidden",
          !mobileOpen && !open && "md:hidden",
          className,
        )}
      >
        <X className="h-4 w-4 md:hidden" strokeWidth={2.25} />
        <ChevronLeft className="hidden h-4 w-4 md:block" strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={mobileOpen ? es.nav.hideSidebar : es.nav.showSidebar}
        onClick={mobileOpen ? hide : show}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#4A3728] hover:bg-[#4A3728]/10 hover:text-[#3D2B1F] md:hidden",
          className,
        )}
      >
        {mobileOpen ? (
          <X className="h-4 w-4" strokeWidth={2.25} />
        ) : (
          <Menu className="h-4 w-4" strokeWidth={2.25} />
        )}
      </button>
      {!locked && !open ? (
        <button
          type="button"
          aria-label={es.nav.showSidebar}
          onClick={show}
          className={cn(
            "hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#4A3728] hover:bg-[#4A3728]/10 hover:text-[#3D2B1F] md:flex",
            className,
          )}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      ) : null}
    </>
  );
}
