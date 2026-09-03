import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[9px] border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-ink/45 focus-visible:outline-none focus-visible:border-ink",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
