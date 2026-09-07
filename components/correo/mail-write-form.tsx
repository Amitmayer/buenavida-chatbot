"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { MAIL_FILE_ACCEPT, MAX_MAIL_ATTACHMENTS, mimeFromFilename } from "@/lib/email/mail-files";
import { validateUpload } from "@/lib/storage";
import { cn } from "@/lib/utils";

type MailActionResult = { ok: true } | { ok: false; detail?: string; message?: string };

export function MailWriteForm({
  action,
  hidden,
  defaults,
  layout = "compose",
  showSubject = true,
  requireTo = true,
  replyAllCc = "",
  onAiDraft,
  onSuccess,
  bodyPlaceholder,
  resetKey,
}: {
  action: (form: FormData) => Promise<MailActionResult>;
  hidden?: Record<string, string>;
  defaults?: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string };
  layout?: "compose" | "reply";
  showSubject?: boolean;
  requireTo?: boolean;
  replyAllCc?: string;
  onAiDraft?: () => Promise<string | null>;
  onSuccess?: () => void;
  bodyPlaceholder?: string;
  resetKey?: string;
}) {
  const compose = layout === "compose";
  const [pending, start] = useTransition();
  const [to, setTo] = useState(defaults?.to ?? "");
  const [cc, setCc] = useState(defaults?.cc ?? "");
  const [bcc, setBcc] = useState(defaults?.bcc ?? "");
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState(defaults?.body ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(Boolean(defaults?.cc));
  const [showBcc, setShowBcc] = useState(Boolean(defaults?.bcc));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTo(defaults?.to ?? "");
    setCc(defaults?.cc ?? "");
    setBcc(defaults?.bcc ?? "");
    setSubject(defaults?.subject ?? "");
    setBody(defaults?.body ?? "");
    setFiles([]);
    setShowCc(Boolean(defaults?.cc));
    setShowBcc(Boolean(defaults?.bcc));
    // Reset only when switching messages, not when a draft_reply lands after "Responder con IA".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_MAIL_ATTACHMENTS) {
        toast.error(es.correo.tooManyFiles);
        break;
      }
      const check = validateUpload({
        mimeType: file.type || mimeFromFilename(file.name),
        sizeBytes: file.size,
        filename: file.name,
      });
      if (!check.ok) {
        toast.error(check.detail);
        continue;
      }
      const total = next.reduce((sum, item) => sum + item.size, 0) + file.size;
      if (total > MAX_UPLOAD_BYTES) {
        toast.error(es.correo.filesTooLarge);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData();
    for (const [key, value] of Object.entries(hidden ?? {})) form.set(key, value);
    form.set("to", to);
    form.set("cc", cc);
    form.set("bcc", bcc);
    form.set("subject", subject);
    form.set("body", body);
    for (const file of files) form.append("files", file);
    start(async () => {
      const result = await action(form);
      if (!result.ok) {
        toast.error(result.message ?? es.correo.sendError);
        return;
      }
      toast.success(es.correo.sentOk);
      setBody("");
      setFiles([]);
      onSuccess?.();
    });
  }

  const fieldClass = compose ? "h-12 border-2 text-[16px]" : "h-11 border-2 text-[15px]";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink/55";

  return (
    <form className={cn("flex min-h-0 flex-col gap-3", compose && "flex-1 gap-5")} onSubmit={submit}>
      <label className="block shrink-0">
        <span className={labelClass}>{es.correo.to}</span>
        <Input
          name="to"
          type="text"
          inputMode="email"
          autoComplete="email"
          required={requireTo}
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder={es.correo.toPlaceholder}
          className={fieldClass}
        />
      </label>

      {showCc ? (
        <label className="block shrink-0">
          <span className={labelClass}>{es.correo.cc}</span>
          <Input
            name="cc"
            type="text"
            inputMode="email"
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder={es.correo.ccPlaceholder}
            className={fieldClass}
          />
        </label>
      ) : null}

      {showBcc ? (
        <label className="block shrink-0">
          <span className={labelClass}>{es.correo.bcc}</span>
          <Input
            name="bcc"
            type="text"
            inputMode="email"
            value={bcc}
            onChange={(event) => setBcc(event.target.value)}
            placeholder={es.correo.bccPlaceholder}
            className={fieldClass}
          />
        </label>
      ) : null}

      {!showCc || !showBcc || replyAllCc ? (
        <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
          {showCc ? null : (
            <button type="button" className="text-[13px] font-semibold text-ink/55 hover:text-ink" onClick={() => setShowCc(true)}>
              {es.correo.cc}
            </button>
          )}
          {showBcc ? null : (
            <button type="button" className="text-[13px] font-semibold text-ink/55 hover:text-ink" onClick={() => setShowBcc(true)}>
              {es.correo.bcc}
            </button>
          )}
          {replyAllCc ? (
            <button
              type="button"
              className="text-[13px] font-semibold text-ink/55 hover:text-ink"
              onClick={() => {
                setCc(replyAllCc);
                setShowCc(true);
              }}
            >
              {es.correo.replyAll}
            </button>
          ) : null}
        </div>
      ) : null}

      {showSubject ? (
        <label className="block shrink-0">
          <span className={labelClass}>{es.correo.composeSubject}</span>
          <Input
            name="subject"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={fieldClass}
          />
        </label>
      ) : null}

      <label className={cn("flex flex-col", compose ? "min-h-0 flex-1" : "shrink-0")}>
        {compose ? <span className={labelClass}>{es.correo.composeBody}</span> : null}
        <Textarea
          name="body"
          required
          maxLength={8000}
          rows={compose ? 18 : 4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={bodyPlaceholder ?? (compose ? undefined : es.correo.replyPlaceholder)}
          className={cn("border-2 text-[16px] leading-relaxed", compose ? "min-h-0 flex-1" : "min-h-[96px]")}
        />
      </label>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={MAIL_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />

      {files.length ? (
        <ul className="flex shrink-0 flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex max-w-full items-center gap-1.5 rounded-[9px] border border-ink/15 bg-white px-2.5 py-1.5 text-[13px]"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink/45 hover:bg-wash hover:text-ink"
                aria-label={es.correo.removeFile}
                onClick={() => setFiles(files.filter((_, item) => item !== index))}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {compose ? <p className="text-[12px] text-ink/45">{es.correo.attachHint}</p> : null}

      <div className={cn("flex shrink-0 flex-wrap items-center gap-3", compose && "gap-3")}>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="flex h-12 items-center gap-2 rounded-[11px] border-2 border-ink/20 px-4 text-[14px] font-semibold text-ink hover:border-ink hover:bg-white disabled:opacity-40"
        >
          <Paperclip className="h-4 w-4" strokeWidth={2.25} />
          {es.correo.attach}
        </button>
        {onAiDraft ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const text = await onAiDraft();
                if (text) setBody(text);
              });
            }}
            className="hidden h-12 shrink-0 items-center rounded-[11px] border-2 border-ink/20 px-4 text-[14px] font-semibold text-ink hover:border-ink hover:bg-white disabled:opacity-40 md:flex"
          >
            {es.correo.replyAi}
          </button>
        ) : null}
        {compose ? (
          <Button type="submit" disabled={pending} className="h-12 flex-1 rounded-[11px] text-[16px]">
            {es.correo.send}
          </Button>
        ) : (
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="ml-auto flex h-12 items-center rounded-xl bg-ink px-5 text-[15px] font-semibold text-cream hover:bg-pine disabled:opacity-40 md:text-[16px]"
          >
            {es.correo.send}
          </button>
        )}
      </div>
    </form>
  );
}
