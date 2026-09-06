"use client";

import { createContext, useContext } from "react";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
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
  mark = "chevron",
}: {
  className?: string;
  edge?: boolean;
  mark?: "chevron" | "menu";
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
          : "text-[#5BA85F] hover:bg-[#5BA85F]/10 hover:text-[#3E8A42]",
        className,
      )}
    >
      {mark === "menu" ? (
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      ) : open ? (
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
      ) : (
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
      )}
    </button>
  );
}
