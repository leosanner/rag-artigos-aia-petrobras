"use client";

import { useEffect, useRef, useState } from "react";

import {
  appendConversationMessageResponseSchema,
  conversationDetailResponseSchema,
  createConversationResponseSchema,
  listRagDocumentsResponseSchema,
  ragConversationStreamEventSchema,
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
  type ConversationDetailResponse,
  type ConversationMessageResponse,
  type RagConversationStreamEvent,
  type RagRunAuditResponse,
  type RagRunMetadataResponse,
  type RagQueryRunDetailResponse,
  type RagQueryRunSummaryResponse,
  type RagSource,
  type RagStreamSource,
  type RelatedTerm,
  type SelectableRagDocument,
} from "@/application/rag/schemas";
import {
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  RAG_RERANK_DEFAULT_CANDIDATE_TOP_K,
  RAG_RETRIEVAL_DEFAULT_TOP_K,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  type RagRetrievalStrategy,
} from "@/domain/rag";

import { AuditDrawer } from "./components/AuditDrawer";
import {
  formatTechnicalErrorMessage,
  RAG_EMPTY_SOURCES_MESSAGE,
  RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE,
  RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE,
  RAG_FOCUSED_DOCUMENTS_EMPTY_MESSAGE,
  RAG_FOCUSED_DOCUMENTS_ERROR_MESSAGE,
  RAG_GENERATION_FAILED_MESSAGE,
  RAG_GENERATION_UNAVAILABLE_MESSAGE,
  RAG_INVALID_REQUEST_MESSAGE,
  RAG_NETWORK_ERROR_MESSAGE,
  RAG_NO_GENERATION_AUDIT_MESSAGE,
  RAG_PHASE_COPY_GENERATING,
  RAG_PHASE_COPY_RERANKING,
  RAG_PHASE_COPY_RETRIEVING,
  RAG_STREAM_RELATED_TERMS_TITLE,
  RAG_TECHNICAL_ERROR_MESSAGE,
  RAG_UNAUTHORIZED_MESSAGE,
  STRATEGY_FOCUSED_NOTE,
  STRATEGY_LABEL_EXPLORE,
  STRATEGY_LABEL_RERANK,
  STRATEGY_LABEL_STANDARD,
  STRATEGY_TOOLTIP_EXPLORE,
  STRATEGY_TOOLTIP_RERANK,
  STRATEGY_TOOLTIP_STANDARD,
  truncateExcerptPreview,
} from "./constants";
import styles from "./page.module.css";

const SECRET_STORAGE_KEY = "query:secret";
const SOURCE_FOCUS_ACTION_LABEL = "Conversar apenas sobre este artigo";

// ---------------------------------------------------------------------------
// Mock visual para iteracao de design — ativar com ?mock=1 na URL.
// Nao afeta testes nem fluxo real (so e injetado se a query string contiver mock=1).
// Remover quando o trabalho de estilo terminar.
// ---------------------------------------------------------------------------
const MOCK_CONVERSATION: ConversationDetailResponse = (() => {
  const metadata: RagRunMetadataResponse = {
    mode: "global",
    documentId: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 24,
    promptVersion: "rag.global.v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
    rerankerProvider: null,
    rerankerModel: null,
  };
  const audit: RagRunAuditResponse = {
    latencyMs: 2430,
    embedding: { inputTokens: 24, estimatedCostUsd: 0.00000312 },
    reranking: null,
    generation: {
      inputTokens: 1820,
      outputTokens: 312,
      totalTokens: 2132,
      estimatedCostUsd: 0.00021048,
    },
    totalCostUsd: 0.0002136,
  };

  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    title: "Tecnicas recorrentes em AIA",
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:04:32.000Z",
    lastMessageAt: "2026-04-26T12:04:32.000Z",
    messages: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        role: "user",
        content:
          "Quais tecnicas de machine learning aparecem com mais frequencia nos estudos de Avaliacao de Impacto Ambiental?",
        createdAt: "2026-04-26T12:00:10.000Z",
        trace: null,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        role: "assistant",
        content:
          "As tecnicas mais recorrentes nos artigos analisados sao Random Forest e Support Vector Machines para classificacao supervisionada [1], seguidas por redes convolucionais aplicadas a sensoriamento remoto [2]. Estudos mais recentes combinam ensembles com features derivadas de indices espectrais [3].",
        createdAt: "2026-04-26T12:00:32.000Z",
        trace: {
          id: "33333333-3333-3333-3333-333333333333",
          question:
            "Quais tecnicas de machine learning aparecem com mais frequencia nos estudos de Avaliacao de Impacto Ambiental?",
          answer:
            "As tecnicas mais recorrentes nos artigos analisados sao Random Forest e Support Vector Machines para classificacao supervisionada [1], seguidas por redes convolucionais aplicadas a sensoriamento remoto [2].",
          mode: "global",
          documentId: null,
          status: "answered",
          errorCode: null,
          metadata,
          audit,
          createdAt: "2026-04-26T12:00:32.000Z",
          relatedTerms: [
            { rank: 1, term: "random forest", ngramSize: 2, frequency: 18, sourceCoverageCount: 9 },
            { rank: 2, term: "sensoriamento remoto", ngramSize: 2, frequency: 14, sourceCoverageCount: 8 },
            { rank: 3, term: "classificacao supervisionada", ngramSize: 2, frequency: 11, sourceCoverageCount: 6 },
            { rank: 4, term: "support vector machine", ngramSize: 3, frequency: 9, sourceCoverageCount: 5 },
          ],
          sources: [
            {
              sourceNumber: 1,
              chunkId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
              documentId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
              documentTitle: "Machine learning para AIA - revisao sistematica (2022).pdf",
              chunkIndex: 4,
              excerpt:
                "Entre os 31 estudos revisados, Random Forest aparece em 19 trabalhos como classificador principal, frequentemente comparado a SVM em cenarios de cobertura do solo.",
              retrievalScore: 0.87,
              rerankScore: null,
              documentPipelineVersion: "ingest-v1",
              chunkingVersion: "chunk-v1",
              embeddingModel: "text-embedding-3-large",
              citedInAnswer: true,
            },
            {
              sourceNumber: 2,
              chunkId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              documentId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
              documentTitle: "CNNs aplicadas a imagens Sentinel-2 em estudos de impacto.pdf",
              chunkIndex: 7,
              excerpt:
                "A arquitetura U-Net foi usada para segmentar areas degradadas com IoU medio de 0.78, superando metodos baseados em indices espectrais isolados.",
              retrievalScore: 0.81,
              rerankScore: null,
              documentPipelineVersion: "ingest-v1",
              chunkingVersion: "chunk-v1",
              embeddingModel: "text-embedding-3-large",
              citedInAnswer: true,
            },
            {
              sourceNumber: 3,
              chunkId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
              documentId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
              documentTitle: "Ensembles e indices espectrais em monitoramento ambiental.pdf",
              chunkIndex: 2,
              excerpt:
                "Modelos do tipo gradient boosting alimentados por NDVI, NDWI e EVI superaram baselines tradicionais em 4 das 6 bacias estudadas.",
              retrievalScore: 0.74,
              rerankScore: null,
              documentPipelineVersion: "ingest-v1",
              chunkingVersion: "chunk-v1",
              embeddingModel: "text-embedding-3-large",
              citedInAnswer: false,
            },
          ],
        },
      },
      {
        id: "44444444-4444-4444-4444-444444444444",
        role: "user",
        content: "E quanto a metricas de avaliacao? Quais sao reportadas com mais frequencia?",
        createdAt: "2026-04-26T12:04:10.000Z",
        trace: null,
      },
      {
        id: "55555555-5555-5555-5555-555555555555",
        role: "assistant",
        content:
          "As metricas mais reportadas sao acuracia global e kappa para classificacao [1], alem de IoU e F1-score nos trabalhos baseados em CNN [2]. Estudos com forte componente de validacao de campo tambem reportam matriz de confusao por classe.",
        createdAt: "2026-04-26T12:04:32.000Z",
        trace: null,
      },
    ],
  };
})();

type ConversationSubmissionStrategy = RagRetrievalStrategy;
type QueryMode = "global" | "focused";

const GLOBAL_STRATEGY_OPTIONS: ReadonlyArray<{
  value: RagRetrievalStrategy;
  label: string;
  tooltip: string;
}> = [
  {
    value: "standard",
    label: STRATEGY_LABEL_STANDARD,
    tooltip: STRATEGY_TOOLTIP_STANDARD,
  },
  {
    value: "explore",
    label: STRATEGY_LABEL_EXPLORE,
    tooltip: STRATEGY_TOOLTIP_EXPLORE,
  },
  {
    value: "rerank",
    label: STRATEGY_LABEL_RERANK,
    tooltip: STRATEGY_TOOLTIP_RERANK,
  },
];

type ConversationAskState =
  | { kind: "idle" }
  | { kind: "submitting"; strategy: ConversationSubmissionStrategy }
  | { kind: "invalid_request" }
  | { kind: "unauthorized" }
  | { kind: "technical_error"; message: string };

type LoadErrorKind = "unauthorized" | "technical";

type ConversationErrorKind = LoadErrorKind | "not_found";

type ConversationState = {
  status: "idle" | "loading" | "loaded" | "error";
  conversation: ConversationDetailResponse | null;
  error: ConversationErrorKind | null;
};

type SelectableDocumentsState = {
  status: "idle" | "loading" | "loaded" | "error";
  documents: SelectableRagDocument[];
  error: LoadErrorKind | null;
  lastLoadedSecret: string | null;
};

type HandoffState =
  | { status: "idle" }
  | { status: "starting"; sourceChunkId: string };

type StreamingPhase = "retrieving_sources" | "reranking" | "generating_answer";

type StreamingAssistantState =
  | { status: "idle" }
  | {
      status: "streaming";
      phase: StreamingPhase;
      content: string;
      sources: RagStreamSource[];
      relatedTerms: RelatedTerm[];
    };

function createInitialConversationState(): ConversationState {
  return {
    status: "idle",
    conversation: null,
    error: null,
  };
}

function createInitialStreamingAssistantState(): StreamingAssistantState {
  return {
    status: "idle",
  };
}

function createInitialSelectableDocumentsState(): SelectableDocumentsState {
  return {
    status: "idle",
    documents: [],
    error: null,
    lastLoadedSecret: null,
  };
}

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [secret, setSecret] = useState("");
  const [queryMode, setQueryMode] = useState<QueryMode>("global");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [topK, setTopK] = useState(RAG_RETRIEVAL_DEFAULT_TOP_K);
  const [candidateTopK, setCandidateTopK] = useState(
    RAG_RERANK_DEFAULT_CANDIDATE_TOP_K,
  );
  const [selectedStrategy, setSelectedStrategy] =
    useState<RagRetrievalStrategy>("standard");
  const [openStrategyTooltip, setOpenStrategyTooltip] =
    useState<RagRetrievalStrategy | null>(null);
  const [askState, setAskState] = useState<ConversationAskState>({
    kind: "idle",
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>(
    createInitialConversationState,
  );
  const [streamingAssistantState, setStreamingAssistantState] =
    useState<StreamingAssistantState>(createInitialStreamingAssistantState);
  const [selectableDocumentsState, setSelectableDocumentsState] =
    useState<SelectableDocumentsState>(createInitialSelectableDocumentsState);
  const [auditDrawerMessageId, setAuditDrawerMessageId] = useState<
    string | null
  >(null);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [handoffState, setHandoffState] = useState<HandoffState>({
    status: "idle",
  });
  const handoffInFlightRef = useRef(false);
  const suppressUrlSyncRef = useRef(false);

  const trimmedQuestion = question.trim();
  const trimmedSecret = secret.trim();
  const selectedDocument =
    selectableDocumentsState.documents.find(
      (document) => document.id === selectedDocumentId,
    ) ?? null;
  const isSubmitting = askState.kind === "submitting";
  const canSubmit =
    trimmedQuestion.length > 0 &&
    trimmedSecret.length > 0 &&
    !isSubmitting &&
    (queryMode === "global" || selectedDocument !== null);
  const effectiveStrategy: RagRetrievalStrategy =
    queryMode === "focused" ? "standard" : selectedStrategy;
  const submitButtonLabel = isSubmitting
    ? "Consultando..."
    : "Consultar base";
  const conversationTitle =
    conversationState.conversation?.title ??
    (conversationId ? "Conversa sem titulo" : "Nenhuma conversa ativa");
  const newConversationLabel =
    conversationState.status === "loading" ? "Carregando..." : "Nova conversa";
  const auditDrawerMessage =
    auditDrawerMessageId === null
      ? null
      : (conversationState.conversation?.messages ?? []).find(
          (
            message,
          ): message is ConversationMessageResponse & {
            trace: NonNullable<ConversationMessageResponse["trace"]>;
          } =>
            message.role === "assistant" &&
            message.trace !== null &&
            message.id === auditDrawerMessageId,
        ) ?? null;

  useEffect(() => {
    const stored = sessionStorage.getItem(SECRET_STORAGE_KEY);
    const url = new URL(window.location.href);
    const conversationParam = url.searchParams.get("conversation");
    const modeParam = url.searchParams.get("mode");
    const documentIdParam = url.searchParams.get("documentId");
    const mockParam = url.searchParams.get("mock");

    if (mockParam === "1") {
      setConversationId(MOCK_CONVERSATION.id);
      setConversationState({
        status: "loaded",
        conversation: MOCK_CONVERSATION,
        error: null,
      });
      // Start with auditorias closed so the chat opens centered; the user
      // shifts the layout by clicking "Ver auditoria".
      setAuditDrawerMessageId(null);
      return;
    }

    if (modeParam === "focused") {
      setQueryMode("focused");
    }

    if (
      modeParam === "focused" &&
      documentIdParam &&
      isUuidValue(documentIdParam)
    ) {
      setSelectedDocumentId(documentIdParam);
    }

    if (conversationParam) {
      setConversationId(conversationParam);
    }

    if (stored) {
      setSecret(stored);
    }

    setIsUrlStateReady(true);
  }, []);

  useEffect(() => {
    if (!isUrlStateReady || suppressUrlSyncRef.current) {
      return;
    }

    syncQueryUrl({
      conversationId,
      mode: queryMode,
      documentId:
        queryMode === "focused" && isUuidValue(selectedDocumentId)
          ? selectedDocumentId
          : null,
    });
  }, [conversationId, isUrlStateReady, queryMode, selectedDocumentId]);

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

  useEffect(() => {
    if (
      queryMode !== "focused" ||
      trimmedSecret.length === 0 ||
      selectableDocumentsState.status === "loading" ||
      selectableDocumentsState.lastLoadedSecret === trimmedSecret
    ) {
      return;
    }

    void loadSelectableDocuments(trimmedSecret);
    // loadSelectableDocuments mutates the guarded state above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryMode,
    trimmedSecret,
    selectableDocumentsState.status,
    selectableDocumentsState.lastLoadedSecret,
  ]);

  function updateSecret(value: string) {
    setSecret(value);

    if (value.length === 0) {
      sessionStorage.removeItem(SECRET_STORAGE_KEY);
      resetSelectableDocumentsState();
      setConversationState((current) => ({
        ...current,
        status: current.conversation ? "loaded" : "idle",
        error: null,
      }));
      return;
    }

    sessionStorage.setItem(SECRET_STORAGE_KEY, value);
  }

  function resetSelectableDocumentsState() {
    setSelectableDocumentsState(createInitialSelectableDocumentsState());
    setSelectedDocumentId("");
  }

  function clearSecret() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
    resetSelectableDocumentsState();
    setConversationState((current) => ({
      ...current,
      status: current.conversation ? "loaded" : "idle",
      error: null,
    }));
  }

  async function loadSelectableDocuments(
    secretValue = trimmedSecret,
    options: { syncSelection?: boolean } = {},
  ): Promise<SelectableRagDocument[] | null> {
    const effectiveSecret = secretValue.trim();
    const syncSelection = options.syncSelection ?? true;

    if (effectiveSecret.length === 0) {
      return null;
    }

    setSelectableDocumentsState((current) => ({
      ...current,
      status: "loading",
      error: null,
    }));

    const response = await fetchJson("/api/rag/documents", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${effectiveSecret}`,
      },
    });

    if (response.kind === "network_error") {
      console.error("[rag/query]", {
        phase: "loadSelectableDocuments",
        kind: "network_error",
      });
      setSelectableDocumentsState({
        status: "error",
        documents: [],
        error: "technical",
        lastLoadedSecret: effectiveSecret,
      });
      return null;
    }

    if (response.status === 200) {
      const parsed = listRagDocumentsResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        console.error("[rag/query]", {
          phase: "loadSelectableDocuments",
          status: response.status,
          body: response.body,
          parseError: true,
        });
        setSelectableDocumentsState({
          status: "error",
          documents: [],
          error: "technical",
          lastLoadedSecret: effectiveSecret,
        });
        return null;
      }

      setSelectableDocumentsState({
        status: "loaded",
        documents: parsed.data.documents,
        error: null,
        lastLoadedSecret: effectiveSecret,
      });
      if (syncSelection) {
        setSelectedDocumentId((current) =>
          current.length > 0 &&
          parsed.data.documents.some((document) => document.id === current)
            ? current
            : "",
        );
      }
      return parsed.data.documents;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      console.error("[rag/query]", {
        phase: "loadSelectableDocuments",
        status: response.status,
        body: response.body,
      });
      clearSecret();
      if (parsed.success) {
        setAskState({ kind: "unauthorized" });
      } else {
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
      }
      return null;
    }

    console.error("[rag/query]", {
      phase: "loadSelectableDocuments",
      status: response.status,
      body: response.body,
    });
    setSelectableDocumentsState({
      status: "error",
      documents: [],
      error: "technical",
      lastLoadedSecret: effectiveSecret,
    });
    return null;
  }

  async function submitQuestion(strategy: ConversationSubmissionStrategy) {
    if (
      trimmedQuestion.length === 0 ||
      trimmedSecret.length === 0 ||
      (queryMode === "focused" && selectedDocument === null)
    ) {
      return;
    }

    setAskState({ kind: "submitting", strategy });
    setStreamingAssistantState(createInitialStreamingAssistantState());

    const activeConversationId = await ensureConversation();

    if (!activeConversationId) {
      return;
    }

    let response: Response;

    try {
      response = await fetch(
        `/api/rag/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Accept: "text/event-stream, application/json",
            Authorization: `Bearer ${trimmedSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            queryMode === "focused"
              ? {
                  content: trimmedQuestion,
                  mode: "focused",
                  documentId: selectedDocumentId,
                  retrievalSettings: {
                    topK,
                    strategy,
                  },
                }
              : {
                  content: trimmedQuestion,
                  retrievalSettings: {
                    topK,
                    strategy,
                  },
                },
          ),
        },
      );
    } catch {
      console.error("[rag/query]", { phase: "submitQuestion", kind: "network_error" });
      setAskState({ kind: "technical_error", message: RAG_NETWORK_ERROR_MESSAGE });
      return;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (response.status === 200 && contentType.includes("text/event-stream")) {
      await handleConversationEventStream(response);
      return;
    }

    const body = await response.json().catch(() => null);

    if (response.status === 200) {
      const parsed = appendConversationMessageResponseSchema.safeParse(body);

      if (!parsed.success) {
        console.error("[rag/query]", {
          phase: "submitQuestion",
          status: response.status,
          body,
          parseError: true,
        });
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
        return;
      }

      if (
        parsed.data.status !== "answered" &&
        parsed.data.status !== "answered_no_evidence"
      ) {
        console.error("[rag/query]", {
          phase: "submitQuestion",
          status: response.status,
          body,
        });
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
        return;
      }

      appendTranscriptMessages([
        parsed.data.userMessage,
        parsed.data.assistantMessage,
      ]);
      setQuestion("");
      setAskState({ kind: "idle" });
      return;
    }

    if (response.status === 400) {
      const parsed = ragInvalidRequestResponseSchema.safeParse(body);
      console.error("[rag/query]", {
        phase: "submitQuestion",
        status: response.status,
        body,
      });
      setAskState(
        parsed.success
          ? { kind: "invalid_request" }
          : {
              kind: "technical_error",
              message: formatTechnicalErrorMessage(response.status),
            },
      );
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(body);
      console.error("[rag/query]", {
        phase: "submitQuestion",
        status: response.status,
        body,
      });
      clearSecret();
      if (parsed.success) {
        setAskState({ kind: "unauthorized" });
        setConversationState((current) => ({
          ...current,
          status: current.conversation ? "loaded" : "idle",
          error: "unauthorized",
        }));
      } else {
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
      }
      return;
    }

    if (response.status === 404) {
      const parsed = appendConversationMessageResponseSchema.safeParse(body);

      if (parsed.success && parsed.data.status === "document_not_found") {
        appendTranscriptMessages([parsed.data.userMessage]);
        setAskState({
          kind: "technical_error",
          message: RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE,
        });
        return;
      }

      console.error("[rag/query]", {
        phase: "submitQuestion",
        status: response.status,
        body,
      });
      setConversationState({
        status: "error",
        conversation: null,
        error: "not_found",
      });
      setAskState({
        kind: "technical_error",
        message: formatTechnicalErrorMessage(response.status),
      });
      return;
    }

    if (response.status === 422) {
      const parsed = appendConversationMessageResponseSchema.safeParse(body);

      if (parsed.success && parsed.data.status === "document_not_focusable") {
        appendTranscriptMessages([parsed.data.userMessage]);
        setAskState({
          kind: "technical_error",
          message: RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE,
        });
        return;
      }

      console.error("[rag/query]", {
        phase: "submitQuestion",
        status: response.status,
        body,
      });
      setAskState({
        kind: "technical_error",
        message: formatTechnicalErrorMessage(response.status),
      });
      return;
    }

    if (response.status === 502 || response.status === 503) {
      const parsed = appendConversationMessageResponseSchema.safeParse(body);

      if (
        parsed.success &&
        "errorCode" in parsed.data &&
        "userMessage" in parsed.data
      ) {
        appendTranscriptMessages([parsed.data.userMessage]);
      }

      console.error("[rag/query]", {
        phase: "submitQuestion",
        status: response.status,
        body,
      });

      const errorCode =
        parsed.success && "errorCode" in parsed.data ? parsed.data.errorCode : null;
      const message =
        errorCode === "generation_failed"
          ? RAG_GENERATION_FAILED_MESSAGE
          : errorCode === "generation_unavailable"
            ? RAG_GENERATION_UNAVAILABLE_MESSAGE
            : formatTechnicalErrorMessage(response.status);

      setAskState({ kind: "technical_error", message });
      return;
    }

    console.error("[rag/query]", {
      phase: "submitQuestion",
      status: response.status,
      body,
    });
    setAskState({
      kind: "technical_error",
      message: formatTechnicalErrorMessage(response.status),
    });
  }

  async function handleConversationEventStream(response: Response) {
    if (!response.body) {
      setStreamingAssistantState(createInitialStreamingAssistantState());
      setAskState({
        kind: "technical_error",
        message: formatTechnicalErrorMessage(response.status),
      });
      return;
    }

    let sawTerminalEvent = false;

    try {
      for await (const event of readConversationStreamEvents(response.body)) {
        if (event.type === "user_message_created") {
          appendTranscriptMessages([event.userMessage]);
          setQuestion("");
          continue;
        }

        if (event.type === "phase") {
          setStreamingAssistantState((current) => ({
            status: "streaming",
            phase: event.phase,
            content:
              current.status === "streaming" ? current.content : "",
            sources:
              current.status === "streaming" ? current.sources : [],
            relatedTerms:
              current.status === "streaming" ? current.relatedTerms : [],
          }));
          continue;
        }

        if (event.type === "source") {
          setStreamingAssistantState((current) => ({
            status: "streaming",
            phase:
              current.status === "streaming"
                ? current.phase
                : "retrieving_sources",
            content:
              current.status === "streaming" ? current.content : "",
            sources:
              current.status === "streaming"
                ? [...current.sources, event.source]
                : [event.source],
            relatedTerms:
              current.status === "streaming" ? current.relatedTerms : [],
          }));
          continue;
        }

        if (event.type === "related_terms") {
          setStreamingAssistantState((current) => ({
            status: "streaming",
            phase:
              current.status === "streaming"
                ? current.phase
                : "retrieving_sources",
            content:
              current.status === "streaming" ? current.content : "",
            sources:
              current.status === "streaming" ? current.sources : [],
            relatedTerms: event.terms,
          }));
          continue;
        }

        if (event.type === "answer_delta") {
          setStreamingAssistantState((current) => ({
            status: "streaming",
            phase: "generating_answer",
            content:
              current.status === "streaming"
                ? `${current.content}${event.textDelta}`
                : event.textDelta,
            sources:
              current.status === "streaming" ? current.sources : [],
            relatedTerms:
              current.status === "streaming" ? current.relatedTerms : [],
          }));
          continue;
        }

        if (event.type === "done") {
          sawTerminalEvent = true;
          appendTranscriptMessages([event.assistantMessage]);
          setStreamingAssistantState(createInitialStreamingAssistantState());
          setAskState({ kind: "idle" });
          return;
        }

        sawTerminalEvent = true;
        setStreamingAssistantState(createInitialStreamingAssistantState());
        setAskState({
          kind: "technical_error",
          message: formatStreamErrorMessage(event.status),
        });
        return;
      }
    } catch (error) {
      console.error("[rag/query]", {
        phase: "submitQuestion.stream",
        kind: "stream_error",
        error,
      });
    }

    setStreamingAssistantState(createInitialStreamingAssistantState());
    if (!sawTerminalEvent) {
      setAskState({
        kind: "technical_error",
        message: RAG_TECHNICAL_ERROR_MESSAGE,
      });
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (conversationId) {
      return conversationId;
    }

    return createConversation();
  }

  async function createConversation(
    options: {
      preserveCurrentConversation?: boolean;
      pushUrlOnSuccess?: boolean;
    } = {},
  ): Promise<string | null> {
    if (trimmedSecret.length === 0) {
      return null;
    }

    const preserveCurrentConversation =
      options.preserveCurrentConversation ?? false;
    const pushUrlOnSuccess = options.pushUrlOnSuccess ?? true;
    const previousConversation = preserveCurrentConversation
      ? conversationState.conversation
      : null;

    setConversationState({
      status: "loading",
      conversation: previousConversation,
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
      console.error("[rag/query]", {
        phase: "createConversation",
        kind: "network_error",
      });
      setConversationState({
        status: "error",
        conversation: previousConversation,
        error: "technical",
      });
      setAskState({
        kind: "technical_error",
        message: RAG_NETWORK_ERROR_MESSAGE,
      });
      return null;
    }

    if (response.status === 201) {
      const parsed = createConversationResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        console.error("[rag/query]", {
          phase: "createConversation",
          status: response.status,
          body: response.body,
          parseError: true,
        });
        setConversationState({
          status: "error",
          conversation: previousConversation,
          error: "technical",
        });
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
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
      setStreamingAssistantState(createInitialStreamingAssistantState());
      setAuditDrawerMessageId(null);
      if (pushUrlOnSuccess) {
        writeQueryUrl(
          {
            conversationId: parsed.data.id,
            mode: queryMode,
            documentId:
              queryMode === "focused" && isUuidValue(selectedDocumentId)
                ? selectedDocumentId
                : null,
          },
          "push",
        );
      }

      return parsed.data.id;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      console.error("[rag/query]", {
        phase: "createConversation",
        status: response.status,
        body: response.body,
      });
      clearSecret();
      if (parsed.success) {
        setAskState({ kind: "unauthorized" });
        setConversationState({
          status: previousConversation ? "loaded" : "idle",
          conversation: previousConversation,
          error: "unauthorized",
        });
      } else {
        setConversationState({
          status: previousConversation ? "loaded" : "idle",
          conversation: previousConversation,
          error: "technical",
        });
        setAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
      }
      return null;
    }

    console.error("[rag/query]", {
      phase: "createConversation",
      status: response.status,
      body: response.body,
    });
    setConversationState({
      status: "error",
      conversation: previousConversation,
      error: "technical",
    });
    setAskState({
      kind: "technical_error",
      message: formatTechnicalErrorMessage(response.status),
    });
    return null;
  }

  async function startNewConversation() {
    setAskState({ kind: "idle" });
    setStreamingAssistantState(createInitialStreamingAssistantState());
    setQuestion("");
    await createConversation();
  }

  async function startFocusedConversationFromSource(source: SourceCard) {
    if (trimmedSecret.length === 0 || handoffInFlightRef.current) {
      return;
    }

    handoffInFlightRef.current = true;
    suppressUrlSyncRef.current = true;
    setHandoffState({ status: "starting", sourceChunkId: source.chunkId });
    setAskState({ kind: "idle" });

    try {
      const documents = await loadSelectableDocuments(trimmedSecret, {
        syncSelection: false,
      });

      if (!documents) {
        return;
      }

      if (!documents.some((document) => document.id === source.documentId)) {
        setAskState({
          kind: "technical_error",
          message: RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE,
        });
        return;
      }

      const nextConversationId = await createConversation({
        preserveCurrentConversation: true,
        pushUrlOnSuccess: false,
      });

      if (!nextConversationId) {
        return;
      }

      setQueryMode("focused");
      setSelectedDocumentId(source.documentId);
      setAskState({ kind: "idle" });
      writeQueryUrl(
        {
          conversationId: nextConversationId,
          mode: "focused",
          documentId: source.documentId,
        },
        "push",
      );
    } finally {
      suppressUrlSyncRef.current = false;
      handoffInFlightRef.current = false;
      setHandoffState({ status: "idle" });
    }
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
      console.error("[rag/query]", {
        phase: "loadConversation",
        kind: "network_error",
      });
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
        console.error("[rag/query]", {
          phase: "loadConversation",
          status: response.status,
          body: response.body,
          parseError: true,
        });
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
      setStreamingAssistantState(createInitialStreamingAssistantState());
      setAuditDrawerMessageId(null);
      return;
    }

    if (response.status === 401) {
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      console.error("[rag/query]", {
        phase: "loadConversation",
        status: response.status,
        body: response.body,
      });
      clearSecret();
      setConversationState({
        status: "error",
        conversation: null,
        error: parsed.success ? "unauthorized" : "technical",
      });
      return;
    }

    if (response.status === 404) {
      console.error("[rag/query]", {
        phase: "loadConversation",
        status: response.status,
        body: response.body,
      });
      setConversationState({
        status: "error",
        conversation: null,
        error: "not_found",
      });
      return;
    }

    console.error("[rag/query]", {
      phase: "loadConversation",
      status: response.status,
      body: response.body,
    });
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

  function openAuditDrawer(messageId: string) {
    setAuditDrawerMessageId(messageId);
  }

  function closeAuditDrawer() {
    setAuditDrawerMessageId(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion(effectiveStrategy);
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
              Faça uma pergunta sobre toda a base ou restrinja a consulta a um
              documento especifico. Todas as respostas mantem citacoes inline,
              fontes numeradas e trilha de auditoria. Apenas usuarios com o
              secret podem consultar ou ler o historico persistido.
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

          <div className={`${styles.field} ${styles.fieldMode}`}>
            <fieldset className={styles.modeFieldset}>
              <legend className={styles.label}>
                <span>Modo de consulta</span>
                <span className={styles.labelIndex}>[ 02 ]</span>
              </legend>

              <div className={styles.modeOptions}>
                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="query-mode"
                    value="global"
                    checked={queryMode === "global"}
                    onChange={() => {
                      setQueryMode("global");
                      setAskState({ kind: "idle" });
                    }}
                  />
                  <span>Base inteira</span>
                </label>

                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="query-mode"
                    value="focused"
                    checked={queryMode === "focused"}
                    onChange={() => {
                      setQueryMode("focused");
                      setAskState({ kind: "idle" });
                    }}
                  />
                  <span>Documento especifico</span>
                </label>
              </div>
            </fieldset>
          </div>

          {queryMode === "focused" ? (
            <div className={`${styles.field} ${styles.fieldFocusedDocument}`}>
              <label htmlFor="query-document" className={styles.label}>
                <span>Documento alvo</span>
                <span className={styles.labelIndex}>[ 03 ]</span>
              </label>

              {trimmedSecret.length === 0 ? (
                <p className={styles.inlineNote}>
                  Informe o secret para listar documentos disponiveis.
                </p>
              ) : null}

              {trimmedSecret.length > 0 &&
              selectableDocumentsState.status === "loading" ? (
                <p className={styles.inlineNote}>
                  Carregando documentos disponiveis...
                </p>
              ) : null}

              {trimmedSecret.length > 0 &&
              selectableDocumentsState.status === "error" ? (
                <div className={styles.inlineActionRow}>
                  <p className={styles.inlineNote}>
                    {RAG_FOCUSED_DOCUMENTS_ERROR_MESSAGE}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void loadSelectableDocuments();
                    }}
                    className={`${styles.btn} ${styles.btnSecondary}`}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}

              {trimmedSecret.length > 0 &&
              selectableDocumentsState.status === "loaded" &&
              selectableDocumentsState.documents.length === 0 ? (
                <p className={styles.inlineNote}>
                  {RAG_FOCUSED_DOCUMENTS_EMPTY_MESSAGE}
                </p>
              ) : null}

              {trimmedSecret.length > 0 &&
              selectableDocumentsState.documents.length > 0 ? (
                <>
                  <select
                    id="query-document"
                    value={selectedDocumentId}
                    onChange={(event) => setSelectedDocumentId(event.target.value)}
                    className={styles.select}
                  >
                    <option value="">Selecione um documento focavel</option>
                    {selectableDocumentsState.documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </select>

                  {selectedDocument ? (
                    <div className={styles.documentSummary}>
                      <p className={styles.documentSummaryTitle}>
                        {selectedDocument.title}
                      </p>
                      {selectedDocument.authors ? (
                        <p className={styles.documentSummaryMeta}>
                          autores :: {selectedDocument.authors}
                        </p>
                      ) : null}
                      {selectedDocument.publicationYear ? (
                        <p className={styles.documentSummaryMeta}>
                          ano :: {selectedDocument.publicationYear}
                        </p>
                      ) : null}
                      {selectedDocument.doi ? (
                        <p className={styles.documentSummaryMeta}>
                          doi :: {selectedDocument.doi}
                        </p>
                      ) : null}
                      <p className={styles.documentSummaryMeta}>
                        chunks indexados :: {selectedDocument.chunkCount}
                      </p>
                      <p className={styles.documentSummaryMeta}>
                        atualizado :: {formatTimestamp(selectedDocument.updatedAt)}
                      </p>
                    </div>
                  ) : (
                    <p className={styles.inlineNote}>
                      Escolha um documento para habilitar a consulta focada.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

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

        <div className={styles.chatLayout}>
        <AuditDrawer
          open={auditDrawerMessage !== null}
          onClose={closeAuditDrawer}
          traceLabel={
            auditDrawerMessage
              ? `trace :: ${auditDrawerMessage.trace.id.slice(0, 8)}`
              : null
          }
        >
          {auditDrawerMessage ? (
            <>
              <AuditSummaryBlock
                blockIndex="[ 01 ] Auditoria da mensagem"
                metaLabel={`trace :: ${auditDrawerMessage.trace.id.slice(0, 8)}`}
                traceId={auditDrawerMessage.trace.id}
                question={auditDrawerMessage.trace.question}
                metadata={auditDrawerMessage.trace.metadata}
                audit={auditDrawerMessage.trace.audit}
                status={auditDrawerMessage.trace.status}
                errorCode={auditDrawerMessage.trace.errorCode}
                createdAt={auditDrawerMessage.trace.createdAt}
              />
              <RelatedTermsBlock
                blockIndex="[ 02 ] Termos da mensagem"
                terms={auditDrawerMessage.trace.relatedTerms}
              />
              <SourcesBlock
                blockIndex="[ 03 ] Fontes da mensagem"
                sources={auditDrawerMessage.trace.sources}
                showCitationFlags
                onStartFocusedConversation={
                  auditDrawerMessage.trace.mode === "global"
                    ? startFocusedConversationFromSource
                    : undefined
                }
                handoffState={handoffState}
              />
            </>
          ) : null}
        </AuditDrawer>

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

          {conversationState.conversation?.messages.length ||
          streamingAssistantState.status === "streaming" ? (
            <ol className={styles.transcript}>
              {(conversationState.conversation?.messages ?? []).map((message) => (
                <ConversationMessageItem
                  key={message.id}
                  message={message}
                  onViewAudit={() => openAuditDrawer(message.id)}
                />
              ))}
              {streamingAssistantState.status === "streaming" ? (
                <StreamingConversationMessageItem
                  phase={streamingAssistantState.phase}
                  content={streamingAssistantState.content}
                  sources={streamingAssistantState.sources}
                  relatedTerms={streamingAssistantState.relatedTerms}
                />
              ) : null}
            </ol>
          ) : null}


          <div className={styles.composerWrap}>
            {askState.kind === "invalid_request" ? (
              <StatusAlert kind="invalid" message={RAG_INVALID_REQUEST_MESSAGE} />
            ) : null}

            {askState.kind === "unauthorized" ? (
              <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
            ) : null}

            {askState.kind === "technical_error" ? (
              <StatusAlert kind="technical" message={askState.message} />
            ) : null}

            <form onSubmit={onSubmit} className={styles.composer}>
              <div className={`${styles.field} ${styles.fieldQuestion}`}>
                <label htmlFor="query-question" className={styles.label}>
                  <span>Pergunta</span>
                  <span className={styles.labelIndex}>[ 05 ]</span>
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
                        void submitQuestion(effectiveStrategy);
                      }
                    }
                  }}
                  rows={3}
                  placeholder="Ex.: Quais tecnicas aparecem com mais frequencia nos estudos ou neste documento?"
                  className={styles.textarea}
                />
              </div>

              {queryMode === "global" ? (
                <div
                  role="radiogroup"
                  aria-label="Estratégia"
                  className={styles.composerStrategy}
                >
                  <ul className={styles.composerStrategyList}>
                    {GLOBAL_STRATEGY_OPTIONS.map((option) => {
                      const tooltipId = `query-strategy-${option.value}-tooltip`;
                      const isOpen = openStrategyTooltip === option.value;
                      return (
                        <li
                          key={option.value}
                          className={styles.composerStrategyItem}
                        >
                          <label className={styles.composerStrategyOption}>
                            <input
                              type="radio"
                              name="query-strategy"
                              value={option.value}
                              checked={selectedStrategy === option.value}
                              onChange={() => {
                                setSelectedStrategy(option.value);
                                setAskState({ kind: "idle" });
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                          <button
                            type="button"
                            aria-label={`Sobre estratégia ${option.label}`}
                            aria-expanded={isOpen}
                            aria-controls={tooltipId}
                            onClick={() =>
                              setOpenStrategyTooltip((current) =>
                                current === option.value ? null : option.value,
                              )
                            }
                            className={styles.composerStrategyInfo}
                          >
                            i
                          </button>
                          {isOpen ? (
                            <p
                              id={tooltipId}
                              role="note"
                              className={styles.composerStrategyTooltip}
                            >
                              {option.tooltip}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className={styles.composerStrategyNote}>
                  {STRATEGY_FOCUSED_NOTE}
                </p>
              )}

              <div className={styles.composerFooter}>
                <details className={styles.composerAdvanced}>
                  <summary className={styles.composerAdvancedSummary}>
                    Avançado
                  </summary>
                  <div className={styles.composerAdvancedFields}>
                    <label
                      htmlFor="query-top-k"
                      className={styles.composerAdvancedField}
                    >
                      <span className={styles.composerAdvancedLabel}>
                        Fontes recuperadas
                      </span>
                      <input
                        id="query-top-k"
                        type="number"
                        min={RAG_RETRIEVAL_MIN_TOP_K}
                        max={RAG_RETRIEVAL_MAX_TOP_K}
                        step={1}
                        value={topK}
                        onChange={(event) =>
                          setTopK(readTopKInput(event.target.value))
                        }
                        className={styles.composerAdvancedInput}
                      />
                    </label>
                    {effectiveStrategy === "rerank" ? (
                      <label
                        htmlFor="query-candidate-top-k"
                        className={styles.composerAdvancedField}
                      >
                        <span className={styles.composerAdvancedLabel}>
                          Candidatos para rerank
                        </span>
                        <input
                          id="query-candidate-top-k"
                          type="number"
                          min={topK}
                          max={EXPLORE_RETRIEVAL_MAX_CANDIDATES}
                          step={1}
                          value={candidateTopK}
                          onChange={(event) =>
                            setCandidateTopK(
                              readCandidateTopKInput(event.target.value, topK),
                            )
                          }
                          className={styles.composerAdvancedInput}
                        />
                      </label>
                    ) : null}
                  </div>
                </details>
                <div className={styles.composerActions}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`${styles.btn} ${
                    isSubmitting ? styles.btnLoading : styles.btnPrimary
                  }`}
                >
                  {submitButtonLabel}
                </button>
                </div>
              </div>
            </form>
          </div>
        </section>
        </div>

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
  onViewAudit: () => void;
};

function ConversationMessageItem({
  message,
  onViewAudit,
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
            onClick={onViewAudit}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.auditToggle}`}
          >
            Ver auditoria
          </button>
        ) : null}
      </article>

    </li>
  );
}

function StreamingConversationMessageItem({
  phase,
  content,
  sources,
  relatedTerms,
}: {
  phase: StreamingPhase;
  content: string;
  sources: RagStreamSource[];
  relatedTerms: RelatedTerm[];
}) {
  const phaseCopy =
    phase === "retrieving_sources"
      ? RAG_PHASE_COPY_RETRIEVING
      : phase === "reranking"
        ? RAG_PHASE_COPY_RERANKING
        : RAG_PHASE_COPY_GENERATING;

  return (
    <li className={`${styles.transcriptItem} ${styles.transcriptAssistant}`}>
      <article
        className={`${styles.transcriptBubble} ${styles.streamingTranscriptBubble}`}
      >
        <header className={styles.transcriptHeader}>
          <span>Assistente</span>
          <span>Ao vivo</span>
        </header>

        <p className={styles.streamingPhase}>{phaseCopy}</p>

        {sources.length > 0 ? (
          <ol className={styles.streamingSources}>
            {sources.map((source) => (
              <li key={source.chunkId} className={styles.streamingSourceCard}>
                <p className={styles.streamingSourceTitle}>
                  {source.sourceNumber}. {source.documentTitle}
                </p>
                <p className={styles.streamingSourceExcerpt}>
                  {truncateExcerptPreview(source.excerpt)}
                </p>
              </li>
            ))}
          </ol>
        ) : null}

        {relatedTerms.length > 0 ? (
          <section
            aria-label={RAG_STREAM_RELATED_TERMS_TITLE}
            className={styles.streamingRelatedTerms}
          >
            <p className={styles.streamingRelatedTermsTitle}>
              {RAG_STREAM_RELATED_TERMS_TITLE}
            </p>
            <ul className={styles.streamingRelatedTermsList}>
              {relatedTerms.map((term) => (
                <li
                  key={`${term.rank}-${term.term}`}
                  className={styles.streamingRelatedTermsChip}
                >
                  {term.term}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {content.length > 0 ? (
          <p className={styles.transcriptText}>{content}</p>
        ) : (
          <p className={styles.streamingHint}>
            {phase === "retrieving_sources"
              ? "Selecionando os trechos finais para responder."
              : "A resposta vai aparecendo abaixo conforme os tokens chegam."}
          </p>
        )}
      </article>
    </li>
  );
}

type AuditSummaryBlockProps = {
  blockIndex: string;
  metaLabel: string;
  traceId: string;
  question: string;
  metadata: RagRunMetadataResponse;
  audit: RagRunAuditResponse;
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
        <MetaItem
          label="// reranker"
          value={
            metadata.rerankerProvider && metadata.rerankerModel
              ? `${metadata.rerankerProvider} :: ${metadata.rerankerModel}`
              : "nao aplicado"
          }
        />
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
        <MetaItem
          label="// rerank latency"
          value={
            audit.reranking
              ? `${audit.reranking.latencyMs} ms`
              : "nao aplicado"
          }
        />
        <MetaItem
          label="// rerank tokens"
          value={
            audit.reranking
              ? String(audit.reranking.inputTokens)
              : "nao aplicado"
          }
        />
        <MetaItem
          label="// rerank cost"
          value={
            audit.reranking
              ? formatUsd(audit.reranking.estimatedCostUsd)
              : "nao aplicado"
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

type SourceCard =
  | (RagSource & { citedInAnswer?: boolean })
  | RagQueryRunDetailResponse["sources"][number];

function getRetrievalScore(source: SourceCard): number {
  return source.retrievalScore;
}

function getRerankScore(source: SourceCard): number | null {
  return source.rerankScore;
}

function SourcesBlock({
  blockIndex,
  sources,
  showCitationFlags = false,
  onStartFocusedConversation,
  handoffState = { status: "idle" },
}: {
  blockIndex: string;
  sources: SourceCard[];
  showCitationFlags?: boolean;
  onStartFocusedConversation?: (source: SourceCard) => void;
  handoffState?: HandoffState;
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
            {sources.map((source) => {
              const canStartFocusedConversation =
                onStartFocusedConversation !== undefined &&
                source.citedInAnswer === true;
              const isStartingFocusedConversation =
                handoffState.status === "starting" &&
                handoffState.sourceChunkId === source.chunkId;

              return (
                <li key={source.chunkId} className={styles.sourceCard}>
                  <div className={styles.sourceNumber} aria-hidden="true">
                    {source.sourceNumber}
                  </div>
                  <div className={styles.sourceContent}>
                    <p className={styles.sourceTitle}>
                      {source.sourceNumber}. {source.documentTitle}
                    </p>
                    <p className={styles.sourceExcerpt}>
                      {truncateExcerptPreview(source.excerpt)}
                    </p>
                    <div className={styles.sourceMetaRow}>
                      <span className={styles.sourceChip}>
                        retrieval :: {getRetrievalScore(source).toFixed(2)}
                      </span>
                      {getRerankScore(source) !== null ? (
                        <span className={styles.sourceChip}>
                          rerank :: {getRerankScore(source)!.toFixed(2)}
                        </span>
                      ) : null}
                      <span className={styles.sourceChip}>
                        chunk :: {source.chunkIndex}
                      </span>
                      {showCitationFlags ? (
                        <span className={styles.sourceChip}>
                          citado :: {source.citedInAnswer ? "sim" : "nao"}
                        </span>
                      ) : null}
                    </div>
                    {canStartFocusedConversation ? (
                      <div className={styles.sourceActionRow}>
                        <button
                          type="button"
                          onClick={() => onStartFocusedConversation(source)}
                          disabled={handoffState.status === "starting"}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.sourceActionButton}`}
                        >
                          {isStartingFocusedConversation
                            ? "Preparando foco..."
                            : SOURCE_FOCUS_ACTION_LABEL}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
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

function readCandidateTopKInput(value: string, topKFloor: number): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return RAG_RERANK_DEFAULT_CANDIDATE_TOP_K;
  }

  return Math.min(
    EXPLORE_RETRIEVAL_MAX_CANDIDATES,
    Math.max(topKFloor, parsed),
  );
}

function syncQueryUrl({
  conversationId,
  mode,
  documentId,
}: {
  conversationId: string | null;
  mode: QueryMode;
  documentId: string | null;
}): void {
  writeQueryUrl({ conversationId, mode, documentId }, "replace");
}

function writeQueryUrl(
  {
    conversationId,
    mode,
    documentId,
  }: {
  conversationId: string | null;
  mode: QueryMode;
  documentId: string | null;
  },
  historyMode: "push" | "replace",
): void {
  const url = new URL(window.location.href);

  if (conversationId) {
    url.searchParams.set("conversation", conversationId);
  } else {
    url.searchParams.delete("conversation");
  }

  if (mode === "focused") {
    url.searchParams.set("mode", "focused");
  } else {
    url.searchParams.delete("mode");
  }

  if (mode === "focused" && documentId) {
    url.searchParams.set("documentId", documentId);
  } else {
    url.searchParams.delete("documentId");
  }

  if (historyMode === "push") {
    window.history.pushState({}, "", url);
    return;
  }

  window.history.replaceState({}, "", url);
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

async function* readConversationStreamEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<RagConversationStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");

      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const parsedEvent = parseConversationStreamChunk(rawEvent);

        if (parsedEvent) {
          yield parsedEvent;
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();

    if (buffer.trim().length > 0) {
      const parsedEvent = parseConversationStreamChunk(buffer);

      if (parsedEvent) {
        yield parsedEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseConversationStreamChunk(
  chunk: string,
): RagConversationStreamEvent | null {
  const lines = chunk
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const data = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.replace("data: ", ""))
    .join("\n");

  if (data.length === 0) {
    return null;
  }

  const parsed = ragConversationStreamEventSchema.safeParse(JSON.parse(data));

  if (!parsed.success) {
    throw new Error("invalid_conversation_stream_event");
  }

  return parsed.data;
}

function formatStreamErrorMessage(
  status:
    | "generation_failed"
    | "generation_unavailable"
    | "document_not_found"
    | "document_not_focusable"
    | "strategy_not_allowed_for_focused_conversation",
): string {
  if (status === "generation_failed") {
    return RAG_GENERATION_FAILED_MESSAGE;
  }

  if (status === "generation_unavailable") {
    return RAG_GENERATION_UNAVAILABLE_MESSAGE;
  }

  if (status === "document_not_found") {
    return RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE;
  }

  if (status === "document_not_focusable") {
    return RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE;
  }

  return RAG_TECHNICAL_ERROR_MESSAGE;
}

function formatUsd(value: number): string {
  return `US$ ${value.toFixed(8)}`;
}

function formatStrategy(strategy: RagRetrievalStrategy): string {
  switch (strategy) {
    case "standard":
      return "standard";
    case "explore":
      return "explore";
    case "rerank":
      return "rerank";
  }
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
    case "reranking_failed":
      return "reranking com falha segura";
    case "reranking_unavailable":
      return "reranking indisponivel";
  }
}

function isUuidValue(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(".000Z", "Z");
}
