import { z } from "zod";

export const LOCALES = ["pt-BR", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_COOKIE_NAME = "locale";

export const localeSchema = z.enum(LOCALES);

export function resolveLocale(value: unknown): Locale {
  const parsed = localeSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_LOCALE;
}
