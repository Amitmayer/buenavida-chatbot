import type { ReactNode } from "react";
import Link from "next/link";
import { es } from "@/lib/i18n/es";
import { getSessionProfile, listVisibleTasks, ensureConversation } from "@/lib/session";
import { addDaysYmd, crDateLabel, daysBetweenYmd, todayYmd } from "@/lib/agent/dates";
import { CaptureBox } from "@/components/hoy/capture-box";
import { CompleteBox } from "@/components/tasks/complete-box";
import { initials, shortName } from "@/lib/utils";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ todo?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const { todo } = await searchParams;
  const verTodo = profile.isOwner && todo === "1";
  const today = todayYmd();
  const weekEnd = addDaysYmd(today, 7);
  const scope = new Set(verTodo ? [] : profile.teams.map((t) => t.id));
  const inScope = (teamId: string) => verTodo || scope.has(teamId);

  const [open, allWeek] = await Promise.all([
    listVisibleTasks({ today, weekEnd, openOnly: true }),
    listVisibleTasks({ today, weekEnd, due: "week", openOnly: false }),
  ]);
  const overdue = open.filter((task) => task.due_date && task.due_date < today && inScope(task.team_id));
  const dueToday = open.filter((task) => task.due_date === today && inScope(task.team_id));
  const assigned = open.filter((task) => task.assignee_id === profile.id && !task.due_date);
  const dueSoon = open
    .filter((task) => task.due_date && task.due_date > today && inScope(task.team_id))
    .slice(0, 4);
  const weekOpen = open.filter(
    (task) => task.due_date && task.due_date >= today && task.due_date <= weekEnd && inScope(task.team_id),
  );
  const weekDone = allWeek.filter((task) => task.status === "done" && inScope(task.team_id));
  const oldest = overdue.reduce((max, task) => {
    if (!task.due_date) return max;
    return Math.max(max, daysBetweenYmd(task.due_date, today));
  }, 0);
  const conversationId = await ensureConversation(profile.id, es.chat.title);

  let hero: string = es.hoy.heroClear;
  if (overdue.length > 0 && dueToday.length > 0) {
    hero = es.hoy.heroMix
      .replace("{today}", String(dueToday.length))
      .replace("{overdue}", String(overdue.length));
  } else if (dueToday.length === 1) {
    hero = es.hoy.heroTodayOne;
  } else if (dueToday.length > 1) {
    hero = es.hoy.heroToday.replace("{n}", String(dueToday.length));
  } else if (overdue.length > 0) {
    hero =
      overdue.length === 1
        ? `1 ${es.hoy.overdueOne}.`
        : `${overdue.length} ${es.hoy.overdueMany}.`;
  }

  const hint =
    overdue.length > 0
      ? oldest <= 1
        ? es.hoy.oldestOverdueOne
        : es.hoy.oldestOverdue.replace("{n}", String(oldest))
      : es.hoy.emptyOverdueHint;

  const weekMax = Math.max(weekOpen.length + weekDone.length, 1);

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-4 py-6 md:px-7 md:py-6">
        <div className="flex min-w-[280px] flex-1 flex-col gap-5" style={{ flexBasis: 560 }}>
          <section className="relative overflow-hidden rounded-lg bg-pine px-6 py-6 text-cream">
            <div className="pointer-events-none absolute -right-10 -top-[60px] h-[260px] w-[260px] rounded-full border border-gold/30" />
            <div className="pointer-events-none absolute right-5 -top-5 h-[170px] w-[170px] rounded-full border border-gold/20" />
            <div className="relative flex flex-wrap items-start gap-6">
              <div className="min-w-[240px] flex-1">
                <p className="mb-2.5 font-mono text-[10px] tracking-[0.16em] text-gold">{es.hoy.daySummary.toUpperCase()}</p>
                <p className="max-w-[30ch] text-[24px] font-semibold leading-snug tracking-tight">{hero}</p>
                <p className="mt-2 max-w-[52ch] text-[13px] text-cream/65">{hint}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {overdue[0] ? (
                    <Link
                      href={`/tareas/${overdue[0].id}`}
                      prefetch={false}
                      className="rounded-[8px] bg-gold px-3.5 py-2 text-[12.5px] font-medium text-pine hover:bg-peach"
                    >
                      {es.hoy.startOverdue}
                    </Link>
                  ) : null}
                  <Link
                    href="/tareas?due=week"
                    prefetch={false}
                    className="rounded-[8px] border border-cream/40 px-3.5 py-2 text-[12.5px] text-cream hover:bg-cream/10"
                  >
                    {es.hoy.seeWeek}
                  </Link>
                </div>
              </div>
              <div className="ml-auto grid grid-cols-3 overflow-hidden rounded-md bg-cream/10">
                <Kpi n={dueToday.length} label={es.hoy.kpiToday} />
                <Kpi
                  n={overdue.length}
                  label={overdue.length === 1 ? es.hoy.kpiOverdue : es.hoy.kpiOverdueMany}
                />
                <Kpi n={weekDone.length} label={es.hoy.kpiDone7} />
              </div>
            </div>
          </section>

          {overdue.length > 0 ? (
            <section>
              <SectionLabel tone="overdue">{es.hoy.overdueSection}</SectionLabel>
              <div className="flex flex-col gap-2">
                {overdue.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3.5 rounded-md border border-overdue/50 bg-sheet px-4 py-3.5 shadow-sm"
                  >
                    <CompleteBox taskId={task.id} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/tareas/${task.id}`} prefetch={false} className="text-[13.5px] font-medium text-ink">
                        {task.title}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-ink/50">
                        {[task.team?.name, task.assignee ? shortName(task.assignee.full_name) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="hidden shrink-0 gap-2 md:flex">
                      <Link
                        href={`/tareas/${task.id}`}
                        prefetch={false}
                        className="rounded-[7px] border border-ink/15 bg-sheet px-2.5 py-1.5 text-[12px] hover:bg-hover"
                      >
                        {es.hoy.reschedule}
                      </Link>
                      <Link
                        href={`/tareas/${task.id}`}
                        prefetch={false}
                        className="rounded-[7px] bg-overdue px-2.5 py-1.5 text-[12px] text-paper hover:bg-[#A94824]"
                      >
                        {es.hoy.doNow}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionLabel>
              {es.hoy.dueToday.toUpperCase()} · {dueToday.length}
            </SectionLabel>
            <div className="overflow-hidden rounded-md border border-line bg-sheet">
              {dueToday.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink/50">{es.hoy.emptyToday}</p>
              ) : (
                dueToday.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3.5 border-b border-line px-4 py-3 hover:bg-hover"
                  >
                    <CompleteBox taskId={task.id} />
                    <Link
                      href={`/tareas/${task.id}`}
                      prefetch={false}
                      className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink"
                    >
                      {task.title}
                    </Link>
                    {task.team ? (
                      <span className="hidden rounded-full bg-wash px-2.5 py-0.5 text-[11px] text-[#3C5540] md:inline">
                        {task.team.name}
                      </span>
                    ) : null}
                    {task.assignee ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[10.5px] font-semibold text-[#3C5540]">
                        {initials(task.assignee.full_name)}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
              {conversationId ? <CaptureBox conversationId={conversationId} trigger="inline" /> : null}
            </div>
          </section>

          <section className="pb-4">
            <SectionLabel>
              {es.hoy.undatedShort.toUpperCase()} · {assigned.length}
            </SectionLabel>
            {assigned.length === 0 ? (
              <p className="text-[13px] text-ink/50">{es.hoy.emptyAssigned}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {assigned.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tareas/${task.id}`}
                    prefetch={false}
                    className="rounded-md border border-ink/10 bg-sheet p-4 hover:border-ink/25"
                  >
                    <p className="text-[13px] font-medium leading-snug text-ink">{task.title}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      {task.team ? (
                        <span className="rounded-full bg-wash px-2 py-0.5 text-[10.5px] text-[#3C5540]">
                          {task.team.name}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex w-full max-w-[320px] min-w-[260px] flex-1 flex-col gap-4">
          <div className="rounded-[14px] border border-ink/10 bg-sheet p-4">
            <p className="mb-3 font-mono text-[9.5px] tracking-[0.14em] text-ink/45">
              {es.hoy.thisWeek.toUpperCase()}
            </p>
            <WeekBar n={weekOpen.length} label={es.hoy.dueThisWeek} pct={`${Math.round((weekOpen.length / weekMax) * 100)}%`} />
            <WeekBar n={weekDone.length} label={es.hoy.doneThisWeek} pct={`${Math.min(100, Math.round((weekDone.length / weekMax) * 100))}%`} />
            <WeekBar n={overdue.length} label={es.hoy.overdueStat} pct={`${Math.min(100, overdue.length * 12)}%`} alert />
          </div>
          <div className="rounded-[14px] border border-ink/10 bg-sheet p-4">
            <p className="mb-3 font-mono text-[9.5px] tracking-[0.14em] text-ink/45">
              {es.hoy.dueSoon.toUpperCase()}
            </p>
            <div className="flex flex-col gap-3">
              {dueSoon.map((task) => (
                <Link key={task.id} href={`/tareas/${task.id}`} prefetch={false} className="flex gap-2.5">
                  <span className="w-[34px] shrink-0 pt-0.5 font-mono text-[10.5px] text-gold">
                    {task.due_date ? crDateLabel(task.due_date) : "—"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug text-ink">{task.title}</p>
                    {task.assignee ? (
                      <p className="mt-0.5 text-[11px] text-ink/45">{shortName(task.assignee.full_name)}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ n, label }: { n: number; label: string }) {
  return (
    <div className="bg-pine px-4 py-3.5">
      <p className="font-mono text-[26px] leading-none text-cream">{n}</p>
      <p className="mt-1.5 text-[11px] text-cream/55">{label}</p>
    </div>
  );
}

function SectionLabel({ children, tone }: { children: ReactNode; tone?: "overdue" }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        className={`font-mono text-[11px] font-semibold tracking-[0.1em] ${
          tone === "overdue" ? "text-overdue" : "text-ink/50"
        }`}
      >
        {children}
      </span>
      <span className="h-px flex-1 bg-ink/10" />
    </div>
  );
}

function WeekBar({
  n,
  label,
  pct,
  alert,
}: {
  n: number;
  label: string;
  pct: string;
  alert?: boolean;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-baseline gap-2">
        <span className={`font-mono text-[15px] ${alert ? "text-overdue" : "text-ink"}`}>{n}</span>
        <span className="text-[12px] text-ink/55">{label}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-wash">
        <div className={`h-full ${alert ? "bg-overdue" : "bg-sage"}`} style={{ width: pct }} />
      </div>
    </div>
  );
}
