import { describe, expect, it } from "vitest";
import { countFolders, filterMails, folderOf, inFolder, parseFolder } from "./mailbox";
import type { Email } from "@/lib/db/types";

function mail(patch: Partial<Email>): Email {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    account_id: "00000000-0000-4000-8000-000000000002",
    user_id: "00000000-0000-4000-8000-000000000003",
    gmail_id: "m1",
    thread_id: "t1",
    rfc_message_id: null,
    from_address: "Marcela <marcela@cafecielo.cr>",
    to_addresses: ["amit@buenavida.cr"],
    subject: "Orden",
    snippet: "60 kg",
    body_text: "Confirmar tueste",
    body_html: null,
    occurred_at: "2026-09-04T14:04:00.000Z",
    unread: true,
    inbound: true,
    archived: false,
    is_draft: false,
    summary: null,
    draft_reply: null,
    task_id: null,
    created_at: "2026-09-04T14:04:00.000Z",
    ...patch,
  };
}

describe("mailbox folders", () => {
  it("parses folders and defaults to inbox", () => {
    expect(parseFolder("sent")).toBe("sent");
    expect(parseFolder("nope")).toBe("inbox");
  });

  it("splits inbox, sent, drafts, and archived", () => {
    const inbox = mail({ unread: true });
    const sent = mail({ inbound: false, unread: false, gmail_id: "s1" });
    const draft = mail({ is_draft: true, inbound: false, unread: false, gmail_id: "draft-1" });
    const archived = mail({ archived: true, unread: false, gmail_id: "a1" });
    expect(folderOf(inbox)).toBe("inbox");
    expect(folderOf(sent)).toBe("sent");
    expect(folderOf(draft)).toBe("drafts");
    expect(folderOf(archived)).toBe("archived");
    expect(inFolder(draft, "inbox")).toBe(false);
    const counts = countFolders([inbox, sent, draft, archived]);
    expect(counts).toEqual({ inbox: 1, sent: 1, drafts: 1, archived: 1, unread: 1 });
  });

  it("filters unread and search without guessing", () => {
    const rows = [
      mail({ subject: "Tueste del viernes", unread: true }),
      mail({ subject: "Factura", snippet: "pago", body_text: "Adjunto factura", unread: false, gmail_id: "m2" }),
    ];
    expect(filterMails(rows, { folder: "inbox", filter: "unread", query: "" })).toHaveLength(1);
    expect(filterMails(rows, { folder: "inbox", filter: "all", query: "tueste" })).toHaveLength(1);
    expect(filterMails(rows, { folder: "sent", filter: "all", query: "" })).toHaveLength(0);
  });

  it("does not apply unread filter to sent mail", () => {
    const sent = mail({ inbound: false, unread: true, gmail_id: "s2" });
    expect(filterMails([sent], { folder: "sent", filter: "unread", query: "" })).toHaveLength(1);
  });
});
