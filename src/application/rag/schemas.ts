import { z } from "zod";

import {
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  type RagSource as DomainRagSource,
  type RelatedTerm as DomainRelatedTerm,
} from "@/domain/rag";

const ragRetrievalStrategySchema = z.enum(["standard", "explore"]);

export const ragRetrievalInputSchema = z
  .object({
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K)
      .optional(),
    strategy: ragRetrievalStrategySchema.optional(),
  })
  .strict();

export const globalRagAskInputSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("global"),
    retrieval: ragRetrievalInputSchema.optional(),
  })
  .strict();

export const ragAskRequestSchema = globalRagAskInputSchema;

export type GlobalRagAskInput = z.infer<typeof globalRagAskInputSchema>;

export const ragSourceSchema: z.ZodType<DomainRagSource> = z
  .object({
    sourceNumber: z.number().int().positive(),
    chunkId: z.string().uuid(),
    documentId: z.string().uuid(),
    documentTitle: z.string().min(1),
    chunkIndex: z.number().int().nonnegative(),
    excerpt: z.string(),
    score: z.number(),
    documentPipelineVersion: z.string().min(1),
    chunkingVersion: z.string().min(1),
    embeddingModel: z.string().min(1),
  })
  .strip();

export type RagSource = z.infer<typeof ragSourceSchema>;

export const relatedTermSchema: z.ZodType<DomainRelatedTerm> = z
  .object({
    rank: z.number().int().positive(),
    term: z.string().min(1),
    ngramSize: z.number().int().positive(),
    frequency: z.number().int().positive(),
    sourceCoverageCount: z.number().int().nonnegative(),
  })
  .strip();

export type RelatedTerm = z.infer<typeof relatedTermSchema>;

export const ragAnswerMetadataSchema = z
  .object({
    mode: z.literal("global"),
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K),
    retrievalStrategy: ragRetrievalStrategySchema,
    candidateTopK: z
      .number()
      .int()
      .positive()
      .max(EXPLORE_RETRIEVAL_MAX_CANDIDATES),
    promptVersion: z.string().min(1),
    generationModel: z.string().min(1),
    embeddingModel: z.string().min(1),
  })
  .strip();

export type RagAnswerMetadata = z.infer<typeof ragAnswerMetadataSchema>;

export const embeddingUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  })
  .strip();

export type EmbeddingUsage = z.infer<typeof embeddingUsageSchema>;

export const generationUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  })
  .strip();

export type GenerationUsage = z.infer<typeof generationUsageSchema>;

export const ragAnswerAuditSchema = z
  .object({
    latencyMs: z.number().int().nonnegative(),
    embedding: embeddingUsageSchema,
    generation: generationUsageSchema.nullable(),
    totalCostUsd: z.number().nonnegative(),
  })
  .strip();

export type RagAnswerAudit = z.infer<typeof ragAnswerAuditSchema>;

export const ragAnsweredResponseSchema = z
  .object({
    answer: z.string().min(1),
    mode: z.literal("global"),
    sources: z.array(ragSourceSchema),
    metadata: ragAnswerMetadataSchema,
  })
  .strip();

export const ragAskSuccessResponseSchema = ragAnsweredResponseSchema;

export type RagAnsweredResponse = z.infer<typeof ragAnsweredResponseSchema>;

export type RagAskSuccessResponse = z.infer<typeof ragAskSuccessResponseSchema>;

export const ragInvalidRequestResponseSchema = z
  .object({
    error: z.literal("invalid_request"),
  })
  .strip();

export type RagInvalidRequestResponse = z.infer<
  typeof ragInvalidRequestResponseSchema
>;

export const ragUnauthorizedResponseSchema = z
  .object({
    error: z.literal("unauthorized"),
  })
  .strip();

export type RagUnauthorizedResponse = z.infer<
  typeof ragUnauthorizedResponseSchema
>;

export const ragGenerationErrorCodeSchema = z.enum([
  "generation_failed",
  "generation_unavailable",
]);

export type RagGenerationErrorCode = z.infer<
  typeof ragGenerationErrorCodeSchema
>;

export const ragGenerationErrorResponseSchema = z
  .object({
    error: ragGenerationErrorCodeSchema,
  })
  .strip();

export const ragGenerationFailedResponseSchema = z
  .object({
    error: z.literal("generation_failed"),
  })
  .strip();

export const ragGenerationUnavailableResponseSchema = z
  .object({
    error: z.literal("generation_unavailable"),
  })
  .strip();

export type RagGenerationErrorResponse = z.infer<
  typeof ragGenerationErrorResponseSchema
>;

export type RagGenerationFailedResponse = z.infer<
  typeof ragGenerationFailedResponseSchema
>;

export type RagGenerationUnavailableResponse = z.infer<
  typeof ragGenerationUnavailableResponseSchema
>;

export const ragAskErrorResponseSchema = z.union([
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
  ragGenerationErrorResponseSchema,
]);

export const ragAskResponseSchema = z.union([
  ragAskSuccessResponseSchema,
  ragAskErrorResponseSchema,
]);

export type RagAskErrorResponse = z.infer<typeof ragAskErrorResponseSchema>;
export type RagAskResponse = z.infer<typeof ragAskResponseSchema>;

export const answerQuestionAnsweredResultSchema = z
  .object({
    kind: z.literal("answered"),
    traceId: z.string().uuid(),
    answer: z.string().min(1),
    mode: z.literal("global"),
    sources: z.array(ragSourceSchema),
    relatedTerms: z.array(relatedTermSchema),
    metadata: ragAnswerMetadataSchema,
    audit: ragAnswerAuditSchema,
  })
  .strip();

export const answerQuestionErrorResultSchema = z
  .object({
    kind: z.literal("error"),
    error: ragGenerationErrorCodeSchema,
  })
  .strip();

export const answerQuestionResultSchema = z.discriminatedUnion("kind", [
  answerQuestionAnsweredResultSchema,
  answerQuestionErrorResultSchema,
]);

export type AnswerQuestionAnsweredResult = z.infer<
  typeof answerQuestionAnsweredResultSchema
>;
export type AnswerQuestionErrorResult = z.infer<
  typeof answerQuestionErrorResultSchema
>;
export type AnswerQuestionResult = z.infer<typeof answerQuestionResultSchema>;
