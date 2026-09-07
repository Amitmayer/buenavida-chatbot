"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { Modal } from "@/components/ui/modal";
import { MailWriteForm } from "@/components/correo/mail-write-form";
import { composeMailAction } from "@/app/(app)/correo/actions";

export function ComposeDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={es.correo.compose} onClose={onClose} size="xl">
      <MailWriteForm
        layout="compose"
        action={composeMailAction}
        hidden={{ save_draft: "0" }}
        onSuccess={onClose}
      />
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
