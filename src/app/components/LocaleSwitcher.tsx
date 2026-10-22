"use client";

import { useLocale } from "@/i18n/LocaleProvider";
import { LOCALES, type Locale } from "@/i18n/locales";

import styles from "./LocaleSwitcher.module.css";

// Each option names itself in its own language so it is recognizable
// regardless of the active locale.
const LOCALE_OPTIONS: Record<Locale, { short: string; name: string }> = {
  "pt-BR": { short: "PT", name: "Português" },
  en: { short: "EN", name: "English" },
};

const GROUP_LABEL: Record<Locale, string> = {
  "pt-BR": "Idioma",
  en: "Language",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div role="group" aria-label={GROUP_LABEL[locale]} className={styles.switcher}>
      {LOCALES.map((option) => {
        const isActive = option === locale;

        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-label={LOCALE_OPTIONS[option].name}
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) {
                setLocale(option);
              }
            }}
            className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
          >
            {LOCALE_OPTIONS[option].short}
          </button>
        );
      })}
    </div>
  );
}
