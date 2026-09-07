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
import { replyAllCc, replyToAddress } from "@/lib/email/addresses";
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
import { MailWriteForm } from "@/components/correo/mail-write-form";
import { initials } from "@/lib/utils";
import type { Email } from "@/lib/db/types";

export function MailThread({
  mail,
  html,
  folder,
  filter,
  query,
  selfEmail,
}: {
  mail: Email;
  html: string;
  folder: MailFolder;
  filter: MailFilter;
  query: string;
  selfEmail: string;
}) {
  const [summary, setSummary] = useState(mail.summary ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const who = displayName(mail.from_address);
  const draft = isDraft(mail);
  const box = folderOf(mail);
  const listHref = correoHref({ folder, filter, query });
  const replyTo = replyToAddress({
    fromAddress: mail.from_address,
    toAddresses: mail.to_addresses,
    inbound: mail.inbound,
  });
  const replyAll = replyAllCc({
    fromAddress: mail.from_address,
    toAddresses: mail.to_addresses,
    selfEmail,
  });

  useEffect(() => {
    if (!mail.unread || !mail.inbound || draft) return;
    void markReadAction(mail.id).catch(() => undefined);
  }, [mail.id, mail.unread, mail.inbound, draft]);

  useEffect(() => {
    setSummary(mail.summary ?? "");
  }, [mail.id, mail.summary]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="flex h-[56px] shrink-0 flex-wrap items-center gap-2.5 border-b-2 border-ink/15 px-4 md:h-[72px] md:gap-3 md:px-7">
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
              } else {
                toast.error(mail.archived ? es.correo.unarchiveError : es.correo.archiveError);
              }
            });
          }}
          className="h-[36px] rounded-[11px] border-2 border-ink/20 px-4 text-[14px] font-semibold text-ink hover:border-ink hover:bg-white disabled:opacity-40 md:h-[42px] md:text-[15px]"
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
          className="flex h-[36px] items-center gap-1.5 rounded-[11px] bg-overdue px-4 text-[14px] font-semibold text-white hover:bg-[#A8501F] md:h-[42px] md:text-[15px]"
        >
          <span className="text-[20px] leading-none">+</span>
          {es.correo.createTask}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-5 md:px-9">
        <div className="min-h-0 flex-1 overflow-auto rounded-[22px] border-2 border-ink/10 bg-sheet px-5 py-6 md:px-9 md:py-8">
          <h1 className="max-w-[28ch] text-[22px] font-bold leading-[1.15] tracking-tight text-ink md:text-[28px]">
            {mail.subject || "—"}
          </h1>
          <div className="mt-5 flex items-center gap-4 border-b-2 border-ink/10 pb-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-sage font-mono text-[15px] font-semibold text-white">
              {initials(who)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink md:text-[17px]">{who}</p>
              <p className="mt-0.5 truncate font-mono text-[12px] text-ink/70 md:text-[14px]">
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
                className="hidden h-9 shrink-0 rounded-xl bg-ink px-4 text-[14px] font-semibold text-cream hover:bg-pine sm:flex sm:items-center"
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
              <p className="mt-2 text-[14px] leading-relaxed md:text-[16px]">
                {summary || es.correo.noSummary}
              </p>
            </div>
          )}

          <div className="mt-5 max-w-[820px] text-[14px] leading-[1.6] text-ink md:text-[16px]">
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
              className="flex h-9 items-center rounded-xl bg-white px-4 text-[14px] font-semibold text-ink"
            >
              {es.correo.openTask}
            </Link>
          </div>
        ) : null}

        <div className="shrink-0 py-4 md:py-6">
          <MailWriteForm
            layout="reply"
            showSubject={draft}
            requireTo
            resetKey={mail.id}
            action={draft ? sendDraftAction : sendMailAction}
            hidden={{ email_id: mail.id }}
            defaults={{
              to: draft ? mail.to_addresses.join(", ") : replyTo,
              subject: mail.subject,
              body: draft ? mail.body_text || mail.draft_reply || "" : mail.draft_reply ?? "",
            }}
            replyAllCc={draft ? "" : replyAll.filter((email) => email !== replyTo).join(", ")}
            bodyPlaceholder={draft ? es.correo.composeBody : es.correo.replyTo.replace("{name}", who)}
            onAiDraft={
              draft
                ? undefined
                : async () => {
                    const result = await draftMailAction(mail.id);
                    if (result.ok && result.draft) {
                      toast.success(es.correo.draftReady);
                      return result.draft;
                    }
                    toast.error(es.correo.draftError);
                    return null;
                  }
            }
            onSuccess={() => router.refresh()}
          />
        </div>
      </div>
    </div>
  );
}
