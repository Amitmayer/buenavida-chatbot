"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction } from "@/app/(app)/mensajes/actions";
import {
  crInstantYmd,
  crRelativeStamp,
  crTimeLabel,
  todayYmd,
} from "@/lib/agent/dates";
import { shortName, initials } from "@/lib/utils";
import type { ChatMessage } from "@/lib/db/types";

type Member = { user_id: string; full_name: string };

export function ThreadView({
  chatId,
  userId,
  members,
  initial,
  emptyLabel,
}: {
  chatId: string;
  userId: string;
  members: Member[];
  initial: ChatMessage[];
  emptyLabel?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const today = todayYmd();

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
          const row = payload.new as ChatMessage;
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
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-5 md:px-6">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-mute">{emptyLabel ?? es.mensajes.emptyThread}</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          const day = crInstantYmd(message.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const full = names.get(message.sender_id) ?? "—";
          const who = shortName(full);
          return (
            <div key={message.id} className="flex flex-col gap-3.5">
              {showDay ? (
                <p className="self-center font-mono text-[10.5px] text-ink/40">
                  {crRelativeStamp(day, today)}
                </p>
              ) : null}
              <div className={`flex max-w-[70%] gap-2.5 ${mine ? "ml-auto flex-row-reverse" : ""}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[10.5px] font-semibold text-[#3C5540]">
                  {initials(full)}
                </span>
                <div>
                  <div className={`mb-1 flex items-baseline gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="text-[12px] font-medium text-ink">{who}</span>
                    <span className="font-mono text-[10px] text-ink/40">
                      {crTimeLabel(message.created_at)}
                    </span>
                  </div>
                  <p
                    className={
                      mine
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
        className="shrink-0 px-4 pb-5 pt-3 md:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-center gap-2.5 rounded-md border border-ink/15 bg-sheet px-3.5 py-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={es.mensajes.composer}
            maxLength={4000}
            className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink/40"
          />
          <Button type="submit" disabled={pending} className="h-8 px-3.5 text-[12px]">
            {es.mensajes.send}
          </Button>
        </div>
      </form>
    </>
  );
}
