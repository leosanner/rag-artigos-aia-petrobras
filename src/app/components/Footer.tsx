"use client";

import Image from "next/image";
import Link from "next/link";

import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";

import styles from "./Footer.module.css";

const FOOTER_MESSAGES: Record<
  Locale,
  {
    tagline: string;
    navLabel: string;
    navTitle: string;
    query: string;
    ingestion: string;
    indexing: string;
  }
> = {
  "pt-BR": {
    tagline: "Projeto de pesquisa apoiado pela Petrobras.",
    navLabel: "Navegação do rodapé",
    navTitle: "Plataforma",
    query: "Consulta",
    ingestion: "Ingestão",
    indexing: "Indexação",
  },
  en: {
    tagline: "Research project supported by Petrobras.",
    navLabel: "Footer navigation",
    navTitle: "Platform",
    query: "Query",
    ingestion: "Ingestion",
    indexing: "Indexing",
  },
};

const FOOTER_NAV = [
  { href: "/query", key: "query" },
  { href: "/ingestion", key: "ingestion" },
  { href: "/indexing", key: "indexing" },
] as const;

export function Footer() {
  const t = FOOTER_MESSAGES[useLocale().locale];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Image
            src="/logo-petrobras.png"
            alt="Petrobras"
            width={148}
            height={44}
            className={styles.logo}
            priority={false}
          />
          <p className={styles.tagline}>{t.tagline}</p>
        </div>

        <nav className={styles.nav} aria-label={t.navLabel}>
          <span className={styles.navTitle}>{t.navTitle}</span>
          <ul className={styles.navList}>
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link className={styles.navLink} href={item.href}>
                  {t[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
