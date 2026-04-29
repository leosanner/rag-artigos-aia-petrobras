import { describe, expect, it } from "vitest";

import {
  assertValidRerankedSelection,
  ragRerankingAuditSchema,
  ragRerankingMetadataSchema,
  ragSourceScoreSchema,
} from "./reranking";

const CANDIDATE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

describe("ragSourceScoreSchema", () => {
  it("requires retrievalScore and allows a nullable rerankScore", () => {
    expect(
      ragSourceScoreSchema.safeParse({
        retrievalScore: 0.91,
        rerankScore: 0.82,
      }).success,
    ).toBe(true);

    expect(
      ragSourceScoreSchema.safeParse({
        retrievalScore: 0.91,
        rerankScore: null,
      }).success,
    ).toBe(true);

    expect(
      ragSourceScoreSchema.safeParse({
        rerankScore: 0.82,
      }).success,
    ).toBe(false);
  });
});

describe("ragRerankingMetadataSchema", () => {
  it("accepts normalized provider and model names only", () => {
    expect(
      ragRerankingMetadataSchema.safeParse({
        rerankerProvider: "openai",
        rerankerModel: "rerank-1",
      }).success,
    ).toBe(true);

    expect(
      ragRerankingMetadataSchema.safeParse({
        rerankerProvider: "",
        rerankerModel: "rerank-1",
      }).success,
    ).toBe(false);
  });
});

describe("ragRerankingAuditSchema", () => {
  it("allows an explicit zero input-token count after provider normalization", () => {
    const result = ragRerankingAuditSchema.safeParse({
      latencyMs: 31,
      candidatesEvaluated: 12,
      inputTokens: 0,
      estimatedCostUsd: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative normalized audit values", () => {
    expect(
      ragRerankingAuditSchema.safeParse({
        latencyMs: -1,
        candidatesEvaluated: 12,
        inputTokens: 0,
        estimatedCostUsd: 0,
      }).success,
    ).toBe(false);

    expect(
      ragRerankingAuditSchema.safeParse({
        latencyMs: 31,
        candidatesEvaluated: 12,
        inputTokens: -1,
        estimatedCostUsd: 0,
      }).success,
    ).toBe(false);
  });
});

describe("assertValidRerankedSelection", () => {
  it("accepts a valid reordered subset when enough candidates exist to fill topK", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: CANDIDATE_IDS,
        selectedChunkIds: [CANDIDATE_IDS[2], CANDIDATE_IDS[0]],
        topK: 2,
      }),
    ).not.toThrow();
  });

  it("rejects duplicate selected chunk ids", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: CANDIDATE_IDS,
        selectedChunkIds: [CANDIDATE_IDS[0], CANDIDATE_IDS[0]],
        topK: 2,
      }),
    ).toThrow("reranked_selection_contains_duplicate_chunk_id");
  });

  it("rejects unknown selected chunk ids", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: CANDIDATE_IDS,
        selectedChunkIds: [
          CANDIDATE_IDS[0],
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ],
        topK: 2,
      }),
    ).toThrow("reranked_selection_contains_unknown_chunk_id");
  });

  it("rejects an underfilled selection when enough candidates exist", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: CANDIDATE_IDS,
        selectedChunkIds: [CANDIDATE_IDS[0]],
        topK: 2,
      }),
    ).toThrow("reranked_selection_size_mismatch");
  });

  it("rejects an oversized selection", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: CANDIDATE_IDS,
        selectedChunkIds: [
          CANDIDATE_IDS[0],
          CANDIDATE_IDS[1],
          CANDIDATE_IDS[2],
        ],
        topK: 2,
      }),
    ).toThrow("reranked_selection_size_mismatch");
  });

  it("accepts an empty selection only when the candidate set is empty", () => {
    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: [],
        selectedChunkIds: [],
        topK: 6,
      }),
    ).not.toThrow();

    expect(() =>
      assertValidRerankedSelection({
        candidateChunkIds: [],
        selectedChunkIds: [CANDIDATE_IDS[0]],
        topK: 6,
      }),
    ).toThrow("reranked_selection_contains_unknown_chunk_id");
  });
});
