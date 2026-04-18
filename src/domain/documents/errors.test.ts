import { describe, expect, it } from "vitest";

import {
  IngestionError,
  type IngestionErrorCode,
  toSafeErrorCode,
} from "./errors";

describe("IngestionError", () => {
  it("preserves the code and the human-readable message", () => {
    const error = new IngestionError("refined_text_empty", "refined text was empty");

    expect(error.code).toBe("refined_text_empty");
    expect(error.message).toBe("refined text was empty");
  });

  it("is an instance of Error so standard catch blocks handle it", () => {
    const error = new IngestionError("unknown_error", "boom");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(IngestionError);
  });

  it("exposes a stable name so logs can discriminate it", () => {
    const error = new IngestionError("refined_text_empty", "x");

    expect(error.name).toBe("IngestionError");
  });
});

describe("toSafeErrorCode", () => {
  it("returns the code from an IngestionError", () => {
    const error = new IngestionError("refined_text_empty", "x");

    expect(toSafeErrorCode(error)).toBe("refined_text_empty");
  });

  it("returns 'unknown_error' for a plain Error and never leaks its message", () => {
    const secret = "postgres://user:pass@host/db";
    const error = new Error(secret);

    const code = toSafeErrorCode(error);

    expect(code).toBe("unknown_error");
    expect(code).not.toContain(secret);
    expect(code).not.toContain("postgres://");
  });

  it("returns 'unknown_error' for non-Error primitives and objects", () => {
    const cases: ReadonlyArray<unknown> = [
      undefined,
      null,
      "boom",
      42,
      {},
      { code: "refined_text_empty" },
      [],
    ];

    for (const value of cases) {
      expect(toSafeErrorCode(value)).toBe("unknown_error");
    }
  });

  it("never returns a code outside the closed IngestionErrorCode union", () => {
    const validCodes: ReadonlyArray<IngestionErrorCode> = [
      "drive_download_failed",
      "raw_text_empty",
      "extraction_failed",
      "refined_text_empty",
      "refinement_failed",
      "unknown_error",
    ];
    const samples: ReadonlyArray<unknown> = [
      new IngestionError("drive_download_failed", "x"),
      new IngestionError("refined_text_empty", "x"),
      new Error("boom"),
      "not-an-error",
      undefined,
    ];

    for (const sample of samples) {
      expect(validCodes).toContain(toSafeErrorCode(sample));
    }
  });
});
