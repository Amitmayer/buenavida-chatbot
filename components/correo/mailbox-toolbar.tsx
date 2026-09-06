"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { syncMailAction } from "@/app/(app)/correo/actions";
import type { MailFilter, MailFolder } from "@/lib/email/mailbox";

export function MailSearch({
  folder,
  filter,
  query,
}: {
  folder: MailFolder;
  filter: MailFilter;
  query: string;
}) {
  const [pending, start] = useTransition();

  return (
    <form className="relative" action="/correo">
      <input type="hidden" name="buzon" value={folder} />
      <input type="hidden" name="filtro" value={filter} />
      <input
        name="q"
        defaultValue={query}
        placeholder={es.correo.search}
        className="h-11 w-full rounded-[12px] border border-ink/10 bg-sheet px-3.5 pr-11 text-[13px] outline-none placeholder:text-ink/40 focus:border-pine"
      />
      <button
        type="button"
        disabled={pending}
        aria-label={es.correo.sync}
        onClick={() => {
          start(async () => {
            const result = await syncMailAction();
            if (result.ok) toast.success(es.correo.synced);
            else toast.error(es.correo.syncError);
          });
        }}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/45 hover:bg-wash hover:text-ink disabled:opacity-40"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} strokeWidth={1.75} />
      </button>
    </form>
  );
}
