import { captureError } from "@/lib/sentry";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export type GmailTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

export type ParsedMessage = {
  gmailId: string;
  threadId: string;
  rfcMessageId: string | null;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body: string;
  occurredAt: string;
  unread: boolean;
  inbound: boolean;
  isDraft: boolean;
  archived: boolean;
};

function clientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function gmailRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/correo/callback";
}

export function gmailConfigured() {
  return Boolean(clientId() && clientSecret());
}

export function gmailAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<GmailTokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: gmailRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    captureError(new Error(`gmail token ${res.status}`), { where: "gmail.exchangeCode" });
    throw new Error("gmail_token");
  }
  return (await res.json()) as GmailTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    captureError(new Error(`gmail refresh ${res.status}`), { where: "gmail.refresh" });
    throw new Error("gmail_refresh");
  }
  return (await res.json()) as GmailTokens;
}

export async function gmailUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    captureError(new Error(`gmail userinfo ${res.status}`), { where: "gmail.userinfo" });
    throw new Error("gmail_userinfo");
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("gmail_email");
  return data.email;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: GmailHeader[];
};

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeB64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeB64Url(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      if (child.mimeType === "text/plain" && child.body?.data) {
        return decodeB64Url(child.body.data);
      }
    }
    for (const child of part.parts) {
      const nested = extractText(child);
      if (nested) return nested;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return stripHtml(decodeB64Url(part.body.data));
  }
  return "";
}

function parseAddresses(raw: string) {
  return raw
    .split(",")
    .map((part) => {
      const match = part.match(/<([^>]+)>/);
      return (match ? match[1] : part).trim();
    })
    .filter(Boolean);
}

export async function listMessageIds(
  accessToken: string,
  max = 40,
): Promise<{ id: string; threadId: string }[]> {
  const url = new URL(`${GMAIL}/messages`);
  url.searchParams.set("maxResults", String(max));
  url.searchParams.set("q", "in:inbox OR in:sent OR in:drafts");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    captureError(new Error(`gmail list ${res.status}`), { where: "gmail.list" });
    throw new Error("gmail_list");
  }
  const data = (await res.json()) as { messages?: { id: string; threadId: string }[] };
  return data.messages ?? [];
}

export async function getMessage(accessToken: string, id: string): Promise<ParsedMessage> {
  const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    captureError(new Error(`gmail get ${res.status}`), { where: "gmail.get" });
    throw new Error("gmail_get");
  }
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    labelIds?: string[];
    internalDate?: string;
    payload?: GmailPart;
  };
  const headers = data.payload?.headers ?? [];
  const from = header(headers, "From");
  const to = parseAddresses(header(headers, "To"));
  const subject = header(headers, "Subject");
  const dateHeader = header(headers, "Date");
  const occurred = data.internalDate
    ? new Date(Number(data.internalDate)).toISOString()
    : dateHeader
      ? new Date(dateHeader).toISOString()
      : new Date().toISOString();
  const body = extractText(data.payload).slice(0, 20000);
  const labels = data.labelIds ?? [];
  return {
    gmailId: data.id,
    threadId: data.threadId,
    rfcMessageId: header(headers, "Message-ID") || null,
    from,
    to,
    subject,
    snippet: (data.snippet ?? "").slice(0, 400),
    body,
    occurredAt: occurred,
    unread: labels.includes("UNREAD"),
    inbound: !labels.includes("SENT") && !labels.includes("DRAFT"),
    isDraft: labels.includes("DRAFT"),
    archived: !labels.includes("INBOX") && !labels.includes("DRAFT") && !labels.includes("SENT"),
  };
}

function rfc2822(args: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}) {
  const lines = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (args.inReplyTo) {
    lines.push(`In-Reply-To: ${args.inReplyTo}`);
    lines.push(`References: ${args.inReplyTo}`);
  }
  return `${lines.join("\r\n")}\r\n\r\n${args.body}`;
}

export async function sendMessage(
  accessToken: string,
  args: {
    from: string;
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string | null;
    threadId?: string;
  },
) {
  const raw = Buffer.from(rfc2822(args))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const res = await fetch(`${GMAIL}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: args.threadId }),
  });
  if (!res.ok) {
    captureError(new Error(`gmail send ${res.status}`), { where: "gmail.send" });
    throw new Error("gmail_send");
  }
  return (await res.json()) as { id: string; threadId: string };
}
