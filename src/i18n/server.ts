import { cookies } from "next/headers";

import { LOCALE_COOKIE_NAME, resolveLocale, type Locale } from "./locales";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
