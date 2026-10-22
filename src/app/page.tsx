import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { HomeContent } from "./components/HomeContent";
import styles from "./page.module.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "SOFT"],
  variable: "--font-display",
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

export default function Home() {
  return (
    <main
      className={`${styles.page} ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <HomeContent />
    </main>
  );
}
