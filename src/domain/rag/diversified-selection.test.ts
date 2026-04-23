import { describe, expect, it } from "vitest";

import type { RetrievedChunkMatch } from "./context-assembler";
import { selectDiversifiedMatches } from "./diversified-selection";

function buildMatch(
  documentId: string,
  chunkIndex: number,
  score: number,
): RetrievedChunkMatch {
  return {
    chunkId: `${documentId.slice(0, 8)}-${chunkIndex}${chunkIndex}${chunkIndex}${chunkIndex}-4aaa-8aaa-aaaaaaaaaaaa`,
    documentId,
    documentTitle: `${documentId}.pdf`,
    chunkIndex,
    excerpt: `Excerpt ${documentId} ${chunkIndex}`,
    score,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
  };
}

const DOCUMENT_A = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_B = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_C = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_D = "44444444-4444-4444-8444-444444444444";

function selectionIds(matches: RetrievedChunkMatch[]): string[] {
  return matches.map((match) => `${match.documentId}:${match.chunkIndex}`);
}

describe("selectDiversifiedMatches", () => {
  it("returns candidates unchanged in retrieval order when count is already within topK", () => {
    const matches = [
      buildMatch(DOCUMENT_A, 0, 0.95),
      buildMatch(DOCUMENT_A, 1, 0.9),
      buildMatch(DOCUMENT_A, 2, 0.85),
    ];

    const selected = selectDiversifiedMatches({ matches, topK: 3 });

    expect(selected).toEqual(matches);
    expect(selected).not.toBe(matches);
  });

  it("is deterministic for the same score-ordered candidate list and topK", () => {
    const matches = [
      buildMatch(DOCUMENT_A, 0, 0.99),
      buildMatch(DOCUMENT_A, 1, 0.98),
      buildMatch(DOCUMENT_A, 2, 0.97),
      buildMatch(DOCUMENT_B, 0, 0.96),
      buildMatch(DOCUMENT_C, 0, 0.95),
    ];

    const first = selectDiversifiedMatches({ matches, topK: 4 });
    const second = selectDiversifiedMatches({ matches, topK: 4 });

    expect(first).toEqual(second);
  });

  it("never selects more than topK matches", () => {
    const matches = [
      buildMatch(DOCUMENT_A, 0, 0.99),
      buildMatch(DOCUMENT_A, 1, 0.98),
      buildMatch(DOCUMENT_A, 2, 0.97),
      buildMatch(DOCUMENT_B, 0, 0.96),
      buildMatch(DOCUMENT_C, 0, 0.95),
    ];

    const selected = selectDiversifiedMatches({ matches, topK: 3 });

    expect(selected).toHaveLength(3);
  });

  it("caps selection at two chunks per document while alternatives are available", () => {
    const matches = [
      buildMatch(DOCUMENT_A, 0, 0.99),
      buildMatch(DOCUMENT_A, 1, 0.98),
      buildMatch(DOCUMENT_A, 2, 0.97),
      buildMatch(DOCUMENT_B, 0, 0.96),
      buildMatch(DOCUMENT_A, 3, 0.95),
      buildMatch(DOCUMENT_C, 0, 0.94),
      buildMatch(DOCUMENT_D, 0, 0.93),
    ];

    const selected = selectDiversifiedMatches({ matches, topK: 5 });

    expect(selectionIds(selected)).toEqual([
      `${DOCUMENT_A}:0`,
      `${DOCUMENT_A}:1`,
      `${DOCUMENT_B}:0`,
      `${DOCUMENT_C}:0`,
      `${DOCUMENT_D}:0`,
    ]);
  });

  it("backfills skipped candidates by retrieval order when the cap would underfill topK", () => {
    const matches = [
      buildMatch(DOCUMENT_A, 0, 0.99),
      buildMatch(DOCUMENT_A, 1, 0.98),
      buildMatch(DOCUMENT_A, 2, 0.97),
      buildMatch(DOCUMENT_A, 3, 0.96),
      buildMatch(DOCUMENT_B, 0, 0.95),
    ];

    const selected = selectDiversifiedMatches({ matches, topK: 4 });

    expect(selectionIds(selected)).toEqual([
      `${DOCUMENT_A}:0`,
      `${DOCUMENT_A}:1`,
      `${DOCUMENT_B}:0`,
      `${DOCUMENT_A}:2`,
    ]);
  });
});
