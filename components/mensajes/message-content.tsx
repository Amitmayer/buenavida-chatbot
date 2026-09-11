"use client";

import { useState, useTransition } from "react";
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
  const [draft, setDraft] = useState(message.content);
  const [pending, start] = useTransition();

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
          className="w-full rounded-[10px] border-2 border-ink/16 bg-white px-3 py-2 text-[13px] text-ink outline-none"
        />
        <span className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="text-[11px] font-medium text-pine"
          >
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

  return (
    <div className={mine ? "flex flex-col items-end" : ""}>
      <p className={bubble}>{message.content}</p>
      {message.edited_at ? (
        <span className="mt-0.5 font-mono text-[10px] text-ink/40">{es.mensajes.edited}</span>
      ) : null}
      {mine && !message.via_assistant ? (
        mode === "confirm" ? (
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
        ) : (
          <span className="mt-1 flex gap-2">
            <button
              type="button"
              className="text-[11px] font-medium text-ink/45 hover:text-ink"
              onClick={() => {
                setDraft(message.content);
                setMode("edit");
              }}
            >
              {es.mensajes.edit}
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-ink/45 hover:text-ink"
              onClick={() => setMode("confirm")}
            >
              {es.mensajes.delete}
            </button>
          </span>
        )
      ) : null}
    </div>
  );
}
