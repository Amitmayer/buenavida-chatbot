"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { useNotices } from "@/components/nav/notice-store";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { items, dismiss, dismissAll } = useNotices();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = items.reduce((sum, item) => sum + item.unread, 0);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={es.notify.title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-[11px] border-2 border-ink/15 bg-white text-ink hover:border-ink md:h-[42px] md:w-[42px]"
      >
        <Bell className="h-4 w-4" strokeWidth={2} aria-hidden />
        {count > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[7px] bg-overdue px-1 font-mono text-[10px] text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[90] mt-1.5 w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-[14px] border-2 border-ink/15 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-3.5 py-2.5">
            <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-ink/70">
              {es.notify.title.toUpperCase()}
            </p>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => dismissAll()}
                className="font-mono text-[11px] font-medium text-ink/55 hover:text-ink"
              >
                {es.notify.markAll}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-3.5 py-5 text-[14px] text-ink/60">{es.notify.empty}</p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] overflow-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={() => {
                      dismiss(item);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-wash"
                  >
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-[6px] px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em]",
                        item.kind === "mail" ? "bg-forest text-cream" : "bg-pine text-cream",
                      )}
                    >
                      {(item.kind === "mail" ? es.notify.mail : es.notify.chat).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">{item.from}</span>
                        {item.unread > 0 ? (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-overdue px-1 font-mono text-[10px] text-white">
                            {item.unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink/65">{item.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
