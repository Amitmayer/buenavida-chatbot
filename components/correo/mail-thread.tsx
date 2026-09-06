"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import {
  archiveMailAction,
  draftMailAction,
  markReadAction,
  sendDraftAction,
  sendMailAction,
  summarizeMailAction,
  taskFromMailAction,
} from "@/app/(app)/correo/actions";
import { crDateLabel, crInstantYmd, crTimeLabel } from "@/lib/agent/dates";
import {
  correoHref,
  displayAddress,
  displayName,
  FOLDER_LABEL,
  folderOf,
  isDraft,
  type MailFilter,
  type MailFolder,
} from "@/lib/email/mailbox";
import { MailHtmlFrame } from "@/components/correo/mail-html-frame";
import { initials } from "@/lib/utils";
import type { Email } from "@/lib/db/types";

export function MailThread({
  mail,
  html,
  folder,
  filter,
  query,
}: {
  mail: Email;
  html: string;
  folder: MailFolder;
  filter: MailFilter;
  query: string;
}) {
  const [body, setBody] = useState(mail.draft_reply ?? mail.body_text ?? "");
  const [summary, setSummary] = useState(mail.summary ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const who = displayName(mail.from_address);
  const draft = isDraft(mail);
  const box = folderOf(mail);
  const listHref = correoHref({ folder, filter, query });

  useEffect(() => {
    if (!mail.unread || !mail.inbound || draft) return;
    void markReadAction(mail.id).catch(() => undefined);
  }, [mail.id, mail.unread, mail.inbound, draft]);

  useEffect(() => {
    setBody(draft ? (mail.body_text || mail.draft_reply || "") : (mail.draft_reply ?? ""));
    setSummary(mail.summary ?? "");
  }, [mail.id, mail.draft_reply, mail.summary, mail.body_text, draft]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-cream">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <Link href={listHref} className="text-[11px] font-medium text-ink/50 md:hidden">
          {es.correo.back}
        </Link>
        <p className="min-w-0 flex-1 font-mono text-[10px] tracking-[0.14em] text-ink/45">
          {FOLDER_LABEL[box].toUpperCase()}
        </p>
        <button
          type="button"
          disabled={pending || draft}
          onClick={() => {
            start(async () => {
              const result = await archiveMailAction(mail.id, !mail.archived);
              if (result.ok) {
                toast.success(mail.archived ? es.correo.unarchive : es.correo.archivedOk);
                router.push(listHref);
              }
            });
          }}
          className="rounded-full border border-ink/15 bg-sheet px-3.5 py-1.5 text-[12.5px] text-ink hover:bg-wash disabled:opacity-40"
        >
          {mail.archived ? es.correo.unarchive : es.correo.archive}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const form = new FormData();
              form.set("email_id", mail.id);
              const result = await taskFromMailAction(form);
              if (result.ok) {
                toast.success(es.tasks.saved);
                router.push(`/tareas/${result.taskId}`);
              } else toast.error(es.tasks.loadError);
            });
          }}
          className="rounded-full bg-overdue px-3.5 py-1.5 text-[12.5px] font-medium text-paper hover:bg-[#A94824]"
        >
          + {es.correo.createTask}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 md:px-6">
        <div className="rounded-[16px] bg-sheet px-5 py-5 shadow-[0_1px_0_rgba(23,48,31,0.06)] md:px-7 md:py-6">
          <h1 className="max-w-[36ch] text-[24px] font-semibold leading-snug tracking-tight text-ink">
            {mail.subject || "—"}
          </h1>
          <div className="mt-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine text-[11px] font-semibold text-cream">
              {initials(who)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{who}</p>
              <p className="text-[12px] text-ink/50">
                {displayAddress(mail.from_address)}
                <span className="mx-1.5 text-ink/25">·</span>
                {es.correo.you}
                <span className="mx-1.5 text-ink/25">·</span>
                {crDateLabel(crInstantYmd(mail.occurred_at))} · {crTimeLabel(mail.occurred_at)}
              </p>
            </div>
            {draft ? null : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await summarizeMailAction(mail.id);
                    if (result.ok && result.summary) {
                      setSummary(result.summary);
                      toast.success(es.correo.summarized);
                    } else toast.error(es.correo.summarizeError);
                  });
                }}
                className="shrink-0 rounded-full bg-pine px-3 py-1.5 text-[11px] font-medium text-cream hover:bg-[#1B3A28]"
              >
                {es.correo.summarize}
              </button>
            )}
          </div>

          {draft ? null : (
            <div className="mt-5 rounded-[12px] bg-pine px-4 py-3 text-cream">
              <p className="font-mono text-[10px] tracking-[0.14em] text-gold">{es.correo.summary.toUpperCase()}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-cream/90">
                {summary || es.correo.noSummary}
              </p>
            </div>
          )}

          <div className="mt-5">
            {html ? (
              <MailHtmlFrame html={html} />
            ) : (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {mail.body_text || mail.snippet}
              </p>
            )}
          </div>

          {mail.task_id ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#4A6D5E] px-4 py-3 text-cream">
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-cream/70">
                  {es.correo.taskFromMail.toUpperCase()}
                </p>
              </div>
              <Link
                href={`/tareas/${mail.task_id}`}
                className="rounded-full bg-sheet px-3 py-1.5 text-[12px] font-medium text-pine"
              >
                {es.correo.openTask}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="shrink-0 px-4 pb-4 md:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          start(async () => {
            const result = draft
              ? await sendDraftAction(new FormData(form))
              : await sendMailAction(new FormData(form));
            if (result.ok) {
              toast.success(es.correo.sentOk);
              setBody("");
              router.refresh();
            } else toast.error(es.correo.sendError);
          });
        }}
      >
        <input type="hidden" name="email_id" value={mail.id} />
        <div className="flex items-end gap-2 rounded-[14px] border border-ink/10 bg-sheet px-3 py-2">
          <textarea
            name="body"
            required
            maxLength={8000}
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={draft ? es.correo.composeBody : es.correo.replyTo.replace("{name}", who)}
            className="min-h-[40px] flex-1 resize-none bg-transparent py-1.5 text-[13px] outline-none placeholder:text-ink/40"
          />
          {draft ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await draftMailAction(mail.id);
                  if (result.ok && result.draft) {
                    setBody(result.draft);
                    toast.success(es.correo.draftReady);
                  } else toast.error(es.correo.draftError);
                });
              }}
              className="shrink-0 rounded-full border border-ink/10 px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-wash"
            >
              {es.correo.replyAi}
            </button>
          )}
          <Button type="submit" disabled={pending || !body.trim()} className="h-9 shrink-0 rounded-full px-4 text-[12px]">
            {es.correo.send}
          </Button>
        </div>
      </form>
    </div>
  );
}
