import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  parseLocale,
  type Locale,
  type Messages,
} from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function getMessages(): Promise<Messages> {
  return getDictionary(await getLocale());
}
