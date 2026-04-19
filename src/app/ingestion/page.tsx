"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ingestionRunDetailResponseSchema,
  ingestionSyncConflictResponseSchema,
  ingestionSyncQueuedResponseSchema,
  type IngestionRunDetailResponse,
} from "@/application/ingestion/schemas";

export const INGESTION_POLL_INTERVAL_MS = 2000;

const SECRET_STORAGE_KEY = "ingestion:secret";

type StartState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "queued"; runId: string }
  | { kind: "polling"; detail: IngestionRunDetailResponse }
  | { kind: "conflict"; activeRunId: string | null }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

function isTerminalStatus(status: IngestionRunDetailResponse["status"]): boolean {
  return status === "completed" || status === "failed";
}

export default function IngestionPage() {
  const [secret, setSecret] = useState<string>("");
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
    const response = await fetch(`/api/ingestion/runs/${runId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      setState({
        kind: "error",
        message: `Failed to fetch run status (HTTP ${response.status})`,
      });
      pollRunIdRef.current = null;
      return;
    }

    const body = await response.json();
    const parsed = ingestionRunDetailResponseSchema.safeParse(body);
    if (!parsed.success) {
      setState({
        kind: "error",
        message: "Received a malformed run detail response",
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

    const runId =
      state.kind === "queued" ? state.runId : state.detail.id;

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
    }, INGESTION_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [state, pollOnce]);

  const onStart = useCallback(async () => {
    if (secret.length === 0) {
      return;
    }
    setState({ kind: "starting" });

    let response: Response;
    try {
      response = await fetch("/api/ingestion/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      setState({
        kind: "error",
        message: `Network error while starting the run: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      });
      return;
    }

    const raw = await response.json().catch(() => null);

    if (response.status === 202) {
      const parsed = ingestionSyncQueuedResponseSchema.safeParse(raw);
      if (!parsed.success) {
        setState({
          kind: "error",
          message: "Received a malformed queued response",
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
      const parsed = ingestionSyncConflictResponseSchema.safeParse(raw);
      setState({
        kind: "conflict",
        activeRunId: parsed.success ? parsed.data.activeRunId : null,
      });
      return;
    }

    setState({
      kind: "error",
      message: `Unexpected response (HTTP ${response.status})`,
    });
  }, [secret, clearSecret]);

  const inspectActiveRun = useCallback((runId: string) => {
    pollRunIdRef.current = runId;
    setState({ kind: "queued", runId });
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "2rem auto",
        padding: "0 1rem",
      }}
    >
      <h1>Document ingestion</h1>
      <p>
        Start a new ingestion run to pick up new PDFs from the configured Drive
        folder. The operator secret is kept only in this browser tab.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <label
          htmlFor="ingestion-secret"
          style={{ display: "block", fontWeight: 600 }}
        >
          Operator secret
        </label>
        <input
          id="ingestion-secret"
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(event) => updateSecret(event.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onStart}
            disabled={secret.length === 0 || state.kind === "starting"}
          >
            {state.kind === "starting" ? "Starting..." : "Start ingestion run"}
          </button>
          <button
            type="button"
            onClick={clearSecret}
            disabled={secret.length === 0}
          >
            Clear secret
          </button>
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        {state.kind === "unauthorized" && (
          <p role="alert">
            Operator secret was rejected. Please re-enter it and try again.
          </p>
        )}

        {state.kind === "conflict" && (
          <div role="alert">
            <p>
              Another ingestion run is already active. Active run id:{" "}
              <code>{state.activeRunId ?? "unknown"}</code>
            </p>
            {state.activeRunId !== null && (
              <button
                type="button"
                onClick={() => inspectActiveRun(state.activeRunId as string)}
              >
                Poll active run
              </button>
            )}
          </div>
        )}

        {state.kind === "error" && <p role="alert">{state.message}</p>}

        {(state.kind === "queued" || state.kind === "polling") && (
          <IngestionRunView state={state} />
        )}
      </section>
    </main>
  );
}

function IngestionRunView({
  state,
}: {
  state: Extract<StartState, { kind: "queued" } | { kind: "polling" }>;
}) {
  const runId = state.kind === "queued" ? state.runId : state.detail.id;
  const status = state.kind === "queued" ? "queued" : state.detail.status;
  const detail = state.kind === "polling" ? state.detail : null;

  return (
    <article>
      <h2>Run</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.25rem" }}>
        <li>
          Run id: <code>{runId}</code>
        </li>
        <li>Status: {status}</li>
        {detail && (
          <>
            <li>Selected: {detail.selectedCount}</li>
            <li>Processed: {detail.processedCount}</li>
            <li>Failed: {detail.failedCount}</li>
            <li>Skipped (existing): {detail.skippedExistingCount}</li>
            {detail.lastError && <li>Last error: {detail.lastError}</li>}
          </>
        )}
      </ul>
      {detail && detail.items.length > 0 && (
        <table style={{ marginTop: "1rem", width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Title</th>
              <th align="left">Drive file id</th>
              <th align="left">Status</th>
              <th align="left">Last error</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  <code>{item.driveFileId}</code>
                </td>
                <td>{item.status}</td>
                <td>{item.lastError ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
