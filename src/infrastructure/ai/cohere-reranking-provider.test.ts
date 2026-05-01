import { describe, expect, it, vi } from "vitest";

import type { FirstPassChunkMatch } from "@/domain/rag";

import {
  CohereRerankingProvider,
  DEFAULT_COHERE_RERANKING_MODEL,
  createCohereRerankingModel,
  createCohereRerankingProviderFromEnv,
  createRerankingProviderFromEnv,
} from "./cohere-reranking-provider";

const MATCHES: FirstPassChunkMatch[] = [
  {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentTitle: "artigo-a.pdf",
    chunkIndex: 0,
    excerpt: "Trecho A.",
    retrievalScore: 0.91,
    rerankScore: null,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
  },
  {
    chunkId: "22222222-2222-4222-8222-222222222222",
    documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    documentTitle: "artigo-b.pdf",
    chunkIndex: 0,
    excerpt: "Trecho B.",
    retrievalScore: 0.88,
    rerankScore: null,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
  },
  {
    chunkId: "33333333-3333-4333-8333-333333333333",
    documentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    documentTitle: "artigo-c.pdf",
    chunkIndex: 0,
    excerpt: "Trecho C.",
    retrievalScore: 0.82,
    rerankScore: null,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
  },
];

describe("CohereRerankingProvider", () => {
  it("maps the ranking order back to first-pass chunk ids and normalizes metadata plus audit", async () => {
    const model = {
      specificationVersion: "v3" as const,
      provider: "cohere",
      modelId: DEFAULT_COHERE_RERANKING_MODEL,
      doRerank: vi.fn(),
    };
    const rerank = vi.fn().mockResolvedValue({
      ranking: [
        {
          originalIndex: 1,
          score: 0.97,
          document: MATCHES[1],
        },
        {
          originalIndex: 0,
          score: 0.93,
          document: MATCHES[0],
        },
        {
          originalIndex: 2,
          score: 0.71,
          document: MATCHES[2],
        },
      ],
    });
    const provider = new CohereRerankingProvider({
      modelFactory: vi.fn().mockReturnValue(model),
      rerank,
      nowMs: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(148),
    });

    await expect(
      provider.rerank({
        question: "Quais estudos sao mais relevantes?",
        matches: MATCHES,
        topK: 2,
        candidateTopK: 6,
      }),
    ).resolves.toEqual({
      matches: [
        {
          ...MATCHES[1],
          rerankScore: 0.97,
        },
        {
          ...MATCHES[0],
          rerankScore: 0.93,
        },
      ],
      metadata: {
        rerankerProvider: "cohere",
        rerankerModel: DEFAULT_COHERE_RERANKING_MODEL,
      },
      audit: {
        latencyMs: 48,
        candidatesEvaluated: 3,
        inputTokens: 0,
        estimatedCostUsd: 0,
      },
    });

    expect(rerank).toHaveBeenCalledWith({
      model,
      documents: MATCHES,
      query: "Quais estudos sao mais relevantes?",
      topN: 2,
    });
  });

  it("fails if the provider returns a ranking index outside the candidate set", async () => {
    const provider = new CohereRerankingProvider({
      modelFactory: vi.fn().mockReturnValue({
        specificationVersion: "v3" as const,
        provider: "cohere",
        modelId: DEFAULT_COHERE_RERANKING_MODEL,
        doRerank: vi.fn(),
      }),
      rerank: vi.fn().mockResolvedValue({
        ranking: [
          {
            originalIndex: 99,
            score: 0.91,
            document: MATCHES[0],
          },
        ],
      }),
    });

    await expect(
      provider.rerank({
        question: "Pergunta",
        matches: MATCHES,
        topK: 1,
        candidateTopK: 3,
      }),
    ).rejects.toThrow("reranking_provider_returned_unknown_original_index");
  });
});

describe("createCohereRerankingModel", () => {
  it("posts the Cohere rerank request and returns ordered scores through the AI SDK model contract", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "rerank-response-id",
          results: [
            {
              index: 1,
              relevance_score: 0.97,
            },
            {
              index: 0,
              relevance_score: 0.93,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "cohere-request-id",
          },
        },
      ),
    );
    const model = createCohereRerankingModel({
      apiKey: "cohere-key",
      modelId: "rerank-v4.0",
      baseURL: "https://cohere.example.test/v2",
      fetch,
    });

    const result = await model.doRerank({
      query: "Pergunta",
      documents: {
        type: "object",
        values: MATCHES,
      },
      topN: 2,
    });

    expect(result.ranking).toEqual([
      {
        index: 1,
        relevanceScore: 0.97,
      },
      {
        index: 0,
        relevanceScore: 0.93,
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("https://cohere.example.test/v2/rerank", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer cohere-key",
        "Content-Type": "application/json",
      },
      signal: undefined,
      body: JSON.stringify({
        model: "rerank-v4.0",
        query: "Pergunta",
        documents: MATCHES.map((match) => JSON.stringify(match)),
        top_n: 2,
      }),
    });
  });

  it("surfaces a statusCode when Cohere responds with an unavailable error", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "provider unavailable" }), {
        status: 503,
        statusText: "Service Unavailable",
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const model = createCohereRerankingModel({
      apiKey: "cohere-key",
      modelId: DEFAULT_COHERE_RERANKING_MODEL,
      fetch,
    });

    await expect(
      model.doRerank({
        query: "Pergunta",
        documents: {
          type: "text",
          values: ["A", "B"],
        },
      }),
    ).rejects.toMatchObject({
      name: "CohereRerankingApiError",
      message: "provider unavailable",
      statusCode: 503,
    });
  });
});

describe("createRerankingProviderFromEnv", () => {
  it("returns undefined when no reranker provider is configured", () => {
    const provider = createRerankingProviderFromEnv({
      COHERE_API_KEY: undefined,
      RAG_RERANKER_PROVIDER: undefined,
      RAG_RERANKER_MODEL: DEFAULT_COHERE_RERANKING_MODEL,
    });

    expect(provider).toBeUndefined();
  });

  it("creates a Cohere provider with the configured model and API key", async () => {
    const rerank = vi.fn().mockResolvedValue({
      ranking: [
        {
          originalIndex: 0,
          score: 0.94,
          document: MATCHES[0],
        },
      ],
    });
    const provider = createCohereRerankingProviderFromEnv(
      {
        COHERE_API_KEY: "cohere-key",
        RAG_RERANKER_MODEL: "rerank-v4.0",
      },
      {
        rerank,
        fetch: vi.fn(),
      },
    );

    const result = await provider.rerank({
      question: "Pergunta",
      matches: MATCHES,
      topK: 1,
      candidateTopK: 3,
    });

    expect(result.metadata).toEqual({
      rerankerProvider: "cohere",
      rerankerModel: "rerank-v4.0",
    });
  });

  it("rejects a configured Cohere provider without an API key", () => {
    expect(() =>
      createCohereRerankingProviderFromEnv({
        COHERE_API_KEY: undefined,
        RAG_RERANKER_MODEL: DEFAULT_COHERE_RERANKING_MODEL,
      }),
    ).toThrow(/COHERE_API_KEY/);
  });
});
