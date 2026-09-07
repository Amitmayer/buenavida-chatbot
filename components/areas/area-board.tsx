"use client";

import { useMemo, useState } from "react";
import { es } from "@/lib/i18n/es";
import { todayYmd } from "@/lib/agent/dates";
import { TaskRow } from "@/components/tasks/task-row";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { TaskRow as TaskRowData } from "@/lib/session";

type Chip = "today" | "high" | "overdue" | "undated";

export function AreaBoard({
  tasks,
  peopleCount,
}: {
  tasks: TaskRowData[];
  peopleCount: number;
}) {
  const [on, setOn] = useState<Chip[]>([]);
  const today = todayYmd();
  const overdueCount = tasks.filter((task) => task.due_date && task.due_date < today).length;

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (on.includes("today") && task.due_date !== today) return false;
      if (on.includes("high") && task.priority !== "high" && task.priority !== "urgent") return false;
      if (on.includes("overdue") && !(task.due_date && task.due_date < today)) return false;
      if (on.includes("undated") && task.due_date) return false;
      return true;
    });
  }, [on, tasks, today]);

  function toggle(id: Chip) {
    setOn((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const chips: { id: Chip; label: string }[] = [
    { id: "today", label: es.areas.filterToday },
    { id: "high", label: es.areas.filterHigh },
    { id: "overdue", label: es.areas.filterOverdue },
    { id: "undated", label: es.areas.filterUndated },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-9">
      <div className="flex flex-wrap gap-2.5">
        {chips.map((chip) => {
          const active = on.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggle(chip.id)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] md:text-[15px]",
                active
                  ? "bg-ink font-semibold text-cream"
                  : "border-2 border-ink/20 font-medium text-ink hover:border-ink hover:bg-white",
              )}
            >
              {chip.label}
              {active ? <span className="opacity-70">×</span> : null}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-auto pt-6">
        {tasks.length === 0 ? (
          <EmptyState title={es.tasks.empty} hint={es.tasks.emptyHint} />
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-8 rounded-[22px] border-2 border-ink/12 bg-sheet px-8 py-10">
            <span className="hidden h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-gold md:flex">
              <span className="h-[30px] w-[30px] rounded-[8px] border-[3px] border-ink" />
            </span>
            <div className="min-w-0">
              <p className="text-[20px] font-bold text-ink md:text-[24px]">{es.areas.emptyFilters}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/75 md:text-[16px]">
                {es.areas.emptyFiltersHint}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setOn([])}
                  className="flex h-10 items-center rounded-[11px] bg-ink px-4 text-[14px] font-semibold text-cream md:text-[15px]"
                >
                  {es.areas.clearFilters}
                </button>
                <button
                  type="button"
                  onClick={() => setOn([])}
                  className="flex h-10 items-center rounded-[11px] border-2 border-ink/22 px-4 text-[14px] font-semibold text-ink hover:border-ink hover:bg-wash md:text-[15px]"
                >
                  {es.areas.seeAll}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line bg-sheet">
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} href={`/tareas/${task.id}`} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={es.areas.statOpen} value={String(tasks.length)} hint={es.areas.statOpenHint} />
        <Stat
          label={es.areas.statOverdue}
          value={String(overdueCount)}
          hint={es.areas.statOverdueHint}
          alert={overdueCount > 0}
        />
        <Stat label={es.areas.statPeople} value={String(peopleCount)} hint={es.areas.statPeopleHint} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[18px] border-2 border-ink/12 bg-wash px-6 py-[22px]">
      <p className="font-mono text-[12px] font-medium uppercase tracking-[0.18em] text-ink/70 md:text-[14px]">
        {label}
      </p>
      <p className={cn("mt-1.5 font-mono text-[26px] font-bold md:text-[30px]", alert ? "text-[#A8501F]" : "text-ink")}>
        {value}
      </p>
      <p className="mt-1 text-[14px] text-ink/75 md:text-[15px]">{hint}</p>
    </div>
  );
}
