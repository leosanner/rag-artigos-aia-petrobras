import { describe, expect, it } from "vitest";

import type { RagRunDetail } from "@/repositories/rag-query-runs-repository";

import { projectRunWithConversationStatus } from "./run-projection";

function buildRun(): RagRunDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    question: "q",
    answer: "a",
    mode: "global",
    documentId: null,
    status: "answered",
    errorCode: null,
    sources: [],
    relatedTerms: [],
    metadata: {
      mode: "global",
      documentId: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: "v1",
      generationModel: "gpt-4.1-mini",
      embeddingModel: "text-embedding-3-large",
      rerankerProvider: null,
      rerankerModel: null,
    },
    audit: {
      latencyMs: 0,
      embedding: { inputTokens: 0, estimatedCostUsd: 0 },
      reranking: null,
      generation: null,
      totalCostUsd: 0,
    },
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
  };
}

describe("projectRunWithConversationStatus", () => {
  it("marks the run as not archived when the parent conversation still exists", () => {
    const run = buildRun();

    const projected = projectRunWithConversationStatus(run, {
      conversationExists: true,
    });

    expect(projected.conversationArchived).toBe(false);
    expect(projected.id).toBe(run.id);
  });

  it("marks the run as archived when the parent conversation has been deleted", () => {
    const run = buildRun();

    const projected = projectRunWithConversationStatus(run, {
      conversationExists: false,
    });

    expect(projected.conversationArchived).toBe(true);
  });

  it("preserves every original run field on the projection", () => {
    const run = buildRun();

    const projected = projectRunWithConversationStatus(run, {
      conversationExists: true,
    });

    const { conversationArchived, ...rest } = projected;
    expect(conversationArchived).toBe(false);
    expect(rest).toEqual(run);
  });
});
