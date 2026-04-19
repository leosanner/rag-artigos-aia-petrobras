import { z } from "zod";

export const ingestionErrorCodeSchema = z.enum([
  "drive_download_failed",
  "raw_text_empty",
  "extraction_failed",
  "refined_text_empty",
  "refinement_failed",
  "unknown_error",
]);

export const ingestionRunStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const ingestionRunItemStatusSchema = z.enum([
  "processing",
  "processed",
  "failed",
]);

export const ingestionSyncQueuedResponseSchema = z
  .object({
    runId: z.string().uuid(),
    status: z.literal("queued"),
    maxDocuments: z.number().int().positive(),
  })
  .strip();

export type IngestionSyncQueuedResponse = z.infer<
  typeof ingestionSyncQueuedResponseSchema
>;

export const ingestionSyncConflictResponseSchema = z
  .object({
    activeRunId: z.string().uuid().nullable(),
  })
  .strip();

export type IngestionSyncConflictResponse = z.infer<
  typeof ingestionSyncConflictResponseSchema
>;

export const ingestionSyncUnauthorizedResponseSchema = z
  .object({
    error: z.literal("unauthorized"),
  })
  .strip();

export type IngestionSyncUnauthorizedResponse = z.infer<
  typeof ingestionSyncUnauthorizedResponseSchema
>;

export const ingestionRunInvalidIdResponseSchema = z
  .object({
    error: z.literal("invalid_id"),
  })
  .strip();

export type IngestionRunInvalidIdResponse = z.infer<
  typeof ingestionRunInvalidIdResponseSchema
>;

export const ingestionRunNotFoundResponseSchema = z
  .object({
    error: z.literal("not_found"),
  })
  .strip();

export type IngestionRunNotFoundResponse = z.infer<
  typeof ingestionRunNotFoundResponseSchema
>;

export const ingestionRunItemResponseSchema = z
  .object({
    id: z.string().uuid(),
    driveFileId: z.string().min(1),
    title: z.string().min(1),
    status: ingestionRunItemStatusSchema,
    lastError: ingestionErrorCodeSchema.nullable(),
    documentId: z.string().uuid().nullable(),
  })
  .strip();

export type IngestionRunItemResponse = z.infer<
  typeof ingestionRunItemResponseSchema
>;

export const ingestionRunDetailResponseSchema = z
  .object({
    id: z.string().uuid(),
    status: ingestionRunStatusSchema,
    maxDocuments: z.number().int().positive(),
    selectedCount: z.number().int().nonnegative(),
    processedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    skippedExistingCount: z.number().int().nonnegative(),
    lastError: ingestionErrorCodeSchema.nullable(),
    items: z.array(ingestionRunItemResponseSchema),
  })
  .strip();

export type IngestionRunDetailResponse = z.infer<
  typeof ingestionRunDetailResponseSchema
>;

export const ingestionRunIdParamSchema = z.string().uuid();
