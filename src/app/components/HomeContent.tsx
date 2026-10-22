"use client";

import Link from "next/link";

import { useHomeMessages } from "../messages";
import styles from "../page.module.css";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function HomeContent() {
  const t = useHomeMessages();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.eyebrow}>{t.eyebrow}</span>
          <LocaleSwitcher />
        </div>
        <div>
          <h1 className={styles.title}>
            {t.titleLead}{" "}
            <span className={styles.titleAccent}>{t.titleAccent}</span>
          </h1>
          <p className={styles.lede}>{t.lede}</p>
        </div>
      </header>

      <section className={styles.heroPanel} aria-labelledby="home-entry-title">
        <div className={styles.blockHeader}>
          <span className={styles.blockIndex}>{t.entry.index}</span>
          <span className={styles.blockMeta}>route :: /query</span>
        </div>

        <div className={styles.blockBody}>
          <div>
            <h2 id="home-entry-title" className={styles.panelTitle}>
              {t.entry.title}
            </h2>
            <p className={styles.panelCopy}>{t.entry.copy}</p>
          </div>

          <Link className={styles.btnPrimary} href="/query">
            {t.entry.cta}
          </Link>
        </div>
      </section>

      <section
        className={styles.processPanel}
        aria-labelledby="home-document-flow-title"
      >
        <div className={styles.blockHeader}>
          <span className={styles.blockIndex}>{t.flow.index}</span>
          <span className={styles.blockMeta}>
            flow :: drive -&gt; ingestion -&gt; indexing
          </span>
        </div>

        <div className={styles.processBody}>
          <div className={styles.processIntro}>
            <div>
              <h2 id="home-document-flow-title" className={styles.panelTitle}>
                {t.flow.title}
              </h2>
              <p className={styles.panelCopy}>{t.flow.copy}</p>
            </div>

            <div className={styles.routeGroup}>
              <Link
                className={`${styles.btnSecondary} ${styles.btnIngest}`}
                href="/ingestion"
              >
                {t.flow.openIngestion}
              </Link>
              <Link
                className={`${styles.btnSecondary} ${styles.btnIndex}`}
                href="/indexing"
              >
                {t.flow.openIndexing}
              </Link>
            </div>
          </div>

          <ol className={styles.stepGrid}>
            <li className={styles.stepCard}>
              <span className={styles.stepNumeral} aria-hidden>
                01
              </span>
              <div className={styles.stepBody}>
                <h3>{t.flow.upload.title}</h3>
                <p>{t.flow.upload.body}</p>
              </div>
            </li>

            <li className={styles.stepCard}>
              <span className={styles.stepNumeral} aria-hidden>
                02
              </span>
              <div className={styles.stepBody}>
                <h3>{t.flow.ingest.title}</h3>
                <p>
                  {t.flow.ingest.bodyLead} <code>/ingestion</code>
                  {t.flow.ingest.bodyTail}
                </p>
              </div>
            </li>

            <li className={styles.stepCard}>
              <span className={styles.stepNumeral} aria-hidden>
                03
              </span>
              <div className={styles.stepBody}>
                <h3>{t.flow.confirm.title}</h3>
                <p>{t.flow.confirm.body}</p>
              </div>
            </li>

            <li className={styles.stepCard}>
              <span className={styles.stepNumeral} aria-hidden>
                04
              </span>
              <div className={styles.stepBody}>
                <h3>{t.flow.indexStep.title}</h3>
                <p>
                  {t.flow.indexStep.bodyLead} <code>/indexing</code>{" "}
                  {t.flow.indexStep.bodyMiddle} <code>documentId</code>{" "}
                  {t.flow.indexStep.bodyOr} <code>force</code>{" "}
                  {t.flow.indexStep.bodyTail}
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.grid} aria-label={t.capabilitiesLabel}>
        <article className={`${styles.card} ${styles.cardLime}`}>
          <span className={styles.cardIndex}>[ 03 ]</span>
          <h2>{t.governance.title}</h2>
          <p>{t.governance.body}</p>
        </article>

        <article className={`${styles.card} ${styles.cardBlue}`}>
          <span className={styles.cardIndex}>[ 04 ]</span>
          <h2>{t.traceability.title}</h2>
          <p>{t.traceability.body}</p>
        </article>

        <article className={`${styles.card} ${styles.cardYellow}`}>
          <span className={styles.cardIndex}>[ 05 ]</span>
          <h2>{t.audit.title}</h2>
          <p>{t.audit.body}</p>
        </article>
      </section>
    </div>
  );
}
