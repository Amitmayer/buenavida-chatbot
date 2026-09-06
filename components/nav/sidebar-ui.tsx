"use client";

import { createContext, useContext } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export const SidebarUi = createContext<{
  open: boolean;
  show: () => void;
  hide: () => void;
}>({
  open: false,
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
  const { open, show, hide } = useSidebarUi();
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
          ? "text-[#8FBF7A] hover:bg-cream/10 hover:text-[#B7D9A8]"
          : "text-pine hover:bg-pine/10",
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
