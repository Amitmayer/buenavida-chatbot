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
import { initials } from "@/lib/utils";
import type { Email } from "@/lib/db/types";

export function MailThread({
  mail,
  folder,
  filter,
  query,
}: {
  mail: Email;
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
    if (mail.unread) void markReadAction(mail.id);
  }, [mail.id, mail.unread]);

  useEffect(() => {
    setBody(draft ? (mail.body_text || mail.draft_reply || "") : (mail.draft_reply ?? ""));
    setSummary(mail.summary ?? "");
  }, [mail.id, mail.draft_reply, mail.summary, mail.body_text, draft]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sheet">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/[0.06] px-4 py-3 md:px-6">
        <Link href={listHref} className="text-[11px] font-medium text-ink/50 md:hidden">
          {es.correo.back}
        </Link>
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
          className="rounded-[9px] border border-ink/10 px-3 py-2 text-[12.5px] text-ink hover:bg-hover disabled:opacity-40"
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
          className="rounded-[9px] bg-ink px-3 py-2 text-[12.5px] font-medium text-cream hover:bg-pine"
        >
          + {es.correo.createTask}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-4 pt-5 md:px-7">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink/40">
            {FOLDER_LABEL[box].toUpperCase()}
          </p>
          <h1 className="mt-2 max-w-[36ch] text-[22px] font-semibold leading-snug tracking-tight text-ink">
            {mail.subject || "—"}
          </h1>
          <div className="mt-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[11px] font-semibold text-[#3C5540]">
              {initials(who)}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-ink">{who}</p>
              <p className="text-[12px] text-ink/50">{displayAddress(mail.from_address)}</p>
              <p className="mt-0.5 font-mono text-[10.5px] text-ink/40">
                {crDateLabel(crInstantYmd(mail.occurred_at))} · {crTimeLabel(mail.occurred_at)}
              </p>
            </div>
          </div>
        </div>

        {draft ? null : (
          <div className="mt-5 px-4 md:px-7">
            <div className="rounded-[12px] border border-ink/10 bg-wash px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] tracking-[0.12em] text-ink/45">
                  {es.correo.summary.toUpperCase()}
                </p>
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
                  className="text-[11px] font-semibold text-pine"
                >
                  {es.correo.summarize}
                </button>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                {summary || es.correo.noSummary}
              </p>
            </div>
          </div>
        )}

        <div className="px-4 py-5 md:px-7">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {mail.body_text || mail.snippet}
          </p>
        </div>

        {mail.task_id ? (
          <div className="mx-4 mb-5 rounded-[12px] bg-pine px-4 py-3 text-cream md:mx-7">
            <p className="font-mono text-[10px] tracking-[0.12em] text-gold">
              {es.correo.taskFromMail.toUpperCase()}
            </p>
            <Link
              href={`/tareas/${mail.task_id}`}
              className="mt-2 inline-block text-[13px] font-medium text-cream"
            >
              {es.correo.openTask}
            </Link>
          </div>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-ink/[0.06] px-4 py-3 md:px-6"
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
        <div className="flex items-end gap-2 rounded-[12px] border border-ink/10 bg-paper px-3 py-2">
          <textarea
            name="body"
            required
            maxLength={8000}
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              draft ? es.correo.composeBody : es.correo.replyTo.replace("{name}", who)
            }
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
              className="shrink-0 rounded-[8px] px-2 py-1.5 text-[11px] font-semibold text-pine hover:bg-wash"
            >
              {es.correo.replyAi}
            </button>
          )}
          <Button type="submit" disabled={pending || !body.trim()} className="h-9 shrink-0 px-3 text-[12px]">
            {es.correo.send}
          </Button>
        </div>
      </form>
    </div>
  );
}
