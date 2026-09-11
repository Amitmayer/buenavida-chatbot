"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { deleteChatMessageAction, editChatMessageAction } from "@/app/(app)/mensajes/actions";
import type { ChatMessage } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function MessageContent({
  message,
  mine,
  area,
  onChange,
}: {
  message: ChatMessage;
  mine: boolean;
  area: boolean;
  onChange: (next: ChatMessage) => void;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [pending, start] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const bubble = area
    ? mine
      ? "whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-ink px-4 py-3 text-[15px] leading-relaxed text-cream md:text-[16px]"
      : "inline-block whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] border-2 border-ink/12 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink md:text-[16px]"
    : mine
      ? "whitespace-pre-wrap rounded-md rounded-tr-sm bg-pine px-3.5 py-2.5 text-[13px] leading-relaxed text-cream"
      : "whitespace-pre-wrap rounded-md rounded-tl-sm border border-ink/10 bg-sheet px-3.5 py-2.5 text-[13px] leading-relaxed text-ink";

  if (message.deleted_at) {
    return (
      <p className={cn(bubble, mine ? "italic opacity-70" : "italic text-ink/45")}>{es.mensajes.deleted}</p>
    );
  }

  if (mode === "edit") {
    return (
      <form
        className="flex min-w-[180px] flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (!value || pending) return;
          start(async () => {
            const result = await editChatMessageAction(message.id, value);
            if (!result.ok) return;
            onChange({ ...message, content: value, edited_at: new Date().toISOString() });
            setMode("idle");
          });
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={4000}
          rows={3}
          autoFocus
          className="w-full rounded-[10px] border-2 border-ink/16 bg-white px-3 py-2 text-[13px] text-ink outline-none"
        />
        <span className="flex gap-2">
          <button type="submit" disabled={pending} className="text-[11px] font-medium text-pine">
            {es.tasks.save}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(message.content);
              setMode("idle");
            }}
            className="text-[11px] font-medium text-ink/55"
          >
            {es.tasks.cancel}
          </button>
        </span>
      </form>
    );
  }

  const canManage = mine && !message.via_assistant;

  return (
    <div className={cn("group", mine ? "flex flex-col items-end" : "")}>
      <div className="relative inline-block max-w-full">
        <p className={cn(bubble, canManage && "pr-9")}>{message.content}</p>
        {canManage ? (
          <div ref={menuRef} className={cn("absolute top-1", mine ? "right-1" : "right-1")}>
            <button
              type="button"
              aria-label={es.mensajes.messageMenu}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-opacity",
                mine
                  ? "text-white hover:bg-white/15 hover:text-white"
                  : "text-ink/40 hover:bg-ink/5 hover:text-ink",
                menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              )}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[132px] overflow-hidden rounded-[10px] border border-ink/12 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-wash"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraft(message.content);
                    setMode("edit");
                  }}
                >
                  {es.mensajes.edit}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-[13px] text-overdue hover:bg-wash"
                  onClick={() => {
                    setMenuOpen(false);
                    setMode("confirm");
                  }}
                >
                  {es.mensajes.delete}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {message.edited_at ? (
        <span className="mt-0.5 font-mono text-[10px] text-ink/40">{es.mensajes.edited}</span>
      ) : null}
      {canManage && mode === "confirm" ? (
        <span className="mt-1 flex gap-2">
          <span className="text-[11px] text-ink/55">{es.mensajes.deleteConfirm}</span>
          <button
            type="button"
            disabled={pending}
            className="text-[11px] font-medium text-overdue"
            onClick={() => {
              start(async () => {
                const result = await deleteChatMessageAction(message.id);
                if (!result.ok) return;
                onChange({ ...message, deleted_at: new Date().toISOString() });
                setMode("idle");
              });
            }}
          >
            {es.mensajes.delete}
          </button>
          <button type="button" className="text-[11px] font-medium text-ink/55" onClick={() => setMode("idle")}>
            {es.tasks.cancel}
          </button>
        </span>
      ) : null}
    </div>
  );
}
