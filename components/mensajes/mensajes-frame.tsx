"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

export function MensajesFrame({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const threadOpen = Boolean(useSelectedLayoutSegment());

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col overflow-auto bg-sheet md:w-[320px] md:border-r md:border-line",
          threadOpen && "hidden md:flex",
        )}
      >
        {sidebar}
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          threadOpen ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </div>
    </div>
  );
}
