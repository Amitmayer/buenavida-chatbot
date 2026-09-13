"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { modalCloseClassName, ModalCloseIcon } from "@/components/ui/modal";
import { AppSelect } from "@/components/ui/select";
import { completeTaskAction, updateTaskAction, cancelTaskAction } from "@/app/(app)/tareas/actions";
import { AttachmentList } from "@/components/files/attachment-list";
import { Dropzone } from "@/components/files/dropzone";
import { PriorityBars, TeamBadge } from "@/components/tasks/badges";
import { crDateLabel, crInstantYmd, daysBetweenYmd, formatDueLabel, todayYmd } from "@/lib/agent/dates";
import { initials, shortName } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, Profile, Task, Team } from "@/lib/db/types";

type EventRow = {
  id: string;
  kind: string;
  created_at: string;
  actor: { full_name: string } | { full_name: string }[] | null;
};

type Person = Pick<Profile, "id" | "full_name"> | null;

export function TaskDetail({
  task,
  events,
  attachments,
  people,
  teams,
}: {
  task: Task & {
    team: (Team & { areas?: string[] }) | Team[] | null;
    owner?: Person | Person[];
    assignee?: Person | Person[];
  };
  events: EventRow[];
  attachments: Attachment[];
  people: Pick<Profile, "id" | "full_name">[];
  teams: Team[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [teamId, setTeamId] = useState(task.team_id);
  const [assigneeOptions, setAssigneeOptions] = useState(people);
  const team = Array.isArray(task.team) ? task.team[0] : task.team;
  const owner = Array.isArray(task.owner) ? task.owner[0] : task.owner;
  const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee;

  useEffect(() => {
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
        .filter((person): person is Pick<Profile, "id" | "full_name"> => Boolean(person));
      setAssigneeOptions(next.length ? next : people);
    })();
  }, [teamId, people]);
  const due = formatDueLabel(task.due_date);
  const overdueDays =
    task.due_date && due.kind === "overdue" ? daysBetweenYmd(task.due_date, todayYmd()) : 0;

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-auto bg-sheet md:w-[360px] md:border-l md:border-ink/10">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col rounded-t-lg px-[18px] pb-8 pt-2 md:max-w-none md:rounded-none md:px-[22px] md:pt-[22px]">
          <div className="flex justify-center pb-2 md:hidden">
            <span className="h-1 w-9 rounded-sm bg-field" />
          </div>
          <form
            id="task-edit-form"
            className="flex min-h-0 flex-1 flex-col"
            action={(formData) => {
              start(async () => {
                const result = await updateTaskAction(task.id, formData);
                if (result.ok) {
                  toast.success(es.tasks.saved);
                  setEditing(false);
                } else toast.error(es.tasks.loadError);
              });
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <textarea
                name="title"
                defaultValue={task.title}
                required
                rows={2}
                className="min-w-0 flex-1 resize-none bg-transparent text-task leading-snug text-ink outline-none"
              />
              <Link href="/tareas" aria-label={es.tasks.close} className={modalCloseClassName}>
                <ModalCloseIcon />
              </Link>
            </div>
            {due.kind === "overdue" && task.due_date ? (
              <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-[8px] bg-overdue px-2 py-1.5">
                <span className="text-[11px] font-semibold text-paper">
                  {overdueDays === 1
                    ? es.tasks.overdueDay
                    : es.tasks.overdueDays.replace("{n}", String(overdueDays))}
                </span>
                <span className="font-mono text-[11px] text-paper/80">
                  {es.tasks.dueOn.replace("{date}", crDateLabel(task.due_date))}
                </span>
              </div>
            ) : null}
            <div className="mt-[18px] grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 border-t border-line pt-4">
              <FieldLabel>{es.tasks.status}</FieldLabel>
              <AppSelect
                name="status"
                size="inline"
                defaultValue={task.status}
                options={(["open", "in_progress", "done", "cancelled"] as const).map((s) => ({
                  value: s,
                  label: es.status[s],
                }))}
              />
              <FieldLabel>{es.tasks.team}</FieldLabel>
              <div className="flex items-center gap-1.5">
                {team ? <TeamBadge slug={team.slug} name={team.name} /> : null}
                <select
                  name="team_id"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  className="sr-only"
                >
                  {teams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {team && "areas" in team && Array.isArray(team.areas) && team.areas.length > 0 ? (
                <>
                  <FieldLabel>{es.tasks.area}</FieldLabel>
                  <AppSelect
                    name="area"
                    size="inline"
                    defaultValue={task.area ?? ""}
                    placeholder={es.tasks.area}
                    options={team.areas.map((area) => ({ value: area, label: area }))}
                  />
                </>
              ) : null}
              <FieldLabel>{es.tasks.ownerLabel}</FieldLabel>
              <PersonValue person={owner ?? null} />
              <FieldLabel>{es.tasks.assignedLabel}</FieldLabel>
              <div className="flex items-center gap-1.5">
                {assignee ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DDD8C6] text-[8px] font-semibold text-[#3C5540]">
                    {initials(assignee.full_name)}
                  </span>
                ) : null}
                <AppSelect
                  name="assignee_id"
                  size="inline"
                  defaultValue={task.assignee_id ?? ""}
                  placeholder={es.tasks.assignee}
                  options={assigneeOptions.map((person) => ({
                    value: person.id,
                    label: person.full_name,
                  }))}
                />
              </div>
              <FieldLabel>{es.tasks.priority}</FieldLabel>
              <div className="flex items-center gap-2">
                <PriorityBars priority={task.priority} />
                <select name="priority" defaultValue={task.priority} className="sr-only">
                  {(["low", "medium", "high", "urgent"] as const).map((p) => (
                    <option key={p} value={p}>
                      {es.priority[p]}
                    </option>
                  ))}
                </select>
              </div>
              <FieldLabel>{es.tasks.due}</FieldLabel>
              {editing ? (
                <input
                  name="due_date"
                  type="date"
                  defaultValue={task.due_date ?? ""}
                  className="h-8 w-full rounded-[9px] border border-line bg-sheet px-2.5 text-[13px] font-medium text-ink outline-none focus:border-ink"
                />
              ) : (
                <>
                  <span className="font-mono text-[13px] text-ink md:text-[12px]">
                    {task.due_date ? crDateLabel(task.due_date) : "—"}
                  </span>
                  <input type="hidden" name="due_date" value={task.due_date ?? ""} />
                </>
              )}
              <input type="hidden" name="visibility" value={task.visibility} />
            </div>
            <div className="mt-[18px] border-t border-line pt-4">
              <p className="mb-2 text-[11px] font-semibold text-ink">{es.tasks.notes}</p>
              <textarea
                name="notes"
                defaultValue={task.notes ?? ""}
                rows={5}
                placeholder={es.tasks.notesPlaceholder}
                className="w-full resize-none rounded-[9px] border border-line bg-sheet px-3 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink/40 focus:border-ink"
              />
            </div>
          </form>

          <div className="mt-5 border-t border-hair pt-4">
            <p className="mb-2.5 text-[11px] font-semibold text-ink">
              {es.tasks.attachments} · {attachments.length}
            </p>
            <AttachmentList attachments={attachments} />
            <Dropzone taskId={task.id} />
          </div>

          <section className="mt-[18px] border-t border-hair pt-4">
            <h2 className="mb-3 text-[11px] font-semibold text-ink">{es.tasks.activity}</h2>
            <ul>
              {events.map((event) => {
                const actor = Array.isArray(event.actor) ? event.actor[0] : event.actor;
                const kind = event.kind as keyof typeof es.events;
                const verb = es.events[kind] ?? es.events.updated;
                return (
                  <li key={event.id} className="flex gap-2.5 pb-3">
                    <span className="w-[52px] shrink-0 font-mono text-[10.5px] text-ink/40">
                      {crDateLabel(crInstantYmd(event.created_at))}
                    </span>
                    <span className="text-[12.5px] leading-snug text-ink/70">
                      {actor ? shortName(actor.full_name) : "—"} {verb}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-[22px] flex gap-2">
            <form
              className="flex-1"
              action={() => {
                start(async () => {
                  await completeTaskAction(task.id);
                  toast.success(es.tasks.completed);
                });
              }}
            >
              <Button type="submit" disabled={pending} className="h-12 w-full text-[13px] md:h-11 md:text-[12px]">
                {es.tasks.markDone}
              </Button>
            </form>
            {editing ? (
              <Button
                type="submit"
                form="task-edit-form"
                variant="outline"
                disabled={pending}
                className="h-12 px-4 text-[13px] md:h-11 md:text-[12px]"
              >
                {es.tasks.save}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-12 px-4 text-[13px] md:h-11 md:text-[12px]"
                onClick={() => setEditing(true)}
              >
                {es.tasks.edit}
              </Button>
            )}
            <form
              action={() => {
                start(async () => {
                  await cancelTaskAction(task.id);
                  toast.success(es.tasks.cancelled);
                });
              }}
            >
              <Button type="submit" variant="ghost" className="h-12 px-2 text-[13px] text-ink/50 md:h-11">
                {es.tasks.cancel}
              </Button>
            </form>
          </div>
        </div>
    </aside>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className="text-[11.5px] text-ink/45 md:text-[11px]">{children}</span>;
}

function PersonValue({ person }: { person: Person }) {
  if (!person) return <span className="text-[13px] font-medium text-ink">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pine text-[8px] font-semibold text-paper">
        {initials(person.full_name)}
      </span>
      <span className="text-[13px] font-medium text-ink md:text-[12px]">{person.full_name}</span>
    </span>
  );
}
