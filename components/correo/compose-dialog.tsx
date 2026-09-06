"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { composeDraftAction, composeMailAction } from "@/app/(app)/correo/actions";

export function ComposeDialog({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");

  function submit(saveDraft: boolean) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData();
      form.set("to", to);
      form.set("subject", subject);
      form.set("body", body);
      form.set("save_draft", saveDraft ? "1" : "0");
      start(async () => {
        const result = await composeMailAction(form);
        if (!result.ok) {
          toast.error(es.correo.sendError);
          return;
        }
        toast.success(result.draft ? es.correo.draftSaved : es.correo.sentOk);
        onClose();
      });
    };
  }

  return (
    <Modal title={es.correo.compose} onClose={onClose} size="xl">
      <form className="space-y-5" onSubmit={submit(false)}>
        <div className="rounded-[16px] border-2 border-ink/10 bg-wash px-5 py-4">
          <p className="text-[13px] font-medium text-ink/70">{es.correo.composeAiHint}</p>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={es.correo.composeAiPlaceholder}
            maxLength={2000}
            rows={3}
            className="mt-3 min-h-[72px] border-2 bg-white text-[14px]"
          />
          <button
            type="button"
            disabled={pending || !prompt.trim()}
            onClick={() => {
              const form = new FormData();
              form.set("to", to);
              form.set("subject", subject);
              form.set("prompt", prompt.trim());
              start(async () => {
                const result = await composeDraftAction(form);
                if (result.ok && result.draft) {
                  setBody(result.draft);
                  toast.success(es.correo.draftReady);
                  return;
                }
                toast.error(es.correo.draftError);
              });
            }}
            className="mt-3 flex h-10 items-center rounded-[11px] border-2 border-ink/20 bg-sheet px-4 text-[14px] font-semibold text-ink hover:border-ink disabled:opacity-40"
          >
            {es.correo.composeAi}
          </button>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.to}</span>
          <Input
            name="to"
            type="email"
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={es.correo.toPlaceholder}
            className="h-10 border-2 text-[14px]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.composeSubject}</span>
          <Input
            name="subject"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-10 border-2 text-[14px]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.composeBody}</span>
          <Textarea
            name="body"
            required
            maxLength={8000}
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[220px] border-2 text-[14px] leading-relaxed"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending} className="h-10 flex-1 rounded-[11px] text-[15px]">
            {es.correo.send}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="h-10 rounded-[11px] text-[15px]"
            onClick={() => {
              const form = new FormData();
              form.set("to", to);
              form.set("subject", subject);
              form.set("body", body);
              form.set("save_draft", "1");
              start(async () => {
                const result = await composeMailAction(form);
                if (!result.ok) {
                  toast.error(es.correo.sendError);
                  return;
                }
                toast.success(es.correo.draftSaved);
                onClose();
              });
            }}
          >
            {es.correo.saveDraft}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ComposeButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-[9px] bg-pine px-3 py-2 text-[12.5px] font-medium text-cream hover:bg-[#1B3A28]"
        }
      >
        + {es.correo.compose}
      </button>
      {open ? <ComposeDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
