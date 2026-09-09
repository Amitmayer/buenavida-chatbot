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
    <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
      <div
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col overflow-auto bg-wash md:w-[360px] md:border-r-2 md:border-ink/15 xl:w-[400px]",
          threadOpen && "hidden md:flex",
        )}
      >
        {sidebar}
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1 flex-col", threadOpen ? "flex" : "hidden md:flex")}>
        {children}
      </div>
    </div>
  );
}
