import type { ReactNode } from "react";
import {
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Mulish,
} from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
  display: "swap",
});

// Humanist sans for the institutional (Petrobras-style) headings.
const mulish = Mulish({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-inst",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export default function QueryLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${mulish.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
