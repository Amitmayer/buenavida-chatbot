"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { composeMailAction } from "@/app/(app)/correo/actions";

export function ComposeDialog({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData();
    form.set("to", to);
    form.set("subject", subject);
    form.set("body", body);
    form.set("save_draft", "0");
    start(async () => {
      const result = await composeMailAction(form);
      if (!result.ok) {
        toast.error(es.correo.sendError);
        return;
      }
      toast.success(es.correo.sentOk);
      onClose();
    });
  }

  return (
    <Modal title={es.correo.compose} onClose={onClose} size="xl">
      <form className="flex min-h-0 flex-1 flex-col gap-5" onSubmit={submit}>
        <label className="block shrink-0">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.to}</span>
          <Input
            name="to"
            type="email"
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={es.correo.toPlaceholder}
            className="h-12 border-2 text-[16px]"
          />
        </label>
        <label className="block shrink-0">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.composeSubject}</span>
          <Input
            name="subject"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-12 border-2 text-[16px]"
          />
        </label>
        <label className="flex min-h-0 flex-1 flex-col">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink/55">{es.correo.composeBody}</span>
          <Textarea
            name="body"
            required
            maxLength={8000}
            rows={18}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-0 flex-1 border-2 text-[16px] leading-relaxed"
          />
        </label>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button type="submit" disabled={pending} className="h-12 flex-1 rounded-[11px] text-[16px]">
            {es.correo.send}
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
