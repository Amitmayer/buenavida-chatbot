"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/client";
import { startConversationAction } from "@/app/(app)/chat/actions";

type Row = { id: string; title: string | null };

export function ChatHistoryButton() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("c");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, start] = useTransition();

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || rows) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("conversations")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(20);
    setRows(data ?? []);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex h-[42px] items-center rounded-[13px] border-2 border-ink/20 bg-sheet px-4 text-[15px] font-semibold text-ink hover:border-ink hover:bg-white md:h-[50px] md:px-5 md:text-[19px]"
      >
        {es.chat.history}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[280px] overflow-hidden rounded-[14px] border-2 border-ink/12 bg-sheet p-2 shadow-lg">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => startConversationAction())}
            className="mb-1 flex h-10 w-full items-center rounded-[10px] bg-ink px-3 text-[15px] font-semibold text-cream"
          >
            {es.chat.newConversation}
          </button>
          <ul className="max-h-64 overflow-auto">
            {(rows ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/chat?c=${row.id}`);
                  }}
                  className={`flex w-full truncate rounded-[10px] px-3 py-2 text-left text-[15px] ${
                    row.id === current ? "bg-wash font-semibold" : "hover:bg-wash"
                  }`}
                >
                  {row.title || es.chat.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
