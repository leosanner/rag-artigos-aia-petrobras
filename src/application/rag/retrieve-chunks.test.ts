import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import type { RetrievedChunkMatch } from "@/domain/rag";

import { RetrieveChunks } from "./retrieve-chunks";

const EMBEDDING_MODEL = "text-embedding-3-large";

function buildMatch(
  overrides: Partial<RetrievedChunkMatch> = {},
): RetrievedChunkMatch {
  return {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
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
  it("embeds the question and searches the active configuration with top-k 6", async () => {
    const queryEmbedding = [0.1, 0.2, 0.3];
    const matches = [buildMatch()];
    const questionEmbeddingProvider = {
      embedQuestion: vi.fn().mockResolvedValue(queryEmbedding),
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
      service.search("Quais técnicas foram usadas nos artigos?"),
    ).resolves.toEqual(matches);

    expect(questionEmbeddingProvider.embedQuestion).toHaveBeenCalledWith(
      "Quais técnicas foram usadas nos artigos?",
    );
    expect(chunksRepository.searchGlobal).toHaveBeenCalledWith({
      queryEmbedding,
      topK: 6,
      chunkingVersion: DEFAULT_CHUNKING_CONFIG.chunkingVersion,
      embeddingModel: EMBEDDING_MODEL,
    });
    expect(service.topK).toBe(6);
    expect(service.chunkingVersion).toBe(
      DEFAULT_CHUNKING_CONFIG.chunkingVersion,
    );
  });
});
