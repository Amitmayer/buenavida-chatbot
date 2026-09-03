import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-wash px-2.5 py-0.5 text-xs font-medium text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
