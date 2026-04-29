import { describe, expect, it } from "vitest";

import { ragAskRequestSchema } from "./schemas";

describe("ragAskRequestSchema", () => {
  it("keeps rerank unavailable on the public global ask surface until Block 04", () => {
    const result = ragAskRequestSchema.safeParse({
      question: "Quais tecnicas aparecem com mais frequencia?",
      mode: "global",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result.success).toBe(false);
  });

  it("keeps rerank unavailable on the public focused ask surface until Block 04", () => {
    const result = ragAskRequestSchema.safeParse({
      question: "Quais tecnicas aparecem com mais frequencia?",
      mode: "focused",
      documentId: "11111111-1111-4111-8111-111111111111",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result.success).toBe(false);
  });
});
