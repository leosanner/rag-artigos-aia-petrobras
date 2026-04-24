import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

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
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>AIA Insight / DEMO</p>
            <h1 className={styles.title}>
              Plataforma RAG{" "}
              <span className={styles.titleAccent}>rastreavel</span>
            </h1>
            <p className={styles.lede}>
              Explore a base documental governada com respostas auditaveis,
              citacoes inline e fontes numeradas para apoiar analises de EIA.
            </p>
          </div>

          <aside className={styles.sysStamp} aria-hidden="true">
            <span>SYS / HOME</span>
            <span>corpus :: 31 papers</span>
            <span>mode :: governed-rag</span>
            <span>audit :: enabled</span>
          </aside>
        </header>

        <section className={styles.heroPanel} aria-labelledby="home-entry-title">
          <div className={styles.blockHeader}>
            <span className={styles.blockIndex}>[ 01 ] Entrada operacional</span>
            <span className={styles.blockMeta}>route :: /query</span>
          </div>

          <div className={styles.blockBody}>
            <div>
              <h2 id="home-entry-title" className={styles.panelTitle}>
                Consulte a base com trilha de auditoria.
              </h2>
              <p className={styles.panelCopy}>
                A pagina de consulta concentra conversa, controles de recuperacao
                e historico persistido em uma unica superficie para operadores.
              </p>
            </div>

            <Link className={styles.btnPrimary} href="/query">
              Acessar consulta RAG
            </Link>
          </div>
        </section>

        <section className={styles.grid} aria-label="Capacidades principais">
          <article className={styles.card}>
            <span className={styles.cardIndex}>[ 02 ]</span>
            <h2>Governanca</h2>
            <p>Status, versao de pipeline e origem documentada em cada registro.</p>
          </article>

          <article className={styles.card}>
            <span className={styles.cardIndex}>[ 03 ]</span>
            <h2>Rastreabilidade</h2>
            <p>Respostas ligadas a fontes numeradas, trechos e metadados.</p>
          </article>

          <article className={styles.card}>
            <span className={styles.cardIndex}>[ 04 ]</span>
            <h2>Auditoria</h2>
            <p>Historico persistido com custo, latencia, modelos e termos.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
