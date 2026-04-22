"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ragAskSuccessResponseSchema,
  ragGenerationErrorResponseSchema,
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
  type RagAskSuccessResponse,
} from "@/application/rag/schemas";

import {
  RAG_EMPTY_SOURCES_MESSAGE,
  RAG_INVALID_REQUEST_MESSAGE,
  RAG_TECHNICAL_ERROR_MESSAGE,
  RAG_UNAUTHORIZED_MESSAGE,
  truncateExcerptPreview,
} from "./constants";
import styles from "./page.module.css";

const SECRET_STORAGE_KEY = "query:secret";

type QueryPageState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; response: RagAskSuccessResponse }
  | { kind: "invalid_request" }
  | { kind: "unauthorized" }
  | { kind: "technical_error" };

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<QueryPageState>({ kind: "idle" });

  const trimmedQuestion = question.trim();
  const trimmedSecret = secret.trim();
  const isSubmitting = state.kind === "submitting";
  const canSubmit =
    trimmedQuestion.length > 0 && trimmedSecret.length > 0 && !isSubmitting;
  const successResponse = state.kind === "success" ? state.response : null;

  useEffect(() => {
    const stored = sessionStorage.getItem(SECRET_STORAGE_KEY);
    if (stored) {
      setSecret(stored);
    }
  }, []);

  const updateSecret = useCallback((value: string) => {
    setSecret(value);

    if (value.length === 0) {
      sessionStorage.removeItem(SECRET_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(SECRET_STORAGE_KEY, value);
  }, []);

  const clearSecret = useCallback(() => {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedQuestion.length === 0 || trimmedSecret.length === 0) {
      return;
    }

    setState({ kind: "submitting" });

    let response: Response;
    try {
      response = await fetch("/api/rag/ask", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${trimmedSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          mode: "global",
        }),
      });
    } catch {
      setState({ kind: "technical_error" });
      return;
    }

    const raw = await response.json().catch(() => null);

    if (response.status === 200) {
      const parsed = ragAskSuccessResponseSchema.safeParse(raw);
      setState(
        parsed.success
          ? { kind: "success", response: parsed.data }
          : { kind: "technical_error" },
      );
      return;
    }

    if (response.status === 400) {
      const parsed = ragInvalidRequestResponseSchema.safeParse(raw);
      setState(
        parsed.success
          ? { kind: "invalid_request" }
          : { kind: "technical_error" },
      );
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(raw);
      clearSecret();
      setState(
        parsed.success
          ? { kind: "unauthorized" }
          : { kind: "technical_error" },
      );
      return;
    }

    if (response.status === 502 || response.status === 503) {
      ragGenerationErrorResponseSchema.safeParse(raw);
      setState({ kind: "technical_error" });
      return;
    }

    setState({ kind: "technical_error" });
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Consulta na base{" "}
              <span className={styles.titleAccent}>documental</span>
            </h1>
            <p className={styles.lede}>
              Faça uma pergunta global sobre os documentos indexados e receba
              uma resposta com citações inline e fontes numeradas. Apenas
              usuários com o secret podem consultar a base — o valor fica salvo
              somente nesta aba do navegador.
            </p>
          </div>

          <aside className={styles.sysStamp} aria-hidden="true">
            <span>SYS / STATUS</span>
            <span>retrieval :: hybrid-v1</span>
            <span>embedding :: 3-large</span>
            <span>mode :: global-only</span>
          </aside>
        </header>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={`${styles.field} ${styles.fieldSecret}`}>
            <label htmlFor="query-secret" className={styles.label}>
              <span>Secret de consulta</span>
              <span className={styles.labelIndex}>[ 01 ]</span>
            </label>
            <input
              id="query-secret"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(event) => updateSecret(event.target.value)}
              className={styles.input}
              placeholder="• • • • • • • •"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldQuestion}`}>
            <label htmlFor="query-question" className={styles.label}>
              <span>Pergunta</span>
              <span className={styles.labelIndex}>[ 02 ]</span>
            </label>
            <textarea
              id="query-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={6}
              placeholder="Ex.: Quais tecnicas aparecem com mais frequencia nos estudos?"
              className={styles.textarea}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${styles.btn} ${
                isSubmitting ? styles.btnLoading : styles.btnPrimary
              }`}
            >
              {isSubmitting ? "Consultando..." : "Consultar base"}
            </button>
            <button
              type="button"
              onClick={clearSecret}
              disabled={trimmedSecret.length === 0}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              Limpar secret
            </button>
          </div>
        </form>

        {state.kind === "invalid_request" ? (
          <div
            role="alert"
            className={`${styles.alert} ${styles.alertInvalid}`}
          >
            <span className={styles.alertBadge}>400</span>
            <p style={{ margin: 0 }}>{RAG_INVALID_REQUEST_MESSAGE}</p>
          </div>
        ) : null}

        {state.kind === "unauthorized" ? (
          <div
            role="alert"
            className={`${styles.alert} ${styles.alertUnauthorized}`}
          >
            <span className={styles.alertBadge}>401</span>
            <p style={{ margin: 0 }}>{RAG_UNAUTHORIZED_MESSAGE}</p>
          </div>
        ) : null}

        {state.kind === "technical_error" ? (
          <div
            role="alert"
            className={`${styles.alert} ${styles.alertTechnical}`}
          >
            <span className={styles.alertBadge}>ERR</span>
            <p style={{ margin: 0 }}>{RAG_TECHNICAL_ERROR_MESSAGE}</p>
          </div>
        ) : null}

        {successResponse ? (
          <section className={styles.result}>
            <article className={styles.resultBlock}>
              <header className={styles.blockHeader}>
                <span className={styles.blockIndex}>[ 01 ] Resposta</span>
                <span className={styles.blockMeta}>
                  mode :: {successResponse.metadata.mode}
                </span>
              </header>
              <div className={styles.blockBody}>
                <h2 className={styles.answerHeadline}>
                  Síntese gerada com citações inline.
                </h2>
                <p className={styles.answerText}>{successResponse.answer}</p>
              </div>
            </article>

            <article
              className={`${styles.resultBlock} ${styles.metaBlockAccent}`}
            >
              <header className={styles.blockHeader}>
                <span className={styles.blockIndex}>[ 02 ] Resumo tecnico</span>
                <span className={styles.blockMeta}>governance // xai</span>
              </header>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>{"// retrieval"}</span>
                  <p className={styles.metaValue}>
                    Top-k: {successResponse.metadata.topK}
                  </p>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>{"// generation"}</span>
                  <p className={styles.metaValue}>
                    Modelo de geracao: {successResponse.metadata.generationModel}
                  </p>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>{"// embedding"}</span>
                  <p className={styles.metaValue}>
                    Modelo de embedding: {successResponse.metadata.embeddingModel}
                  </p>
                </div>
              </div>
            </article>

            <article
              className={`${styles.resultBlock} ${styles.sourcesBlockAccent}`}
            >
              <header className={styles.blockHeader}>
                <span className={styles.blockIndex}>[ 03 ] Fontes</span>
                <span className={styles.blockMeta}>
                  n = {successResponse.sources.length}
                </span>
              </header>
              <div className={styles.blockBody}>
                {successResponse.sources.length === 0 ? (
                  <p className={styles.emptySources}>
                    {RAG_EMPTY_SOURCES_MESSAGE}
                  </p>
                ) : (
                  <ol className={styles.sources}>
                    {successResponse.sources.map((source) => (
                      <li key={source.chunkId} className={styles.sourceCard}>
                        <div
                          className={styles.sourceNumber}
                          aria-hidden="true"
                        >
                          {source.sourceNumber}
                        </div>
                        <div>
                          <p className={styles.sourceTitle}>
                            {source.sourceNumber}. {source.documentTitle}
                          </p>
                          <p className={styles.sourceExcerpt}>
                            {truncateExcerptPreview(source.excerpt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}
