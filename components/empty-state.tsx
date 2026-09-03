import type { ReactNode } from "react";
import { es } from "@/lib/i18n/es";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-6">
      <p className="text-[15px] font-semibold leading-snug text-ink">{title}</p>
      {hint ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-mute">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadError() {
  return (
    <div className="rounded-md border border-overdue/40 bg-sheet px-4 py-8">
      <p className="text-[15px] font-semibold text-ink">{es.tasks.loadError}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-mute">{es.tasks.loadErrorHint}</p>
    </div>
  );
}
