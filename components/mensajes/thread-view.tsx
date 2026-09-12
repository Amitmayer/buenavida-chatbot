"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { z } from "zod";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction } from "@/app/(app)/mensajes/actions";
import { MessageContent } from "@/components/mensajes/message-content";
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
  edited_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  via_assistant: z.boolean().optional(),
  task_id: z.string().uuid().nullable().optional(),
  attachment_id: z.string().uuid().nullable().optional(),
});

function toMessage(row: z.infer<typeof IncomingMessage>): ChatMessage {
  return {
    id: row.id,
    chat_id: row.chat_id,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
    edited_at: row.edited_at ?? null,
    deleted_at: row.deleted_at ?? null,
    via_assistant: row.via_assistant ?? false,
    task_id: row.task_id ?? null,
    attachment_id: row.attachment_id ?? null,
  };
}

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
  const [uploading, setUploading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
          const row = toMessage(parsed.data);
          setMessages((prev) => {
            if (prev.some((item) => item.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const parsed = IncomingMessage.safeParse(payload.new);
          if (!parsed.success) return;
          const row = toMessage(parsed.data);
          setMessages((prev) => prev.map((item) => (item.id === row.id ? row : item)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId]);



  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const metaRes = await fetch("/api/files/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!metaRes.ok) return;
      const meta = (await metaRes.json()) as { signedUrl?: string; path?: string };
      const signedUrl = meta.signedUrl;
      const path = meta.path;
      if (!signedUrl || !path) return;
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) return;
      const confirm = await fetch("/api/files/channel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          path,
        }),
      });
      if (!confirm.ok) return;
      const body = (await confirm.json()) as { file?: { id: string; filename: string } };
      if (!body.file?.id) return;
      start(async () => {
        await sendChatMessageAction(chatId, file.name, body.file!.id);
      });
    } finally {
      setUploading(false);
    }
  }

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
                  <MessageContent
                    message={message}
                    mine={mine}
                    area={false}
                    onChange={(next) =>
                      setMessages((prev) => prev.map((item) => (item.id === next.id ? next : item)))
                    }
                  />
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
                  <MessageContent
                    message={message}
                    mine={mine}
                    area={area}
                    onChange={(next) =>
                      setMessages((prev) => prev.map((item) => (item.id === next.id ? next : item)))
                    }
                  />
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
              ? "flex items-end gap-3"
              : "flex items-end gap-2.5 rounded-md border border-ink/15 bg-sheet px-3.5 py-2.5"
          }
        >
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadFile(file);
            }}
          />
          <button
            type="button"
            aria-label={es.mensajes.attachFile}
            title={es.mensajes.attachFile}
            disabled={uploading || pending}
            onClick={() => fileInput.current?.click()}
            className={
              area
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border-2 border-ink/16 text-ink hover:bg-white disabled:opacity-50"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-ink/55 hover:bg-wash hover:text-ink disabled:opacity-50"
            }
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={composerPlaceholder ?? es.mensajes.composer}
            maxLength={4000}
            rows={1}
            className={
              area
                ? "max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-[12px] border-2 border-ink/16 bg-white px-4 py-2.5 text-[15px] outline-none placeholder:text-ink/55"
                : "max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13px] outline-none placeholder:text-ink/40"
            }
          />
          <Button
            type="submit"
            disabled={pending || uploading || !text.trim()}
            className={area ? "h-11 rounded-[12px] px-4 text-[15px]" : "h-8 px-3.5 text-[12px]"}
          >
            {es.mensajes.send}
          </Button>
        </div>
      </form>
    </>
  );
}
