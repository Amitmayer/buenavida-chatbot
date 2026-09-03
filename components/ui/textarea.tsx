import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-[9px] border border-line bg-sheet px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus-visible:outline-none focus-visible:border-ink",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
