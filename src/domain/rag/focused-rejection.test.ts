import { describe, expect, it } from "vitest";

import {
  FOCUSED_DOCUMENT_REJECTION_REASONS,
  type FocusedDocumentRejectionReason,
} from "./focused-rejection";

describe("FocusedDocumentRejectionReason", () => {
  it("exposes the closed set of safe rejection reasons", () => {
    expect(FOCUSED_DOCUMENT_REJECTION_REASONS).toEqual([
      "not_found",
      "not_processed",
      "not_indexed",
    ]);
  });

  it("admits exactly the three documented values via exhaustive narrowing", () => {
    const describeReason = (reason: FocusedDocumentRejectionReason): string => {
      switch (reason) {
        case "not_found":
          return "missing";
        case "not_processed":
          return "processing";
        case "not_indexed":
          return "indexing";
        default: {
          const exhaustive: never = reason;
          return exhaustive;
        }
      }
    };

    expect(describeReason("not_found")).toBe("missing");
    expect(describeReason("not_processed")).toBe("processing");
    expect(describeReason("not_indexed")).toBe("indexing");
  });
});
