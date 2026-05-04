import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RAG_SOURCE_EXCERPT_PREVIEW_LENGTH,
  truncateExcerptPreview,
} from "./constants";
import QueryPage from "./page";

const LONG_EXCERPT = `${"A".repeat(RAG_SOURCE_EXCERPT_PREVIEW_LENGTH)} trecho extra para truncar`;
const SECRET = "query-secret-value";
const CONVERSATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FOCUSED_HANDOFF_CONVERSATION_ID = "fefefefe-fefe-4efe-8efe-fefefefefefe";
const CURRENT_TRACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOCUSED_DOCUMENT_ID = "12121212-1212-4212-8212-121212121212";
const SOURCE_HANDOFF_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const RUN_DETAIL_SOURCE_DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";
const MESSAGE_CREATED_AT = "2026-04-24T09:00:00.000Z";
const ASSISTANT_CREATED_AT = "2026-04-24T09:00:01.000Z";

const SUCCESS_RESPONSE = {
  traceId: CURRENT_TRACE_ID,
  answer:
    "Os documentos destacam classificacao supervisionada e segmentacao [1] [2].",
  mode: "global" as const,
  sources: [
    {
      sourceNumber: 1,
      chunkId: "11111111-1111-4111-8111-111111111111",
      documentId: SOURCE_HANDOFF_DOCUMENT_ID,
      documentTitle: "artigo-a.pdf",
      chunkIndex: 0,
      excerpt: LONG_EXCERPT,
      retrievalScore: 0.91,
      rerankScore: null,
      documentPipelineVersion: "documents-v1",
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
    },
    {
      sourceNumber: 2,
      chunkId: "33333333-3333-4333-8333-333333333333",
      documentId: "44444444-4444-4444-8444-444444444444",
      documentTitle: "artigo-b.pdf",
      chunkIndex: 1,
      excerpt: "Trecho curto.",
      retrievalScore: 0.87,
      rerankScore: null,
      documentPipelineVersion: "documents-v1",
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
    },
  ],
  relatedTerms: [
    {
      rank: 1,
      term: "classificacao supervisionada",
      ngramSize: 2,
      frequency: 3,
      sourceCoverageCount: 2,
    },
    {
      rank: 2,
      term: "segmentacao",
      ngramSize: 1,
      frequency: 2,
      sourceCoverageCount: 1,
    },
  ],
  metadata: {
    mode: "global" as const,
    documentId: null,
    topK: 6,
    retrievalStrategy: "standard" as const,
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
    rerankerProvider: null,
    rerankerModel: null,
  },
  audit: {
    latencyMs: 123,
    embedding: {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    },
    reranking: null,
    generation: {
      inputTokens: 42,
      outputTokens: 16,
      totalTokens: 58,
      estimatedCostUsd: 0.0000192,
    },
    totalCostUsd: 0.00002063,
  },
};

const NO_EVIDENCE_RESPONSE = {
  ...SUCCESS_RESPONSE,
  traceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  answer: "Nao encontrei evidencias suficientes nos documentos recuperados.",
  sources: [],
  audit: {
    latencyMs: 88,
    embedding: {
      inputTokens: 9,
      estimatedCostUsd: 0.00000117,
    },
    reranking: null,
    generation: null,
    totalCostUsd: 0.00000117,
  },
};

const CREATE_CONVERSATION_RESPONSE = {
  id: CONVERSATION_ID,
  title: null,
  createdAt: "2026-04-24T08:59:00.000Z",
  updatedAt: "2026-04-24T08:59:00.000Z",
  lastMessageAt: null,
};

const FOCUSED_HANDOFF_CONVERSATION_RESPONSE = {
  ...CREATE_CONVERSATION_RESPONSE,
  id: FOCUSED_HANDOFF_CONVERSATION_ID,
  createdAt: "2026-04-24T09:15:00.000Z",
  updatedAt: "2026-04-24T09:15:00.000Z",
};

const FOCUSED_HANDOFF_CONVERSATION_DETAIL_RESPONSE = {
  ...FOCUSED_HANDOFF_CONVERSATION_RESPONSE,
  title: null,
  lastMessageAt: null,
  messages: [],
};

const SELECTABLE_DOCUMENTS_RESPONSE = {
  documents: [
    {
      id: FOCUSED_DOCUMENT_ID,
      title: "artigo focado a.pdf",
      authors: "Silva et al.",
      publicationYear: 2024,
      doi: "10.1000/focado-a",
      chunkCount: 12,
      updatedAt: "2026-04-25T10:30:00.000Z",
    },
    {
      id: "34343434-3434-4343-8343-343434343434",
      title: "artigo focado b.pdf",
      authors: null,
      publicationYear: null,
      doi: null,
      chunkCount: 5,
      updatedAt: "2026-04-23T08:00:00.000Z",
    },
  ],
};

const HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE = {
  documents: [
    {
      id: SOURCE_HANDOFF_DOCUMENT_ID,
      title: "artigo-a.pdf",
      authors: "Souza et al.",
      publicationYear: 2022,
      doi: "10.1000/source-a",
      chunkCount: 7,
      updatedAt: "2026-04-25T12:00:00.000Z",
    },
    {
      id: RUN_DETAIL_SOURCE_DOCUMENT_ID,
      title: "artigo-persistido.pdf",
      authors: "Campos et al.",
      publicationYear: 2021,
      doi: "10.1000/persistido",
      chunkCount: 4,
      updatedAt: "2026-04-22T15:30:00.000Z",
    },
    ...SELECTABLE_DOCUMENTS_RESPONSE.documents,
  ],
};

const FOCUSED_SUCCESS_RESPONSE = {
  ...SUCCESS_RESPONSE,
  mode: "focused" as const,
  metadata: {
    ...SUCCESS_RESPONSE.metadata,
    mode: "focused" as const,
    documentId: FOCUSED_DOCUMENT_ID,
  },
};

const PARTIALLY_CITED_SUCCESS_RESPONSE = {
  ...SUCCESS_RESPONSE,
  sources: [
    {
      ...SUCCESS_RESPONSE.sources[0],
      citedInAnswer: true,
    },
    {
      ...SUCCESS_RESPONSE.sources[1],
      citedInAnswer: false,
    },
  ],
};

type AskSourceFixture = (typeof SUCCESS_RESPONSE.sources)[number] & {
  citedInAnswer?: boolean;
};

type AskFixture = Omit<
  typeof SUCCESS_RESPONSE,
  "audit" | "metadata" | "mode" | "sources"
> & {
  sources: AskSourceFixture[];
  mode: "global" | "focused";
  audit: typeof SUCCESS_RESPONSE.audit | typeof NO_EVIDENCE_RESPONSE.audit;
  metadata: Omit<typeof SUCCESS_RESPONSE.metadata, "retrievalStrategy" | "mode" | "documentId"> & {
    mode: "global" | "focused";
    documentId: string | null;
    retrievalStrategy: "standard" | "explore" | "rerank";
  };
};

function appendResponseFromAsk(
  response: AskFixture,
  question = "Quais tecnicas aparecem com mais frequencia?",
  suffix: "1" | "2" = "1",
) {
  return {
    status: response.sources.length === 0 ? "answered_no_evidence" : "answered",
    userMessage: {
      id:
        suffix === "1"
          ? "99999999-9999-4999-8999-999999999991"
          : "99999999-9999-4999-8999-999999999992",
      role: "user" as const,
      content: question,
      createdAt: MESSAGE_CREATED_AT,
      trace: null,
    },
    assistantMessage: {
      id:
        suffix === "1"
          ? "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"
          : "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2",
      role: "assistant" as const,
      content: response.answer,
      createdAt: ASSISTANT_CREATED_AT,
      trace: {
        id: response.traceId,
        question,
        answer: response.answer,
        mode: response.mode,
        documentId: response.metadata.documentId,
        status:
          response.sources.length === 0
            ? ("answered_no_evidence" as const)
            : ("answered" as const),
        errorCode: null,
        sources: response.sources.map((source) => ({
          sourceNumber: source.sourceNumber,
          chunkId: source.chunkId,
          documentId: source.documentId,
          documentTitle: source.documentTitle,
          chunkIndex: source.chunkIndex,
          excerpt: source.excerpt,
          retrievalScore: source.retrievalScore,
          rerankScore: source.rerankScore,
          documentPipelineVersion: source.documentPipelineVersion,
          chunkingVersion: source.chunkingVersion,
          embeddingModel: source.embeddingModel,
          citedInAnswer: source.citedInAnswer ?? true,
        })),
        relatedTerms: response.relatedTerms,
        metadata: response.metadata,
        audit: response.audit,
        createdAt: ASSISTANT_CREATED_AT,
      },
    },
  };
}

const CONVERSATION_DETAIL_RESPONSE = {
  ...CREATE_CONVERSATION_RESPONSE,
  title: "Quais tecnicas aparecem com maior frequencia?",
  updatedAt: ASSISTANT_CREATED_AT,
  lastMessageAt: ASSISTANT_CREATED_AT,
  messages: [
    appendResponseFromAsk(
      SUCCESS_RESPONSE,
      "Quais tecnicas aparecem com maior frequencia?",
    ).userMessage,
    appendResponseFromAsk(
      SUCCESS_RESPONSE,
      "Quais tecnicas aparecem com maior frequencia?",
    ).assistantMessage,
  ],
};

function jsonResponse(
  body: unknown,
  init: { status: number } = { status: 200 },
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "Content-Type": "application/json" },
  });
}

function createControlledEventStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  return {
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(innerController) {
          controller = innerController;
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    ),
    push(event: Record<string, unknown>) {
      controller?.enqueue(
        encoder.encode(
          `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
        ),
      );
    },
    close() {
      controller?.close();
    },
  };
}

function streamEventsFromAsk(
  response: AskFixture,
  question = "Quais tecnicas aparecem com mais frequencia?",
  answerChunks: string[] = [response.answer],
) {
  const appended = appendResponseFromAsk(response, question);
  const sourceEvents = response.sources.map((source) => {
    const streamSource = {
      sourceNumber: source.sourceNumber,
      chunkId: source.chunkId,
      documentId: source.documentId,
      documentTitle: source.documentTitle,
      chunkIndex: source.chunkIndex,
      excerpt: source.excerpt,
      score: source.retrievalScore,
      documentPipelineVersion: source.documentPipelineVersion,
      chunkingVersion: source.chunkingVersion,
      embeddingModel: source.embeddingModel,
    };

    return {
      type: "source" as const,
      source: streamSource,
    };
  });

  return [
    {
      type: "user_message_created" as const,
      userMessage: {
        ...appended.userMessage,
        createdAt: appended.userMessage.createdAt,
      },
    },
    {
      type: "phase" as const,
      phase: "retrieving_sources" as const,
    },
    ...sourceEvents,
    ...(response.sources.length > 0
      ? [
          {
            type: "phase" as const,
            phase: "generating_answer" as const,
          },
          ...answerChunks.map((chunk) => ({
            type: "answer_delta" as const,
            textDelta: chunk,
          })),
        ]
      : []),
    {
      type: "done" as const,
      status:
        response.sources.length === 0 ? "answered_no_evidence" : "answered",
      assistantMessage: {
        ...appended.assistantMessage,
        createdAt: appended.assistantMessage.createdAt,
        trace: appended.assistantMessage.trace
          ? {
              ...appended.assistantMessage.trace,
              createdAt: appended.assistantMessage.trace.createdAt,
            }
          : null,
      },
    },
  ];
}

function typeQuestion(value: string): void {
  fireEvent.change(
    within(getConversationSection()).getByLabelText(/pergunta/i),
    {
      target: { value },
    },
  );
}

function typeSecret(value: string): void {
  fireEvent.change(screen.getByLabelText(/secret de consulta/i), {
    target: { value },
  });
}

function setTopK(value: string): void {
  fireEvent.change(
    within(getConversationSection()).getByLabelText(/fontes recuperadas/i),
    {
      target: { value },
    },
  );
}

function clickSubmit(): void {
  fireEvent.click(
    within(getConversationSection()).getByRole("button", {
      name: /consultar base/i,
    }),
  );
}

function selectStrategy(label: RegExp): void {
  fireEvent.click(
    within(getConversationSection()).getByRole("radio", { name: label }),
  );
}

function getConversationSection(): HTMLElement {
  const section = screen
    .getByRole("heading", { name: /^conversa$/i })
    .closest("section");

  if (!section) {
    throw new Error("conversation section not found");
  }

  return section;
}

function clickNewConversation(): void {
  fireEvent.click(screen.getByRole("button", { name: /nova conversa/i }));
}

function clickViewAudit(): void {
  const toggle = within(getConversationSection()).queryByRole("button", {
    name: /ver auditoria/i,
  });

  if (toggle) {
    fireEvent.click(toggle);
  }
}

function clickFocusedMode(): void {
  fireEvent.click(screen.getByLabelText(/documento especifico/i));
}

function clickGlobalMode(): void {
  fireEvent.click(screen.getByLabelText(/base inteira/i));
}

function selectFocusedDocument(value: string): void {
  fireEvent.change(screen.getByLabelText(/documento alvo/i), {
    target: { value },
  });
}

function clickStartFocusedConversation(index = 0): void {
  fireEvent.click(
    screen.getAllByRole("button", {
      name: /conversar apenas sobre este artigo/i,
    })[index]!,
  );
}

describe("/query page", () => {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    window.history.pushState({}, "", "/query");
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders PT-BR copy, requires the secret, and does not auto-load history", () => {
    render(<QueryPage />);

    expect(
      screen.getByRole("heading", { name: /consulta na base/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /consulta unica global/i }),
    ).not.toBeInTheDocument();
    expect(
      within(getConversationSection()).getByLabelText(/pergunta/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/secret de consulta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/base inteira/i)).toBeChecked();
    expect(screen.getByLabelText(/documento especifico/i)).not.toBeChecked();
    expect(
      within(getConversationSection()).getByLabelText(/fontes recuperadas/i),
    ).toHaveValue(6);
    expect(
      within(getConversationSection()).getByRole("button", {
        name: /consultar base/i,
      }),
    ).toBeDisabled();
    expect(
      within(getConversationSection()).getByRole("radio", { name: /^padrão$/i }),
    ).toBeChecked();
    expect(
      within(getConversationSection()).getByRole("radio", { name: /^explorar$/i }),
    ).toBeInTheDocument();
    expect(
      within(getConversationSection()).getByRole("radio", { name: /^rerank$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /carregar historico recente/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lazy-loads selectable documents only after focused mode is enabled", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      clickFocusedMode();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rag/documents",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
    expect(
      await screen.findByRole("option", { name: /artigo focado a\.pdf/i }),
    ).toBeInTheDocument();
  });

  it("shows the strategy selector only in global mode and a focused-only note in focused mode", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);

    expect(
      within(getConversationSection()).getByRole("radiogroup", {
        name: /estratégia/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(getConversationSection()).getByRole("radio", { name: /^padrão$/i }),
    ).toBeChecked();

    await act(async () => {
      clickFocusedMode();
    });

    expect(
      within(getConversationSection()).queryByRole("radiogroup", {
        name: /estratégia/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(getConversationSection()).getByText(
        /apenas a estratégia padrão está disponível/i,
      ),
    ).toBeInTheDocument();

    clickGlobalMode();

    expect(
      within(getConversationSection()).getByRole("radio", { name: /^padrão$/i }),
    ).toBeChecked();
  });

  it("hides advanced retrieval controls behind a disclosure that toggles on click", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    const summary = within(getConversationSection()).getByText(/^avançado$/i);
    const details = summary.closest("details");

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary);

    expect(details).toHaveAttribute("open");

    const topKInput =
      within(getConversationSection()).getByLabelText(/fontes recuperadas/i);
    fireEvent.change(topKInput, { target: { value: "10" } });

    expect(topKInput).toHaveValue(10);
  });

  it("renders candidateTopK only when the rerank strategy is selected", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    const summary = within(getConversationSection()).getByText(/^avançado$/i);
    fireEvent.click(summary);

    expect(
      within(getConversationSection()).queryByLabelText(
        /candidatos para rerank/i,
      ),
    ).not.toBeInTheDocument();

    selectStrategy(/^rerank$/i);

    const candidateInput = within(getConversationSection()).getByLabelText(
      /candidatos para rerank/i,
    );
    expect(candidateInput).toHaveValue(24);

    fireEvent.change(candidateInput, { target: { value: "20" } });
    expect(candidateInput).toHaveValue(20);

    selectStrategy(/^padrão$/i);

    expect(
      within(getConversationSection()).queryByLabelText(
        /candidatos para rerank/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the per-strategy tooltip when the info button is clicked", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    const exploreInfo = within(getConversationSection()).getByRole("button", {
      name: /sobre estratégia explorar/i,
    });

    fireEvent.click(exploreInfo);

    expect(
      within(getConversationSection()).getByRole("note"),
    ).toHaveTextContent(/amplia a busca/i);

    fireEvent.click(exploreInfo);

    expect(
      within(getConversationSection()).queryByRole("note"),
    ).not.toBeInTheDocument();
  });

  it("requires a selected document in focused mode and preserves the selection across mode switches", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Compare os achados.");
    setTopK("9");

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });

    expect(
      within(getConversationSection()).getByRole("button", {
        name: /consultar base/i,
      }),
    ).toBeDisabled();
    expect(
      within(getConversationSection()).queryByRole("radiogroup", {
        name: /estratégia/i,
      }),
    ).not.toBeInTheDocument();

    selectFocusedDocument(FOCUSED_DOCUMENT_ID);

    expect(
      within(getConversationSection()).getByRole("button", {
        name: /consultar base/i,
      }),
    ).toBeEnabled();

    clickGlobalMode();
    expect(
      within(getConversationSection()).getByLabelText(/fontes recuperadas/i),
    ).toHaveValue(9);
    expect(
      within(getConversationSection()).getByRole("button", {
        name: /consultar base/i,
      }),
    ).toBeEnabled();

    clickFocusedMode();

    expect(screen.getByLabelText(/documento alvo/i)).toHaveValue(
      FOCUSED_DOCUMENT_ID,
    );
    expect(
      within(getConversationSection()).getByLabelText(/fontes recuperadas/i),
    ).toHaveValue(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits standard and explore queries with validated retrieval settings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        appendResponseFromAsk(
          SUCCESS_RESPONSE,
          "Compare as abordagens metodologicas.",
        ),
      ),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...appendResponseFromAsk(
          {
            ...SUCCESS_RESPONSE,
            metadata: {
              ...SUCCESS_RESPONSE.metadata,
              topK: 8,
              retrievalStrategy: "explore",
              candidateTopK: 24,
            },
          },
          "Compare as abordagens metodologicas.",
          "2",
        ),
      }),
    );

    render(<QueryPage />);
    typeSecret(`  ${SECRET}  `);
    typeQuestion("Compare as abordagens metodologicas.");
    setTopK("8");

    await act(async () => {
      clickSubmit();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/rag/conversations",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/rag/conversations/${CONVERSATION_ID}/messages`,
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          content: "Compare as abordagens metodologicas.",
          retrievalSettings: {
            topK: 8,
            strategy: "standard",
          },
        }),
      }),
    );

    typeQuestion("Compare as abordagens metodologicas.");
    selectStrategy(/^explorar$/i);

    await act(async () => {
      clickSubmit();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/rag/conversations/${CONVERSATION_ID}/messages`,
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          content: "Compare as abordagens metodologicas.",
          retrievalSettings: {
            topK: 8,
            strategy: "explore",
          },
        }),
      }),
    );
  });

  it("submits focused questions through the conversation route with mode and documentId", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        appendResponseFromAsk({
          ...SUCCESS_RESPONSE,
          mode: "focused",
          metadata: {
            ...SUCCESS_RESPONSE.metadata,
            mode: "focused",
            documentId: FOCUSED_DOCUMENT_ID,
          },
        }),
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem neste documento?");

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });
    selectFocusedDocument(FOCUSED_DOCUMENT_ID);

    await act(async () => {
      clickSubmit();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/rag/conversations/${CONVERSATION_ID}/messages`,
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          content: "Quais tecnicas aparecem neste documento?",
          mode: "focused",
          documentId: FOCUSED_DOCUMENT_ID,
          retrievalSettings: {
            topK: 6,
            strategy: "standard",
          },
        }),
      }),
    );
  });

  it("renders the current answer audit from the conversation turn payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText(SUCCESS_RESPONSE.answer).length).toBeGreaterThan(0);

    await act(async () => {
      clickViewAudit();
    });

    expect(screen.getByText(CURRENT_TRACE_ID)).toBeInTheDocument();
    expect(
      screen.getAllByText(/classificacao supervisionada/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/US\$ 0\.00002063/i)).toBeInTheDocument();
    expect(screen.getAllByText(/123 ms/i).length).toBeGreaterThan(0);
    expect(screen.getByText("1. artigo-a.pdf")).toBeInTheDocument();
    expect(screen.getByText(/operador/i)).toBeInTheDocument();
    expect(screen.getByText(/assistente/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/quais tecnicas aparecem com mais frequencia\?/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/carregando historico auditado/i)).not.toBeInTheDocument();
  });

  it("streams sources first and then renders answer deltas live before hydrating the final assistant trace", async () => {
    const stream = createControlledEventStreamResponse();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(stream.response);

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    await act(async () => {
      stream.push(streamEventsFromAsk(SUCCESS_RESPONSE)[0]!);
      stream.push(streamEventsFromAsk(SUCCESS_RESPONSE)[1]!);
    });

    expect(
      await screen.findByText(/consultando fontes/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/quais tecnicas aparecem com mais frequencia\?/i)
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(getConversationSection()).getByLabelText(/pergunta/i),
    ).toHaveValue("");

    await act(async () => {
      for (const event of streamEventsFromAsk(SUCCESS_RESPONSE).slice(2, 4)) {
        stream.push(event);
      }
    });

    expect(screen.getByText("1. artigo-a.pdf")).toBeInTheDocument();
    expect(screen.getByText("2. artigo-b.pdf")).toBeInTheDocument();

    await act(async () => {
      stream.push({
        type: "phase",
        phase: "generating_answer",
      });
      stream.push({
        type: "answer_delta",
        textDelta: "Os documentos destacam ",
      });
      stream.push({
        type: "answer_delta",
        textDelta: "classificacao supervisionada [1] [2].",
      });
    });

    expect(await screen.findByText(/gerando resposta/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Os documentos destacam classificacao supervisionada [1] [2].",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(CURRENT_TRACE_ID)).not.toBeInTheDocument();

    await act(async () => {
      stream.push(
        streamEventsFromAsk(
          SUCCESS_RESPONSE,
          "Quais tecnicas aparecem com mais frequencia?",
          [
          "Os documentos destacam ",
          "classificacao supervisionada [1] [2].",
          ],
        ).at(-1)!,
      );
      stream.close();
    });

    await act(async () => {
      clickViewAudit();
    });

    expect(await screen.findByText(CURRENT_TRACE_ID)).toBeInTheDocument();
    expect(screen.queryByText(/consultando fontes/i)).not.toBeInTheDocument();
  });

  it("keeps the streamed user message and shows a safe error when the SSE turn fails", async () => {
    const stream = createControlledEventStreamResponse();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(stream.response);

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta com falha");

    await act(async () => {
      clickSubmit();
    });

    await act(async () => {
      stream.push({
        type: "user_message_created",
        userMessage: {
          id: "99999999-9999-4999-8999-999999999993",
          role: "user",
          content: "Pergunta com falha",
          createdAt: MESSAGE_CREATED_AT,
          trace: null,
        },
      });
      stream.push({
        type: "phase",
        phase: "retrieving_sources",
      });
      stream.push({
        type: "error",
        status: "generation_unavailable",
        errorCode: "generation_unavailable",
      });
      stream.close();
    });

    expect(
      await screen.findByText(/servico de geracao indisponivel/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Pergunta com falha")).toBeInTheDocument();
    expect(screen.queryByText(/gerando resposta/i)).not.toBeInTheDocument();
  });

  it("renders the focused handoff CTA only for cited global source cards", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(PARTIALLY_CITED_SUCCESS_RESPONSE)),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    expect(
      screen.getAllByRole("button", {
        name: /conversar apenas sobre este artigo/i,
      }),
    ).toHaveLength(1);
    expect(screen.getByText(/citado :: nao/i)).toBeInTheDocument();
  });

  it("does not render the focused handoff CTA for already-focused source cards", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(FOCUSED_SUCCESS_RESPONSE)),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem neste documento?");

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });
    selectFocusedDocument(FOCUSED_DOCUMENT_ID);

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    expect(
      screen.queryByRole("button", {
        name: /conversar apenas sobre este artigo/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("loads an existing conversation from the URL when a stored secret exists", async () => {
    sessionStorage.setItem("query:secret", SECRET);
    window.history.pushState({}, "", `/query?conversation=${CONVERSATION_ID}`);
    fetchMock.mockResolvedValueOnce(jsonResponse(CONVERSATION_DETAIL_RESPONSE));

    render(<QueryPage />);

    expect(await screen.findByText(SUCCESS_RESPONSE.answer)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/rag/conversations/${CONVERSATION_ID}`,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
    expect(
      screen.getAllByText(/Quais tecnicas aparecem com maior frequencia/i).length,
    ).toBeGreaterThan(0);
  });

  it("restores a focused draft from the URL after reload when a stored secret exists", async () => {
    sessionStorage.setItem("query:secret", SECRET);
    window.history.pushState(
      {},
      "",
      `/query?conversation=${CONVERSATION_ID}&mode=focused&documentId=${FOCUSED_DOCUMENT_ID}`,
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(CONVERSATION_DETAIL_RESPONSE));
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));

    render(<QueryPage />);

    expect(await screen.findByText(SUCCESS_RESPONSE.answer)).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /artigo focado a\.pdf/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/documento especifico/i)).toBeChecked();
    expect(screen.getByLabelText(/documento alvo/i)).toHaveValue(
      FOCUSED_DOCUMENT_ID,
    );
  });

  it("restores an empty focused draft from the URL after a handoff-style reload", async () => {
    sessionStorage.setItem("query:secret", SECRET);
    window.history.pushState(
      {},
      "",
      `/query?conversation=${FOCUSED_HANDOFF_CONVERSATION_ID}&mode=focused&documentId=${SOURCE_HANDOFF_DOCUMENT_ID}`,
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(FOCUSED_HANDOFF_CONVERSATION_DETAIL_RESPONSE),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE),
    );

    render(<QueryPage />);

    expect(
      await screen.findByLabelText(/documento especifico/i),
    ).toBeChecked();
    expect(screen.getByLabelText(/documento alvo/i)).toHaveValue(
      SOURCE_HANDOFF_DOCUMENT_ID,
    );
  });

  it("starts a new conversation explicitly and syncs the URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));

    render(<QueryPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickNewConversation();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rag/conversations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(window.location.search).toBe(`?conversation=${CONVERSATION_ID}`);
    expect(screen.getByText(/Conversa sem titulo/i)).toBeInTheDocument();
  });

  it("expands assistant-message audit inside the transcript", async () => {
    sessionStorage.setItem("query:secret", SECRET);
    window.history.pushState({}, "", `/query?conversation=${CONVERSATION_ID}`);
    fetchMock.mockResolvedValueOnce(jsonResponse(CONVERSATION_DETAIL_RESPONSE));

    render(<QueryPage />);

    expect(await screen.findByText(SUCCESS_RESPONSE.answer)).toBeInTheDocument();
    expect(screen.queryByText(/\[ 03 \] Fontes da mensagem/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver auditoria/i }));

    expect(screen.getByText(/\[ 01 \] Auditoria da mensagem/i)).toBeInTheDocument();
    expect(screen.getByText(/\[ 03 \] Fontes da mensagem/i)).toBeInTheDocument();
    expect(screen.getAllByText(/citado :: sim/i).length).toBeGreaterThan(0);
  });

  it("starts a new focused conversation from a cited source card in the conversation audit", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        appendResponseFromAsk(
          {
            ...SUCCESS_RESPONSE,
            metadata: {
              ...SUCCESS_RESPONSE.metadata,
              topK: 8,
            },
          },
          "Compare as abordagens metodologicas.",
        ),
      ),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(FOCUSED_HANDOFF_CONVERSATION_RESPONSE, { status: 201 }),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Compare as abordagens metodologicas.");
    setTopK("8");

    await act(async () => {
      clickSubmit();
    });

    typeQuestion("Agora quero aprofundar esse artigo.");
    clickViewAudit();

    await act(async () => {
      clickStartFocusedConversation();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/rag/documents",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/rag/conversations",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByLabelText(/documento especifico/i)).toBeChecked();
    expect(screen.getByLabelText(/documento alvo/i)).toHaveValue(
      SOURCE_HANDOFF_DOCUMENT_ID,
    );
    expect(
      within(getConversationSection()).getByLabelText(/fontes recuperadas/i),
    ).toHaveValue(8);
    expect(
      within(getConversationSection()).getByLabelText(/pergunta/i),
    ).toHaveValue(
      "Agora quero aprofundar esse artigo.",
    );
    expect(window.location.search).toContain(
      `conversation=${FOCUSED_HANDOFF_CONVERSATION_ID}`,
    );
    expect(window.location.search).toContain("mode=focused");
    expect(window.location.search).toContain(
      `documentId=${SOURCE_HANDOFF_DOCUMENT_ID}`,
    );
    expect(screen.getByText(/conversa sem titulo/i)).toBeInTheDocument();
  });

  it("ignores repeated rapid clicks while a focused handoff is already starting", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(FOCUSED_HANDOFF_CONVERSATION_RESPONSE, { status: 201 }),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    const handoffButton = screen.getAllByRole("button", {
      name: /conversar apenas sobre este artigo/i,
    })[0]!;

    await act(async () => {
      fireEvent.click(handoffButton);
      fireEvent.click(handoffButton);
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(window.location.search).toContain(
      `conversation=${FOCUSED_HANDOFF_CONVERSATION_ID}`,
    );
  });

  it("truncates long excerpts only in the rendered preview", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE, "Explique o contexto.")),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Explique o contexto.");

    await act(async () => {
      clickSubmit();
    });

    await act(async () => {
      clickViewAudit();
    });

    const preview = truncateExcerptPreview(LONG_EXCERPT);

    expect(screen.getByText(preview)).toBeInTheDocument();
    expect(screen.queryByText(LONG_EXCERPT)).not.toBeInTheDocument();
  });

  it("shows the no-evidence state, empty sources, and skipped generation audit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        appendResponseFromAsk(NO_EVIDENCE_RESPONSE, "Existe evidencia suficiente?"),
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Existe evidencia suficiente?");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getAllByText(/nao encontrei evidencias suficientes/i).length,
    ).toBeGreaterThan(0);

    await act(async () => {
      clickViewAudit();
    });

    expect(
      screen.getByText(/nenhuma fonte foi recuperada para esta pergunta/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/esta execucao nao consumiu geracao de resposta/i)[0],
    ).toBeInTheDocument();
  });

  it("shows safe ask errors for invalid request, unauthorized, and technical failures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_request" }, { status: 400 }),
    );

    const { unmount } = render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta invalida");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/digite uma pergunta valida para consultar/i),
    ).toBeInTheDocument();

    unmount();
    window.history.pushState({}, "", "/query");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);
    typeQuestion("Pergunta valida");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThanOrEqual(1);

    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    window.history.pushState({}, "", "/query");
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "generation_failed",
          userMessage: appendResponseFromAsk(
            SUCCESS_RESPONSE,
            "Pergunta valida outra vez",
          ).userMessage,
          errorCode: "generation_failed",
        },
        { status: 502 },
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta valida outra vez");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(
        /a geracao da resposta falhou\. tente reformular a pergunta ou tentar novamente\./i,
      ),
    ).toBeInTheDocument();
  });

  it("clears the secret and shows a safe unauthorized message when loading focused documents is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    await act(async () => {
      clickFocusedMode();
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThan(0);
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });

  it("shows the safe focused document-not-found message and keeps the active conversation state intact", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "document_not_found",
          userMessage: appendResponseFromAsk(
            SUCCESS_RESPONSE,
            "Pergunta focada sem documento valido",
          ).userMessage,
          errorCode: "document_not_found",
        },
        { status: 404 },
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta focada sem documento valido");

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });
    selectFocusedDocument(FOCUSED_DOCUMENT_ID);

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/documento nao encontrado ou indisponivel para foco/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/pergunta focada sem documento valido/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/conversa nao encontrada ou indisponivel para recarga/i),
    ).not.toBeInTheDocument();
  });

  it("shows the safe focused not-focusable message and keeps the persisted user turn in the transcript", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "document_not_focusable",
          userMessage: appendResponseFromAsk(
            SUCCESS_RESPONSE,
            "Pergunta focada em documento ainda nao pronto",
          ).userMessage,
          errorCode: "document_not_focusable",
        },
        { status: 422 },
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta focada em documento ainda nao pronto");

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });
    selectFocusedDocument(FOCUSED_DOCUMENT_ID);

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/documento ainda nao esta pronto para consulta focada/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/pergunta focada em documento ainda nao pronto/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("shows a safe message, keeps the current conversation, and preserves the current focused draft selection when the cited article is no longer focusable", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(SELECTABLE_DOCUMENTS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickFocusedMode();
    });

    await screen.findByRole("option", { name: /artigo focado a\.pdf/i });
    selectFocusedDocument(FOCUSED_DOCUMENT_ID);
    clickGlobalMode();
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    await act(async () => {
      clickStartFocusedConversation();
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/rag/documents",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(
      screen.getByText(/documento nao encontrado ou indisponivel para foco/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(SUCCESS_RESPONSE.answer).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(/base inteira/i)).toBeChecked();
    expect(window.location.search).toBe(`?conversation=${CONVERSATION_ID}`);

    clickFocusedMode();

    expect(screen.getByLabelText(/documento alvo/i)).toHaveValue(
      FOCUSED_DOCUMENT_ID,
    );
  });

  it("reuses the safe unauthorized UX when focused handoff document preflight is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    await act(async () => {
      clickStartFocusedConversation();
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThan(0);
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
    expect(
      screen.getAllByText(SUCCESS_RESPONSE.answer).length,
    ).toBeGreaterThan(0);
  });

  it("reuses the safe technical UX when creating the focused handoff conversation fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    await act(async () => {
      clickStartFocusedConversation();
    });

    expect(screen.getByText(/\[HTTP 500\]/)).toBeInTheDocument();
    expect(
      screen.getAllByText(SUCCESS_RESPONSE.answer).length,
    ).toBeGreaterThan(0);
    expect(window.location.search).toBe(`?conversation=${CONVERSATION_ID}`);
  });

  it("reuses the safe unauthorized UX when the focused handoff conversation creation is rejected after preflight", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(appendResponseFromAsk(SUCCESS_RESPONSE)),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse(HANDOFF_SELECTABLE_DOCUMENTS_RESPONSE),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    clickViewAudit();

    await act(async () => {
      clickStartFocusedConversation();
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThan(0);
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
    expect(
      screen.getAllByText(SUCCESS_RESPONSE.answer).length,
    ).toBeGreaterThan(0);
    expect(window.location.search).toBe(`?conversation=${CONVERSATION_ID}`);
  });

  it("shows the dedicated generation_unavailable message on 503", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: "generation_unavailable",
          userMessage: appendResponseFromAsk(SUCCESS_RESPONSE, "Pergunta indisp").userMessage,
          errorCode: "generation_unavailable",
        },
        { status: 503 },
      ),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta indisp");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/servico de geracao indisponivel no momento/i),
    ).toBeInTheDocument();
  });

  it("shows the HTTP status tail on unknown server errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta com 500");

    await act(async () => {
      clickSubmit();
    });

    expect(screen.getByText(/\[HTTP 500\]/)).toBeInTheDocument();
  });

  it("shows the dedicated network-error message when fetch rejects", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CREATE_CONVERSATION_RESPONSE, { status: 201 }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta offline");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/falha de rede ao falar com o servidor/i),
    ).toBeInTheDocument();
  });

  it("surfaces 401 from createConversation in the chat panel and unsticks loading", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    await act(async () => {
      clickNewConversation();
    });

    const alerts = screen.getAllByRole("alert");
    const unauthorizedAlerts = alerts.filter((alert) =>
      /secret de consulta foi rejeitado/i.test(alert.textContent ?? ""),
    );
    expect(unauthorizedAlerts.length).toBeGreaterThanOrEqual(2);

    expect(screen.queryByText(/carregando conversa\.\.\./i)).not.toBeInTheDocument();
  });

  it("persists the secret in sessionStorage and lets the user clear it", () => {
    render(<QueryPage />);
    typeSecret(SECRET);

    expect(sessionStorage.getItem("query:secret")).toBe(SECRET);

    fireEvent.click(screen.getByRole("button", { name: /limpar secret/i }));

    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });
});
