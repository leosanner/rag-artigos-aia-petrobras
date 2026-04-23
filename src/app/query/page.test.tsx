import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RAG_SOURCE_EXCERPT_PREVIEW_LENGTH,
  truncateExcerptPreview,
} from "./constants";
import QueryPage from "./page";

const LONG_EXCERPT = `${"A".repeat(RAG_SOURCE_EXCERPT_PREVIEW_LENGTH)} trecho extra para truncar`;
const SECRET = "query-secret-value";
const CURRENT_TRACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SUCCESS_RESPONSE = {
  traceId: CURRENT_TRACE_ID,
  answer:
    "Os documentos destacam classificacao supervisionada e segmentacao [1] [2].",
  mode: "global" as const,
  sources: [
    {
      sourceNumber: 1,
      chunkId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      documentTitle: "artigo-a.pdf",
      chunkIndex: 0,
      excerpt: LONG_EXCERPT,
      score: 0.91,
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
      score: 0.87,
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
    topK: 6,
    retrievalStrategy: "standard" as const,
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
  },
  audit: {
    latencyMs: 123,
    embedding: {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    },
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
    generation: null,
    totalCostUsd: 0.00000117,
  },
};

const RUN_SUMMARIES = [
  {
    id: RUN_ID,
    question: "Quais tecnicas aparecem com maior frequencia?",
    status: "answered" as const,
    topK: 6,
    retrievalStrategy: "standard" as const,
    latencyMs: 432,
    totalCostUsd: 0.000482,
    createdAt: "2026-04-23T12:34:56.000Z",
  },
];

const RUN_DETAIL = {
  id: RUN_ID,
  question: "Quais tecnicas aparecem com maior frequencia?",
  answer: "Classificacao supervisionada [1].",
  mode: "global" as const,
  status: "answered" as const,
  errorCode: null,
  sources: [
    {
      sourceNumber: 1,
      chunkId: "55555555-5555-4555-8555-555555555555",
      documentId: "66666666-6666-4666-8666-666666666666",
      documentTitle: "artigo-persistido.pdf",
      chunkIndex: 0,
      excerpt: "Trecho persistido do banco.",
      score: 0.92,
      documentPipelineVersion: "documents-v1",
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
      citedInAnswer: true,
    },
  ],
  relatedTerms: [
    {
      rank: 1,
      term: "classificacao supervisionada",
      ngramSize: 2,
      frequency: 3,
      sourceCoverageCount: 1,
    },
  ],
  metadata: {
    mode: "global" as const,
    topK: 6,
    retrievalStrategy: "standard" as const,
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
  },
  audit: {
    latencyMs: 432,
    embedding: {
      inputTokens: 17,
      estimatedCostUsd: 0.000002,
    },
    generation: {
      inputTokens: 120,
      outputTokens: 42,
      totalTokens: 162,
      estimatedCostUsd: 0.00048,
    },
    totalCostUsd: 0.000482,
  },
  createdAt: "2026-04-23T12:34:56.000Z",
};

const FAILED_RUN_DETAIL = {
  ...RUN_DETAIL,
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  question: "Existe evidencia suficiente para uma resposta?",
  answer: null,
  status: "generation_failed" as const,
  errorCode: "generation_failed" as const,
  sources: [],
  relatedTerms: [],
  audit: {
    latencyMs: 91,
    embedding: {
      inputTokens: 8,
      estimatedCostUsd: 0.00000104,
    },
    generation: null,
    totalCostUsd: 0.00000104,
  },
  createdAt: "2026-04-24T08:00:00.000Z",
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

function typeQuestion(value: string): void {
  fireEvent.change(screen.getByLabelText(/pergunta/i), {
    target: { value },
  });
}

function typeSecret(value: string): void {
  fireEvent.change(screen.getByLabelText(/secret de consulta/i), {
    target: { value },
  });
}

function setTopK(value: string): void {
  fireEvent.change(screen.getByLabelText(/fontes recuperadas/i), {
    target: { value },
  });
}

function clickSubmit(): void {
  fireEvent.click(screen.getByRole("button", { name: /consultar base/i }));
}

function clickExplore(): void {
  fireEvent.click(
    screen.getByRole("button", { name: /explorar perspectivas/i }),
  );
}

function clickLoadHistory(): void {
  fireEvent.click(
    screen.getByRole("button", { name: /carregar historico recente/i }),
  );
}

describe("/query page", () => {
  const fetchMock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
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
    expect(screen.getByLabelText(/pergunta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secret de consulta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fontes recuperadas/i)).toHaveValue(6);
    expect(screen.getByRole("button", { name: /consultar base/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /explorar perspectivas/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /carregar historico recente/i }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits standard and explore queries with validated retrieval settings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...SUCCESS_RESPONSE,
        metadata: {
          ...SUCCESS_RESPONSE.metadata,
          topK: 8,
          retrievalStrategy: "explore",
          candidateTopK: 24,
        },
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
      "/api/rag/ask",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          question: "Compare as abordagens metodologicas.",
          mode: "global",
          retrieval: {
            topK: 8,
            strategy: "standard",
          },
        }),
      }),
    );

    await act(async () => {
      clickExplore();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/rag/ask",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          question: "Compare as abordagens metodologicas.",
          mode: "global",
          retrieval: {
            topK: 8,
            strategy: "explore",
          },
        }),
      }),
    );
  });

  it("renders the current answer audit from the ask success payload without an extra fetch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Quais tecnicas aparecem com mais frequencia?");

    await act(async () => {
      clickSubmit();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(SUCCESS_RESPONSE.answer)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_TRACE_ID)).toBeInTheDocument();
    expect(
      screen.getAllByText(/classificacao supervisionada/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/US\$ 0\.00002063/i)).toBeInTheDocument();
    expect(screen.getAllByText(/123 ms/i).length).toBeGreaterThan(0);
    expect(screen.getByText("1. artigo-a.pdf")).toBeInTheDocument();
    expect(
      screen.getAllByText(/quais tecnicas aparecem com mais frequencia\?/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/carregando historico auditado/i)).not.toBeInTheDocument();
  });

  it("truncates long excerpts only in the rendered preview", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUCCESS_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Explique o contexto.");

    await act(async () => {
      clickSubmit();
    });

    const preview = truncateExcerptPreview(LONG_EXCERPT);

    expect(screen.getByText(preview)).toBeInTheDocument();
    expect(screen.queryByText(LONG_EXCERPT)).not.toBeInTheDocument();
  });

  it("shows the no-evidence state, empty sources, and skipped generation audit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NO_EVIDENCE_RESPONSE));

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Existe evidencia suficiente?");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(/nao encontrei evidencias suficientes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nenhuma fonte foi recuperada para esta pergunta/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/esta execucao nao consumiu geracao de resposta/i)[0],
    ).toBeInTheDocument();
  });

  it("loads the recent history manually and inspects one persisted run on demand", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RUN_SUMMARIES));
    fetchMock.mockResolvedValueOnce(jsonResponse(RUN_DETAIL));

    render(<QueryPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickLoadHistory();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/rag/query-runs",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
    expect(
      screen.getByRole("button", {
        name: /quais tecnicas aparecem com maior frequencia\?/i,
      }),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /quais tecnicas aparecem com maior frequencia\?/i,
        }),
      );
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/rag/query-runs/${RUN_ID}`,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: `Bearer ${SECRET}`,
        }),
      }),
    );
    expect(screen.getByText(/classificacao supervisionada \[1\]\./i)).toBeInTheDocument();
    expect(screen.getByText(/citado :: sim/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/2026-04-23 12:34:56Z/i).length,
    ).toBeGreaterThan(0);
  });

  it("clears persisted history, clears the stored secret, and shows a safe message on 401 when refreshing history", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RUN_SUMMARIES));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe(
      SECRET,
    );

    await act(async () => {
      clickLoadHistory();
    });

    expect(
      screen.getByRole("button", {
        name: /quais tecnicas aparecem com maior frequencia\?/i,
      }),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /atualizar historico/i }),
      );
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", {
        name: /quais tecnicas aparecem com maior frequencia\?/i,
      }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });

  it("clears persisted history, clears the stored secret, and shows a safe message on 401 when loading run detail", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RUN_SUMMARIES));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);

    await act(async () => {
      clickLoadHistory();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /quais tecnicas aparecem com maior frequencia\?/i,
        }),
      );
    });

    expect(
      screen.getAllByText(/secret de consulta foi rejeitado/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", {
        name: /quais tecnicas aparecem com maior frequencia\?/i,
      }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem("query:secret")).toBeNull();
    expect((screen.getByLabelText(/secret de consulta/i) as HTMLInputElement).value).toBe("");
  });

  it("renders a persisted failed run safely without leaking internals", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          ...RUN_SUMMARIES[0],
          id: FAILED_RUN_DETAIL.id,
          question: FAILED_RUN_DETAIL.question,
          status: FAILED_RUN_DETAIL.status,
          createdAt: FAILED_RUN_DETAIL.createdAt,
        },
      ]),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(FAILED_RUN_DETAIL));

    render(<QueryPage />);
    typeSecret(SECRET);

    await act(async () => {
      clickLoadHistory();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /existe evidencia suficiente para uma resposta\?/i,
        }),
      );
    });

    expect(screen.getAllByText(/falha segura/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/generation_failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nenhuma resposta textual foi persistida para esta execucao/i),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain("providerPayload");
  });

  it("shows safe ask errors for invalid request, unauthorized, and technical failures", async () => {
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
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "unauthorized" }, { status: 401 }),
    );
    sessionStorage.setItem("query:secret", SECRET);

    render(<QueryPage />);
    typeQuestion("Pergunta valida");

    await act(async () => {
      clickSubmit();
    });

    expect(screen.getByText(/secret de consulta foi rejeitado/i)).toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "generation_failed" }, { status: 502 }),
    );

    render(<QueryPage />);
    typeSecret(SECRET);
    typeQuestion("Pergunta valida outra vez");

    await act(async () => {
      clickSubmit();
    });

    expect(
      screen.getByText(
        /nao foi possivel consultar a base agora\. tente novamente em instantes\./i,
      ),
    ).toBeInTheDocument();
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
