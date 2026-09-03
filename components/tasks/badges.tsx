import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export function TeamBadge({ name }: { slug?: string; name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-wash px-2.5 py-0.5 text-[11px] text-[#3C5540]">
      {name}
    </span>
  );
}

const LEVEL: Record<keyof typeof es.priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export function PriorityBars({
  priority,
  compact,
}: {
  priority: keyof typeof es.priority;
  compact?: boolean;
}) {
  const filled = LEVEL[priority];
  const h = compact ? "h-[9px]" : "h-[11px]";
  const w = compact ? "w-[3px]" : "w-1";
  return (
    <span className="inline-flex items-center gap-1.5" title={es.priority[priority]}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn(h, w, n <= filled ? "bg-ink" : "bg-mist")}
          />
        ))}
      </span>
      {compact ? null : (
        <span className="text-[12px] font-medium text-ink">{es.priority[priority]}</span>
      )}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: keyof typeof es.priority }) {
  return (
    <span className="text-ink">
      <span className="sr-only">{es.priority[priority]}</span>
      <PriorityBars priority={priority} compact />
    </span>
  );
}

export function DueBadge({
  ymd,
  kind,
  label,
}: {
  ymd: string | null;
  kind: "none" | "overdue" | "today" | "upcoming";
  label: string;
}) {
  if (kind === "none" || !ymd) return null;
  return (
    <span
      className={
        kind === "overdue"
          ? "font-mono text-[10.5px] font-medium text-overdue"
          : "font-mono text-[10.5px] text-ink/45"
      }
    >
      {label}
    </span>
  );
}
