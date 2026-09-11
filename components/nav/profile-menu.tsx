"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { cn, initials } from "@/lib/utils";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import type { Locale } from "@/lib/i18n";

const LANGS: { locale: Locale; labelKey: "langEs" | "langEn" }[] = [
  { locale: "es", labelKey: "langEs" },
  { locale: "en", labelKey: "langEn" },
];

export function ProfileMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { locale, t, setLocale, pending } = useI18n();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2.5 rounded-[12px] bg-cream/[0.08] px-3 py-2.5 text-left hover:bg-cream/[0.12]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold font-mono text-[14px] font-semibold text-pine">
          {initials(name)}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14px] font-medium text-cream">{shortFirst(name)}</div>
          <div className="truncate font-mono text-[13px] text-cream/70">{roleLabel}</div>
        </div>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+8px)] left-0 right-0 overflow-hidden rounded-[10px] border border-cream/10 bg-[#1B3A28] py-1.5 shadow-lg"
        >
          <div className="px-3 py-1.5">
            <PushOptIn />
          </div>
          <div className="px-3 py-1.5" role="none">
            <p className="mb-1.5 font-mono text-[10px] font-medium tracking-[0.16em] text-cream/55">
              {t.nav.language.toUpperCase()}
            </p>
            <div className="flex rounded-[8px] border border-cream/15 p-0.5" aria-label={t.nav.language}>
              {LANGS.map((option) => {
                const on = locale === option.locale;
                return (
                  <button
                    key={option.locale}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => setLocale(option.locale)}
                    className={cn(
                      "flex-1 rounded-[6px] py-1 font-mono text-[11px] font-medium tracking-[0.08em] transition-colors disabled:opacity-50",
                      on ? "bg-cream text-pine" : "text-cream/70 hover:text-cream",
                    )}
                  >
                    {t.nav[option.labelKey]}
                  </button>
                );
              })}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[12.5px] text-cream/80 hover:bg-cream/10 hover:text-cream"
            >
              {t.nav.salir}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function shortFirst(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1]?.slice(0, 1)}.`;
}
