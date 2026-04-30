"use client";

import { useEffect, useRef, useState } from "react";

import {
  appendConversationMessageResponseSchema,
  conversationDetailResponseSchema,
  createConversationResponseSchema,
  listRagDocumentsResponseSchema,
  ragAskSuccessResponseSchema,
  ragConversationStreamEventSchema,
  ragInvalidRequestResponseSchema,
  ragQueryRunDetailResponseSchema,
  ragQueryRunSummariesResponseSchema,
  ragUnauthorizedResponseSchema,
  type ConversationDetailResponse,
  type ConversationMessageResponse,
  type RagAskSuccessResponse,
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
  RAG_RETRIEVAL_DEFAULT_TOP_K,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  type RagRetrievalStrategy,
} from "@/domain/rag";

import {
  formatTechnicalErrorMessage,
  RAG_EMPTY_SOURCES_MESSAGE,
  RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE,
  RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE,
  RAG_FOCUSED_DOCUMENTS_EMPTY_MESSAGE,
  RAG_FOCUSED_DOCUMENTS_ERROR_MESSAGE,
  RAG_GENERATION_FAILED_MESSAGE,
  RAG_GENERATION_UNAVAILABLE_MESSAGE,
  RAG_HISTORY_EMPTY_MESSAGE,
  RAG_HISTORY_ERROR_MESSAGE,
  RAG_HISTORY_IDLE_MESSAGE,
  RAG_INVALID_REQUEST_MESSAGE,
  RAG_NETWORK_ERROR_MESSAGE,
  RAG_NO_GENERATION_AUDIT_MESSAGE,
  RAG_RERANKING_FAILED_MESSAGE,
  RAG_RERANKING_UNAVAILABLE_MESSAGE,
  RAG_RUN_DETAIL_ERROR_MESSAGE,
  RAG_RUN_DETAIL_IDLE_MESSAGE,
  RAG_TECHNICAL_ERROR_MESSAGE,
  RAG_UNAUTHORIZED_MESSAGE,
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

type ConversationSubmissionStrategy = Extract<
  RagRetrievalStrategy,
  "standard" | "explore"
>;
type SingleTurnSubmissionStrategy = Extract<
  RagRetrievalStrategy,
  "standard" | "explore" | "rerank"
>;
type QueryMode = "global" | "focused";

type ConversationAskState =
  | { kind: "idle" }
  | { kind: "submitting"; strategy: ConversationSubmissionStrategy }
  | { kind: "invalid_request" }
  | { kind: "unauthorized" }
  | { kind: "technical_error"; message: string };

type SingleTurnAskState =
  | { kind: "idle" }
  | { kind: "submitting"; strategy: SingleTurnSubmissionStrategy }
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

type SelectableDocumentsState = {
  status: "idle" | "loading" | "loaded" | "error";
  documents: SelectableRagDocument[];
  error: LoadErrorKind | null;
  lastLoadedSecret: string | null;
};

type HandoffState =
  | { status: "idle" }
  | { status: "starting"; sourceChunkId: string };

type SingleTurnResultState = {
  status: "idle" | "loaded";
  question: string | null;
  result: RagAskSuccessResponse | null;
};

type StreamingAssistantState =
  | { status: "idle" }
  | {
      status: "streaming";
      phase: "retrieving_sources" | "generating_answer";
      content: string;
      sources: RagStreamSource[];
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

function createInitialSingleTurnResultState(): SingleTurnResultState {
  return {
    status: "idle",
    question: null,
    result: null,
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
  const [singleTurnQuestion, setSingleTurnQuestion] = useState("");
  const [secret, setSecret] = useState("");
  const [queryMode, setQueryMode] = useState<QueryMode>("global");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [topK, setTopK] = useState(RAG_RETRIEVAL_DEFAULT_TOP_K);
  const [singleTurnTopK, setSingleTurnTopK] = useState(
    RAG_RETRIEVAL_DEFAULT_TOP_K,
  );
  const [askState, setAskState] = useState<ConversationAskState>({
    kind: "idle",
  });
  const [singleTurnAskState, setSingleTurnAskState] =
    useState<SingleTurnAskState>({ kind: "idle" });
  const [singleTurnResultState, setSingleTurnResultState] =
    useState<SingleTurnResultState>(createInitialSingleTurnResultState);
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
  const [streamingAssistantState, setStreamingAssistantState] =
    useState<StreamingAssistantState>(createInitialStreamingAssistantState);
  const [selectableDocumentsState, setSelectableDocumentsState] =
    useState<SelectableDocumentsState>(createInitialSelectableDocumentsState);
  const [expandedAuditMessageIds, setExpandedAuditMessageIds] = useState<
    Set<string>
  >(() => new Set());
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [handoffState, setHandoffState] = useState<HandoffState>({
    status: "idle",
  });
  const handoffInFlightRef = useRef(false);
  const suppressUrlSyncRef = useRef(false);

  const trimmedQuestion = question.trim();
  const trimmedSingleTurnQuestion = singleTurnQuestion.trim();
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
  const isSingleTurnSubmitting = singleTurnAskState.kind === "submitting";
  const canSubmitSingleTurn =
    queryMode === "global" &&
    trimmedSingleTurnQuestion.length > 0 &&
    trimmedSecret.length > 0 &&
    !isSingleTurnSubmitting;
  const isStandardSubmitting =
    askState.kind === "submitting" && askState.strategy === "standard";
  const isExploreSubmitting =
    askState.kind === "submitting" && askState.strategy === "explore";
  const isSingleTurnStandardSubmitting =
    singleTurnAskState.kind === "submitting" &&
    singleTurnAskState.strategy === "standard";
  const isSingleTurnExploreSubmitting =
    singleTurnAskState.kind === "submitting" &&
    singleTurnAskState.strategy === "explore";
  const isSingleTurnRerankSubmitting =
    singleTurnAskState.kind === "submitting" &&
    singleTurnAskState.strategy === "rerank";
  const standardButtonLabel =
    isStandardSubmitting ? "Consultando..." : "Consultar base";
  const exploreButtonLabel =
    isExploreSubmitting ? "Explorando..." : "Explorar perspectivas";
  const singleTurnStandardButtonLabel = isSingleTurnStandardSubmitting
    ? "Consultando..."
    : "Consultar base";
  const singleTurnExploreButtonLabel = isSingleTurnExploreSubmitting
    ? "Explorando..."
    : "Explorar perspectivas";
  const singleTurnRerankButtonLabel = isSingleTurnRerankSubmitting
    ? "Reranqueando..."
    : "Rerank";
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
  const expandedAuditMessages = (conversationState.conversation?.messages ?? [])
    .filter(
      (
        message,
      ): message is ConversationMessageResponse & {
        trace: NonNullable<ConversationMessageResponse["trace"]>;
      } =>
        message.role === "assistant" &&
        message.trace !== null &&
        expandedAuditMessageIds.has(message.id),
    );

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
      setExpandedAuditMessageIds(new Set());
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
      resetPersistedAuditState();
      resetSingleTurnState();
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

  function resetPersistedAuditState() {
    setRecentRunsState(createInitialRecentRunsState());
    setSelectedRunState(createInitialSelectedRunState());
  }

  function resetSingleTurnState() {
    setSingleTurnQuestion("");
    setSingleTurnTopK(RAG_RETRIEVAL_DEFAULT_TOP_K);
    setSingleTurnAskState({ kind: "idle" });
    setSingleTurnResultState(createInitialSingleTurnResultState());
  }

  function resetSelectableDocumentsState() {
    setSelectableDocumentsState(createInitialSelectableDocumentsState());
    setSelectedDocumentId("");
  }

  function clearSecret() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret("");
    resetPersistedAuditState();
    resetSingleTurnState();
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

  async function submitSingleTurnQuestion(
    strategy: SingleTurnSubmissionStrategy,
  ) {
    if (
      queryMode !== "global" ||
      trimmedSingleTurnQuestion.length === 0 ||
      trimmedSecret.length === 0
    ) {
      return;
    }

    setSingleTurnAskState({ kind: "submitting", strategy });
    setSingleTurnResultState(createInitialSingleTurnResultState());

    const response = await fetchJson("/api/rag/ask", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${trimmedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: trimmedSingleTurnQuestion,
        mode: "global",
        retrieval: {
          topK: singleTurnTopK,
          strategy,
        },
      }),
    });

    if (response.kind === "network_error") {
      console.error("[rag/query]", {
        phase: "submitSingleTurnQuestion",
        kind: "network_error",
      });
      setSingleTurnAskState({
        kind: "technical_error",
        message: RAG_NETWORK_ERROR_MESSAGE,
      });
      return;
    }

    if (response.status === 200) {
      const parsed = ragAskSuccessResponseSchema.safeParse(response.body);

      if (!parsed.success) {
        console.error("[rag/query]", {
          phase: "submitSingleTurnQuestion",
          status: response.status,
          body: response.body,
          parseError: true,
        });
        setSingleTurnAskState({
          kind: "technical_error",
          message: formatTechnicalErrorMessage(response.status),
        });
        return;
      }

      setSingleTurnResultState({
        status: "loaded",
        question: trimmedSingleTurnQuestion,
        result: parsed.data,
      });
      setSingleTurnQuestion("");
      setSingleTurnAskState({ kind: "idle" });
      return;
    }

    if (response.status === 400) {
      const parsed = ragInvalidRequestResponseSchema.safeParse(response.body);
      console.error("[rag/query]", {
        phase: "submitSingleTurnQuestion",
        status: response.status,
        body: response.body,
      });
      setSingleTurnAskState(
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
      const parsed = ragUnauthorizedResponseSchema.safeParse(response.body);
      console.error("[rag/query]", {
        phase: "submitSingleTurnQuestion",
        status: response.status,
        body: response.body,
      });
      clearSecret();
      setSingleTurnAskState(
        parsed.success
          ? { kind: "unauthorized" }
          : {
              kind: "technical_error",
              message: formatTechnicalErrorMessage(response.status),
            },
      );
      return;
    }

    if (response.status === 502 || response.status === 503) {
      console.error("[rag/query]", {
        phase: "submitSingleTurnQuestion",
        status: response.status,
        body: response.body,
      });
      setSingleTurnAskState({
        kind: "technical_error",
        message: formatAskFailureMessage(response.body, response.status),
      });
      return;
    }

    console.error("[rag/query]", {
      phase: "submitSingleTurnQuestion",
      status: response.status,
      body: response.body,
    });
    setSingleTurnAskState({
      kind: "technical_error",
      message: formatTechnicalErrorMessage(response.status),
    });
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

      if (parsed.success && "errorCode" in parsed.data) {
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
      setExpandedAuditMessageIds(new Set());
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
      setExpandedAuditMessageIds(new Set());
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
      console.error("[rag/query]", {
        phase: "loadRecentRuns",
        kind: "network_error",
      });
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
        console.error("[rag/query]", {
          phase: "loadRecentRuns",
          status: response.status,
          body: response.body,
          parseError: true,
        });
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
      console.error("[rag/query]", {
        phase: "loadRecentRuns",
        status: response.status,
        body: response.body,
      });
      const error = parsed.success ? "unauthorized" : "technical";
      clearSecret();
      setRecentRunsState({
        status: "error",
        runs: [],
        error,
      });
      return;
    }

    console.error("[rag/query]", {
      phase: "loadRecentRuns",
      status: response.status,
      body: response.body,
    });
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
      console.error("[rag/query]", {
        phase: "loadRunDetail",
        kind: "network_error",
      });
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
        console.error("[rag/query]", {
          phase: "loadRunDetail",
          status: response.status,
          body: response.body,
          parseError: true,
        });
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
      console.error("[rag/query]", {
        phase: "loadRunDetail",
        status: response.status,
        body: response.body,
      });
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

    console.error("[rag/query]", {
      phase: "loadRunDetail",
      status: response.status,
      body: response.body,
    });
    setSelectedRunState({
      status: "error",
      run: null,
      runId,
      error: "technical",
    });
  }

  async function onSingleTurnSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitSingleTurnQuestion("standard");
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

        <section
          className={styles.panel}
          aria-labelledby="single-turn-query-title"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 id="single-turn-query-title" className={styles.panelTitle}>
                Consulta unica global
              </h2>
              <p className={styles.panelCopy}>
                Fluxo dedicado do <code>POST /api/rag/ask</code> para pergunta
                unica na base inteira, com tres estrategias explicitas:
                standard, explore e rerank.
              </p>
            </div>
          </header>

          {queryMode !== "global" ? (
            <p className={styles.inlineNote}>
              A consulta unica com rerank fica disponivel apenas no modo Base
              inteira. O fluxo focado e o composer conversacional continuam sem
              rerank nesta etapa.
            </p>
          ) : null}

          {singleTurnAskState.kind === "invalid_request" ? (
            <StatusAlert kind="invalid" message={RAG_INVALID_REQUEST_MESSAGE} />
          ) : null}

          {singleTurnAskState.kind === "unauthorized" ? (
            <StatusAlert kind="unauthorized" message={RAG_UNAUTHORIZED_MESSAGE} />
          ) : null}

          {singleTurnAskState.kind === "technical_error" ? (
            <StatusAlert
              kind="technical"
              message={singleTurnAskState.message}
            />
          ) : null}

          <form
            onSubmit={onSingleTurnSubmit}
            className={styles.composer}
            aria-label="Consulta unica global"
          >
            <div className={`${styles.field} ${styles.fieldQuestion}`}>
              <label htmlFor="single-turn-question" className={styles.label}>
                <span>Pergunta da consulta unica</span>
                <span className={styles.labelIndex}>[ 04 ]</span>
              </label>
              <textarea
                id="single-turn-question"
                value={singleTurnQuestion}
                onChange={(event) => setSingleTurnQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (canSubmitSingleTurn) {
                      void submitSingleTurnQuestion("standard");
                    }
                  }
                }}
                rows={3}
                placeholder="Ex.: Quais tecnicas aparecem com mais frequencia em toda a base?"
                className={styles.textarea}
                disabled={queryMode !== "global"}
              />
            </div>

            <div className={styles.composerFooter}>
              <label
                htmlFor="single-turn-top-k"
                className={styles.composerTopK}
              >
                <span className={styles.composerTopKLabel}>
                  Fontes da consulta unica
                </span>
                <span className={styles.composerTopKSelectWrap}>
                  <select
                    id="single-turn-top-k"
                    value={singleTurnTopK}
                    onChange={(event) =>
                      setSingleTurnTopK(readTopKInput(event.target.value))
                    }
                    className={styles.composerTopKSelect}
                    disabled={queryMode !== "global"}
                  >
                    {Array.from(
                      {
                        length:
                          RAG_RETRIEVAL_MAX_TOP_K -
                          RAG_RETRIEVAL_MIN_TOP_K +
                          1,
                      },
                      (_, index) => RAG_RETRIEVAL_MIN_TOP_K + index,
                    ).map((value) => (
                      <option key={value} value={value}>
                        {String(value).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden className={styles.composerTopKChevron}>
                    ▾
                  </span>
                </span>
              </label>

              <div className={styles.composerActions}>
                <button
                  type="submit"
                  disabled={!canSubmitSingleTurn}
                  className={`${styles.btn} ${
                    isSingleTurnStandardSubmitting
                      ? styles.btnLoading
                      : styles.btnPrimary
                  }`}
                >
                  {singleTurnStandardButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitSingleTurnQuestion("explore");
                  }}
                  disabled={!canSubmitSingleTurn}
                  className={`${styles.btn} ${
                    isSingleTurnExploreSubmitting
                      ? styles.btnLoading
                      : styles.btnExplore
                  }`}
                >
                  {singleTurnExploreButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitSingleTurnQuestion("rerank");
                  }}
                  disabled={!canSubmitSingleTurn}
                  className={`${styles.btn} ${
                    isSingleTurnRerankSubmitting
                      ? styles.btnLoading
                      : styles.btnSecondary
                  }`}
                >
                  {singleTurnRerankButtonLabel}
                </button>
              </div>
            </div>
          </form>

          {singleTurnResultState.result ? (
            <section className={styles.result}>
              <article className={styles.resultBlock}>
                <header className={styles.blockHeader}>
                  <span className={styles.blockIndex}>
                    [ 01 ] Resposta atual
                  </span>
                  <span className={styles.blockMeta}>
                    status ::{" "}
                    {formatRunStatus(
                      singleTurnResultState.result.sources.length === 0
                        ? "answered_no_evidence"
                        : "answered",
                    )}
                  </span>
                </header>
                <div className={styles.blockBody}>
                  <p className={styles.subHeadline}>Pergunta enviada</p>
                  <p className={styles.questionSnapshot}>
                    {singleTurnResultState.question}
                  </p>
                  <h2 className={styles.answerHeadline}>
                    Execucao global single-turn via ask.
                  </h2>
                  <p className={styles.answerText}>
                    {singleTurnResultState.result.answer}
                  </p>
                </div>
              </article>

              <AuditSummaryBlock
                blockIndex="[ 02 ] Auditoria atual"
                metaLabel={`trace :: ${singleTurnResultState.result.traceId.slice(
                  0,
                  8,
                )}`}
                traceId={singleTurnResultState.result.traceId}
                question={singleTurnResultState.question ?? ""}
                metadata={singleTurnResultState.result.metadata}
                audit={singleTurnResultState.result.audit}
                status={
                  singleTurnResultState.result.sources.length === 0
                    ? "answered_no_evidence"
                    : "answered"
                }
              />

              <RelatedTermsBlock
                blockIndex="[ 03 ] Termos atuais"
                terms={singleTurnResultState.result.relatedTerms}
              />

              <SourcesBlock
                blockIndex="[ 04 ] Fontes atuais"
                sources={singleTurnResultState.result.sources}
              />
            </section>
          ) : (
            <p className={styles.emptyPanel}>
              Envie uma pergunta global para inspecionar a resposta atual com
              auditoria de rerank quando aplicavel.
            </p>
          )}
        </section>

        <div className={styles.chatLayout}>
        {expandedAuditMessages.length > 0 ? (
          <ConversationAuditAside
            messages={expandedAuditMessages}
            onClose={(messageId) => toggleAudit(messageId)}
            onStartFocusedConversation={startFocusedConversationFromSource}
            handoffState={handoffState}
          />
        ) : null}
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
                  isAuditExpanded={expandedAuditMessageIds.has(message.id)}
                  onToggleAudit={() => toggleAudit(message.id)}
                />
              ))}
              {streamingAssistantState.status === "streaming" ? (
                <StreamingConversationMessageItem
                  phase={streamingAssistantState.phase}
                  content={streamingAssistantState.content}
                  sources={streamingAssistantState.sources}
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
                        void submitQuestion("standard");
                      }
                    }
                  }}
                  rows={3}
                  placeholder="Ex.: Quais tecnicas aparecem com mais frequencia nos estudos ou neste documento?"
                  className={styles.textarea}
                />
              </div>

              <div className={styles.composerFooter}>
                <label htmlFor="query-top-k" className={styles.composerTopK}>
                  <span className={styles.composerTopKLabel}>
                    Fontes recuperadas
                  </span>
                  <span className={styles.composerTopKSelectWrap}>
                    <select
                      id="query-top-k"
                      value={topK}
                      onChange={(event) =>
                        setTopK(readTopKInput(event.target.value))
                      }
                      className={styles.composerTopKSelect}
                    >
                      {Array.from(
                        {
                          length:
                            RAG_RETRIEVAL_MAX_TOP_K -
                            RAG_RETRIEVAL_MIN_TOP_K +
                            1,
                        },
                        (_, index) => RAG_RETRIEVAL_MIN_TOP_K + index,
                      ).map((value) => (
                        <option key={value} value={value}>
                          {String(value).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden className={styles.composerTopKChevron}>
                      ▾
                    </span>
                  </span>
                </label>
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
              </div>
            </form>
          </div>
        </section>
        </div>

        <details className={styles.runsPanel}>
          <summary className={styles.runsPanelSummary}>
            <span className={styles.runsPanelTitleGroup}>
              <span className={styles.runsPanelEyebrow}>Auditoria</span>
              <span className={styles.runsPanelTitle}>
                Historico de execucoes
              </span>
            </span>
            <span aria-hidden className={styles.runsPanelChevron}>
              ▾
            </span>
          </summary>

          <div className={styles.runsPanelBody}>
            <header className={styles.runsPanelToolbar}>
              <p className={styles.panelCopy}>
                O carregamento e manual. Nenhuma consulta adicional e feita
                automaticamente apos o ask atual.
              </p>
              <button
                type="button"
                onClick={() => {
                  void loadRecentRuns();
                }}
                disabled={
                  trimmedSecret.length === 0 ||
                  recentRunsState.status === "loading"
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
                    <details
                      className={`${styles.historyItem} ${
                        isSelected ? styles.historyItemActive : ""
                      }`}
                    >
                      <summary className={styles.historyItemSummary}>
                        <span className={styles.historyItemHead}>
                          <span className={styles.historyQuestion}>
                            {run.question}
                          </span>
                          <span className={styles.historyItemInlineMeta}>
                            {formatTimestamp(run.createdAt)} ·{" "}
                            {formatRunStatus(run.status)}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className={styles.historyItemChevron}
                        >
                          ▾
                        </span>
                      </summary>

                      <div className={styles.historyItemBody}>
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

                        <button
                          type="button"
                          onClick={() => {
                            void loadRunDetail(run.id);
                          }}
                          disabled={isLoading}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.historyItemAction}`}
                        >
                          {isLoading
                            ? "abrindo execucao..."
                            : isSelected
                              ? "recarregar execucao"
                              : "ver execucao auditada"}
                        </button>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          ) : null}

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
                onStartFocusedConversation={
                  selectedRunState.run.mode === "global"
                    ? startFocusedConversationFromSource
                    : undefined
                }
                handoffState={handoffState}
              />
            </section>
          ) : null}
          </div>
        </details>
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

    </li>
  );
}

function StreamingConversationMessageItem({
  phase,
  content,
  sources,
}: {
  phase: "retrieving_sources" | "generating_answer";
  content: string;
  sources: RagStreamSource[];
}) {
  return (
    <li className={`${styles.transcriptItem} ${styles.transcriptAssistant}`}>
      <article
        className={`${styles.transcriptBubble} ${styles.streamingTranscriptBubble}`}
      >
        <header className={styles.transcriptHeader}>
          <span>Assistente</span>
          <span>Ao vivo</span>
        </header>

        <p className={styles.streamingPhase}>
          {phase === "retrieving_sources"
            ? "Consultando fontes..."
            : "Gerando resposta..."}
        </p>

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

type ConversationAuditAsideProps = {
  messages: Array<
    ConversationMessageResponse & {
      trace: NonNullable<ConversationMessageResponse["trace"]>;
    }
  >;
  onClose: (messageId: string) => void;
  onStartFocusedConversation: (source: SourceCard) => void;
  handoffState: HandoffState;
};

function ConversationAuditAside({
  messages,
  onClose,
  onStartFocusedConversation,
  handoffState,
}: ConversationAuditAsideProps) {
  return (
    <aside className={styles.auditAside} aria-label="Auditoria da conversa">
      {messages.map((message) => (
          <section key={message.id} className={styles.conversationAudit}>
            <header className={styles.auditAsideHeader}>
              <span className={styles.subHeadline}>
                {`// auditoria :: ${message.trace.id.slice(0, 8)}`}
              </span>
              <button
                type="button"
                onClick={() => onClose(message.id)}
                className={`${styles.btn} ${styles.btnSecondary} ${styles.auditToggle}`}
              >
                Fechar
              </button>
            </header>

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
              onStartFocusedConversation={
                message.trace.mode === "global"
                  ? onStartFocusedConversation
                  : undefined
              }
              handoffState={handoffState}
            />
        </section>
      ))}
    </aside>
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
    | "document_not_focusable",
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

  return RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE;
}

function formatAskFailureMessage(body: unknown, httpStatus: number): string {
  const errorCode =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
      ? body.error
      : null;

  switch (errorCode) {
    case "generation_failed":
      return RAG_GENERATION_FAILED_MESSAGE;
    case "generation_unavailable":
      return RAG_GENERATION_UNAVAILABLE_MESSAGE;
    case "reranking_failed":
      return RAG_RERANKING_FAILED_MESSAGE;
    case "reranking_unavailable":
      return RAG_RERANKING_UNAVAILABLE_MESSAGE;
    default:
      return formatTechnicalErrorMessage(httpStatus);
  }
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
