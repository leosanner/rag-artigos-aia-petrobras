import { z } from "zod";

import {
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  FOCUSED_DOCUMENT_REJECTION_REASONS,
  FocusedRagAskRequestSchema,
  RAG_QUERY_RUN_ERROR_CODES,
  RAG_QUERY_RUN_STATUSES,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  RagRetrievalSettingsSchema,
  RagRetrievalStrategySchema,
  type FocusedDocumentRejectionReason,
  type FocusedRagAskRequest,
  type RagSource as DomainRagSource,
  type RagQueryRunErrorCode as DomainRagQueryRunErrorCode,
  type RagQueryRunStatus as DomainRagQueryRunStatus,
  type RelatedTerm as DomainRelatedTerm,
} from "@/domain/rag";

const ragRetrievalStrategySchema = RagRetrievalStrategySchema;

export const ragRetrievalInputSchema = RagRetrievalSettingsSchema;

export const globalRagAskInputSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("global"),
    retrieval: ragRetrievalInputSchema.optional(),
  })
  .strict();

export const ragAskRequestSchema = z.discriminatedUnion("mode", [
  globalRagAskInputSchema,
  FocusedRagAskRequestSchema,
]);

export type RagAskRequest = z.infer<typeof ragAskRequestSchema>;
export type FocusedRagAskInput = FocusedRagAskRequest;

export type GlobalRagAskInput = z.infer<typeof globalRagAskInputSchema>;
export type AnswerQuestionConversationContext = {
  transcript: string;
};
type AnswerQuestionInputExtensions = {
  conversationContext?: AnswerQuestionConversationContext;
  requestTraceId?: string;
};
export type GlobalAnswerQuestionInput = GlobalRagAskInput &
  AnswerQuestionInputExtensions;
export type FocusedAnswerQuestionInput = FocusedRagAskRequest &
  AnswerQuestionInputExtensions;
export type AnswerQuestionInput =
  | GlobalAnswerQuestionInput
  | FocusedAnswerQuestionInput;

const ragSourceShape = {
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
} satisfies z.ZodRawShape;

export const ragSourceSchema: z.ZodType<DomainRagSource> = z
  .object(ragSourceShape)
  .strip();

export type RagSource = z.infer<typeof ragSourceSchema>;

export const ragRunSourceResponseSchema = z
  .object({
    ...ragSourceShape,
    citedInAnswer: z.boolean(),
  })
  .strip();

export type RagRunSourceResponse = z.infer<typeof ragRunSourceResponseSchema>;

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

const ragQueryRunStatusSchema: z.ZodType<DomainRagQueryRunStatus> = z.enum(
  RAG_QUERY_RUN_STATUSES,
);

const ragQueryRunErrorCodeSchema: z.ZodType<DomainRagQueryRunErrorCode> =
  z.enum(RAG_QUERY_RUN_ERROR_CODES);

export const ragAnswerMetadataSchema = z
  .object({
    mode: z.enum(["global", "focused"]),
    documentId: z.string().uuid().nullable(),
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
    mode: z.enum(["global", "focused"]),
    sources: z.array(ragSourceSchema),
    metadata: ragAnswerMetadataSchema,
  })
  .strip();

export const ragAskSuccessResponseSchema = ragAnsweredResponseSchema
  .extend({
    traceId: z.string().uuid(),
    relatedTerms: z.array(relatedTermSchema),
    audit: ragAnswerAuditSchema,
  })
  .strip();

export type RagAnsweredResponse = z.infer<typeof ragAnsweredResponseSchema>;

export type RagAskSuccessResponse = z.infer<typeof ragAskSuccessResponseSchema>;

export const ragQueryRunSummaryResponseSchema = z
  .object({
    id: z.string().uuid(),
    question: z.string().min(1),
    status: ragQueryRunStatusSchema,
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K),
    retrievalStrategy: ragRetrievalStrategySchema,
    latencyMs: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strip();

export type RagQueryRunSummaryResponse = z.infer<
  typeof ragQueryRunSummaryResponseSchema
>;

export const ragQueryRunSummariesResponseSchema = z.array(
  ragQueryRunSummaryResponseSchema,
);

export type RagQueryRunSummariesResponse = z.infer<
  typeof ragQueryRunSummariesResponseSchema
>;

export const ragQueryRunDetailResponseSchema = z
  .object({
    id: z.string().uuid(),
    question: z.string().min(1),
    answer: z.string().min(1).nullable(),
    mode: z.enum(["global", "focused"]),
    documentId: z.string().uuid().nullable(),
    status: ragQueryRunStatusSchema,
    errorCode: ragQueryRunErrorCodeSchema.nullable(),
    sources: z.array(ragRunSourceResponseSchema),
    relatedTerms: z.array(relatedTermSchema),
    metadata: ragAnswerMetadataSchema,
    audit: ragAnswerAuditSchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strip();

export type RagQueryRunDetailResponse = z.infer<
  typeof ragQueryRunDetailResponseSchema
>;

export const createConversationResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    lastMessageAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strip();

export type CreateConversationResponse = z.infer<
  typeof createConversationResponseSchema
>;

export const conversationMessageResponseSchema = z
  .object({
    id: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    trace: ragQueryRunDetailResponseSchema.nullable(),
  })
  .strip();

export type ConversationMessageResponse = z.infer<
  typeof conversationMessageResponseSchema
>;

export const conversationDetailResponseSchema =
  createConversationResponseSchema.extend({
    messages: z.array(conversationMessageResponseSchema),
  });

export type ConversationDetailResponse = z.infer<
  typeof conversationDetailResponseSchema
>;

export const appendConversationMessageRequestSchema = z
  .object({
    content: z.string().trim().min(1),
    retrievalSettings: ragRetrievalInputSchema.optional(),
  })
  .strict();

export type AppendConversationMessageRequest = z.infer<
  typeof appendConversationMessageRequestSchema
>;

export const appendConversationMessageResponseSchema = z.union([
  z
    .object({
      status: z.enum(["answered", "answered_no_evidence"]),
      userMessage: conversationMessageResponseSchema,
      assistantMessage: conversationMessageResponseSchema,
    })
    .strip(),
  z
    .object({
      status: z.enum(["generation_failed", "generation_unavailable"]),
      userMessage: conversationMessageResponseSchema,
      errorCode: z.enum(["generation_failed", "generation_unavailable"]),
    })
    .strip(),
]);

export type AppendConversationMessageResponse = z.infer<
  typeof appendConversationMessageResponseSchema
>;

export const ragQueryRunIdParamSchema = z.string().uuid();

export const conversationIdParamSchema = z.string().uuid();

export const conversationNotFoundResponseSchema = z
  .object({
    error: z.literal("not_found"),
  })
  .strip();

export type ConversationNotFoundResponse = z.infer<
  typeof conversationNotFoundResponseSchema
>;

export const ragQueryRunInvalidIdResponseSchema = z
  .object({
    error: z.literal("invalid_id"),
  })
  .strip();

export type RagQueryRunInvalidIdResponse = z.infer<
  typeof ragQueryRunInvalidIdResponseSchema
>;

export const ragQueryRunNotFoundResponseSchema = z
  .object({
    error: z.literal("not_found"),
  })
  .strip();

export type RagQueryRunNotFoundResponse = z.infer<
  typeof ragQueryRunNotFoundResponseSchema
>;

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

export const ragGenerationErrorCodeSchema = z.enum(RAG_QUERY_RUN_ERROR_CODES);

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

export const ragTechnicalErrorResponseSchema = z
  .object({
    error: z.literal("technical_error"),
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

export type RagTechnicalErrorResponse = z.infer<
  typeof ragTechnicalErrorResponseSchema
>;

export const ragAskErrorResponseSchema = z.union([
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
  ragGenerationErrorResponseSchema,
  ragTechnicalErrorResponseSchema,
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
    status: z.enum(["answered", "answered_no_evidence"]),
    traceId: z.string().uuid(),
    answer: z.string().min(1),
    mode: z.enum(["global", "focused"]),
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

export const focusedDocumentRejectionReasonSchema: z.ZodType<FocusedDocumentRejectionReason> =
  z.enum(FOCUSED_DOCUMENT_REJECTION_REASONS);

export const answerQuestionFocusedRejectionResultSchema = z
  .object({
    kind: z.literal("focused_document_rejected"),
    reason: focusedDocumentRejectionReasonSchema,
  })
  .strip();

export const answerQuestionResultSchema = z.discriminatedUnion("kind", [
  answerQuestionAnsweredResultSchema,
  answerQuestionErrorResultSchema,
  answerQuestionFocusedRejectionResultSchema,
]);

export type AnswerQuestionAnsweredResult = z.infer<
  typeof answerQuestionAnsweredResultSchema
>;
export type AnswerQuestionErrorResult = z.infer<
  typeof answerQuestionErrorResultSchema
>;
export type AnswerQuestionFocusedRejectionResult = z.infer<
  typeof answerQuestionFocusedRejectionResultSchema
>;
export type AnswerQuestionResult = z.infer<typeof answerQuestionResultSchema>;
