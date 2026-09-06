"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
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
    <div className="flex min-h-0 flex-1 flex-col items-center px-4 pt-6 md:px-9">
      <div className="flex min-h-0 w-full max-w-[1100px] flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 overflow-y-auto pb-6">
          {items.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-ink/70 md:text-[17px]">{es.chat.empty}</p>
          ) : null}
          {items.map((item) =>
            item.type === "text" ? (
              item.role === "user" ? (
                <div key={item.id} className="flex justify-end">
                  <p className="max-w-[640px] rounded-[16px] rounded-br-[6px] bg-ink px-5 py-3.5 text-[15px] leading-relaxed text-cream md:text-[17px]">
                    {item.text}
                  </p>
                </div>
              ) : (
                <div key={item.id} className="flex gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold font-mono text-[13px] font-semibold text-ink">
                    {es.chat.assistantMark}
                  </span>
                  <p className="max-w-[680px] rounded-[16px] rounded-bl-[6px] border-2 border-ink/12 bg-sheet px-5 py-3.5 text-[15px] leading-relaxed text-ink md:text-[17px]">
                    {item.text}
                  </p>
                </div>
              )
            ) : (
              <div key={item.tool.id} className="flex gap-3.5 pl-[60px]">
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
        <div className="shrink-0 pb-7">
          <div className="mb-4 flex flex-wrap gap-3">
            {[es.chat.hintOverdue, es.chat.hintReschedule, es.chat.hintCreate].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setText(hint)}
                className="flex h-9 items-center rounded-full border-2 border-ink/18 bg-wash px-4 text-[13px] font-medium text-ink hover:border-ink hover:bg-white md:text-[14px]"
              >
                {hint}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={es.chat.placeholder}
              className="h-[46px] min-w-0 flex-1 rounded-xl border-2 border-ink/16 bg-white px-4 text-[15px] outline-none placeholder:text-ink/55 md:h-[52px] md:text-[16px]"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex h-[46px] items-center rounded-xl bg-ink px-5 text-[15px] font-semibold text-cream hover:bg-pine disabled:opacity-40 md:h-[52px] md:text-[16px]"
            >
              {es.chat.send}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
