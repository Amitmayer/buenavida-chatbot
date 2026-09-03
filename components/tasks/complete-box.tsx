"use client";

import { useTransition } from "react";
import { completeTaskAction } from "@/app/(app)/tareas/actions";
import { es } from "@/lib/i18n/es";

export function CompleteBox({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={es.tasks.markDone}
      disabled={pending}
      className="mt-0.5 h-5 w-5 shrink-0 rounded-[5px] border-2 border-ink/55 bg-sheet shadow-[inset_0_0_0_1px_rgba(23,48,31,0.12)] disabled:opacity-40"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        start(async () => {
          await completeTaskAction(taskId);
        });
      }}
    />
  );
}
