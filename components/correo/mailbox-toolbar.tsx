"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { disconnectMailAction, syncMailAction } from "@/app/(app)/correo/actions";

export function MailboxToolbar({ address }: { address: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3 border-b border-ink/[0.06] px-4 py-2">
      <p className="min-w-0 flex-1 truncate text-[11px] text-ink/45">{address}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await syncMailAction();
            if (result.ok) toast.success(es.correo.synced);
            else toast.error(es.correo.syncError);
          });
        }}
        className="text-[11px] font-medium text-ink/60 hover:text-ink disabled:opacity-40"
      >
        {es.correo.sync}
      </button>
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
        className="text-[11px] font-medium text-ink/45 hover:text-ink disabled:opacity-40"
      >
        {es.correo.disconnect}
      </button>
    </div>
  );
}
