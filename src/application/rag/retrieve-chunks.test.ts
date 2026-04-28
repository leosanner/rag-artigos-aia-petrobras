import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import type { RetrievedChunkMatch } from "@/domain/rag";

import { RetrieveChunks, RetrieveChunksFailure } from "./retrieve-chunks";

const EMBEDDING_MODEL = "text-embedding-3-large";
const DOCUMENT_A = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_B = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_C = "33333333-3333-4333-8333-333333333333";

function buildMatch(
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

describe("RetrieveChunks", () => {
  it("embeds the question, returns embedding audit, and searches the active configuration with standard top-k", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 14,
      estimatedCostUsd: 0.00000182,
    };
    const matches = [buildMatch()];
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
      matches,
      embedding: embeddingUsage,
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

  it("fetches explore candidates, returns the diversified top-k selection, and preserves embedding audit data", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 18,
      estimatedCostUsd: 0.00000234,
    };
    const candidates = [
      buildMatch({
        chunkId: "10000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_A,
        chunkIndex: 0,
        score: 0.99,
      }),
      buildMatch({
        chunkId: "10000000-0000-4000-8000-000000000001",
        documentId: DOCUMENT_A,
        chunkIndex: 1,
        score: 0.98,
      }),
      buildMatch({
        chunkId: "10000000-0000-4000-8000-000000000002",
        documentId: DOCUMENT_A,
        chunkIndex: 2,
        score: 0.97,
      }),
      buildMatch({
        chunkId: "20000000-0000-4000-8000-000000000000",
        documentId: DOCUMENT_B,
        chunkIndex: 0,
        score: 0.96,
      }),
      buildMatch({
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
      matches: [candidates[0], candidates[1], candidates[3], candidates[4]],
      embedding: embeddingUsage,
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

  it("forwards documentId to the chunks repository when focused mode supplies it", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const embeddingUsage = {
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    };
    const matches = [buildMatch({ documentId: DOCUMENT_B })];
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
      matches,
      embedding: embeddingUsage,
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
