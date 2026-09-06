"use client";

import { useTransition } from "react";
import { RefreshCw, Search } from "lucide-react";
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
    <div className="flex items-center gap-2">
      <form className="relative min-w-0 flex-1" action="/correo">
        <input type="hidden" name="buzon" value={folder} />
        <input type="hidden" name="filtro" value={filter} />
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink"
          strokeWidth={2.5}
        />
        <input
          name="q"
          defaultValue={query}
          placeholder={es.correo.search}
          className="h-[50px] w-full rounded-[13px] border-2 border-ink/15 bg-white pl-11 pr-4 text-[16px] outline-none placeholder:text-ink/55 focus:border-ink md:h-[54px] md:text-[20px]"
        />
      </form>
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
        className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[13px] border-2 border-ink/15 bg-white text-ink hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-40 md:h-[54px] md:w-[54px]"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} strokeWidth={1.75} />
      </button>
    </div>
  );
}
