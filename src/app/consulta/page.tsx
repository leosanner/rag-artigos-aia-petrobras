"use client";

import { useState } from "react";

import {
  ragAskSuccessResponseSchema,
  ragGenerationErrorResponseSchema,
  ragInvalidRequestResponseSchema,
  type RagAskSuccessResponse,
} from "@/application/rag/schemas";

import {
  RAG_EMPTY_SOURCES_MESSAGE,
  RAG_INVALID_REQUEST_MESSAGE,
  RAG_TECHNICAL_ERROR_MESSAGE,
  truncateExcerptPreview,
} from "./constants";

type ConsultaState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; response: RagAskSuccessResponse }
  | { kind: "invalid_request" }
  | { kind: "technical_error" };

export default function ConsultaPage() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<ConsultaState>({ kind: "idle" });

  const trimmedQuestion = question.trim();
  const isSubmitting = state.kind === "submitting";
  const canSubmit = trimmedQuestion.length > 0 && !isSubmitting;
  const successResponse = state.kind === "success" ? state.response : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedQuestion.length === 0) {
      return;
    }

    setState({ kind: "submitting" });

    let response: Response;
    try {
      response = await fetch("/api/rag/ask", {
        method: "POST",
        cache: "no-store",
        headers: {
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
      setState(parsed.success ? { kind: "invalid_request" } : { kind: "technical_error" });
      return;
    }

    if (response.status === 502 || response.status === 503) {
      const parsed = ragGenerationErrorResponseSchema.safeParse(raw);
      setState(parsed.success ? { kind: "technical_error" } : { kind: "technical_error" });
      return;
    }

    setState({ kind: "technical_error" });
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 820,
        margin: "2rem auto",
        padding: "0 1rem 3rem",
      }}
    >
      <h1>Consulta na base documental</h1>
      <p>
        Faça uma pergunta global sobre os documentos indexados e receba uma
        resposta com citacoes inline e fontes numeradas.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: "1.5rem" }}>
        <label
          htmlFor="consulta-question"
          style={{ display: "block", fontWeight: 600 }}
        >
          Pergunta
        </label>
        <textarea
          id="consulta-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={6}
          placeholder="Ex.: Quais tecnicas aparecem com mais frequencia nos estudos?"
          style={{
            width: "100%",
            padding: "0.75rem",
            marginTop: "0.25rem",
            resize: "vertical",
          }}
        />
        <div style={{ marginTop: "0.75rem" }}>
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Consultando..." : "Consultar base"}
          </button>
        </div>
      </form>

      {state.kind === "invalid_request" ? (
        <p role="alert">{RAG_INVALID_REQUEST_MESSAGE}</p>
      ) : null}

      {state.kind === "technical_error" ? (
        <p role="alert">{RAG_TECHNICAL_ERROR_MESSAGE}</p>
      ) : null}

      {successResponse ? (
        <section style={{ marginTop: "2rem" }}>
          <h2>Resposta</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{successResponse.answer}</p>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Resumo tecnico</h2>
            <p>Top-k: {successResponse.metadata.topK}</p>
            <p>Modelo de geracao: {successResponse.metadata.generationModel}</p>
            <p>Modelo de embedding: {successResponse.metadata.embeddingModel}</p>
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Fontes</h2>
            {successResponse.sources.length === 0 ? (
              <p>{RAG_EMPTY_SOURCES_MESSAGE}</p>
            ) : (
              <ol style={{ paddingLeft: "1.5rem" }}>
                {successResponse.sources.map((source) => (
                  <li key={source.chunkId} style={{ marginBottom: "1rem" }}>
                    <p style={{ marginBottom: "0.5rem", fontWeight: 700 }}>
                      {source.sourceNumber}. {source.documentTitle}
                    </p>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {truncateExcerptPreview(source.excerpt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      ) : null}
    </main>
  );
}
