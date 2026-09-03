import { es } from "@/lib/i18n/es";
import { crDateLabel, daysBetweenYmd } from "@/lib/agent/dates";

export type DigestGroup = {
  team: string;
  tasks: { title: string; due: string | null; priority: string }[];
};

type Flat = { title: string; due: string | null; team: string };

function flatten(groups: DigestGroup[]): Flat[] {
  return groups.flatMap((g) => g.tasks.map((t) => ({ title: t.title, due: t.due, team: g.team })));
}

function row(task: Flat, todayYmd: string, overdue: boolean): string {
  const left = overdue && task.due
    ? `${daysBetweenYmd(task.due, todayYmd)} d`
    : task.due
      ? crDateLabel(task.due)
      : "—";
  const color = overdue ? "#A8451C" : "rgba(18,33,26,.45)";
  return `<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #DCE0DA">
    <span style="font:500 11px 'IBM Plex Mono',monospace;color:${color};width:38px;flex:none">${left}</span>
    <span style="flex:1;font:500 13px/1.4 Montserrat,sans-serif;color:#12211A">${task.title}</span>
  </div>`;
}

export function renderDigestEmail(args: {
  name: string;
  dateLabel: string;
  siteUrl: string;
  todayYmd: string;
  overdue: DigestGroup[];
  today: DigestGroup[];
  week: DigestGroup[];
}): string {
  const overdue = flatten(args.overdue);
  const today = flatten(args.today);
  const week = flatten(args.week);
  const oldest = overdue.reduce((max, t) => {
    if (!t.due) return max;
    return Math.max(max, daysBetweenYmd(t.due, args.todayYmd));
  }, 0);
  const overdueCopy =
    overdue.length === 1
      ? es.digest.overdueOne
      : es.digest.overdue.replace("{n}", String(Math.max(oldest, 1)));

  const overdueBlock =
    overdue.length === 0
      ? ""
      : `<div style="background:#A8451C;padding:16px 24px">
          <div style="display:flex;align-items:center;gap:14px">
            <span style="font:600 34px/1 'IBM Plex Mono',monospace;color:#F7F8F6">${overdue.length}</span>
            <span style="flex:1;font:600 13px/1.4 Montserrat,sans-serif;color:#F7F8F6">${overdueCopy}</span>
          </div>
        </div>
        <div style="padding:18px 24px 4px">${overdue.map((t) => row(t, args.todayYmd, true)).join("")}</div>`;

  const section = (title: string, tasks: Flat[], overdueRows: boolean) => {
    if (tasks.length === 0) return "";
    return `<div style="padding:18px 24px 0">
      <div style="font:600 11px Montserrat,sans-serif;color:#12211A;padding-bottom:4px;border-bottom:1px solid #12211A">${title} · ${tasks.length}</div>
      ${tasks.map((t) => row(t, args.todayYmd, overdueRows)).join("")}
    </div>`;
  };

  return `<!doctype html>
<html>
<body style="margin:0;background:#EDEFEC;color:#12211A">
  <div style="width:536px;max-width:100%;margin:24px auto;background:#FFFFFF;font-family:Montserrat,Helvetica,sans-serif">
    <div style="background:#12211A;padding:20px 24px">
      <div style="font:600 12px Montserrat,sans-serif;color:rgba(247,248,246,.6)">${es.appName}</div>
      <div style="font:600 19px Montserrat,sans-serif;color:#F7F8F6;margin-top:5px">${es.digest.heading.replace("{date}", args.dateLabel)}</div>
    </div>
    ${overdueBlock}
    ${section(es.digest.today, today, false)}
    ${section(es.digest.week, week, false)}
    <div style="padding:22px 24px 26px">
      <a href="${args.siteUrl}" style="display:block;background:#12211A;color:#F7F8F6;font:600 13px Montserrat,sans-serif;text-align:center;padding:14px;text-decoration:none">${es.digest.open}</a>
      <div style="font:400 10.5px/1.5 Montserrat,sans-serif;color:rgba(18,33,26,.45);margin-top:14px;text-align:center">${es.digest.footer}</div>
    </div>
  </div>
</body>
</html>`;
}
