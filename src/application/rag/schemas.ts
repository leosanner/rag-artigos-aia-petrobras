import { z } from "zod";

import {
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  FOCUSED_DOCUMENT_REJECTION_REASONS,
  RAG_QUERY_RUN_ERROR_CODES,
  RAG_QUERY_RUN_STATUSES,
  RAG_RETRIEVAL_MAX_TOP_K,
  RAG_RETRIEVAL_MIN_TOP_K,
  RagRetrievalStrategySchema,
  type FocusedDocumentRejectionReason,
  type RagRetrievalInput,
  type RagSource as DomainRagSource,
  type RagQueryRunErrorCode as DomainRagQueryRunErrorCode,
  type RagQueryRunStatus as DomainRagQueryRunStatus,
  type RelatedTerm as DomainRelatedTerm,
  type SelectableRagDocument as DomainSelectableRagDocument,
  SelectableRagDocumentSchema,
} from "@/domain/rag";

const ragRetrievalStrategySchema = RagRetrievalStrategySchema;

const publicAskRetrievalStrategySchema = z.enum([
  "standard",
  "explore",
  "rerank",
]);

const publicGlobalConversationRetrievalStrategySchema = z.enum([
  "standard",
  "explore",
  "rerank",
]);

const publicFocusedConversationRetrievalStrategySchema = z.enum(["standard"]);

export const ragRetrievalInputSchema = z
  .object({
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K)
      .optional(),
    strategy: publicAskRetrievalStrategySchema.optional(),
  })
  .strict();

export const conversationRagRetrievalInputSchema = z
  .object({
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K)
      .optional(),
    strategy: publicGlobalConversationRetrievalStrategySchema.optional(),
  })
  .strict();

export const focusedConversationRagRetrievalInputSchema = z
  .object({
    topK: z
      .number()
      .int()
      .min(RAG_RETRIEVAL_MIN_TOP_K)
      .max(RAG_RETRIEVAL_MAX_TOP_K)
      .optional(),
    strategy: publicFocusedConversationRetrievalStrategySchema.optional(),
  })
  .strict();

export type ConversationRagRetrievalInput = z.infer<
  typeof conversationRagRetrievalInputSchema
>;

export const globalRagAskInputSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("global"),
    retrieval: ragRetrievalInputSchema.optional(),
  })
  .strict();

const focusedRagAskInputSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("focused"),
    documentId: z.string().uuid(),
    retrieval: focusedConversationRagRetrievalInputSchema.optional(),
  })
  .strict();

export const ragAskRequestSchema = z.discriminatedUnion("mode", [
  globalRagAskInputSchema,
  focusedRagAskInputSchema,
]);

export type RagAskRequest = z.infer<typeof ragAskRequestSchema>;
export type FocusedRagAskInput = z.infer<typeof focusedRagAskInputSchema>;

export type GlobalRagAskInput = z.infer<typeof globalRagAskInputSchema>;
export type AnswerQuestionConversationContext = {
  transcript: string;
};
type AnswerQuestionInputExtensions = {
  conversationContext?: AnswerQuestionConversationContext;
  requestTraceId?: string;
};
export type GlobalAnswerQuestionInput = {
  question: string;
  mode: "global";
  retrieval?: RagRetrievalInput;
} & AnswerQuestionInputExtensions;
export type FocusedAnswerQuestionInput = {
  question: string;
  mode: "focused";
  documentId: string;
  retrieval?: z.infer<typeof conversationRagRetrievalInputSchema>;
} & AnswerQuestionInputExtensions;
export type AnswerQuestionInput =
  | GlobalAnswerQuestionInput
  | FocusedAnswerQuestionInput;

const ragAskSourceShape = {
  sourceNumber: z.number().int().positive(),
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  excerpt: z.string(),
  retrievalScore: z.number(),
  rerankScore: z.number().nullable(),
  documentPipelineVersion: z.string().min(1),
  chunkingVersion: z.string().min(1),
  embeddingModel: z.string().min(1),
} satisfies z.ZodRawShape;

export const ragSourceSchema = z.object(ragAskSourceShape).strip();

export type RagSource = z.infer<typeof ragSourceSchema>;

const ragStreamSourceShape = {
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

export const ragStreamSourceSchema: z.ZodType<DomainRagSource> = z
  .object(ragStreamSourceShape)
  .strip();

export type RagStreamSource = z.infer<typeof ragStreamSourceSchema>;

export const ragRunSourceResponseSchema = ragSourceSchema
  .extend({
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
    rerankerProvider: z.string().min(1).nullable(),
    rerankerModel: z.string().min(1).nullable(),
  })
  .strip();

export type RagAnswerMetadata = z.infer<typeof ragAnswerMetadataSchema>;

export const ragRunMetadataResponseSchema = ragAnswerMetadataSchema;

export type RagRunMetadataResponse = z.infer<
  typeof ragRunMetadataResponseSchema
>;

export const answerQuestionMetadataSchema = ragRunMetadataResponseSchema;

export type AnswerQuestionMetadata = z.infer<
  typeof answerQuestionMetadataSchema
>;

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

export const ragRerankingAuditResponseSchema = z
  .object({
    latencyMs: z.number().int().nonnegative(),
    candidatesEvaluated: z.number().int().positive(),
    inputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
  })
  .strip();

export type RagRerankingAuditResponse = z.infer<
  typeof ragRerankingAuditResponseSchema
>;

export const ragAnswerAuditSchema = z
  .object({
    latencyMs: z.number().int().nonnegative(),
    embedding: embeddingUsageSchema,
    reranking: ragRerankingAuditResponseSchema.nullable(),
    generation: generationUsageSchema.nullable(),
    totalCostUsd: z.number().nonnegative(),
  })
  .strip();

export type RagAnswerAudit = z.infer<typeof ragAnswerAuditSchema>;

export const ragRunAuditResponseSchema = ragAnswerAuditSchema;

export type RagRunAuditResponse = z.infer<typeof ragRunAuditResponseSchema>;

export const answerQuestionAuditSchema = ragRunAuditResponseSchema;

export type AnswerQuestionAudit = z.infer<typeof answerQuestionAuditSchema>;

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

export const selectableRagDocumentSchema: z.ZodType<DomainSelectableRagDocument> =
  SelectableRagDocumentSchema;

export type SelectableRagDocument = z.infer<typeof selectableRagDocumentSchema>;

export const listRagDocumentsResponseSchema = z
  .object({
    documents: z.array(selectableRagDocumentSchema),
  })
  .strip();

export type ListRagDocumentsResponse = z.infer<
  typeof listRagDocumentsResponseSchema
>;

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
    metadata: ragRunMetadataResponseSchema,
    audit: ragRunAuditResponseSchema,
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

export const appendConversationMessageGlobalRequestSchema = z
  .object({
    content: z.string().trim().min(1),
    retrievalSettings: conversationRagRetrievalInputSchema.optional(),
    mode: z.literal("global").optional(),
  })
  .strict();

export const appendConversationMessageFocusedRequestSchema = z
  .object({
    content: z.string().trim().min(1),
    retrievalSettings: focusedConversationRagRetrievalInputSchema.optional(),
    mode: z.literal("focused"),
    documentId: z.string().uuid(),
  })
  .strict();

export const appendConversationMessageRequestSchema = z.union([
  appendConversationMessageGlobalRequestSchema,
  appendConversationMessageFocusedRequestSchema,
]);

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
  z
    .object({
      status: z.literal("document_not_found"),
      userMessage: conversationMessageResponseSchema,
      errorCode: z.literal("document_not_found"),
    })
    .strip(),
  z
    .object({
      status: z.literal("document_not_focusable"),
      userMessage: conversationMessageResponseSchema,
      errorCode: z.literal("document_not_focusable"),
    })
    .strip(),
  z
    .object({
      status: z.literal("invalid_request"),
      errorCode: z.literal("strategy_not_allowed_for_focused_conversation"),
    })
    .strip(),
]);

export type AppendConversationMessageResponse = z.infer<
  typeof appendConversationMessageResponseSchema
>;

export const ragConversationStreamPhaseSchema = z.enum([
  "retrieving_sources",
  "reranking",
  "generating_answer",
]);

export type RagConversationStreamPhase = z.infer<
  typeof ragConversationStreamPhaseSchema
>;

export const ragConversationStreamErrorStatusSchema = z.enum([
  "generation_failed",
  "generation_unavailable",
  "document_not_found",
  "document_not_focusable",
  "strategy_not_allowed_for_focused_conversation",
]);

export type RagConversationStreamErrorStatus = z.infer<
  typeof ragConversationStreamErrorStatusSchema
>;

export const ragConversationStreamUserMessageCreatedEventSchema = z
  .object({
    type: z.literal("user_message_created"),
    userMessage: conversationMessageResponseSchema,
  })
  .strip();

export const ragConversationStreamPhaseEventSchema = z
  .object({
    type: z.literal("phase"),
    phase: ragConversationStreamPhaseSchema,
  })
  .strip();

export const ragConversationStreamSourceEventSchema = z
  .object({
    type: z.literal("source"),
    source: ragStreamSourceSchema,
  })
  .strip();

export const ragConversationStreamAnswerDeltaEventSchema = z
  .object({
    type: z.literal("answer_delta"),
    textDelta: z.string().min(1),
  })
  .strip();

export const ragConversationStreamRelatedTermsEventSchema = z
  .object({
    type: z.literal("related_terms"),
    terms: z.array(relatedTermSchema),
  })
  .strip();

export const ragConversationStreamDoneEventSchema = z
  .object({
    type: z.literal("done"),
    status: z.enum(["answered", "answered_no_evidence"]),
    assistantMessage: conversationMessageResponseSchema,
  })
  .strip();

export const ragConversationStreamErrorEventSchema = z
  .object({
    type: z.literal("error"),
    status: ragConversationStreamErrorStatusSchema,
    errorCode: ragConversationStreamErrorStatusSchema,
  })
  .strip();

export const ragConversationStreamEventSchema = z.discriminatedUnion("type", [
  ragConversationStreamUserMessageCreatedEventSchema,
  ragConversationStreamPhaseEventSchema,
  ragConversationStreamSourceEventSchema,
  ragConversationStreamAnswerDeltaEventSchema,
  ragConversationStreamRelatedTermsEventSchema,
  ragConversationStreamDoneEventSchema,
  ragConversationStreamErrorEventSchema,
]);

export type RagConversationStreamEvent = z.infer<
  typeof ragConversationStreamEventSchema
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

export const ragDocumentNotFoundResponseSchema = z
  .object({
    error: z.literal("document_not_found"),
  })
  .strip();

export type RagDocumentNotFoundResponse = z.infer<
  typeof ragDocumentNotFoundResponseSchema
>;

export const ragDocumentNotFocusableResponseSchema = z
  .object({
    error: z.literal("document_not_focusable"),
  })
  .strip();

export type RagDocumentNotFocusableResponse = z.infer<
  typeof ragDocumentNotFocusableResponseSchema
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

export const ragRerankingFailedResponseSchema = z
  .object({
    error: z.literal("reranking_failed"),
  })
  .strip();

export const ragRerankingUnavailableResponseSchema = z
  .object({
    error: z.literal("reranking_unavailable"),
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

export type RagRerankingFailedResponse = z.infer<
  typeof ragRerankingFailedResponseSchema
>;

export type RagRerankingUnavailableResponse = z.infer<
  typeof ragRerankingUnavailableResponseSchema
>;

export type RagTechnicalErrorResponse = z.infer<
  typeof ragTechnicalErrorResponseSchema
>;

export const ragAskErrorResponseSchema = z.union([
  ragInvalidRequestResponseSchema,
  ragUnauthorizedResponseSchema,
  ragDocumentNotFoundResponseSchema,
  ragDocumentNotFocusableResponseSchema,
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
    metadata: answerQuestionMetadataSchema,
    audit: answerQuestionAuditSchema,
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
