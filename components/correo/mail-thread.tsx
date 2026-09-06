"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="flex h-[64px] shrink-0 flex-wrap items-center gap-3 border-b-2 border-ink/15 px-4 md:h-[92px] md:gap-3.5 md:px-9">
        <Link href={listHref} className="text-[13px] font-medium text-ink/60 md:hidden">
          {es.correo.back}
        </Link>
        <p className="min-w-0 flex-1 font-mono text-[12px] font-medium tracking-[0.18em] text-ink/70 md:text-[15px]">
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
          className="h-[42px] rounded-[13px] border-2 border-ink/20 px-5 text-[16px] font-semibold text-ink hover:border-ink hover:bg-white disabled:opacity-40 md:h-[50px] md:text-[20px]"
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
          className="flex h-[42px] items-center gap-2 rounded-[13px] bg-overdue px-5 text-[16px] font-semibold text-white hover:bg-[#A8501F] md:h-[50px] md:text-[20px]"
        >
          <span className="text-[20px] leading-none">+</span>
          {es.correo.createTask}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-5 md:px-9">
        <div className="min-h-0 flex-1 overflow-auto rounded-[22px] border-2 border-ink/10 bg-sheet px-5 py-6 md:px-9 md:py-8">
          <h1 className="max-w-[28ch] text-[26px] font-bold leading-[1.12] tracking-tight text-ink md:text-[40px]">
            {mail.subject || "—"}
          </h1>
          <div className="mt-5 flex items-center gap-4 border-b-2 border-ink/10 pb-6">
            <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] bg-sage font-mono text-[19px] font-semibold text-white">
              {initials(who)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-semibold text-ink md:text-[23px]">{who}</p>
              <p className="mt-1 truncate font-mono text-[14px] text-ink/70 md:text-[18px]">
                {displayAddress(mail.from_address)} → {es.correo.you} · {crDateLabel(crInstantYmd(mail.occurred_at))}{" "}
                {crTimeLabel(mail.occurred_at)}
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
                className="hidden h-11 shrink-0 rounded-xl bg-ink px-5 text-[16px] font-semibold text-cream hover:bg-pine sm:flex sm:items-center md:h-11 md:text-[18px]"
              >
                {es.correo.summarize}
              </button>
            )}
          </div>

          {draft ? null : (
            <div className="mt-6 rounded-2xl bg-ink px-6 py-5 text-cream">
              <p className="font-mono text-[13px] font-medium tracking-[0.18em] text-gold">
                {es.correo.summary.toUpperCase()}
              </p>
              <p className="mt-2.5 text-[16px] leading-relaxed md:text-[22px]">
                {summary || es.correo.noSummary}
              </p>
            </div>
          )}

          <div className="mt-6 max-w-[820px] text-[16px] leading-[1.62] text-ink md:text-[23px]">
            {html ? (
              <MailHtmlFrame html={html} />
            ) : (
              <p className="whitespace-pre-wrap">{mail.body_text || mail.snippet}</p>
            )}
          </div>
        </div>

        {mail.task_id ? (
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-4 rounded-[18px] bg-sage px-7 py-5 text-white">
            <div className="min-w-[200px] flex-1">
              <p className="font-mono text-[13px] font-medium tracking-[0.18em]">
                {es.correo.taskFromMail.toUpperCase()}
              </p>
            </div>
            <Link
              href={`/tareas/${mail.task_id}`}
              className="flex h-[46px] items-center rounded-xl bg-white px-5 text-[17px] font-semibold text-ink"
            >
              {es.correo.openTask}
            </Link>
          </div>
        ) : null}

        <form
          className="shrink-0 py-4 md:py-6"
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
          <div className="flex items-center gap-3.5">
            <textarea
              name="body"
              required
              maxLength={8000}
              rows={1}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={draft ? es.correo.composeBody : es.correo.replyTo.replace("{name}", who)}
              className="h-[56px] min-w-0 flex-1 resize-none rounded-2xl border-2 border-ink/15 bg-white px-5 py-4 text-[16px] outline-none placeholder:text-ink/55 focus:border-ink md:h-[66px] md:text-[22px]"
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
                className="hidden h-[56px] shrink-0 rounded-2xl border-2 border-ink/20 px-6 text-[16px] font-semibold text-ink hover:border-ink hover:bg-white md:flex md:h-[66px] md:items-center md:text-[20px]"
              >
                {es.correo.replyAi}
              </button>
            )}
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="flex h-[56px] shrink-0 items-center rounded-2xl bg-ink px-7 text-[18px] font-semibold text-cream hover:bg-pine disabled:opacity-40 md:h-[66px] md:text-[22px]"
            >
              {es.correo.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
