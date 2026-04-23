import { describe, expect, it } from "vitest";

import {
  DEFAULT_RAG_RETRIEVAL_SETTINGS,
  EXPLORE_RETRIEVAL_MAX_CANDIDATES,
  getCandidateTopK,
  normalizeRetrievalSettings,
} from "./retrieval-settings";

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
});
