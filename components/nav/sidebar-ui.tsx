"use client";

import { createContext, useContext } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export const SidebarUi = createContext<{
  open: boolean;
  locked: boolean;
  show: () => void;
  hide: () => void;
}>({
  open: false,
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
  const { open, locked, show, hide } = useSidebarUi();
  if (locked) return null;
  if (edge && !open) return null;
  if (!edge && open) return null;
  return (
    <button
      type="button"
      aria-label={open ? es.nav.hideSidebar : es.nav.showSidebar}
      onClick={open ? hide : show}
      className={cn(
        "hidden h-7 w-7 shrink-0 items-center justify-center rounded-full md:flex",
        edge
          ? "text-cream/80 hover:bg-cream/10 hover:text-cream"
          : "text-[#4A3728] hover:bg-[#4A3728]/10 hover:text-[#3D2B1F]",
        className,
      )}
    >
      {open ? (
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
      ) : (
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
      )}
    </button>
  );
}
