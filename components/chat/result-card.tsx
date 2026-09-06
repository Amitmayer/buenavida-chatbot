"use client";

import { resultCardState } from "@/lib/agent/result";
import { es } from "@/lib/i18n/es";
import { crDateLabel } from "@/lib/agent/dates";
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
      area?: string | null;
    };
    detail?: string;
  };
}) {
  const state = resultCardState(status);
  const task = result?.data;
  if (state === "guardando") {
    return (
      <div className="inline-flex items-center gap-3 rounded-[16px] bg-sage/80 px-[22px] py-4 text-white">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        <span className="font-mono text-[14px] font-medium tracking-[0.18em] uppercase">
          {es.resultCard.guardando}
        </span>
      </div>
    );
  }
  if (state === "no_se_guardo") {
    return (
      <div className="inline-flex max-w-full flex-col rounded-[16px] bg-overdue px-[22px] py-4 text-white">
        <span className="font-mono text-[14px] font-medium tracking-[0.18em] uppercase">
          {es.resultCard.noSeGuardo}
        </span>
        <p className="mt-1.5 text-[18px] font-semibold leading-snug">{result?.detail ?? name}</p>
      </div>
    );
  }
  const meta = [task?.area, task?.due_date ? crDateLabel(task.due_date) : null].filter(Boolean).join(" · ");
  const inner = (
    <div className="inline-flex max-w-full flex-wrap items-center gap-5 rounded-[16px] bg-sage px-[22px] py-4 text-white">
      <div className="min-w-0">
        <p className="font-mono text-[14px] font-medium uppercase tracking-[0.18em]">
          {task?.title ? es.resultCard.created : es.resultCard.guardado}
        </p>
        <p className="mt-1.5 text-[16px] font-semibold leading-snug md:text-[18px]">
          {task?.title ?? name}
        </p>
        {meta ? <p className="mt-1 font-mono text-[13px] md:text-[14px]">{meta}</p> : null}
      </div>
      {task?.id ? (
        <span className="flex h-9 items-center rounded-xl bg-white px-4 text-[14px] font-semibold text-ink">
          {es.resultCard.open}
        </span>
      ) : null}
    </div>
  );
  if (task?.id) {
    return (
      <Link href={`/tareas/${task.id}`} className="inline-flex max-w-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
