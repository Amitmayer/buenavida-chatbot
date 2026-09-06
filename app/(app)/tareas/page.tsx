import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { addDaysYmd, todayYmd } from "@/lib/agent/dates";
import { getSessionProfile, listVisibleTasks, type TaskRow as TaskRowData } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskFilters } from "@/components/tasks/filters";
import { EmptyState } from "@/components/empty-state";
import { fold } from "@/lib/utils";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    area?: string;
    assignee?: string;
    status?: string;
    due?: string;
    todo?: string;
    q?: string;
    historial?: string;
  }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: teams }, { data: people }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const team = (teams ?? []).find((t) => t.slug === params.team);
  const today = todayYmd();
  const verTodo = profile.isOwner && params.todo === "1";
  const history = params.historial === "1" || params.status === "done" || params.status === "cancelled";
  const liveStatus =
    params.status === "open" || params.status === "in_progress" ? params.status : undefined;
  const closedStatus = params.status === "done" || params.status === "cancelled" ? params.status : undefined;
  const scope = new Set(profile.teams.map((t) => t.id));
  const tasks = (await listVisibleTasks({
    teamId: team?.id,
    area: params.area,
    assigneeId: params.assignee,
    status: history ? closedStatus : liveStatus,
    due: (params.due as "overdue" | "today" | "week" | "all" | undefined) ?? "all",
    today,
    weekEnd: addDaysYmd(today, 7),
    openOnly: !history,
    closedOnly: history && !closedStatus,
  })).filter((task) => verTodo || !profile.isOwner || scope.has(task.team_id));
  const q = (params.q ?? "").trim();
  const needle = fold(q);
  const filtered = needle
    ? tasks.filter((task) =>
        fold(
          [
            task.title,
            task.notes ?? "",
            task.assignee?.full_name ?? "",
            task.owner?.full_name ?? "",
          ].join(" "),
        ).includes(needle),
      )
    : tasks;

  const overdue = filtered.filter((task) => task.due_date && task.due_date < today);
  const rest = filtered.filter((task) => !overdue.includes(task));
  const dated = new Map<string, TaskRowData[]>();
  const none: TaskRowData[] = [];
  for (const task of rest) {
    if (!task.due_date) {
      none.push(task);
      continue;
    }
    const list = dated.get(task.due_date) ?? [];
    list.push(task);
    dated.set(task.due_date, list);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="px-4 pt-5 md:px-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TaskFilters teams={teams ?? []} people={people ?? []} />
          <span className="flex-1" />
          {profile.isOwner ? (
            <Link href={verTodo ? "/tareas" : "/tareas?todo=1"} className="flex items-center gap-2">
              <span className={`relative h-5 w-8 rounded-full ${verTodo ? "bg-pine" : "bg-field"}`}>
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-sheet ${verTodo ? "left-[14px]" : "left-0.5"}`}
                />
              </span>
              <span className="text-[12px] font-medium text-ink">{es.hoy.verTodo}</span>
            </Link>
          ) : null}
        </div>
      </div>
      {verTodo ? (
        <p className="border-y border-ink/10 bg-wash px-4 py-2 text-[11px] text-ink/60 md:px-7">
          {es.hoy.scopeBanner}
        </p>
      ) : null}
      {filtered.length === 0 ? (
        <div className="px-4 py-6 md:px-7">
          <EmptyState
            title={history ? es.tasks.historyEmpty : es.tasks.empty}
            hint={history ? es.tasks.historyHint : es.tasks.emptyHint}
          />
        </div>
      ) : (
        <div className="px-4 pb-10 md:px-7">
          <div className="overflow-hidden rounded-[14px] border border-line bg-sheet">
            <div className="hidden grid-cols-[26px_minmax(0,1fr)_130px_110px_116px_92px] gap-3.5 bg-wash px-[18px] py-2.5 font-mono text-[9.5px] tracking-[0.13em] text-ink/50 md:grid">
              <span />
              <span>{es.tasks.colTask.toUpperCase()}</span>
              <span>{es.tasks.colTeam.toUpperCase()}</span>
              <span>{es.tasks.colAssignee.toUpperCase()}</span>
              <span>{es.tasks.colDue.toUpperCase()}</span>
              <span>{es.tasks.status.toUpperCase()}</span>
            </div>
            {overdue.length > 0 ? (
              <>
                {overdue.map((task) => (
                  <TaskRow key={task.id} task={task} href={`/tareas/${task.id}`} />
                ))}
              </>
            ) : null}
            {[...dated.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ymd, rows]) => (
              <div key={ymd}>
                {rows.map((task) => (
                  <TaskRow key={task.id} task={task} href={`/tareas/${task.id}`} />
                ))}
              </div>
            ))}
            {none.map((task) => (
              <TaskRow key={task.id} task={task} href={`/tareas/${task.id}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
