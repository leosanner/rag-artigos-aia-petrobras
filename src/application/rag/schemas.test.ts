import { describe, expect, it } from "vitest";

import {
  appendConversationMessageRequestSchema,
  answerQuestionResultSchema,
  ragAskRequestSchema,
  ragAskSuccessResponseSchema,
} from "./schemas";

describe("ragAskRequestSchema", () => {
  it("accepts rerank on the public global ask surface", () => {
    const result = ragAskRequestSchema.safeParse({
      question: "Quais tecnicas aparecem com mais frequencia?",
      mode: "global",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result.success).toBe(true);
  });

  it("keeps rerank unavailable on the public focused ask surface", () => {
    const result = ragAskRequestSchema.safeParse({
      question: "Quais tecnicas aparecem com mais frequencia?",
      mode: "focused",
      documentId: "11111111-1111-4111-8111-111111111111",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts rerank on the public global conversation request surface", () => {
    const result = appendConversationMessageRequestSchema.safeParse({
      content: "Quais tecnicas aparecem com mais frequencia?",
      retrievalSettings: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result.success).toBe(true);
  });

  it.each(["explore", "rerank"] as const)(
    "rejects strategy=%s on the public focused conversation request surface",
    (strategy) => {
      const result = appendConversationMessageRequestSchema.safeParse({
        content: "Pergunta no documento focado",
        mode: "focused",
        documentId: "11111111-1111-4111-8111-111111111111",
        retrievalSettings: {
          topK: 6,
          strategy,
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it("accepts strategy=standard on the public focused conversation request surface", () => {
    const result = appendConversationMessageRequestSchema.safeParse({
      content: "Pergunta no documento focado",
      mode: "focused",
      documentId: "11111111-1111-4111-8111-111111111111",
      retrievalSettings: {
        topK: 6,
        strategy: "standard",
      },
    });

    expect(result.success).toBe(true);
  });

  it("keeps split scores and rerank audit visible on the public ask payload", () => {
    const internalResult = answerQuestionResultSchema.parse({
      kind: "answered",
      status: "answered",
      traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      answer: "Resposta [1].",
      mode: "global",
      sources: [
        {
          sourceNumber: 1,
          chunkId: "11111111-1111-4111-8111-111111111111",
          documentId: "22222222-2222-4222-8222-222222222222",
          documentTitle: "artigo.pdf",
          chunkIndex: 0,
          excerpt: "Trecho recuperado.",
          retrievalScore: 0.91,
          rerankScore: 0.84,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
        },
      ],
      relatedTerms: [
        {
          rank: 1,
          term: "segmentacao",
          ngramSize: 1,
          frequency: 2,
          sourceCoverageCount: 1,
        },
      ],
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        promptVersion: "f08-rerank-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
        rerankerProvider: "test-reranker",
        rerankerModel: "rerank-v1",
      },
      audit: {
        latencyMs: 123,
        embedding: {
          inputTokens: 11,
          estimatedCostUsd: 0.00000143,
        },
        reranking: {
          latencyMs: 41,
          candidatesEvaluated: 6,
          inputTokens: 22,
          estimatedCostUsd: 0.000031,
        },
        generation: {
          inputTokens: 42,
          outputTokens: 16,
          totalTokens: 58,
          estimatedCostUsd: 0.0000192,
        },
        totalCostUsd: 0.00005163,
      },
    });

    expect(internalResult).toMatchObject({
      metadata: {
        retrievalStrategy: "rerank",
        rerankerProvider: "test-reranker",
        rerankerModel: "rerank-v1",
      },
      audit: {
        reranking: {
          candidatesEvaluated: 6,
        },
      },
    });

    const publicPayload = ragAskSuccessResponseSchema.parse(internalResult);

    expect(publicPayload).toEqual({
      traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      answer: "Resposta [1].",
      mode: "global",
      sources: [
        {
          sourceNumber: 1,
          chunkId: "11111111-1111-4111-8111-111111111111",
          documentId: "22222222-2222-4222-8222-222222222222",
          documentTitle: "artigo.pdf",
          chunkIndex: 0,
          excerpt: "Trecho recuperado.",
          retrievalScore: 0.91,
          rerankScore: 0.84,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
        },
      ],
      relatedTerms: [
        {
          rank: 1,
          term: "segmentacao",
          ngramSize: 1,
          frequency: 2,
          sourceCoverageCount: 1,
        },
      ],
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        promptVersion: "f08-rerank-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
        rerankerProvider: "test-reranker",
        rerankerModel: "rerank-v1",
      },
      audit: {
        latencyMs: 123,
        embedding: {
          inputTokens: 11,
          estimatedCostUsd: 0.00000143,
        },
        reranking: {
          latencyMs: 41,
          candidatesEvaluated: 6,
          inputTokens: 22,
          estimatedCostUsd: 0.000031,
        },
        generation: {
          inputTokens: 42,
          outputTokens: 16,
          totalTokens: 58,
          estimatedCostUsd: 0.0000192,
        },
        totalCostUsd: 0.00005163,
      },
    });
  });
});
