import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Estudo de caso: RAG",
  description: "Exploracao documental com RAG, governanca e rastreabilidade"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
