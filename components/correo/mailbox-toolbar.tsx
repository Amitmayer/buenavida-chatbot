"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { disconnectMailAction, syncMailAction } from "@/app/(app)/correo/actions";

export function MailboxToolbar({ address }: { address: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-ink/55">{address}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await syncMailAction();
            if (result.ok) toast.success(es.correo.synced);
            else toast.error(es.correo.syncError);
          });
        }}
      >
        {es.correo.sync}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await disconnectMailAction();
            if (result.ok) toast.success(es.correo.disconnected);
            else toast.error(es.correo.disconnectError);
          });
        }}
      >
        {es.correo.disconnect}
      </Button>
    </div>
  );
}
