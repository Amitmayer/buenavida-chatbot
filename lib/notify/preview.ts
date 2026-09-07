export function clipPreview(value: string, max = 88): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function isRecentIso(iso: string, withinMs = 20 * 60 * 1000): boolean {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < withinMs;
}
