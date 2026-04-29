import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import type {
  FirstPassChunkMatch,
  RetrievedChunkMatch,
  RerankedChunkMatch,
} from "@/domain/rag";

import {
  RetrieveChunks,
  RetrieveChunksFailure,
  RerankingFailure,
} from "./retrieve-chunks";

const EMBEDDING_MODEL = "text-embedding-3-large";
const DOCUMENT_A = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_B = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_C = "33333333-3333-4333-8333-333333333333";

function buildSearchMatch(
  overrides: Partial<RetrievedChunkMatch> = {},
): RetrievedChunkMatch {
  return {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: DOCUMENT_A,
    documentTitle: "article.pdf",
    chunkIndex: 0,
    excerpt: "Chunk excerpt",
    score: 0.91,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: DEFAULT_CHUNKING_CONFIG.chunkingVersion,
    embeddingModel: EMBEDDING_MODEL,
    ...overrides,
  };
}

function toFirstPassMatch(match: RetrievedChunkMatch): FirstPassChunkMatch {
  return {
    chunkId: match.chunkId,
    documentId: match.documentId,
    documentTitle: match.documentTitle,
    chunkIndex: match.chunkIndex,
    excerpt: match.excerpt,
    retrievalScore: match.score,
    rerankScore: null,
    documentPipelineVersion: match.documentPipelineVersion,
    chunkingVersion: match.chunkingVersion,
    embeddingModel: match.embeddingModel,
  };
}

function toRerankedMatch(
  match: RetrievedChunkMatch,
  rerankScore: number | null,
): RerankedChunkMatch {
  return {
    ...toFirstPassMatch(match),
    rerankScore,
  };
}

describe("RetrieveChunks", () => {
  it("embeds the question, returns normalized first-pass matches, and searches the active configuration with standard top-k", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 14,
      estimatedCostUsd: 0.00000182,
    };
    const matches = [buildSearchMatch()];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(matches),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas foram usadas nos artigos?",
        retrieval: {
          topK: 9,
          strategy: "standard",
        },
      }),
    ).resolves.toEqual({
      matches: matches.map(toFirstPassMatch),
      embedding: embeddingUsage,
      reranking: null,
    });

    expect(questionEmbeddingProvider.embedQuestion).toHaveBeenCalledWith(
      "Quais técnicas foram usadas nos artigos?",
    );
    expect(chunksRepository.searchGlobal).toHaveBeenCalledWith({
      queryEmbedding,
      topK: 9,
      chunkingVersion: DEFAULT_CHUNKING_CONFIG.chunkingVersion,
      embeddingModel: EMBEDDING_MODEL,
    });
    expect(service.chunkingVersion).toBe(
      DEFAULT_CHUNKING_CONFIG.chunkingVersion,
    );
  });

  it("fetches explore candidates, returns the diversified normalized top-k selection, and preserves embedding audit data", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 18,
      estimatedCostUsd: 0.00000234,
    };
    const candidates = [
      buildSearchMatch({
        chunkId: "10000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_A,
        chunkIndex: 0,
        score: 0.99,
      }),
      buildSearchMatch({
        chunkId: "10000000-0000-4000-8000-000000000001",
        documentId: DOCUMENT_A,
        chunkIndex: 1,
        score: 0.98,
      }),
      buildSearchMatch({
        chunkId: "10000000-0000-4000-8000-000000000002",
        documentId: DOCUMENT_A,
        chunkIndex: 2,
        score: 0.97,
      }),
      buildSearchMatch({
        chunkId: "20000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_B,
        chunkIndex: 0,
        score: 0.96,
      }),
      buildSearchMatch({
        chunkId: "30000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_C,
        chunkIndex: 0,
        score: 0.95,
      }),
    ];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(candidates),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais linhas de pesquisa aparecem?",
        retrieval: {
          topK: 4,
          strategy: "explore",
        },
      }),
    ).resolves.toEqual({
      matches: [candidates[0], candidates[1], candidates[3], candidates[4]].map(
        toFirstPassMatch,
      ),
      embedding: embeddingUsage,
      reranking: null,
    });

    expect(chunksRepository.searchGlobal).toHaveBeenCalledWith({
      queryEmbedding,
      topK: 12,
      chunkingVersion: DEFAULT_CHUNKING_CONFIG.chunkingVersion,
      embeddingModel: EMBEDDING_MODEL,
    });
  });

  it("caps explore candidate fetches at 24", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: {
          inputTokens: 9,
          estimatedCostUsd: 0.00000117,
        },
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue([]),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await service.search({
      question: "Compare os estudos.",
      retrieval: {
        topK: 12,
        strategy: "explore",
      },
    });

    expect(chunksRepository.searchGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 24,
      }),
    );
  });

  it("returns empty rerank matches and skips the reranking provider when first-pass retrieval finds no candidates", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 13,
      estimatedCostUsd: 0.00000169,
    };
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue([]),
    };
    const rerankingProvider = {
      rerank: vi.fn(),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      rerankingProvider,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas foram mais consistentes?",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
      }),
    ).resolves.toEqual({
      matches: [],
      embedding: embeddingUsage,
      reranking: null,
    });

    expect(rerankingProvider.rerank).not.toHaveBeenCalled();
  });

  it("calls the reranking provider exactly once, validates its selection, and returns reranking metadata plus audit", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 18,
      estimatedCostUsd: 0.00000234,
    };
    const candidates = [
      buildSearchMatch({
        chunkId: "10000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_A,
        chunkIndex: 0,
        score: 0.99,
      }),
      buildSearchMatch({
        chunkId: "20000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_B,
        chunkIndex: 0,
        score: 0.96,
      }),
      buildSearchMatch({
        chunkId: "30000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_C,
        chunkIndex: 0,
        score: 0.95,
      }),
    ];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(candidates),
    };
    const rerankingProvider = {
      rerank: vi.fn().mockResolvedValue({
        matches: [
          toRerankedMatch(candidates[1]!, 0.98),
          toRerankedMatch(candidates[0]!, 0.92),
        ],
        metadata: {
          rerankerProvider: "test-reranker",
          rerankerModel: "rerank-v1",
        },
        audit: {
          latencyMs: 41,
          candidatesEvaluated: 3,
          inputTokens: 22,
          estimatedCostUsd: 0.000031,
        },
      }),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      rerankingProvider,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas foram mais consistentes?",
        retrieval: {
          topK: 2,
          strategy: "rerank",
        },
      }),
    ).resolves.toEqual({
      matches: [
        toRerankedMatch(candidates[1]!, 0.98),
        toRerankedMatch(candidates[0]!, 0.92),
      ],
      embedding: embeddingUsage,
      reranking: {
        metadata: {
          rerankerProvider: "test-reranker",
          rerankerModel: "rerank-v1",
        },
        audit: {
          latencyMs: 41,
          candidatesEvaluated: 3,
          inputTokens: 22,
          estimatedCostUsd: 0.000031,
        },
      },
    });

    expect(rerankingProvider.rerank).toHaveBeenCalledTimes(1);
    expect(rerankingProvider.rerank).toHaveBeenCalledWith({
      question: "Quais técnicas foram mais consistentes?",
      matches: candidates.map(toFirstPassMatch),
      topK: 2,
      candidateTopK: 6,
    });
  });

  it("fails safely with reranking_unavailable when rerank is requested without a configured provider", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    };
    const matches = [buildSearchMatch()];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(matches),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas o documento usa?",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
        documentId: DOCUMENT_B,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "RerankingFailure",
        code: "reranking_unavailable",
        embedding: embeddingUsage,
      }),
    );
  });

  it("fails safely with reranking_unavailable when the reranking provider is temporarily unavailable", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    };
    const matches = [buildSearchMatch()];
    const providerError = {
      statusCode: 503,
      message: "reranking provider unavailable",
    };
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(matches),
    };
    const rerankingProvider = {
      rerank: vi.fn().mockRejectedValue(providerError),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      rerankingProvider,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas o documento usa?",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "RerankingFailure",
        code: "reranking_unavailable",
        cause: providerError,
        embedding: embeddingUsage,
      }),
    );
  });

  it("fails safely with reranking_failed when the reranking provider returns an invalid selection", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    };
    const matches = [
      buildSearchMatch({
        chunkId: "10000000-0000-4000-8000-000000000000",
      }),
      buildSearchMatch({
        chunkId: "20000000-0000-4000-8000-000000000000",
      }),
    ];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(matches),
    };
    const rerankingProvider = {
      rerank: vi.fn().mockResolvedValue({
        matches: [
          toRerankedMatch(
            buildSearchMatch({
              chunkId: "99999999-0000-4000-8000-000000000000",
            }),
            0.98,
          ),
        ],
        metadata: {
          rerankerProvider: "test-reranker",
          rerankerModel: "rerank-v1",
        },
        audit: {
          latencyMs: 41,
          candidatesEvaluated: 2,
          inputTokens: 22,
          estimatedCostUsd: 0.000031,
        },
      }),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      rerankingProvider,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas o documento usa?",
        retrieval: {
          topK: 1,
          strategy: "rerank",
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "RerankingFailure",
        code: "reranking_failed",
        embedding: embeddingUsage,
      }),
    );
    await expect(
      service.search({
        question: "Quais técnicas o documento usa?",
        retrieval: {
          topK: 1,
          strategy: "rerank",
        },
      }),
    ).rejects.toBeInstanceOf(RerankingFailure);
  });

  it("forwards documentId to the chunks repository when focused mode supplies it", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    };
    const matches = [buildSearchMatch({ documentId: DOCUMENT_B })];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockResolvedValue(matches),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais técnicas o documento usa?",
        retrieval: {
          topK: 6,
          strategy: "standard",
        },
        documentId: DOCUMENT_B,
      }),
    ).resolves.toEqual({
      matches: matches.map(toFirstPassMatch),
      embedding: embeddingUsage,
      reranking: null,
    });

    expect(chunksRepository.searchGlobal).toHaveBeenCalledWith({
      queryEmbedding,
      topK: 6,
      chunkingVersion: DEFAULT_CHUNKING_CONFIG.chunkingVersion,
      embeddingModel: EMBEDDING_MODEL,
      documentId: DOCUMENT_B,
    });
  });

  it("wraps repository failures and preserves any embedding audit already captured", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 16,
      estimatedCostUsd: 0.00000208,
    };
    const repositoryError = {
      statusCode: 503,
      message: "vector search unavailable",
    };
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue({
        embedding: queryEmbedding,
        usage: embeddingUsage,
      }),
    };
    const chunksRepository = {
      searchGlobal: vi.fn().mockRejectedValue(repositoryError),
    };
    const service = new RetrieveChunks({
      questionEmbeddingProvider,
      chunksRepository,
      embeddingModel: EMBEDDING_MODEL,
    });

    await expect(
      service.search({
        question: "Quais linhas de pesquisa aparecem?",
        retrieval: {
          topK: 6,
          strategy: "standard",
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "RetrieveChunksFailure",
        cause: repositoryError,
        embedding: embeddingUsage,
      }),
    );
    await expect(
      service.search({
        question: "Quais linhas de pesquisa aparecem?",
        retrieval: {
          topK: 6,
          strategy: "standard",
        },
      }),
    ).rejects.toBeInstanceOf(RetrieveChunksFailure);
  });
});
