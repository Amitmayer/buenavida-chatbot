"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { disconnectMailAction } from "@/app/(app)/correo/actions";

export function MailDisconnect() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await disconnectMailAction();
          if (result.ok) toast.success(es.correo.disconnected);
          else toast.error(es.correo.disconnectError);
        });
      }}
      className="mt-3.5 flex h-[42px] w-full items-center justify-center rounded-[11px] border-[1.5px] border-cream/35 text-[16px] font-medium text-cream/90 hover:border-overdue hover:bg-overdue/25 hover:text-white disabled:opacity-40"
    >
      {es.correo.disconnect}
    </button>
  );
}
