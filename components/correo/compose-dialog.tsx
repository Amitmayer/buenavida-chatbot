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

  function submit(saveDraft: boolean) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
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
    <Modal title={es.correo.compose} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit(false)}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/55">{es.correo.to}</span>
          <Input name="to" type="email" required placeholder={es.correo.toPlaceholder} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/55">{es.correo.composeSubject}</span>
          <Input name="subject" maxLength={200} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/55">{es.correo.composeBody}</span>
          <Textarea name="body" required maxLength={8000} rows={7} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {es.correo.send}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              const form = event.currentTarget.form;
              if (!form) return;
              submit(true)({ preventDefault() {}, currentTarget: form } as React.FormEvent<HTMLFormElement>);
            }}
          >
            {es.correo.saveDraft}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ComposeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] bg-ink px-3 py-2 text-[12.5px] font-medium text-cream hover:bg-pine"
      >
        + {es.correo.compose}
      </button>
      {open ? <ComposeDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
