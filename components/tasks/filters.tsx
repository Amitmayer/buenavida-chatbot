"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { AppSelect } from "@/components/ui/select";
import type { Team } from "@/lib/db/types";
import type { Profile } from "@/lib/db/types";

const chip =
  "h-[34px] shrink-0 rounded-[9px] border border-line bg-sheet px-3.5 text-[12.5px] font-medium text-ink";
const chipOn = "h-[34px] shrink-0 rounded-[9px] bg-pine px-3.5 text-[12.5px] font-medium text-cream";
const selectOn = "border-transparent bg-pine text-cream hover:bg-pine";

export function TaskFilters({
  teams,
  people,
}: {
  teams: Team[];
  people: Pick<Profile, "id" | "full_name">[];
}) {
  const params = useSearchParams();
  const router = useRouter();

  const current = useMemo(
    () => ({
      team: params.get("team") ?? "",
      area: params.get("area") ?? "",
      assignee: params.get("assignee") ?? "",
      status: params.get("status") ?? "",
      due: params.get("due") ?? "all",
      historial: params.get("historial") === "1",
    }),
    [params],
  );

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/tareas?${next.toString()}`);
  }

  const selectedTeam = teams.find((t) => t.slug === current.team);
  const hasFilters = Boolean(
    current.team || current.area || current.assignee || current.status || current.due !== "all" || current.historial,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={!current.historial ? chipOn : chip}
        onClick={() => {
          const next = new URLSearchParams(params.toString());
          next.delete("historial");
          next.delete("status");
          router.push(`/tareas?${next.toString()}`);
        }}
      >
        {es.tasks.live}
      </button>
      <button
        type="button"
        className={current.historial ? chipOn : chip}
        onClick={() => {
          const next = new URLSearchParams(params.toString());
          next.set("historial", "1");
          if (current.status === "open" || current.status === "in_progress") next.delete("status");
          router.push(`/tareas?${next.toString()}`);
        }}
      >
        {es.tasks.history}
      </button>
      <button
        type="button"
        className={current.due === "week" ? chipOn : chip}
        onClick={() => update("due", current.due === "week" ? "" : "week")}
      >
        {es.tasks.weekDue}
      </button>
      <AppSelect
        size="chip"
        aria-label={es.tasks.team}
        value={current.team}
        placeholder={es.tasks.team}
        triggerClassName={current.team ? selectOn : undefined}
        onValueChange={(value) => update("team", value)}
        options={teams.map((team) => ({ value: team.slug, label: team.name }))}
      />
      <AppSelect
        size="chip"
        aria-label={es.tasks.area}
        value={current.area}
        placeholder={es.tasks.area}
        triggerClassName={current.area ? selectOn : undefined}
        onValueChange={(value) => update("area", value)}
        options={(selectedTeam?.areas ?? []).map((area) => ({ value: area, label: area }))}
      />
      <AppSelect
        size="chip"
        aria-label={es.tasks.assignee}
        value={current.assignee}
        placeholder={es.tasks.owner}
        triggerClassName={current.assignee ? selectOn : undefined}
        onValueChange={(value) => update("assignee", value)}
        options={people.map((person) => ({ value: person.id, label: person.full_name }))}
      />
      <AppSelect
        size="chip"
        aria-label={es.tasks.status}
        value={current.status}
        placeholder={es.tasks.status}
        triggerClassName={current.status ? selectOn : undefined}
        onValueChange={(value) => update("status", value)}
        options={(current.historial
          ? (["done", "cancelled"] as const)
          : (["open", "in_progress"] as const)
        ).map((status) => ({
          value: status,
          label: es.status[status],
        }))}
      />
      {hasFilters ? (
        <button
          type="button"
          className="ml-auto shrink-0 px-2 text-[12px] text-ink/45 hover:text-ink"
          onClick={() => router.push("/tareas")}
        >
          {es.tasks.clear}
        </button>
      ) : null}
    </div>
  );
}
