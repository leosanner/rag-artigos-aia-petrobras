import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALES,
  localeSchema,
  resolveLocale,
} from "./locales";

describe("locales", () => {
  it("supports Brazilian Portuguese and English, defaulting to Portuguese", () => {
    expect(LOCALES).toEqual(["pt-BR", "en"]);
    expect(DEFAULT_LOCALE).toBe("pt-BR");
    expect(LOCALE_COOKIE_NAME).toBe("locale");
  });

  it("resolves supported values as-is", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to the default locale for unknown or missing values", () => {
    expect(resolveLocale(undefined)).toBe("pt-BR");
    expect(resolveLocale(null)).toBe("pt-BR");
    expect(resolveLocale("")).toBe("pt-BR");
    expect(resolveLocale("es")).toBe("pt-BR");
    expect(resolveLocale("EN")).toBe("pt-BR");
  });

  it("validates locales at request boundaries", () => {
    expect(localeSchema.safeParse("en").success).toBe(true);
    expect(localeSchema.safeParse("fr").success).toBe(false);
  });
});
