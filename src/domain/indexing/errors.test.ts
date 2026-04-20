import { describe, expect, it } from "vitest";

import {
  INDEXING_ERROR_CODES,
  IndexingError,
  toSafeIndexingErrorCode,
} from "./errors";

describe("INDEXING_ERROR_CODES", () => {
  it("defines the closed safe indexing error catalog", () => {
    expect(INDEXING_ERROR_CODES).toEqual([
      "document_not_indexable",
      "refined_text_empty",
      "chunking_failed",
      "embedding_failed",
      "embedding_dimensions_mismatch",
      "persistence_failed",
      "unknown_error",
    ]);
  });
});

describe("IndexingError", () => {
  it("preserves its explicit safe code", () => {
    const error = new IndexingError(
      "embedding_dimensions_mismatch",
      "Provider returned 1536 dimensions",
    );

    expect(error.name).toBe("IndexingError");
    expect(error.code).toBe("embedding_dimensions_mismatch");
    expect(toSafeIndexingErrorCode(error)).toBe(
      "embedding_dimensions_mismatch",
    );
  });
});

describe("toSafeIndexingErrorCode", () => {
  it("returns unknown_error for unknown errors and arbitrary inputs", () => {
    const inputs: unknown[] = [
      new Error("OPENAI_API_KEY leaked in a stack trace"),
      { code: "embedding_failed" },
      "persistence_failed",
      null,
      undefined,
      42,
    ];

    expect(inputs.map(toSafeIndexingErrorCode)).toEqual([
      "unknown_error",
      "unknown_error",
      "unknown_error",
      "unknown_error",
      "unknown_error",
      "unknown_error",
    ]);
  });

  it("never returns raw messages or stack traces", () => {
    const rawError = new Error(
      "DATABASE_URL=postgres://secret@example OPENAI_API_KEY=sk-secret",
    );

    const safeCode = toSafeIndexingErrorCode(rawError);

    expect(safeCode).toBe("unknown_error");
    expect(safeCode).not.toContain("DATABASE_URL");
    expect(safeCode).not.toContain("OPENAI_API_KEY");
    expect(safeCode).not.toContain("sk-secret");
  });
});
