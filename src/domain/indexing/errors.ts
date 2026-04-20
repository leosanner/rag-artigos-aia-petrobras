export type IndexingErrorCode =
  | "document_not_indexable"
  | "refined_text_empty"
  | "chunking_failed"
  | "embedding_failed"
  | "embedding_dimensions_mismatch"
  | "persistence_failed"
  | "unknown_error";

export class IndexingError extends Error {
  readonly code: IndexingErrorCode;

  constructor(code: IndexingErrorCode, message: string) {
    super(message);
    this.name = "IndexingError";
    this.code = code;
  }
}

export function toSafeIndexingErrorCode(error: unknown): IndexingErrorCode {
  if (error instanceof IndexingError) {
    return error.code;
  }
  return "unknown_error";
}
