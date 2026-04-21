"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  indexingConflictResponseSchema,
  indexingQueuedResponseSchema,
  indexingRunDetailResponseSchema,
  type IndexingRunDetailResponse,
} from "@/application/indexing/schemas";

import { INDEXING_POLL_INTERVAL_MS } from "./constants";

const SECRET_STORAGE_KEY = "indexing:secret";

type StartState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "queued"; runId: string }
  | { kind: "polling"; detail: IndexingRunDetailResponse }
  | { kind: "conflict"; activeRunId: string | null }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

function isTerminalStatus(status: IndexingRunDetailResponse["status"]): boolean {
  return status === "completed" || status === "failed";
}

export default function IndexingPage() {
  const [secret, setSecret] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [force, setForce] = useState(false);
  const [state, setState] = useState<StartState>({ kind: "idle" });
  const pollRunIdRef = useRef<string | null>(null);

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
    } else {
      sessionStorage.setItem(SECRET_STORAGE_KEY, value);
    }
  }, []);

  const clearSecret = useCallback(() => {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
  }, []);

  const pollOnce = useCallback(async (runId: string) => {
    const response = await fetch(`/api/rag/indexing/runs/${runId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      setState({
        kind: "error",
        message: `Falha ao consultar a execucao (HTTP ${response.status})`,
      });
      pollRunIdRef.current = null;
      return;
    }

    const body = await response.json();
    const parsed = indexingRunDetailResponseSchema.safeParse(body);
    if (!parsed.success) {
      setState({
        kind: "error",
        message: "A resposta da execucao veio em formato invalido",
      });
      pollRunIdRef.current = null;
      return;
    }

    setState({ kind: "polling", detail: parsed.data });

    if (isTerminalStatus(parsed.data.status)) {
      pollRunIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state.kind !== "queued" && state.kind !== "polling") {
      return;
    }

    const runId = state.kind === "queued" ? state.runId : state.detail.id;

    if (pollRunIdRef.current === null) {
      return;
    }

    if (pollRunIdRef.current !== runId) {
      pollRunIdRef.current = runId;
    }

    const interval = setInterval(() => {
      const activeRunId = pollRunIdRef.current;
      if (activeRunId !== null) {
        void pollOnce(activeRunId);
      }
    }, INDEXING_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [state, pollOnce]);

  const onStart = useCallback(async () => {
    if (secret.length === 0) {
      return;
    }

    setState({ kind: "starting" });

    const trimmedDocumentId = documentId.trim();
    const body =
      trimmedDocumentId.length > 0
        ? { documentId: trimmedDocumentId, force }
        : { force };

    let response: Response;
    try {
      response = await fetch("/api/rag/indexing/runs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      setState({
        kind: "error",
        message: `Erro de rede ao iniciar indexacao: ${
          error instanceof Error ? error.message : "desconhecido"
        }`,
      });
      return;
    }

    const raw = await response.json().catch(() => null);

    if (response.status === 202) {
      const parsed = indexingQueuedResponseSchema.safeParse(raw);
      if (!parsed.success) {
        setState({
          kind: "error",
          message: "A resposta de fila veio em formato invalido",
        });
        return;
      }
      pollRunIdRef.current = parsed.data.runId;
      setState({ kind: "queued", runId: parsed.data.runId });
      return;
    }

    if (response.status === 401) {
      clearSecret();
      setState({ kind: "unauthorized" });
      return;
    }

    if (response.status === 409) {
      const parsed = indexingConflictResponseSchema.safeParse(raw);
      setState({
        kind: "conflict",
        activeRunId: parsed.success ? parsed.data.activeRunId : null,
      });
      return;
    }

    setState({
      kind: "error",
      message: `Resposta inesperada (HTTP ${response.status})`,
    });
  }, [clearSecret, documentId, force, secret]);

  const inspectActiveRun = useCallback((runId: string) => {
    pollRunIdRef.current = runId;
    setState({ kind: "queued", runId });
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 760,
        margin: "2rem auto",
        padding: "0 1rem",
      }}
    >
      <h1>Indexacao de documentos</h1>
      <p>
        Inicie a indexacao manual dos documentos processados. O segredo fica
        somente nesta aba do navegador.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <label htmlFor="indexing-secret" style={{ display: "block", fontWeight: 600 }}>
          Segredo do operador
        </label>
        <input
          id="indexing-secret"
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(event) => updateSecret(event.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
      </section>

      <section style={{ marginTop: "1rem" }}>
        <label
          htmlFor="indexing-document-id"
          style={{ display: "block", fontWeight: 600 }}
        >
          Documento especifico
        </label>
        <input
          id="indexing-document-id"
          type="text"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          placeholder="UUID opcional do documento"
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
      </section>

      <section style={{ marginTop: "1rem" }}>
        <label htmlFor="indexing-force">
          <input
            id="indexing-force"
            type="checkbox"
            checked={force}
            onChange={(event) => setForce(event.target.checked)}
          />{" "}
          Recriar chunks existentes
        </label>
      </section>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={onStart}
          disabled={secret.length === 0 || state.kind === "starting"}
        >
          {state.kind === "starting" ? "Iniciando..." : "Iniciar indexacao"}
        </button>
        <button
          type="button"
          onClick={clearSecret}
          disabled={secret.length === 0}
        >
          Limpar segredo
        </button>
      </div>

      <section style={{ marginTop: "2rem" }}>
        {state.kind === "unauthorized" && (
          <p role="alert">O segredo foi recusado. Informe novamente.</p>
        )}

        {state.kind === "conflict" && (
          <div role="alert">
            <p>
              Outra indexacao ja esta ativa. Execucao ativa:{" "}
              <code>{state.activeRunId ?? "desconhecida"}</code>
            </p>
            {state.activeRunId !== null && (
              <button
                type="button"
                onClick={() => inspectActiveRun(state.activeRunId as string)}
              >
                Acompanhar execucao ativa
              </button>
            )}
          </div>
        )}

        {state.kind === "error" && <p role="alert">{state.message}</p>}

        {(state.kind === "queued" || state.kind === "polling") && (
          <IndexingRunView state={state} />
        )}
      </section>
    </main>
  );
}

function IndexingRunView({
  state,
}: {
  state: Extract<StartState, { kind: "queued" } | { kind: "polling" }>;
}) {
  const runId = state.kind === "queued" ? state.runId : state.detail.id;
  const status = state.kind === "queued" ? "queued" : state.detail.status;
  const detail = state.kind === "polling" ? state.detail : null;

  return (
    <article>
      <h2>Execucao</h2>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: "0.25rem",
        }}
      >
        <li>
          Id: <code>{runId}</code>
        </li>
        <li>Status: {status}</li>
        {detail && (
          <>
            <li>Selecionados: {detail.selectedCount}</li>
            <li>Processados: {detail.processedCount}</li>
            <li>Falhos: {detail.failedCount}</li>
            <li>Ignorados: {detail.skippedCount}</li>
            {detail.lastError && <li>Ultimo erro: {detail.lastError}</li>}
          </>
        )}
      </ul>

      {detail && detail.items.length > 0 && (
        <table
          style={{ marginTop: "1rem", width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th align="left">Titulo</th>
              <th align="left">Documento</th>
              <th align="left">Status</th>
              <th align="left">Chunks</th>
              <th align="left">Erro</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  <code>{item.documentId ?? "-"}</code>
                </td>
                <td>{item.status}</td>
                <td>{item.chunkCount}</td>
                <td>{item.lastError ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
