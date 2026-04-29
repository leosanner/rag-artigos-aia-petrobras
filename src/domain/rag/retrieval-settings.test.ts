import { describe, expect, it } from "vitest";

import {
  DEFAULT_RAG_RETRIEVAL_SETTINGS,
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  RagRetrievalSettingsSchema,
  RagRetrievalStrategySchema,
  getCandidateTopK,
  normalizeRetrievalSettings,
} from "./retrieval-settings";

describe("RagRetrievalStrategySchema", () => {
  it("accepts the closed retrieval-strategy catalog including rerank", () => {
    expect(RagRetrievalStrategySchema.safeParse("standard").success).toBe(true);
    expect(RagRetrievalStrategySchema.safeParse("explore").success).toBe(true);
    expect(RagRetrievalStrategySchema.safeParse("rerank").success).toBe(true);
    expect(RagRetrievalStrategySchema.safeParse("auto").success).toBe(false);
  });
});

describe("normalizeRetrievalSettings", () => {
  it("defaults omitted retrieval controls to the standard global RAG baseline", () => {
    expect(normalizeRetrievalSettings()).toEqual({
      topK: 6,
      strategy: "standard",
    });
    expect(normalizeRetrievalSettings({})).toEqual(
      DEFAULT_RAG_RETRIEVAL_SETTINGS,
    );
  });

  it("preserves an explicit topK and defaults only the omitted strategy", () => {
    expect(normalizeRetrievalSettings({ topK: 9 })).toEqual({
      topK: 9,
      strategy: "standard",
    });
  });

  it("preserves an explicit strategy and defaults only the omitted topK", () => {
    expect(normalizeRetrievalSettings({ strategy: "explore" })).toEqual({
      topK: 6,
      strategy: "explore",
    });
  });

  it("preserves explicit retrieval settings", () => {
    expect(
      normalizeRetrievalSettings({
        topK: 12,
        strategy: "explore",
      }),
    ).toEqual({
      topK: 12,
      strategy: "explore",
    });
  });

  it("preserves rerank as an explicit retrieval strategy", () => {
    expect(
      normalizeRetrievalSettings({
        topK: 8,
        strategy: "rerank",
      }),
    ).toEqual({
      topK: 8,
      strategy: "rerank",
    });
  });
});

describe("RagRetrievalSettingsSchema", () => {
  it("accepts rerank within the shared retrieval settings contract", () => {
    const result = RagRetrievalSettingsSchema.safeParse({
      topK: 6,
      strategy: "rerank",
    });

    expect(result.success).toBe(true);
  });
});

describe("getCandidateTopK", () => {
  it("returns the requested topK for standard retrieval", () => {
    expect(getCandidateTopK({ topK: 3, strategy: "standard" })).toBe(3);
    expect(getCandidateTopK({ topK: 12, strategy: "standard" })).toBe(12);
  });

  it("expands explore retrieval to three times topK", () => {
    expect(getCandidateTopK({ topK: 3, strategy: "explore" })).toBe(9);
    expect(getCandidateTopK({ topK: 6, strategy: "explore" })).toBe(18);
  });

  it("caps explore candidates at the domain maximum", () => {
    expect(getCandidateTopK({ topK: 9, strategy: "explore" })).toBe(
      EXPLORE_RETRIEVAL_MAX_CANDIDATES,
    );
    expect(getCandidateTopK({ topK: 12, strategy: "explore" })).toBe(
      EXPLORE_RETRIEVAL_MAX_CANDIDATES,
    );
  });

  it("applies the same bounded candidate expansion to rerank", () => {
    expect(getCandidateTopK({ topK: 3, strategy: "rerank" })).toBe(9);
    expect(getCandidateTopK({ topK: 6, strategy: "rerank" })).toBe(18);
    expect(getCandidateTopK({ topK: 9, strategy: "rerank" })).toBe(
      EXPLORE_RETRIEVAL_MAX_CANDIDATES,
    );
  });
});
