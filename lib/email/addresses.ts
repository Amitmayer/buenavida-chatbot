const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function extractEmail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim().replace(/^mailto:/i, "");
  if (!EMAIL_RE.test(candidate)) return null;
  return candidate.toLowerCase();
}

export function parseAddressList(raw: string): { ok: true; emails: string[] } | { ok: false } {
  if (!raw.trim()) return { ok: true, emails: [] };
  const parts = raw.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  const emails: string[] = [];
  for (const part of parts) {
    const email = extractEmail(part);
    if (!email) return { ok: false };
    if (!emails.includes(email)) emails.push(email);
  }
  return { ok: true, emails };
}

export function replyAllCc(args: {
  fromAddress: string;
  toAddresses: string[];
  selfEmail: string;
}): string[] {
  const self = args.selfEmail.trim().toLowerCase();
  const from = extractEmail(args.fromAddress);
  const seen = new Set<string>([self]);
  if (from) seen.add(from);
  const cc: string[] = [];
  for (const raw of args.toAddresses) {
    const email = extractEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    cc.push(email);
  }
  return cc;
}

export function replyToAddress(args: { fromAddress: string; toAddresses: string[]; inbound: boolean }): string {
  if (args.inbound) {
    return extractEmail(args.fromAddress) ?? "";
  }
  return extractEmail(args.toAddresses[0] ?? "") ?? args.toAddresses[0] ?? "";
}
