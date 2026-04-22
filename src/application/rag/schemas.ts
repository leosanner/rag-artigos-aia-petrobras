import { z } from "zod";

import type { RagSource as DomainRagSource } from "@/domain/rag";

export const globalRagAskInputSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("global"),
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

export const ragAnswerMetadataSchema = z
  .object({
    mode: z.literal("global"),
    topK: z.number().int().positive(),
    promptVersion: z.string().min(1),
    generationModel: z.string().min(1),
    embeddingModel: z.string().min(1),
  })
  .strip();

export type RagAnswerMetadata = z.infer<typeof ragAnswerMetadataSchema>;

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
    answer: z.string().min(1),
    mode: z.literal("global"),
    sources: z.array(ragSourceSchema),
    metadata: ragAnswerMetadataSchema,
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

export type AnswerQuestionResult = z.infer<typeof answerQuestionResultSchema>;
