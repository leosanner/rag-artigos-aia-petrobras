import { describe, expect, it } from "vitest";

import {
  FocusedRagAskRequestSchema,
  type FocusedRagAskRequest,
} from "./focused-request";

const VALID_DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

const buildFocusedRequest = (
  overrides: Partial<FocusedRagAskRequest> = {},
): FocusedRagAskRequest => ({
  question: "Como o estudo aplica CNN a sensoriamento remoto?",
  mode: "focused",
  documentId: VALID_DOCUMENT_ID,
  ...overrides,
});

describe("FocusedRagAskRequestSchema", () => {
  it("accepts a minimal valid focused request without retrieval overrides", () => {
    const result = FocusedRagAskRequestSchema.safeParse(buildFocusedRequest());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("focused");
      expect(result.data.documentId).toBe(VALID_DOCUMENT_ID);
      expect(result.data.retrieval).toBeUndefined();
    }
  });

  it("accepts an explicit retrieval block reusing the shared retrieval contract", () => {
    const result = FocusedRagAskRequestSchema.safeParse(
      buildFocusedRequest({
        retrieval: { topK: 9, strategy: "explore" },
      }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts rerank at the shared domain-request boundary", () => {
    const result = FocusedRagAskRequestSchema.safeParse(
      buildFocusedRequest({
        retrieval: { topK: 6, strategy: "rerank" },
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID documentId", () => {
    const result = FocusedRagAskRequestSchema.safeParse(
      buildFocusedRequest({ documentId: "not-a-uuid" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a missing documentId", () => {
    const result = FocusedRagAskRequestSchema.safeParse({
      question: "Hi",
      mode: "focused",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty question", () => {
    const result = FocusedRagAskRequestSchema.safeParse(
      buildFocusedRequest({ question: "   " }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects mode values other than 'focused'", () => {
    const result = FocusedRagAskRequestSchema.safeParse({
      question: "Hi",
      mode: "global",
      documentId: VALID_DOCUMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = FocusedRagAskRequestSchema.safeParse({
      ...buildFocusedRequest(),
      conversationId: VALID_DOCUMENT_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a retrieval topK outside the shared 3..12 range", () => {
    expect(
      FocusedRagAskRequestSchema.safeParse(
        buildFocusedRequest({ retrieval: { topK: 2 } }),
      ).success,
    ).toBe(false);

    expect(
      FocusedRagAskRequestSchema.safeParse(
        buildFocusedRequest({ retrieval: { topK: 13 } }),
      ).success,
    ).toBe(false);
  });

  it("rejects a retrieval strategy outside the shared union", () => {
    const result = FocusedRagAskRequestSchema.safeParse(
      buildFocusedRequest({
        retrieval: {
          strategy: "auto" as unknown as "standard",
        },
      }),
    );

    expect(result.success).toBe(false);
  });
});
