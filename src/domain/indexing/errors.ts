export const INDEXING_ERROR_CODES = [
  "document_not_indexable",
  "refined_text_empty",
  "chunking_failed",
  "embedding_failed",
  "embedding_dimensions_mismatch",
  "persistence_failed",
  "unknown_error",
] as const;

export type IndexingErrorCode = (typeof INDEXING_ERROR_CODES)[number];

export class IndexingError extends Error {
  readonly code: IndexingErrorCode;

  constructor(code: IndexingErrorCode, message: string) {
    super(message);
    this.name = "IndexingError";
    this.code = isIndexingErrorCode(code) ? code : "unknown_error";
  }
}

export function toSafeIndexingErrorCode(error: unknown): IndexingErrorCode {
  if (error instanceof IndexingError && isIndexingErrorCode(error.code)) {
    return error.code;
  }
  return "unknown_error";
}

export function isIndexingErrorCode(value: unknown): value is IndexingErrorCode {
  return INDEXING_ERROR_CODES.includes(value as IndexingErrorCode);
}
