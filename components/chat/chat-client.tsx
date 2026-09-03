"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { ResultCard } from "@/components/chat/result-card";

type Tool = {
  id: string;
  name: string;
  status: "pending" | "ok" | "error";
  result?: { ok?: boolean; data?: { id?: string; title?: string }; detail?: string };
};

type Item =
  | { type: "text"; id: string; role: "user" | "assistant"; text: string }
  | { type: "tool"; tool: Tool };

export function ChatClient({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    setBusy(true);
    const clientMessageId = crypto.randomUUID();
    setItems((prev) => [...prev, { type: "text", id: clientMessageId, role: "user", text: value }]);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        client_message_id: clientMessageId,
        text: value,
      }),
    });
    if (!res.body) {
      setBusy(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantId = `a-${clientMessageId}`;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as {
          type: string;
          text?: string;
          id?: string;
          name?: string;
          status?: Tool["status"];
          result?: Tool["result"];
        };
        if (event.type === "text" && event.text) {
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === "text" && last.role === "assistant" && last.id === assistantId) {
              return [...prev.slice(0, -1), { ...last, text: last.text + event.text }];
            }
            return [...prev, { type: "text", id: assistantId, role: "assistant", text: event.text ?? "" }];
          });
        }
        if (event.type === "tool" && event.id && event.name && event.status) {
          setItems((prev) => {
            const idx = prev.findIndex((item) => item.type === "tool" && item.tool.id === event.id);
            const tool: Tool = {
              id: event.id!,
              name: event.name!,
              status: event.status!,
              result: event.result,
            };
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { type: "tool", tool };
              return copy;
            }
            return [...prev, { type: "tool", tool }];
          });
        }
      }
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[840px] flex-1 flex-col px-4 py-7 md:px-7">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-[13.5px] leading-relaxed text-ink/70">{es.chat.empty}</p>
        ) : null}
        {items.map((item) =>
          item.type === "text" ? (
            <div key={item.id} className="flex gap-3">
              <span
                className={
                  item.role === "user"
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash font-mono text-[11px] text-ink"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine font-mono text-[11px] text-gold"
                }
              >
                {item.role === "user" ? "·" : "✳"}
              </span>
              <div className="min-w-0 flex-1">
                {item.role === "user" ? null : (
                  <p className="mb-1 text-[12px] font-medium text-ink/55">{es.chat.title}</p>
                )}
                <p className="text-[13.5px] leading-relaxed text-ink">{item.text}</p>
              </div>
            </div>
          ) : (
            <div key={item.tool.id} className="pl-10">
              <ResultCard
                status={item.tool.status}
                name={item.tool.name}
                result={item.tool.result}
              />
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <div className="shrink-0 pt-2">
        {items.length === 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {[es.chat.hintOverdue, es.chat.hintReschedule, es.chat.hintTeam, es.chat.hintCreate].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setText(hint)}
                className="rounded-full border border-ink/10 bg-sheet px-3.5 py-1.5 text-[12.5px] hover:border-gold hover:bg-sheet"
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null}
        <form
          className="flex items-center gap-2.5 rounded-md border border-ink/15 bg-sheet px-3.5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={es.chat.placeholder}
            className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink/40"
          />
          <Button type="submit" disabled={busy} className="h-8 px-3.5 text-[12px]">
            {es.chat.send}
          </Button>
        </form>
      </div>
    </div>
  );
}
