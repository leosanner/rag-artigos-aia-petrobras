"use client";

import { useEffect, useState } from "react";

import {
  appendConversationMessageResponseSchema,
  conversationDetailResponseSchema,
  createConversationResponseSchema,
  ragInvalidRequestResponseSchema,
  ragQueryRunDetailResponseSchema,
  ragQueryRunSummariesResponseSchema,
  ragUnauthorizedResponseSchema,
  type ConversationDetailResponse,
  type ConversationMessageResponse,
  type RagAnswerAudit,
  type RagAnswerMetadata,
  type RagQueryRunDetailResponse,
  type RagQueryRunSummaryResponse,
  type RelatedTerm,
} from "@/application/rag/schemas";
import {
  RAG_RETRIEVAL_DEFAULT_TOP_K,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  type RagRetrievalStrategy,
} from "@/domain/rag";

import {
  RAG_EMPTY_SOURCES_MESSAGE,
  RAG_HISTORY_EMPTY_MESSAGE,
  RAG_HISTORY_ERROR_MESSAGE,
  RAG_HISTORY_IDLE_MESSAGE,
  RAG_INVALID_REQUEST_MESSAGE,
  RAG_NO_GENERATION_AUDIT_MESSAGE,
  RAG_RUN_DETAIL_ERROR_MESSAGE,
  RAG_RUN_DETAIL_IDLE_MESSAGE,
  RAG_TECHNICAL_ERROR_MESSAGE,
  RAG_UNAUTHORIZED_MESSAGE,
  truncateExcerptPreview,
} from "./constants";
import styles from "./page.module.css";

const SECRET_STORAGE_KEY = "query:secret";

type QuerySubmissionStrategy = Extract<
  RagRetrievalStrategy,
  "standard" | "explore"
>;

type AskState =
  | { kind: "idle" }
  | { kind: "submitting"; strategy: QuerySubmissionStrategy }
  | { kind: "invalid_request" }
  | { kind: "unauthorized" }
  | { kind: "technical_error" };

type LoadErrorKind = "unauthorized" | "technical";

type ConversationErrorKind = LoadErrorKind | "not_found";

type ConversationState = {
  status: "idle" | "loading" | "loaded" | "error";
  conversation: ConversationDetailResponse | null;
  error: ConversationErrorKind | null;
};

type RecentRunsState = {
  status: "idle" | "loading" | "loaded" | "error";
  runs: RagQueryRunSummaryResponse[];
  error: LoadErrorKind | null;
};

type SelectedRunState = {
  status: "idle" | "loading" | "loaded" | "error";
  run: RagQueryRunDetailResponse | null;
  runId: string | null;
  error: LoadErrorKind | null;
};

function createInitialRecentRunsState(): RecentRunsState {
  return {
    status: "idle",
    runs: [],
    error: null,
  };
}

function createInitialSelectedRunState(): SelectedRunState {
  return {
    status: "idle",
    run: null,
    runId: null,
    error: null,
  };
}

function createInitialConversationState(): ConversationState {
  return {
    status: "idle",
    conversation: null,
    error: null,
  };
}

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [secret, setSecret] = useState("");
  const [topK, setTopK] = useState(RAG_RETRIEVAL_DEFAULT_TOP_K);
  const [askState, setAskState] = useState<AskState>({ kind: "idle" });
  const [recentRunsState, setRecentRunsState] = useState<RecentRunsState>(
    createInitialRecentRunsState,
  );
  const [selectedRunState, setSelectedRunState] = useState<SelectedRunState>(
    createInitialSelectedRunState,
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>(
    createInitialConversationState,
  );
  const [expandedAuditMessageIds, setExpandedAuditMessageIds] = useState<
    Set<string>
  >(() => new Set());

  const trimmedQuestion = question.trim();
  const trimmedSecret = secret.trim();
  const isSubmitting = askState.kind === "submitting";
  const canSubmit =
    trimmedQuestion.length > 0 && trimmedSecret.length > 0 && !isSubmitting;
  const isStandardSubmitting =
    askState.kind === "submitting" && askState.strategy === "standard";
  const isExploreSubmitting =
    askState.kind === "submitting" && askState.strategy === "explore";
  const standardButtonLabel =
    isStandardSubmitting ? "Consultando..." : "Consultar base";
  const exploreButtonLabel =
    isExploreSubmitting ? "Explorando..." : "Explorar perspectivas";
  const historyButtonLabel =
    recentRunsState.status === "loading"
      ? "Carregando historico..."
      : recentRunsState.status === "idle"
        ? "Carregar historico recente"
        : "Atualizar historico";
  const conversationTitle =
    conversationState.conversation?.title ??
    (conversationId ? "Conversa sem titulo" : "Nenhuma conversa ativa");
  const newConversationLabel =
    conversationState.status === "loading" ? "Carregando..." : "Nova conversa";

  useEffect(() => {
    const stored = sessionStorage.getItem(SECRET_STORAGE_KEY);
    const url = new URL(window.location.href);
    const conversationParam = url.searchParams.get("conversation");

    if (conversationParam) {
      setConversationId(conversationParam);
    }

    if (stored) {
      setSecret(stored);
    }
  }, []);

  useEffect(() => {
    if (
      !conversationId ||
      trimmedSecret.length === 0 ||
      conversationState.status === "loading" ||
      conversationState.conversation?.id === conversationId
    ) {
      return;
    }

    void loadConversation(conversationId, trimmedSecret);
    // loadConversation mutates the state guarded above; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    conversationId,
    trimmedSecret,
    conversationState.status,
    conversationState.conversation?.id,
  ]);

  function updateSecret(value: string) {
    setSecret(value);

    if (value.length === 0) {
      sessionStorage.removeItem(SECRET_STORAGE_KEY);
      resetPersistedAuditState();
      setConversationState((current) => ({
        ...current,
        status: current.conversation ? "loaded" : "idle",
        error: null,
      }));
      return;
    }

    sessionStorage.setItem(SECRET_STORAGE_KEY, value);
  }

  function resetPersistedAuditState() {
    setRecentRunsState(createInitialRecentRunsState());
    setSelectedRunState(createInitialSelectedRunState());
  }

  function clearSecret() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
    resetPersistedAuditState();
    setConversationState((current) => ({
      ...current,
      status: current.conversation ? "loaded" : "idle",
      error: null,
    }));
  }

  async function submitQuestion(strategy: QuerySubmissionStrategy) {
    if (trimmedQuestion.length === 0 || trimmedSecret.length === 0) {
      return;
    }

    setAskState({ kind: "submitting", strategy });

    const activeConversationId = await ensureConversation();

    if (!activeConversationId) {
      return;
    }

    const response = await fetchJson(
      `/api/rag/conversations/${activeConversationId}/messages`,
      {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${trimmedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: trimmedQuestion,
        retrievalSettings: {
          topK,
          strategy,
        },
      }),
      },
    );

    if (response.kind === "network_error") {
      setAskState({ kind: "technical_error" });
      return;
    }

    if (response.status === 200) {
      const parsed = appendConversationMessageResponseSchema.safeParse(
        response.body,
      );

      if (!parsed.success) {
        setAskState({ kind: "technical_error" });
        return;
      }

      if (
        parsed.data.status !== "answered" &&
        parsed.data.status !== "answered_no_evidence"
      ) {
        setAskState({ kind: "technical_error" });
        return;
      }

      appendTranscriptMessages([
        parsed.data.userMessage,
        parsed.data.assistantMessage,
      ]);
      expandAudit(parsed.data.assistantMessage.id);
      setQuestion("");
      setAskState({ kind: "idle" });
      return;
    }

    if (response.status === 400) {
      const parsed = ragInvalidRequestResponseSchema.safeParse(response.body);
      setAskState(
        parsed.success
          ? { kind: "invalid_request" }
          : { kind: "technical_error" },
      );
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      clearSecret();
      setAskState(
        parsed.success ? { kind: "unauthorized" } : { kind: "technical_error" },
      );
      return;
    }

    if (response.status === 404) {
      setConversationState({
        status: "error",
        conversation: null,
        error: "not_found",
      });
      setAskState({ kind: "technical_error" });
      return;
    }

    if (response.status === 502 || response.status === 503) {
      const parsed = appendConversationMessageResponseSchema.safeParse(
        response.body,
      );

      if (parsed.success && "errorCode" in parsed.data) {
        appendTranscriptMessages([parsed.data.userMessage]);
      }

      setAskState({ kind: "technical_error" });
      return;
    }

    setAskState({ kind: "technical_error" });
  }

  async function ensureConversation(): Promise<string | null> {
    if (conversationId) {
      return conversationId;
    }

    return createConversation();
  }

  async function createConversation(): Promise<string | null> {
    if (trimmedSecret.length === 0) {
      return null;
    }

    setConversationState({
      status: "loading",
      conversation: null,
      error: null,
    });

    const response = await fetchJson("/api/rag/conversations", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${trimmedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (response.kind === "network_error") {
      setConversationState({
        status: "error",
        conversation: null,
        error: "technical",
      });
      setAskState({ kind: "technical_error" });
      return null;
    }

    if (response.status === 201) {
      const parsed = createConversationResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        setConversationState({
          status: "error",
          conversation: null,
          error: "technical",
        });
        setAskState({ kind: "technical_error" });
        return null;
      }

      const conversation: ConversationDetailResponse = {
        ...parsed.data,
        messages: [],
      };

      setConversationId(parsed.data.id);
      setConversationState({
        status: "loaded",
        conversation,
        error: null,
      });
      setExpandedAuditMessageIds(new Set());
      syncConversationUrl(parsed.data.id);

      return parsed.data.id;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      clearSecret();
      setAskState(
        parsed.success ? { kind: "unauthorized" } : { kind: "technical_error" },
      );
      return null;
    }

    setConversationState({
      status: "error",
      conversation: null,
      error: "technical",
    });
    setAskState({ kind: "technical_error" });
    return null;
  }

  async function startNewConversation() {
    setAskState({ kind: "idle" });
    setQuestion("");
    await createConversation();
  }

  async function loadConversation(id: string, secretValue = trimmedSecret) {
    const effectiveSecret = secretValue.trim();

    if (effectiveSecret.length === 0) {
      return;
    }

    setConversationState((current) => ({
      status: "loading",
      conversation: current.conversation,
      error: null,
    }));

    const response = await fetchJson(`/api/rag/conversations/${id}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${effectiveSecret}`,
      },
    });

    if (response.kind === "network_error") {
      setConversationState({
        status: "error",
        conversation: null,
        error: "technical",
      });
      return;
    }

    if (response.status === 200) {
      const parsed = conversationDetailResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        setConversationState({
          status: "error",
          conversation: null,
          error: "technical",
        });
        return;
      }

      setConversationId(parsed.data.id);
      setConversationState({
        status: "loaded",
        conversation: parsed.data,
        error: null,
      });
      setExpandedAuditMessageIds(new Set());
      syncConversationUrl(parsed.data.id);
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      clearSecret();
      setConversationState({
        status: "error",
        conversation: null,
        error: parsed.success ? "unauthorized" : "technical",
      });
      return;
    }

    if (response.status === 404) {
      setConversationState({
        status: "error",
        conversation: null,
        error: "not_found",
      });
      return;
    }

    setConversationState({
      status: "error",
      conversation: null,
      error: "technical",
    });
  }

  function appendTranscriptMessages(messages: ConversationMessageResponse[]) {
    setConversationState((current) => {
      if (!current.conversation) {
        return current;
      }

      return {
        status: "loaded",
        conversation: {
          ...current.conversation,
          lastMessageAt:
            messages[messages.length - 1]?.createdAt ??
            current.conversation.lastMessageAt,
          messages: [...current.conversation.messages, ...messages],
        },
        error: null,
      };
    });
  }

  function toggleAudit(messageId: string) {
    setExpandedAuditMessageIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  function expandAudit(messageId: string) {
    setExpandedAuditMessageIds((current) => {
      if (current.has(messageId)) {
        return current;
      }

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }

  async function loadRecentRuns() {
    if (trimmedSecret.length === 0) {
      return;
    }

    setRecentRunsState((current) => ({
      ...current,
      status: "loading",
      error: null,
    }));

    const response = await fetchJson("/api/rag/query-runs", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${trimmedSecret}`,
      },
    });

    if (response.kind === "network_error") {
      setRecentRunsState((current) => ({
        ...current,
        status: "error",
        error: "technical",
      }));
      return;
    }

    if (response.status === 200) {
      const parsed = ragQueryRunSummariesResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        setRecentRunsState((current) => ({
          ...current,
          status: "error",
          error: "technical",
        }));
        return;
      }

      setRecentRunsState({
        status: "loaded",
        runs: parsed.data,
        error: null,
      });
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      const error = parsed.success ? "unauthorized" : "technical";
      clearSecret();
      setRecentRunsState({
        status: "error",
        runs: [],
        error,
      });
      return;
    }

    setRecentRunsState((current) => ({
      ...current,
      status: "error",
      error: "technical",
    }));
  }

  async function loadRunDetail(runId: string) {
    if (trimmedSecret.length === 0) {
      return;
    }

    setSelectedRunState({
      status: "loading",
      run: null,
      runId,
      error: null,
    });

    const response = await fetchJson(`/api/rag/query-runs/${runId}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${trimmedSecret}`,
      },
    });

    if (response.kind === "network_error") {
      setSelectedRunState({
        status: "error",
        run: null,
        runId,
        error: "technical",
      });
      return;
    }

    if (response.status === 200) {
      const parsed = ragQueryRunDetailResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        setSelectedRunState({
          status: "error",
          run: null,
          runId,
          error: "technical",
        });
        return;
      }

      setSelectedRunState({
        status: "loaded",
        run: parsed.data,
        runId,
        error: null,
      });
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      const error = parsed.success ? "unauthorized" : "technical";
      clearSecret();
      setRecentRunsState({
        status: "error",
        runs: [],
        error,
      });
      setSelectedRunState({
        status: "error",
        run: null,
        runId,
        error,
      });
      return;
    }

    setSelectedRunState({
      status: "error",
      run: null,
      runId,
      error: "technical",
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion("standard");
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>GLOBAL RAG / AUDIT</p>
            <h1 className={styles.title}>
              Consulta na base{" "}
              <span className={styles.titleAccent}>documental</span>
            </h1>
            <p className={styles.lede}>
              Faça uma pergunta global sobre os documentos indexados e receba
              uma resposta com citacoes inline, fontes numeradas e trilha de
              auditoria. Apenas usuarios com o secret podem consultar ou ler o
              historico persistido.
            </p>
          </div>

          <aside className={styles.sysStamp} aria-hidden="true">
            <span>SYS / STATUS</span>
            <span>retrieval :: hybrid-v1</span>
            <span>embedding :: 3-large</span>
            <span>audit :: f05-enabled</span>
          </aside>
        </header>

        <section className={styles.toolbar} aria-label="Controles da consulta">
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

          <div className={`${styles.field} ${styles.fieldControls}`}>
            <label htmlFor="query-top-k" className={styles.label}>
              <span>Fontes recuperadas</span>
              <span className={styles.labelIndex}>[ 02 ]</span>
            </label>
            <div className={styles.controlRow}>
              <input
                id="query-top-k"
                type="number"
                min={RAG_RETRIEVAL_MIN_TOP_K}
                max={RAG_RETRIEVAL_MAX_TOP_K}
                step={1}
                value={topK}
                onChange={(event) => setTopK(readTopKInput(event.target.value))}
                className={`${styles.input} ${styles.numberInput}`}
              />
              <span className={styles.rangeBadge}>
                {RAG_RETRIEVAL_MIN_TOP_K}-{RAG_RETRIEVAL_MAX_TOP_K}
              </span>
            </div>
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              onClick={clearSecret}
              disabled={trimmedSecret.length === 0}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              Limpar secret
            </button>
            <button
              type="button"
              onClick={() => {
                void startNewConversation();
              }}
              disabled={
                trimmedSecret.length === 0 ||
                conversationState.status === "loading" ||
                isSubmitting
              }
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              {newConversationLabel}
            </button>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.chatPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Conversa</h2>
              <p className={styles.panelCopy}>
                {conversationTitle}
                {conversationId ? ` :: ${conversationId.slice(0, 8)}` : ""}
              </p>
            </div>
          </header>

          {conversationState.error === "unauthorized" ? (
            <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
          ) : null}

          {conversationState.error === "technical" ? (
            <StatusAlert kind="technical" message={RAG_TECHNICAL_ERROR_MESSAGE} />
          ) : null}

          {conversationState.error === "not_found" ? (
            <StatusAlert
              kind="technical"
              message="Conversa nao encontrada ou indisponivel para recarga."
            />
          ) : null}

          {conversationState.status === "loading" ? (
            <p className={styles.emptyPanel}>Carregando conversa...</p>
          ) : null}

          {conversationState.conversation?.messages.length ? (
            <ol className={styles.transcript}>
              {conversationState.conversation.messages.map((message) => (
                <ConversationMessageItem
                  key={message.id}
                  message={message}
                  isAuditExpanded={expandedAuditMessageIds.has(message.id)}
                  onToggleAudit={() => toggleAudit(message.id)}
                />
              ))}
            </ol>
          ) : conversationState.status !== "loading" ? (
            <p className={styles.emptyPanel}>
              Envie uma pergunta para criar ou continuar uma conversa auditavel.
            </p>
          ) : null}


          <div className={styles.composerWrap}>
            {askState.kind === "invalid_request" ? (
              <StatusAlert kind="invalid" message={RAG_INVALID_REQUEST_MESSAGE} />
            ) : null}

            {askState.kind === "unauthorized" ? (
              <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
            ) : null}

            {askState.kind === "technical_error" ? (
              <StatusAlert kind="technical" message={RAG_TECHNICAL_ERROR_MESSAGE} />
            ) : null}

            <form onSubmit={onSubmit} className={styles.composer}>
              <div className={`${styles.field} ${styles.fieldQuestion}`}>
                <label htmlFor="query-question" className={styles.label}>
                  <span>Pergunta</span>
                  <span className={styles.labelIndex}>[ 03 ]</span>
                </label>
                <textarea
                  id="query-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      if (canSubmit) {
                        void submitQuestion("standard");
                      }
                    }
                  }}
                  rows={3}
                  placeholder="Ex.: Quais tecnicas aparecem com mais frequencia nos estudos?"
                  className={styles.textarea}
                />
              </div>

              <div className={styles.composerActions}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`${styles.btn} ${
                    isStandardSubmitting ? styles.btnLoading : styles.btnPrimary
                  }`}
                >
                  {standardButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitQuestion("explore");
                  }}
                  disabled={!canSubmit}
                  className={`${styles.btn} ${
                    isExploreSubmitting ? styles.btnLoading : styles.btnExplore
                  }`}
                >
                  {exploreButtonLabel}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Historico recente</h2>
              <p className={styles.panelCopy}>
                O carregamento e manual. Nenhuma consulta adicional e feita
                automaticamente apos o ask atual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadRecentRuns();
              }}
              disabled={
                trimmedSecret.length === 0 || recentRunsState.status === "loading"
              }
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              {historyButtonLabel}
            </button>
          </header>

          {recentRunsState.error === "unauthorized" ? (
            <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
          ) : null}

          {recentRunsState.error === "technical" ? (
            <StatusAlert kind="technical" message={RAG_HISTORY_ERROR_MESSAGE} />
          ) : null}

          {recentRunsState.status === "idle" ? (
            <p className={styles.emptyPanel}>{RAG_HISTORY_IDLE_MESSAGE}</p>
          ) : null}

          {recentRunsState.status === "loading" && recentRunsState.runs.length === 0 ? (
            <p className={styles.emptyPanel}>Carregando historico auditado...</p>
          ) : null}

          {recentRunsState.status !== "idle" &&
          recentRunsState.runs.length === 0 &&
          recentRunsState.status !== "loading" ? (
            <p className={styles.emptyPanel}>{RAG_HISTORY_EMPTY_MESSAGE}</p>
          ) : null}

          {recentRunsState.runs.length > 0 ? (
            <ol className={styles.historyList}>
              {recentRunsState.runs.map((run) => {
                const isSelected = selectedRunState.runId === run.id;
                const isLoading =
                  selectedRunState.status === "loading" &&
                  selectedRunState.runId === run.id;

                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void loadRunDetail(run.id);
                      }}
                      className={`${styles.historyButton} ${
                        isSelected ? styles.historyButtonActive : ""
                      }`}
                    >
                      <span className={styles.historyQuestion}>{run.question}</span>
                      <span className={styles.historyMeta}>
                        status :: {formatRunStatus(run.status)}
                      </span>
                      <span className={styles.historyMeta}>
                        strategy :: {formatStrategy(run.retrievalStrategy)}
                      </span>
                      <span className={styles.historyMeta}>
                        top-k :: {run.topK}
                      </span>
                      <span className={styles.historyMeta}>
                        latency :: {run.latencyMs} ms
                      </span>
                      <span className={styles.historyMeta}>
                        total :: {formatUsd(run.totalCostUsd)}
                      </span>
                      <span className={styles.historyMeta}>
                        created :: {formatTimestamp(run.createdAt)}
                      </span>
                      {isLoading ? (
                        <span className={styles.historyMeta}>abrindo...</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Execucao selecionada</h2>
              <p className={styles.panelCopy}>
                Inspecione a trilha persistida sem reconstruir a resposta no
                navegador.
              </p>
            </div>
          </header>

          {selectedRunState.error === "unauthorized" ? (
            <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
          ) : null}

          {selectedRunState.error === "technical" ? (
            <StatusAlert kind="technical" message={RAG_RUN_DETAIL_ERROR_MESSAGE} />
          ) : null}

          {selectedRunState.status === "idle" ? (
            <p className={styles.emptyPanel}>{RAG_RUN_DETAIL_IDLE_MESSAGE}</p>
          ) : null}

          {selectedRunState.status === "loading" ? (
            <p className={styles.emptyPanel}>Carregando execucao persistida...</p>
          ) : null}

          {selectedRunState.run ? (
            <section className={styles.result}>
              <article className={styles.resultBlock}>
                <header className={styles.blockHeader}>
                  <span className={styles.blockIndex}>
                    [ 01 ] Resposta persistida
                  </span>
                  <span className={styles.blockMeta}>
                    status :: {formatRunStatus(selectedRunState.run.status)}
                  </span>
                </header>
                <div className={styles.blockBody}>
                  <p className={styles.subHeadline}>Pergunta persistida</p>
                  <p className={styles.questionSnapshot}>
                    {selectedRunState.run.question}
                  </p>
                  <h2 className={styles.answerHeadline}>
                    Execucao auditada armazenada em banco.
                  </h2>
                  <p className={styles.answerText}>
                    {selectedRunState.run.answer ??
                      "Nenhuma resposta textual foi persistida para esta execucao."}
                  </p>
                </div>
              </article>

              <AuditSummaryBlock
                blockIndex="[ 02 ] Auditoria persistida"
                metaLabel={`created :: ${formatTimestamp(
                  selectedRunState.run.createdAt,
                )}`}
                traceId={selectedRunState.run.id}
                question={selectedRunState.run.question}
                metadata={selectedRunState.run.metadata}
                audit={selectedRunState.run.audit}
                status={selectedRunState.run.status}
                errorCode={selectedRunState.run.errorCode}
                createdAt={selectedRunState.run.createdAt}
              />

              <RelatedTermsBlock
                blockIndex="[ 03 ] Termos persistidos"
                terms={selectedRunState.run.relatedTerms}
              />

              <SourcesBlock
                blockIndex="[ 04 ] Fontes persistidas"
                sources={selectedRunState.run.sources}
                showCitationFlags
              />
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type StatusAlertProps = {
  kind: "invalid" | "unauthorized" | "technical";
  message: string;
};

function StatusAlert({ kind, message }: StatusAlertProps) {
  const className =
    kind === "invalid"
      ? styles.alertInvalid
      : kind === "unauthorized"
        ? styles.alertUnauthorized
        : styles.alertTechnical;
  const badge = kind === "invalid" ? "400" : kind === "unauthorized" ? "401" : "ERR";

  return (
    <div role="alert" className={`${styles.alert} ${className}`}>
      <span className={styles.alertBadge}>{badge}</span>
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

type ConversationMessageItemProps = {
  message: ConversationMessageResponse;
  isAuditExpanded: boolean;
  onToggleAudit: () => void;
};

function ConversationMessageItem({
  message,
  isAuditExpanded,
  onToggleAudit,
}: ConversationMessageItemProps) {
  const isAssistant = message.role === "assistant";

  return (
    <li
      className={`${styles.transcriptItem} ${
        isAssistant ? styles.transcriptAssistant : styles.transcriptUser
      }`}
    >
      <article className={styles.transcriptBubble}>
        <header className={styles.transcriptHeader}>
          <span>{isAssistant ? "Assistente" : "Operador"}</span>
          <span>{formatTimestamp(message.createdAt)}</span>
        </header>
        <p className={styles.transcriptText}>{message.content}</p>

        {isAssistant && message.trace ? (
          <button
            type="button"
            onClick={onToggleAudit}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.auditToggle}`}
          >
            {isAuditExpanded ? "Ocultar auditoria" : "Ver auditoria"}
          </button>
        ) : null}
      </article>

      {isAssistant && message.trace && isAuditExpanded ? (
        <section className={styles.conversationAudit}>
          <AuditSummaryBlock
            blockIndex="[ 01 ] Auditoria da mensagem"
            metaLabel={`trace :: ${message.trace.id.slice(0, 8)}`}
            traceId={message.trace.id}
            question={message.trace.question}
            metadata={message.trace.metadata}
            audit={message.trace.audit}
            status={message.trace.status}
            errorCode={message.trace.errorCode}
            createdAt={message.trace.createdAt}
          />

          <RelatedTermsBlock
            blockIndex="[ 02 ] Termos da mensagem"
            terms={message.trace.relatedTerms}
          />

          <SourcesBlock
            blockIndex="[ 03 ] Fontes da mensagem"
            sources={message.trace.sources}
            showCitationFlags
          />
        </section>
      ) : null}
    </li>
  );
}

type AuditSummaryBlockProps = {
  blockIndex: string;
  metaLabel: string;
  traceId: string;
  question: string;
  metadata: RagAnswerMetadata;
  audit: RagAnswerAudit;
  status?: RagQueryRunDetailResponse["status"];
  errorCode?: RagQueryRunDetailResponse["errorCode"];
  createdAt?: string;
};

function AuditSummaryBlock({
  blockIndex,
  metaLabel,
  traceId,
  question,
  metadata,
  audit,
  status,
  errorCode,
  createdAt,
}: AuditSummaryBlockProps) {
  return (
    <article className={`${styles.resultBlock} ${styles.metaBlockAccent}`}>
      <header className={styles.blockHeader}>
        <span className={styles.blockIndex}>{blockIndex}</span>
        <span className={styles.blockMeta}>{metaLabel}</span>
      </header>
      <div className={styles.metaGrid}>
        <MetaItem label="// trace id" value={traceId} />
        <MetaItem label="// question chars" value={String(question.length)} />
        <MetaItem label="// strategy" value={formatStrategy(metadata.retrievalStrategy)} />
        <MetaItem label="// top-k" value={String(metadata.topK)} />
        <MetaItem label="// candidates" value={String(metadata.candidateTopK)} />
        <MetaItem label="// generation" value={metadata.generationModel} />
        <MetaItem label="// embedding" value={metadata.embeddingModel} />
        <MetaItem label="// latency" value={`${audit.latencyMs} ms`} />
        <MetaItem
          label="// embedding tokens"
          value={String(audit.embedding.inputTokens)}
        />
        <MetaItem
          label="// embedding cost"
          value={formatUsd(audit.embedding.estimatedCostUsd)}
        />
        <MetaItem
          label="// generation tokens"
          value={
            audit.generation
              ? String(audit.generation.totalTokens)
              : RAG_NO_GENERATION_AUDIT_MESSAGE
          }
        />
        <MetaItem
          label="// generation cost"
          value={
            audit.generation
              ? formatUsd(audit.generation.estimatedCostUsd)
              : RAG_NO_GENERATION_AUDIT_MESSAGE
          }
        />
        <MetaItem label="// total cost" value={formatUsd(audit.totalCostUsd)} />
        {status ? <MetaItem label="// status" value={formatRunStatus(status)} /> : null}
        {errorCode ? <MetaItem label="// error code" value={errorCode} /> : null}
        {createdAt ? (
          <MetaItem label="// created at" value={formatTimestamp(createdAt)} />
        ) : null}
      </div>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaKey}>{label}</span>
      <p className={styles.metaValue}>{value}</p>
    </div>
  );
}

function RelatedTermsBlock({
  blockIndex,
  terms,
}: {
  blockIndex: string;
  terms: RelatedTerm[];
}) {
  return (
    <article className={`${styles.resultBlock} ${styles.termsBlockAccent}`}>
      <header className={styles.blockHeader}>
        <span className={styles.blockIndex}>{blockIndex}</span>
        <span className={styles.blockMeta}>n = {terms.length}</span>
      </header>
      <div className={styles.blockBody}>
        {terms.length === 0 ? (
          <p className={styles.emptyPanel}>
            Nenhum termo relacionado auditavel foi encontrado.
          </p>
        ) : (
          <ul className={styles.termList}>
            {terms.map((term) => (
              <li key={`${term.rank}-${term.term}`} className={styles.termCard}>
                <p className={styles.termTitle}>
                  #{term.rank} {term.term}
                </p>
                <p className={styles.termMeta}>
                  ngram :: {term.ngramSize} | freq :: {term.frequency} |
                  cobertura :: {term.sourceCoverageCount}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

type SourceCard = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
  citedInAnswer?: boolean;
};

function SourcesBlock({
  blockIndex,
  sources,
  showCitationFlags = false,
}: {
  blockIndex: string;
  sources: SourceCard[];
  showCitationFlags?: boolean;
}) {
  return (
    <article className={`${styles.resultBlock} ${styles.sourcesBlockAccent}`}>
      <header className={styles.blockHeader}>
        <span className={styles.blockIndex}>{blockIndex}</span>
        <span className={styles.blockMeta}>n = {sources.length}</span>
      </header>
      <div className={styles.blockBody}>
        {sources.length === 0 ? (
          <p className={styles.emptySources}>{RAG_EMPTY_SOURCES_MESSAGE}</p>
        ) : (
          <ol className={styles.sources}>
            {sources.map((source) => (
              <li key={source.chunkId} className={styles.sourceCard}>
                <div className={styles.sourceNumber} aria-hidden="true">
                  {source.sourceNumber}
                </div>
                <div>
                  <p className={styles.sourceTitle}>
                    {source.sourceNumber}. {source.documentTitle}
                  </p>
                  <p className={styles.sourceExcerpt}>
                    {truncateExcerptPreview(source.excerpt)}
                  </p>
                  <div className={styles.sourceMetaRow}>
                    <span className={styles.sourceChip}>
                      score :: {source.score.toFixed(2)}
                    </span>
                    <span className={styles.sourceChip}>
                      chunk :: {source.chunkIndex}
                    </span>
                    {showCitationFlags ? (
                      <span className={styles.sourceChip}>
                        citado :: {source.citedInAnswer ? "sim" : "nao"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function readTopKInput(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return RAG_RETRIEVAL_DEFAULT_TOP_K;
  }

  return Math.min(
    RAG_RETRIEVAL_MAX_TOP_K,
    Math.max(RAG_RETRIEVAL_MIN_TOP_K, parsed),
  );
}

function syncConversationUrl(conversationId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("conversation", conversationId);
  window.history.pushState({}, "", url);
}

async function fetchJson(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<
  | { kind: "network_error" }
  | { kind: "http"; status: number; body: unknown }
> {
  try {
    const response = await fetch(input, init);
    const body = await response.json().catch(() => null);

    return {
      kind: "http",
      status: response.status,
      body,
    };
  } catch {
    return { kind: "network_error" };
  }
}

function formatUsd(value: number): string {
  return `US$ ${value.toFixed(8)}`;
}

function formatStrategy(strategy: QuerySubmissionStrategy): string {
  return strategy === "explore" ? "explore" : "standard";
}

function formatRunStatus(status: RagQueryRunSummaryResponse["status"]): string {
  switch (status) {
    case "answered":
      return "respondida";
    case "answered_no_evidence":
      return "respondida sem evidencia";
    case "generation_failed":
      return "falha segura";
    case "generation_unavailable":
      return "geracao indisponivel";
  }
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(".000Z", "Z");
}
