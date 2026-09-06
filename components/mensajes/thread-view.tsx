"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { z } from "zod";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction } from "@/app/(app)/mensajes/actions";
import {
  crDateLabel,
  crInstantYmd,
  crRelativeStamp,
  crTimeLabel,
  todayYmd,
} from "@/lib/agent/dates";
import { shortName, initials } from "@/lib/utils";
import type { ChatMessage, TaskPriority } from "@/lib/db/types";

const IncomingMessage = z.object({
  id: z.string().uuid(),
  chat_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string(),
  via_assistant: z.boolean().optional(),
  task_id: z.string().uuid().nullable().optional(),
});

type Member = { user_id: string; full_name: string };
type LinkedTask = {
  id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
};

export function ThreadView({
  chatId,
  userId,
  members,
  initial,
  emptyLabel,
  layout = "thread",
  tasks = [],
  composerPlaceholder,
}: {
  chatId: string;
  userId: string;
  members: Member[];
  initial: ChatMessage[];
  emptyLabel?: string;
  layout?: "thread" | "announcements" | "area";
  tasks?: LinkedTask[];
  composerPlaceholder?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const today = todayYmd();
  const feed = layout === "announcements";
  const area = layout === "area";

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const parsed = IncomingMessage.safeParse(payload.new);
          if (!parsed.success) return;
          const row: ChatMessage = {
            id: parsed.data.id,
            chat_id: parsed.data.chat_id,
            sender_id: parsed.data.sender_id,
            content: parsed.data.content,
            created_at: parsed.data.created_at,
            via_assistant: parsed.data.via_assistant ?? false,
            task_id: parsed.data.task_id ?? null,
          };
          setMessages((prev) => {
            if (prev.some((item) => item.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  function send() {
    const value = text.trim();
    if (!value || pending) return;
    setText("");
    start(async () => {
      await sendChatMessageAction(chatId, value);
    });
  }

  let lastDay = "";

  return (
    <>
      <div
        className={
          area
            ? "flex min-h-0 flex-1 flex-col justify-end gap-[18px] overflow-y-auto px-6 py-5"
            : "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-5 md:px-6"
        }
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-mute">{emptyLabel ?? es.mensajes.emptyThread}</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          const day = crInstantYmd(message.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const fromAssistant = message.via_assistant === true;
          const full = fromAssistant ? es.canales.assistant : (names.get(message.sender_id) ?? "—");
          const who = fromAssistant ? es.canales.assistant : shortName(full);
          const task = message.task_id ? taskById.get(message.task_id) : undefined;
          if (feed) {
            return (
              <div key={message.id} className="flex flex-col gap-3.5">
                {showDay ? (
                  <p className="self-center font-mono text-[10.5px] text-ink/40">
                    {crRelativeStamp(day, today)}
                  </p>
                ) : null}
                <article className="rounded-lg border border-line bg-sheet p-4">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span
                      className={
                        fromAssistant
                          ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine font-mono text-[11px] text-gold"
                          : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[10.5px] font-semibold text-[#3C5540]"
                      }
                    >
                      {fromAssistant ? "✳" : initials(full)}
                    </span>
                    <span className="text-[12px] font-medium text-ink">{who}</span>
                    <span className="font-mono text-[10px] text-ink/40">
                      {crTimeLabel(message.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{message.content}</p>
                  {task ? (
                    <Link
                      href={`/tareas/${task.id}`}
                      className="mt-3 block overflow-hidden rounded-md border border-ink/10 bg-paper"
                    >
                      <span className="block border-b border-ink/[0.07] px-3.5 py-2 font-mono text-[10px] tracking-[0.13em] text-ink/45">
                        {es.resultCard.openTask.toUpperCase()}
                      </span>
                      <span className="block px-3.5 py-2.5 text-[13.5px] font-medium leading-snug text-ink">
                        {task.title}
                      </span>
                      {task.due_date ? (
                        <span className="block px-3.5 pb-2.5 text-[11px] text-ink/50">
                          {crDateLabel(task.due_date)}
                        </span>
                      ) : null}
                    </Link>
                  ) : null}
                </article>
              </div>
            );
          }
          return (
            <div key={message.id} className="flex flex-col gap-3.5">
              {showDay ? (
                <p className="self-center font-mono text-[10.5px] text-ink/40">
                  {crRelativeStamp(day, today)}
                </p>
              ) : null}
              <div
                className={`flex ${area ? "max-w-[92%]" : "max-w-[70%] gap-2.5"} ${mine ? "ml-auto flex-row-reverse" : ""}`}
              >
                {area ? null : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[10.5px] font-semibold text-[#3C5540]">
                    {initials(full)}
                  </span>
                )}
                <div className={area && mine ? "flex flex-col items-end" : ""}>
                  <div className={`mb-1 flex items-baseline gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className={area ? "font-mono text-[13px] text-ink/70" : "text-[12px] font-medium text-ink"}>
                      {mine && area ? es.mensajes.you : who}
                      {area ? ` · ${crTimeLabel(message.created_at)}` : ""}
                    </span>
                    {area ? null : (
                      <span className="font-mono text-[10px] text-ink/40">
                        {crTimeLabel(message.created_at)}
                      </span>
                    )}
                  </div>
                  <p
                    className={
                      area
                        ? mine
                          ? "whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-ink px-4 py-3 text-[15px] leading-relaxed text-cream md:text-[16px]"
                          : "inline-block whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] border-2 border-ink/12 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink md:text-[16px]"
                        : mine
                          ? "whitespace-pre-wrap rounded-md rounded-tr-sm bg-pine px-3.5 py-2.5 text-[13px] leading-relaxed text-cream"
                          : "whitespace-pre-wrap rounded-md rounded-tl-sm border border-ink/10 bg-sheet px-3.5 py-2.5 text-[13px] leading-relaxed text-ink"
                    }
                  >
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className={area ? "shrink-0 border-t-2 border-ink/12 px-6 py-5" : "shrink-0 px-4 pb-5 pt-3 md:px-6"}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div
          className={
            area
              ? "flex items-center gap-3"
              : "flex items-center gap-2.5 rounded-md border border-ink/15 bg-sheet px-3.5 py-2.5"
          }
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={composerPlaceholder ?? es.mensajes.composer}
            maxLength={4000}
            className={
              area
                ? "h-11 min-w-0 flex-1 rounded-[12px] border-2 border-ink/16 bg-white px-4 text-[15px] outline-none placeholder:text-ink/55"
                : "h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink/40"
            }
          />
          <Button
            type="submit"
            disabled={pending}
            className={area ? "h-11 rounded-[12px] px-4 text-[15px]" : "h-8 px-3.5 text-[12px]"}
          >
            {es.mensajes.send}
          </Button>
        </div>
      </form>
    </>
  );
}
