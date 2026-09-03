import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/constants";

export type Clock = () => Date;

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayYmd(clock: Clock = () => new Date()): string {
  return formatInTimeZone(clock(), APP_TIMEZONE, "yyyy-MM-dd");
}

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function fromParts(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function utcNoon(ymd: string): Date {
  const { y, m, d } = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function weekday(ymd: string): number {
  return utcNoon(ymd).getUTCDay();
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = utcNoon(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function upcomingWeekday(ymd: string, target: number): string {
  const current = weekday(ymd);
  const delta = (target - current + 7) % 7;
  return addDaysYmd(ymd, delta);
}

function nextMonday(ymd: string): string {
  const thisMonday = addDaysYmd(ymd, (1 - weekday(ymd) + 7) % 7);
  return addDaysYmd(thisMonday, 7);
}

function dayOfMonth(ymd: string, day: number): string {
  const { y, m, d } = parts(ymd);
  if (d <= day && day <= daysInMonth(y, m)) {
    return fromParts(y, m, day);
  }
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return fromParts(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

const PHRASES: {
  re: RegExp;
  resolve: (today: string, match: RegExpExecArray) => string;
}[] = [
  { re: /\bpasado\s+ma[nñ]ana\b/i, resolve: (t) => addDaysYmd(t, 2) },
  { re: /\bma[nñ]ana\b/i, resolve: (t) => addDaysYmd(t, 1) },
  { re: /\bhoy\b/i, resolve: (t) => t },
  { re: /\bla\s+pr[oó]xima\s+semana\b/i, resolve: (t) => nextMonday(t) },
  {
    re: /\bel\s+(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/i,
    resolve: (t, m) => upcomingWeekday(t, WEEKDAYS[m[1].toLowerCase()] ?? 5),
  },
  {
    re: /\bel\s+(\d{1,2})(?:\s+de\s+\w+)?\b/i,
    resolve: (t, m) => dayOfMonth(t, Number(m[1])),
  },
];

export function parseDueDate(text: string, clock: Clock = () => new Date()): string | null {
  const today = todayYmd(clock);
  const normalized = text.normalize("NFC");
  for (const phrase of PHRASES) {
    const match = phrase.re.exec(normalized);
    if (match) return phrase.resolve(today, match);
  }
  return null;
}

const TRAILING_DATE = new RegExp(
  [
    "\\s*,?\\s*(?:para\\s+|el\\s+|para\\s+el\\s+)?",
    "(?:",
    "hoy|ma[nñ]ana|pasado\\s+ma[nñ]ana|la\\s+pr[oó]xima\\s+semana",
    "|(?:el\\s+)?(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)",
    "|el\\s+\\d{1,2}(?:\\s+de\\s+\\w+)?",
    ")",
    "\\s*$",
  ].join(""),
  "i",
);

export function stripDatePhrase(title: string): string {
  const trimmed = title.trim();
  const stripped = trimmed.replace(TRAILING_DATE, "").replace(/[,\s]+$/, "").trim();
  return stripped.length > 0 ? stripped : trimmed;
}

export function formatDueLabel(
  ymd: string | null,
  clock: Clock = () => new Date(),
): { kind: "none" | "overdue" | "today" | "upcoming"; ymd: string | null } {
  if (!ymd) return { kind: "none", ymd: null };
  const today = todayYmd(clock);
  if (ymd < today) return { kind: "overdue", ymd };
  if (ymd === today) return { kind: "today", ymd };
  return { kind: "upcoming", ymd };
}

export function crDateLabel(ymd: string): string {
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  const { m, d } = parts(ymd);
  return `${d} ${months[m - 1]}`;
}

export function daysBetweenYmd(from: string, to: string): number {
  const a = utcNoon(from).getTime();
  const b = utcNoon(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function crStampLabel(ymd: string): string {
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${days[weekday(ymd)]} ${crDateLabel(ymd)}`;
}

export function crHeadingStamp(ymd: string, today: string): string {
  const stamp = crStampLabel(ymd).toUpperCase();
  if (ymd === today) return `HOY · ${stamp}`;
  return stamp;
}

export function crInstantYmd(iso: string): string {
  return formatInTimeZone(new Date(iso), APP_TIMEZONE, "yyyy-MM-dd");
}

export function crTimeLabel(iso: string): string {
  return formatInTimeZone(new Date(iso), APP_TIMEZONE, "HH:mm");
}

export function crRelativeStamp(ymd: string, today: string): string {
  if (ymd === today) return "HOY";
  if (ymd === addDaysYmd(today, -1)) return "AYER";
  return crStampLabel(ymd).toUpperCase();
}
