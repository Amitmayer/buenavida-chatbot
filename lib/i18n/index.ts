import { es, type Messages } from "./es";
import { en } from "./en";
import {
  type Locale,
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  parseLocale,
} from "./locale";

export type { Messages } from "./es";
export type { Locale };
export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, parseLocale };
export { es } from "./es";
export { en } from "./en";

export const dictionaries: Record<Locale, Messages> = {
  es,
  en: en as unknown as Messages,
};

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale];
}

export function teamBlurb(
  slug: string | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!slug) return "";
  const blurbs = getDictionary(locale).areas.blurbs;
  if (slug in blurbs) {
    return blurbs[slug as keyof typeof blurbs];
  }
  return "";
}
