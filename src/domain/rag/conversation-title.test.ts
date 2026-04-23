import { describe, expect, it } from "vitest";

import { deriveConversationTitle } from "./conversation-title";

describe("deriveConversationTitle", () => {
  it("returns trimmed content when under 80 characters", () => {
    expect(deriveConversationTitle("  Hello world  ")).toBe("Hello world");
  });

  it("returns exactly the first 80 characters when content exceeds the limit", () => {
    const content = "a".repeat(120);
    const result = deriveConversationTitle(content);
    expect(result).toBe("a".repeat(80));
    expect(result?.length).toBe(80);
  });

  it("truncates after trimming, not before", () => {
    const content = `   ${"b".repeat(90)}   `;
    expect(deriveConversationTitle(content)).toBe("b".repeat(80));
  });

  it("does not append ellipsis or any marker when truncating", () => {
    const content = "x".repeat(100);
    const result = deriveConversationTitle(content) ?? "";
    expect(result.endsWith("…")).toBe(false);
    expect(result.endsWith("...")).toBe(false);
  });

  it("returns null for empty input", () => {
    expect(deriveConversationTitle("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(deriveConversationTitle("   \t\n  ")).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const content = "Qual é a melhor abordagem para avaliação de impacto?";
    expect(deriveConversationTitle(content)).toBe(
      deriveConversationTitle(content),
    );
  });
});
