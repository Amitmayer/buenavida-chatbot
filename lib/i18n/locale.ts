export type Locale = "es" | "en";

export const LOCALES = ["es", "en"] as const;

export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_COOKIE = "bv_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function parseLocale(value: string | undefined | null): Locale {
  if (isLocale(value)) return value;
  return DEFAULT_LOCALE;
}
