"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { createTaskAction } from "@/app/(app)/tareas/actions";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Team } from "@/lib/db/types";

type Person = Pick<Profile, "id" | "full_name">;

export function TaskCreateForm({
  teams,
  people,
}: {
  teams: Team[];
  people: Person[];
}) {
  const [pending, start] = useTransition();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignees, setAssignees] = useState<Person[]>(people);

  useEffect(() => {
    if (!teamId) {
      setAssignees(people);
      return;
    }
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, profiles(id, full_name)")
        .eq("team_id", teamId);
      const next = (data ?? [])
        .map((row) => {
          const nested = row.profiles as unknown;
          const profile = Array.isArray(nested) ? nested[0] : nested;
          if (!profile || typeof profile !== "object") return null;
          const person = profile as { id?: string; full_name?: string };
          if (!person.id || !person.full_name) return null;
          return { id: person.id, full_name: person.full_name };
        })
        .filter((person): person is Person => Boolean(person));
      setAssignees(next);
      setAssigneeId((prev) => (next.some((person) => person.id === prev) ? prev : ""));
    })();
  }, [teamId, people]);

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
        value={teamId}
        onValueChange={(value) => {
          setTeamId(value);
          setAssigneeId("");
        }}
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
      <AppSelect
        name="assignee_id"
        value={assigneeId}
        onValueChange={setAssigneeId}
        placeholder={es.tasks.assignee}
        options={assignees.map((person) => ({ value: person.id, label: person.full_name }))}
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
