import { z } from "zod";

import type { RetrievedChunkMatch } from "./context-assembler";

export type RagSourceScore = {
  retrievalScore: number;
  rerankScore: number | null;
};

export type FirstPassChunkMatch = Omit<RetrievedChunkMatch, "score"> & {
  retrievalScore: number;
  rerankScore: null;
};

export type RerankedChunkMatch = Omit<FirstPassChunkMatch, "rerankScore"> & {
  rerankScore: number | null;
};

export type RagRerankingMetadata = {
  rerankerProvider: string;
  rerankerModel: string;
};

export type RagRerankingAudit = {
  latencyMs: number;
  candidatesEvaluated: number;
  inputTokens: number;
  estimatedCostUsd: number;
};

export const ragSourceScoreSchema: z.ZodType<RagSourceScore> = z
  .object({
    retrievalScore: z.number(),
    rerankScore: z.number().nullable(),
  })
  .strict();

export const ragRerankingMetadataSchema: z.ZodType<RagRerankingMetadata> = z
  .object({
    rerankerProvider: z.string().min(1),
    rerankerModel: z.string().min(1),
  })
  .strict();

export const ragRerankingAuditSchema: z.ZodType<RagRerankingAudit> = z
  .object({
    latencyMs: z.number().int().nonnegative(),
    candidatesEvaluated: z.number().int().positive(),
    inputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  })
  .strict();

export function assertValidRerankedSelection(input: {
  candidateChunkIds: string[];
  selectedChunkIds: string[];
  topK: number;
}): void {
  const candidateChunkIdSet = new Set(input.candidateChunkIds);
  const selectedChunkIdSet = new Set<string>();

  for (const chunkId of input.selectedChunkIds) {
    if (selectedChunkIdSet.has(chunkId)) {
      throw new Error("reranked_selection_contains_duplicate_chunk_id");
    }

    if (!candidateChunkIdSet.has(chunkId)) {
      throw new Error("reranked_selection_contains_unknown_chunk_id");
    }

    selectedChunkIdSet.add(chunkId);
  }

  const expectedSelectionSize = Math.min(
    input.candidateChunkIds.length,
    input.topK,
  );

  if (input.selectedChunkIds.length !== expectedSelectionSize) {
    throw new Error("reranked_selection_size_mismatch");
  }
}
