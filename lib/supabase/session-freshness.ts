const AUTH_TOKEN_COOKIE = /^(sb-[a-z0-9]+-auth-token)(?:\.(\d+))?$/i;
const REFRESH_WITHIN_SECONDS = 90;

export function hasAuthSessionCookie(cookies: { name: string }[]): boolean {
  return cookies.some((cookie) => AUTH_TOKEN_COOKIE.test(cookie.name));
}

export function authCookieNames(cookies: { name: string }[]): string[] {
  return cookies.filter((cookie) => AUTH_TOKEN_COOKIE.test(cookie.name)).map((cookie) => cookie.name);
}

export function shouldRefreshSession(
  cookies: { name: string; value: string }[],
  nowSec = Math.floor(Date.now() / 1000),
  withinSec = REFRESH_WITHIN_SECONDS,
): boolean {
  const exp = accessTokenExpiresAt(cookies);
  if (exp == null) return true;
  return exp - nowSec < withinSec;
}

export function accessTokenExpiresAt(cookies: { name: string; value: string }[]): number | null {
  const raw = readAuthCookie(cookies);
  if (!raw) return null;
  const session = parseSession(raw);
  if (!session) return null;
  if (typeof session.expires_at === "number" && Number.isFinite(session.expires_at)) {
    return session.expires_at;
  }
  if (typeof session.access_token === "string") {
    return jwtExp(session.access_token);
  }
  return null;
}

function readAuthCookie(cookies: { name: string; value: string }[]): string | null {
  const groups = new Map<string, { index: number; value: string }[]>();
  for (const cookie of cookies) {
    const match = cookie.name.match(AUTH_TOKEN_COOKIE);
    if (!match) continue;
    const key = match[1];
    const index = match[2] == null ? -1 : Number(match[2]);
    const list = groups.get(key) ?? [];
    list.push({ index, value: cookie.value });
    groups.set(key, list);
  }
  for (const chunks of groups.values()) {
    chunks.sort((a, b) => a.index - b.index);
    const joined = chunks.map((chunk) => chunk.value).join("");
    if (joined) return joined;
  }
  return null;
}

function parseSession(raw: string): { expires_at?: number; access_token?: string } | null {
  const json = raw.startsWith("base64-") ? decodeBase64Url(raw.slice("base64-".length)) : raw;
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object") {
      return parsed[0] as { expires_at?: number; access_token?: string };
    }
    if (parsed && typeof parsed === "object") {
      return parsed as { expires_at?: number; access_token?: string };
    }
  } catch {
    return null;
  }
  return null;
}

function jwtExp(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const json = decodeBase64Url(payload);
  if (!json) return null;
  try {
    const claims = JSON.parse(json) as { exp?: number };
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
