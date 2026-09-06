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
      className="mt-3 w-full rounded-full border border-cream/25 py-1.5 text-[12px] text-cream/80 hover:bg-cream/10 hover:text-cream disabled:opacity-40"
    >
      {es.correo.disconnect}
    </button>
  );
}
