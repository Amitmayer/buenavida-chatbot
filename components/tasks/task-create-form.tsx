"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { createTaskAction } from "@/app/(app)/tareas/actions";
import type { Profile, Team } from "@/lib/db/types";

export function TaskCreateForm({
  teams,
  people,
}: {
  teams: Team[];
  people: Pick<Profile, "id" | "full_name">[];
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-2 rounded-md border border-line bg-sheet p-3 md:grid-cols-2"
      action={(formData) => {
        start(async () => {
          const result = await createTaskAction(formData);
          if (result.ok) toast.success(es.tasks.saved);
          else toast.error(es.tasks.loadError);
        });
      }}
    >
      <Input name="title" required maxLength={200} placeholder={es.tasks.title} />
      <Input name="due_date" type="date" />
      <AppSelect
        name="team_id"
        required
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
      <AppSelect
        name="assignee_id"
        placeholder={es.tasks.assignee}
        options={people.map((person) => ({ value: person.id, label: person.full_name }))}
      />
      <AppSelect
        name="priority"
        defaultValue="medium"
        options={(["low", "medium", "high", "urgent"] as const).map((p) => ({
          value: p,
          label: es.priority[p],
        }))}
      />
      <AppSelect
        name="visibility"
        defaultValue="team"
        options={[
          { value: "team", label: es.tasks.visibilityTeam },
          { value: "restricted", label: es.tasks.visibilityRestricted },
        ]}
      />
      <Textarea name="notes" className="md:col-span-2" placeholder={es.tasks.notes} />
      <Button type="submit" disabled={pending} className="md:col-span-2">
        {es.tasks.create}
      </Button>
    </form>
  );
}
