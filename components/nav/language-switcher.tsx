"use client";

import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { locale: Locale; labelKey: "langEs" | "langEn" }[] = [
  { locale: "es", labelKey: "langEs" },
  { locale: "en", labelKey: "langEn" },
];

export function LanguageSwitcher() {
  const { locale, t, setLocale, pending } = useI18n();

  return (
    <div className="mb-3 px-1" aria-label={t.nav.language}>
      <p className="mb-1.5 px-2 font-mono text-[11px] font-medium tracking-[0.18em] text-[#E5B978]">
        {t.nav.language.toUpperCase()}
      </p>
      <div className="flex rounded-[10px] border border-cream/15 p-0.5">
        {OPTIONS.map((option) => {
          const on = locale === option.locale;
          return (
            <button
              key={option.locale}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => setLocale(option.locale)}
              className={cn(
                "flex-1 rounded-[8px] py-1.5 font-mono text-[12px] font-medium tracking-[0.08em] transition-colors disabled:opacity-50",
                on ? "bg-cream text-pine" : "text-cream/70 hover:text-cream",
              )}
            >
              {t.nav[option.labelKey]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
