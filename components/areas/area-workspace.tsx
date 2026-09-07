"use client";

import { useState, type ReactNode } from "react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

export function AreaWorkspace({
  tasks,
  chat,
}: {
  tasks: ReactNode;
  chat: ReactNode;
}) {
  const [tab, setTab] = useState<"tasks" | "chat">("tasks");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-line md:hidden">
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className={cn(
            "flex-1 py-2.5 text-[13px]",
            tab === "tasks" ? "border-b-2 border-gold font-semibold text-ink" : "text-ink/50",
          )}
        >
          {es.areas.tasks}
        </button>
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={cn(
            "flex-1 py-2.5 text-[13px]",
            tab === "chat" ? "border-b-2 border-gold font-semibold text-ink" : "text-ink/50",
          )}
        >
          {es.areas.chat}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className={cn("min-h-0 min-w-0 flex-1 overflow-auto", tab !== "tasks" && "hidden md:block")}>
          {tasks}
        </div>
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-ink/15 bg-wash md:w-[360px] md:border-l-2 xl:w-[400px]",
            tab !== "chat" && "hidden md:flex",
            tab === "chat" && "flex",
          )}
        >
          {chat}
        </div>
      </div>
    </div>
  );
}
