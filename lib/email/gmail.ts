import { captureError } from "@/lib/sentry";
import { sanitizeEmailHtml, stripHtml } from "@/lib/email/html";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export type GmailTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
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
  html: string;
  inlineImages: InlineImage[];
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
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
};

export type InlineImage = {
  cid: string;
  mime: string;
  data?: string;
  attachmentId?: string;
};

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeB64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

const IMAGE_MIME = /^(image\/jpeg|image\/jpg|image\/png|image\/gif|image\/webp)$/i;

function contentId(headers: GmailHeader[] | undefined) {
  const raw = header(headers, "Content-ID") || header(headers, "X-Attachment-Id");
  return raw.replace(/^<|>$/g, "").trim().toLowerCase();
}

function walkParts(
  part: GmailPart | undefined,
  acc: { text: string; html: string; htmlAttachmentId?: string; images: InlineImage[] },
) {
  if (!part) return;
  const mime = (part.mimeType ?? "").toLowerCase();
  const cid = contentId(part.headers);
  const isBodyPart = !part.filename;

  if (IMAGE_MIME.test(mime) && cid) {
    acc.images.push({
      cid,
      mime,
      data: part.body?.data,
      attachmentId: part.body?.attachmentId,
    });
  }

  if (mime === "text/plain" && part.body?.data && isBodyPart && !acc.text) {
    acc.text = decodeB64Url(part.body.data);
  }
  if (mime === "text/html" && (isBodyPart || !acc.html)) {
    if (part.body?.data) {
      const html = decodeB64Url(part.body.data);
      if (html.length > acc.html.length) acc.html = html;
    } else if (part.body?.attachmentId && !acc.htmlAttachmentId) {
      acc.htmlAttachmentId = part.body.attachmentId;
    }
  }

  for (const child of part.parts ?? []) walkParts(child, acc);
}

export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string | null> {
  const res = await fetch(`${GMAIL}/messages/${messageId}/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    captureError(new Error(`gmail attachment ${res.status}`), { where: "gmail.attachment" });
    return null;
  }
  const data = (await res.json()) as { data?: string };
  return data.data ?? null;
}

function toDataUrl(mime: string, base64url: string) {
  const bytes = Buffer.from(base64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export async function resolveInlineImages(
  accessToken: string,
  messageId: string,
  images: InlineImage[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  let total = 0;
  for (const image of images.slice(0, 12)) {
    const raw = image.data ?? (image.attachmentId ? await getAttachment(accessToken, messageId, image.attachmentId) : null);
    if (!raw) continue;
    const url = toDataUrl(image.mime, raw);
    if (url.length > 1_800_000) continue;
    total += url.length;
    if (total > 5_000_000) break;
    resolved.set(image.cid, url);
    const short = image.cid.split("@")[0];
    if (short && short !== image.cid) resolved.set(short, url);
  }
  return resolved;
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
  max = 100,
  query = "in:inbox OR in:sent OR in:drafts",
): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  while (out.length < max) {
    const url = new URL(`${GMAIL}/messages`);
    url.searchParams.set("maxResults", String(Math.min(100, max - out.length)));
    url.searchParams.set("q", query);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      captureError(new Error(`gmail list ${res.status}`), { where: "gmail.list" });
      throw new Error("gmail_list");
    }
    const data = (await res.json()) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };
    out.push(...(data.messages ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out.slice(0, max);
}

export async function getMessageLabels(accessToken: string, id: string): Promise<string[]> {
  const res = await fetch(`${GMAIL}/messages/${id}?format=minimal`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    captureError(new Error(`gmail labels ${res.status}`), { where: "gmail.labels" });
    return [];
  }
  const data = (await res.json()) as { labelIds?: string[] };
  return data.labelIds ?? [];
}

async function removeUnread(accessToken: string, kind: "messages" | "threads", id: string) {
  if (!id || id.startsWith("draft-") || id.startsWith("sent-")) return false;
  const res = await fetch(`${GMAIL}/${kind}/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  if (!res.ok) {
    captureError(new Error(`gmail ${kind} modify ${res.status}`), { where: "gmail.markRead" });
    return false;
  }
  return true;
}

export async function markGmailRead(
  accessToken: string,
  args: { gmailId: string; threadId?: string | null },
) {
  const message = await removeUnread(accessToken, "messages", args.gmailId);
  const thread = args.threadId ? await removeUnread(accessToken, "threads", args.threadId) : false;
  return message || thread;
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
  const extracted: {
    text: string;
    html: string;
    htmlAttachmentId?: string;
    images: InlineImage[];
  } = { text: "", html: "", images: [] };
  walkParts(data.payload, extracted);
  if (extracted.htmlAttachmentId) {
    const raw = await getAttachment(accessToken, data.id, extracted.htmlAttachmentId);
    if (raw) extracted.html = decodeB64Url(raw);
  }
  const html = extracted.html ? sanitizeEmailHtml(extracted.html).slice(0, 400_000) : "";
  const text =
    extracted.text.trim().length >= 80
      ? extracted.text
      : html
        ? stripHtml(html)
        : extracted.text;
  const labels = data.labelIds ?? [];
  return {
    gmailId: data.id,
    threadId: data.threadId,
    rfcMessageId: header(headers, "Message-ID") || null,
    from,
    to,
    subject,
    snippet: (data.snippet ?? "").slice(0, 400),
    body: text.slice(0, 20000),
    html,
    inlineImages: extracted.images,
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
