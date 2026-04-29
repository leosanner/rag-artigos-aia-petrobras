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
          <span className={styles.eyebrow}>Sistema :: AIA Insight / DEMO</span>
          <div>
            <h1 className={styles.title}>
              Plataforma RAG{" "}
              <span className={styles.titleAccent}>rastreavel</span>
            </h1>
            <p className={styles.lede}>
              Explore a base documental governada com respostas auditaveis,
              citacoes inline e fontes numeradas para apoiar analises de EIA.
            </p>
          </div>
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

        <section
          className={styles.processPanel}
          aria-labelledby="home-document-flow-title"
        >
          <div className={styles.blockHeader}>
            <span className={styles.blockIndex}>[ 02 ] Adicao de documentos</span>
            <span className={styles.blockMeta}>
              flow :: drive -&gt; ingestion -&gt; indexing
            </span>
          </div>

          <div className={styles.processBody}>
            <div className={styles.processIntro}>
              <div>
                <h2 id="home-document-flow-title" className={styles.panelTitle}>
                  Como colocar novos PDFs na base
                </h2>
                <p className={styles.panelCopy}>
                  A adicao de documentos acontece em duas etapas manuais
                  separadas. Primeiro a plataforma busca e processa os PDFs no
                  Drive. Depois ela gera chunks e vetores para liberar esse
                  conteudo nas consultas RAG.
                </p>
              </div>

              <div className={styles.routeGroup}>
                <Link
                  className={`${styles.btnSecondary} ${styles.btnIngest}`}
                  href="/ingestion"
                >
                  Abrir ingestao
                </Link>
                <Link
                  className={`${styles.btnSecondary} ${styles.btnIndex}`}
                  href="/indexing"
                >
                  Abrir indexacao
                </Link>
              </div>
            </div>

            <ol className={styles.stepGrid}>
              <li className={styles.stepCard}>
                <span className={styles.stepNumeral} aria-hidden>
                  01
                </span>
                <div className={styles.stepBody}>
                  <h3>Enviar os arquivos para o Drive</h3>
                  <p>
                    Coloque os PDFs na pasta configurada do Google Drive. Esse
                    folder e a origem oficial dos novos documentos da base.
                  </p>
                </div>
              </li>

              <li className={styles.stepCard}>
                <span className={styles.stepNumeral} aria-hidden>
                  02
                </span>
                <div className={styles.stepBody}>
                  <h3>Executar a ingestao</h3>
                  <p>
                    Acesse <code>/ingestion</code>, informe o segredo do
                    operador e inicie a execucao para importar, extrair e
                    refinar os textos.
                  </p>
                </div>
              </li>

              <li className={styles.stepCard}>
                <span className={styles.stepNumeral} aria-hidden>
                  03
                </span>
                <div className={styles.stepBody}>
                  <h3>Confirmar documentos processados</h3>
                  <p>
                    Espere a execucao terminar e verifique se os arquivos
                    ficaram prontos para indexacao. Somente documentos
                    processados seguem para a etapa de vetores.
                  </p>
                </div>
              </li>

              <li className={styles.stepCard}>
                <span className={styles.stepNumeral} aria-hidden>
                  04
                </span>
                <div className={styles.stepBody}>
                  <h3>Gerar chunks e vetores</h3>
                  <p>
                    Acesse <code>/indexing</code> para criar embeddings dos
                    documentos processados. Use <code>documentId</code> ou{" "}
                    <code>force</code> quando precisar reindexar um item
                    especifico.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.grid} aria-label="Capacidades principais">
          <article className={`${styles.card} ${styles.cardLime}`}>
            <span className={styles.cardIndex}>[ 03 ]</span>
            <h2>Governanca</h2>
            <p>Status, versao de pipeline e origem documentada em cada registro.</p>
          </article>

          <article className={`${styles.card} ${styles.cardBlue}`}>
            <span className={styles.cardIndex}>[ 04 ]</span>
            <h2>Rastreabilidade</h2>
            <p>Respostas ligadas a fontes numeradas, trechos e metadados.</p>
          </article>

          <article className={`${styles.card} ${styles.cardYellow}`}>
            <span className={styles.cardIndex}>[ 05 ]</span>
            <h2>Auditoria</h2>
            <p>Historico persistido com custo, latencia, modelos e termos.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
