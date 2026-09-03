import Link from "next/link";
import { CompleteBox } from "@/components/tasks/complete-box";
import { TeamBadge } from "@/components/tasks/badges";
import { teamEdge } from "@/components/tasks/team-colors";
import { crDateLabel, daysBetweenYmd, formatDueLabel, todayYmd } from "@/lib/agent/dates";
import { es } from "@/lib/i18n/es";
import { cn, initials, shortName } from "@/lib/utils";
import type { TaskRow as TaskRowData } from "@/lib/session";

export function TaskRow({
  task,
  href,
  tone = "list",
}: {
  task: TaskRowData;
  href?: string;
  tone?: "list" | "overdue-dark" | "hoy" | "undated";
}) {
  const due = formatDueLabel(task.due_date);
  const today = todayYmd();
  const overdueDays =
    task.due_date && due.kind === "overdue" ? daysBetweenYmd(task.due_date, today) : 0;
  const dark = tone === "overdue-dark";
  const overdueList = !dark && due.kind === "overdue";
  const dueLabel =
    due.kind === "today" ? es.tasks.today.toLowerCase() : task.due_date ? crDateLabel(task.due_date) : "";
  const showBox = tone === "hoy" || tone === "undated" || tone === "list";
  const stateLabel =
    overdueList && task.status !== "done" && task.status !== "cancelled"
      ? es.hoy.overdueSection
      : es.status[task.status];

  const title = (
    <p
      className={cn(
        "leading-[1.3]",
        dark && "text-[14px] font-medium text-paper md:text-[13px]",
        tone === "hoy" && "text-[15px] font-medium text-ink md:text-[13px]",
        tone === "undated" && "text-[14px] font-normal text-ink/70",
        tone === "list" && "truncate text-[14px] font-medium text-ink md:text-[13px]",
      )}
    >
      {task.title}
    </p>
  );

  const meta =
    dark || tone === "undated" ? null : (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
        {task.team ? <TeamBadge slug={task.team.slug} name={task.team.name} /> : null}
        {tone === "hoy" && task.assignee ? (
          <>
            <span className="text-[11px] text-ink/30">·</span>
            <span className="text-[11px] text-ink/55">{shortName(task.assignee.full_name)}</span>
          </>
        ) : null}
        {tone === "list" && dueLabel ? (
          <span className={cn("font-mono text-[10.5px]", overdueList ? "text-overdue" : "text-ink/45")}>
            {dueLabel}
          </span>
        ) : null}
      </div>
    );

  const extras = (
    <>
      {dark ? (
        <>
          <span className="hidden text-[10.5px] font-semibold text-paper/60 md:inline">
            {task.team?.name}
          </span>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full md:hidden"
            style={{ background: teamEdge(task.team?.slug) }}
          />
          {task.assignee ? (
            <span className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine text-[8px] font-semibold text-paper md:flex">
              {initials(task.assignee.full_name)}
            </span>
          ) : null}
        </>
      ) : null}
      {tone === "hoy" ? (
        <span className="mt-0.5 hidden shrink-0 items-center gap-5 md:flex">
          {task.team ? (
            <span className="flex w-24 items-center gap-1.5">
              <TeamBadge slug={task.team.slug} name={task.team.name} />
            </span>
          ) : null}
          <span className="font-mono text-[11px] text-ink/45">{dueLabel}</span>
        </span>
      ) : null}
      {tone === "list" ? (
        <>
          <span className="hidden md:inline-block">
            {task.team ? <TeamBadge slug={task.team.slug} name={task.team.name} /> : null}
          </span>
          <span className="hidden items-center gap-1.5 truncate text-[12px] text-ink/70 md:flex">
            {task.assignee ? (
              <>
                <span className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[9.5px] font-semibold text-[#3C5540]">
                  {initials(task.assignee.full_name)}
                </span>
                {shortName(task.assignee.full_name)}
              </>
            ) : (
              "—"
            )}
          </span>
          <span
            className={cn(
              "hidden font-mono text-[11px] md:block",
              overdueList ? "font-medium text-overdue" : "text-ink/55",
            )}
          >
            {dueLabel}
          </span>
          <span
            className={cn(
              "hidden text-[11.5px] md:block",
              overdueList ? "text-overdue" : "text-[#3C5540]",
            )}
          >
            {stateLabel}
          </span>
          <div
            aria-label={task.assignee?.full_name ?? es.tasks.assignee}
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[8px] font-semibold text-[#3C5540] md:hidden"
          >
            {task.assignee ? initials(task.assignee.full_name) : "—"}
          </div>
        </>
      ) : null}
    </>
  );

  const chrome = cn(
    "flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-hover md:gap-3.5 md:px-[18px]",
    tone === "list" &&
      "md:grid md:grid-cols-[26px_minmax(0,1fr)_130px_110px_116px_92px] md:items-center",
    dark ? "border-paper/10" : "",
    overdueList && "bg-overdue/[0.04]",
  );

  const box = showBox ? (
    <span className={tone === "list" ? "hidden md:block" : undefined}>
      <CompleteBox taskId={task.id} />
    </span>
  ) : dark ? (
    <span className="w-[26px] shrink-0 font-mono text-[12px] font-medium text-peach md:w-6 md:text-[11.5px]">
      {overdueDays}d
    </span>
  ) : null;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        {title}
        {meta}
      </div>
      {extras}
    </>
  );

  if (!href) {
    return (
      <div className={chrome}>
        {box}
        {body}
      </div>
    );
  }

  return (
    <div className={chrome}>
      {box}
      <Link
        href={href}
        prefetch={false}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3",
          tone === "list" && "md:contents",
        )}
      >
        {body}
      </Link>
    </div>
  );
}
