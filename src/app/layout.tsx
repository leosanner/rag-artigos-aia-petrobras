import type { Metadata } from "next";

import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";
import { getRequestLocale } from "@/i18n/server";

import "./globals.css";

const METADATA: Record<Locale, Metadata> = {
  "pt-BR": {
    title: "Estudo de caso: RAG",
    description: "Exploracao documental com RAG, governanca e rastreabilidade",
  },
  en: {
    title: "Case study: RAG",
    description: "Document exploration with RAG, governance, and traceability",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return METADATA[await getRequestLocale()];
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
