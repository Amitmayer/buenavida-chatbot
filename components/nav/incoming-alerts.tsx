"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";
import { X } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/client";
import { displayName } from "@/lib/email/mailbox";
import { clipPreview, isRecentIso } from "@/lib/notify/preview";
import { syncMailAction } from "@/app/(app)/correo/actions";
import { captureError } from "@/lib/sentry";

const WATCH_MS = 30_000;
const SHOW_MS = 8_000;
const MAX_CARDS = 3;

const ChatInsert = z.object({
  id: z.string().uuid(),
  chat_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
});

const asBool = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((value) => value === true || value === "true" || value === "t" || value === 1);

const MailInsert = z.object({
  id: z.string().uuid(),
  from_address: z.string(),
  subject: z.string().optional().default(""),
  snippet: z.string().optional().default(""),
  inbound: asBool,
  is_draft: asBool.optional().default(false),
  occurred_at: z.string().optional(),
});

type Card = {
  id: string;
  kind: "mail" | "chat";
  href: string;
  from: string;
  title: string;
};

function mailCard(row: {
  id: string;
  from_address: string;
  subject: string;
  snippet: string;
}): Card {
  return {
    id: row.id,
    kind: "mail",
    href: `/correo/${row.id}`,
    from: displayName(row.from_address),
    title: clipPreview(row.subject) || clipPreview(row.snippet) || es.notify.noSubject,
  };
}

export function IncomingAlerts({
  userId,
  watchMail,
}: {
  userId: string;
  watchMail: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const pathRef = useRef(path);
  pathRef.current = path;
  const [cards, setCards] = useState<Card[]>([]);
  const names = useRef(new Map<string, string>());
  const seen = useRef(new Set<string>());
  const busy = useRef(false);

  function pushCard(card: Card) {
    if (seen.current.has(card.id)) return;
    seen.current.add(card.id);
    if (seen.current.size > 80) {
      seen.current = new Set([...seen.current].slice(-40));
    }
    setCards((prev) => [card, ...prev].slice(0, MAX_CARDS));
    window.setTimeout(() => {
      setCards((prev) => prev.filter((item) => item.id !== card.id));
    }, SHOW_MS);
  }

  useEffect(() => {
    const supabase = createClient();

    async function nameOf(senderId: string) {
      const cached = names.current.get(senderId);
      if (cached) return cached;
      const { data } = await supabase.from("profiles").select("id, full_name").eq("id", senderId).maybeSingle();
      const name = data?.full_name?.trim() || es.notify.chat;
      names.current.set(senderId, name);
      return name;
    }

    const channel = supabase
      .channel(`inbox-alerts:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const parsed = ChatInsert.safeParse(payload.new);
          if (!parsed.success) return;
          if (parsed.data.sender_id === userId) return;
          if (pathRef.current.startsWith(`/mensajes/${parsed.data.chat_id}`)) return;
          const preview = clipPreview(parsed.data.content);
          if (!preview) return;
          void nameOf(parsed.data.sender_id).then((from) => {
            pushCard({
              id: parsed.data.id,
              kind: "chat",
              href: `/mensajes/${parsed.data.chat_id}`,
              from,
              title: preview,
            });
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emails" },
        (payload) => {
          const parsed = MailInsert.safeParse(payload.new);
          if (!parsed.success) return;
          if (!parsed.data.inbound || parsed.data.is_draft) return;
          if (parsed.data.occurred_at && !isRecentIso(parsed.data.occurred_at)) return;
          if (pathRef.current.startsWith(`/correo/${parsed.data.id}`)) return;
          pushCard(mailCard(parsed.data));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!watchMail) return;

    async function pull() {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      try {
        const result = await syncMailAction({ watch: true });
        if (!result.ok) return;
        for (const row of result.fresh) {
          if (!isRecentIso(row.occurred_at)) continue;
          if (pathRef.current.startsWith(`/correo/${row.id}`)) continue;
          pushCard(mailCard(row));
        }
        if (result.inserted > 0) router.refresh();
      } catch (error) {
        captureError(error, { where: "IncomingAlerts.watch" });
      } finally {
        busy.current = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void pull();
    }

    void pull();
    const timer = window.setInterval(() => void pull(), WATCH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [watchMail, router]);

  if (cards.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[85] flex w-[min(100%-24px,320px)] flex-col gap-2 md:bottom-5 md:right-5">
      {cards.map((card) => (
        <div
          key={card.id}
          className="pointer-events-auto rounded-[14px] border-2 border-ink/10 bg-sheet p-3.5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-gold">
              {(card.kind === "mail" ? es.notify.mail : es.notify.chat).toUpperCase()}
            </p>
            <button
              type="button"
              aria-label={es.notify.close}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-ink/40 hover:bg-wash hover:text-ink"
              onClick={() => setCards((prev) => prev.filter((item) => item.id !== card.id))}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <Link
            href={card.href}
            onClick={() => setCards((prev) => prev.filter((item) => item.id !== card.id))}
            className="mt-1 block hover:opacity-90"
          >
            <p className="truncate text-[14px] font-semibold text-ink">{card.from}</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink/70">{card.title}</p>
          </Link>
        </div>
      ))}
    </div>
  );
}
