import { z } from "zod";

export const indexingErrorCodeSchema = z.enum([
  "document_not_indexable",
  "refined_text_empty",
  "chunking_failed",
  "embedding_failed",
  "embedding_dimensions_mismatch",
  "persistence_failed",
  "unknown_error",
]);

export const indexingRunStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const indexingRunItemStatusSchema = z.enum([
  "processing",
  "processed",
  "failed",
]);

export const indexingStartRequestSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    force: z.boolean().optional().default(false),
  })
  .strip();

export type IndexingStartRequest = z.infer<typeof indexingStartRequestSchema>;

export const indexingQueuedResponseSchema = z
  .object({
    runId: z.string().uuid(),
    status: z.literal("queued"),
    documentId: z.string().uuid().nullable(),
    force: z.boolean(),
  })
  .strip();

export type IndexingQueuedResponse = z.infer<
  typeof indexingQueuedResponseSchema
>;

export const indexingConflictResponseSchema = z
  .object({
    activeRunId: z.string().uuid().nullable(),
  })
  .strip();

export const indexingUnauthorizedResponseSchema = z
  .object({
    error: z.literal("unauthorized"),
  })
  .strip();

export const indexingInvalidRequestResponseSchema = z
  .object({
    error: z.literal("invalid_request"),
  })
  .strip();

export const indexingInvalidIdResponseSchema = z
  .object({
    error: z.literal("invalid_id"),
  })
  .strip();

export const indexingNotFoundResponseSchema = z
  .object({
    error: z.literal("not_found"),
  })
  .strip();

export const indexingRunItemResponseSchema = z
  .object({
    id: z.string().uuid(),
    documentId: z.string().uuid().nullable(),
    title: z.string().min(1),
    status: indexingRunItemStatusSchema,
    chunkCount: z.number().int().nonnegative(),
    lastError: indexingErrorCodeSchema.nullable(),
  })
  .strip();

export type IndexingRunItemResponse = z.infer<
  typeof indexingRunItemResponseSchema
>;

export const indexingRunDetailResponseSchema = z
  .object({
    id: z.string().uuid(),
    status: indexingRunStatusSchema,
    documentId: z.string().uuid().nullable(),
    force: z.boolean(),
    selectedCount: z.number().int().nonnegative(),
    processedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    lastError: indexingErrorCodeSchema.nullable(),
    items: z.array(indexingRunItemResponseSchema),
  })
  .strip();

export type IndexingRunDetailResponse = z.infer<
  typeof indexingRunDetailResponseSchema
>;

export const indexingRunIdParamSchema = z.string().uuid();
