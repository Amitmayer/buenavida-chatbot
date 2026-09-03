"use client";

import { resultCardState } from "@/lib/agent/result";
import { es } from "@/lib/i18n/es";
import { crDateLabel } from "@/lib/agent/dates";
import { PriorityBars } from "@/components/tasks/badges";
import Link from "next/link";

export function ResultCard({
  status,
  name,
  result,
}: {
  status: "pending" | "ok" | "error";
  name: string;
  result?: {
    ok?: boolean;
    data?: {
      id?: string;
      title?: string;
      due_date?: string | null;
      priority?: "low" | "medium" | "high" | "urgent";
    };
    detail?: string;
  };
}) {
  const state = resultCardState(status);
  const task = result?.data;
  if (state === "guardando") {
    return (
      <div className="overflow-hidden rounded-md border border-ink/10 bg-sheet">
        <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-3.5 py-2.5">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-mute/40 border-t-transparent" />
          <span className="font-mono text-[10px] tracking-[0.13em] text-ink/45">
            {es.resultCard.guardando.toUpperCase()}
          </span>
        </div>
        <div className="px-3.5 py-3.5">
          <div className="h-[11px] w-[70%] rounded-sm bg-wash" />
          <div className="mt-2 h-[9px] w-[42%] rounded-sm bg-mist" />
        </div>
      </div>
    );
  }
  if (state === "no_se_guardo") {
    return (
      <div className="overflow-hidden rounded-md border border-overdue/40 bg-sheet">
        <div className="flex items-center gap-2.5 border-b border-overdue/20 px-3.5 py-2.5">
          <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-overdue" />
          <span className="font-mono text-[10px] tracking-[0.13em] text-overdue">
            {es.resultCard.noSeGuardo.toUpperCase()}
          </span>
        </div>
        <div className="px-3.5 py-3.5">
          <p className="text-[14px] font-medium leading-snug text-ink">{result?.detail ?? name}</p>
        </div>
      </div>
    );
  }
  const inner = (
    <>
      <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-3.5 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.13em] text-ink/45">
          {(task?.title ? es.resultCard.proposed : es.resultCard.guardado).toUpperCase()}
        </span>
      </div>
      <div className="px-3.5 py-3.5">
        {task?.title ? (
          <p className="text-[13.5px] font-medium leading-snug text-ink">{task.title}</p>
        ) : (
          <p className="text-[13.5px] font-medium text-ink">{name}</p>
        )}
        {task?.due_date || task?.priority ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {task.due_date ? (
              <span className="rounded-full bg-wash px-2.5 py-0.5 text-[11px] text-[#3C5540]">
                {crDateLabel(task.due_date)}
              </span>
            ) : null}
            {task.priority ? (
              <span className="rounded-full bg-wash px-2.5 py-0.5 text-[11px] text-[#3C5540]">
                <PriorityBars priority={task.priority} compact />
              </span>
            ) : null}
          </div>
        ) : null}
        {task?.id ? (
          <p className="mt-3.5 inline-flex rounded-[8px] bg-pine px-3.5 py-1.5 text-[12px] text-cream">
            {es.resultCard.openTask}
          </p>
        ) : null}
      </div>
    </>
  );
  if (task?.id) {
    return (
      <Link
        href={`/tareas/${task.id}`}
        className="block overflow-hidden rounded-md border border-ink/10 bg-sheet"
      >
        {inner}
      </Link>
    );
  }
  return <div className="overflow-hidden rounded-md border border-ink/10 bg-sheet">{inner}</div>;
}
