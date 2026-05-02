import { describe, expect, it } from "vitest";

import {
  ConversationRuleViolation,
  assertConversationDocumentImmutable,
  assertConversationModeImmutable,
  isStrategyAllowedForMode,
  type ConversationImmutableSnapshot,
} from "./conversation-rules";
import type { RagRetrievalStrategy } from "./retrieval-settings";

const DOC_A = "11111111-1111-4111-8111-111111111111";
const DOC_B = "22222222-2222-4222-8222-222222222222";

describe("isStrategyAllowedForMode", () => {
  const cases: Array<{
    mode: "global" | "focused";
    strategy: RagRetrievalStrategy;
    allowed: boolean;
  }> = [
    { mode: "global", strategy: "standard", allowed: true },
    { mode: "global", strategy: "explore", allowed: true },
    { mode: "global", strategy: "rerank", allowed: true },
    { mode: "focused", strategy: "standard", allowed: true },
    { mode: "focused", strategy: "explore", allowed: false },
    { mode: "focused", strategy: "rerank", allowed: false },
  ];

  for (const { mode, strategy, allowed } of cases) {
    it(`returns ${allowed} for mode=${mode} strategy=${strategy}`, () => {
      expect(isStrategyAllowedForMode(mode, strategy)).toBe(allowed);
    });
  }
});

describe("assertConversationModeImmutable", () => {
  it("does not throw when mode is unchanged (global)", () => {
    const snap: ConversationImmutableSnapshot = {
      mode: "global",
      documentId: null,
    };
    expect(() => assertConversationModeImmutable(snap, snap)).not.toThrow();
  });

  it("does not throw when mode is unchanged (focused)", () => {
    const snap: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };
    expect(() => assertConversationModeImmutable(snap, snap)).not.toThrow();
  });

  it("throws ConversationRuleViolation when mode changes", () => {
    const prev: ConversationImmutableSnapshot = {
      mode: "global",
      documentId: null,
    };
    const next: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };

    let caught: unknown;
    try {
      assertConversationModeImmutable(prev, next);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConversationRuleViolation);
    expect((caught as ConversationRuleViolation).code).toBe(
      "conversation_mode_immutable",
    );
  });
});

describe("assertConversationDocumentImmutable", () => {
  it("does not throw when documentId is unchanged (null)", () => {
    const snap: ConversationImmutableSnapshot = {
      mode: "global",
      documentId: null,
    };
    expect(() =>
      assertConversationDocumentImmutable(snap, snap),
    ).not.toThrow();
  });

  it("does not throw when documentId is unchanged (uuid)", () => {
    const snap: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };
    expect(() =>
      assertConversationDocumentImmutable(snap, snap),
    ).not.toThrow();
  });

  it("throws when documentId changes from null to uuid", () => {
    const prev: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: null,
    };
    const next: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };

    expect(() => assertConversationDocumentImmutable(prev, next)).toThrow(
      ConversationRuleViolation,
    );
  });

  it("throws when documentId changes from uuid to null", () => {
    const prev: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };
    const next: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: null,
    };

    expect(() => assertConversationDocumentImmutable(prev, next)).toThrow(
      ConversationRuleViolation,
    );
  });

  it("throws when documentId changes between two uuids", () => {
    const prev: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_A,
    };
    const next: ConversationImmutableSnapshot = {
      mode: "focused",
      documentId: DOC_B,
    };

    let caught: unknown;
    try {
      assertConversationDocumentImmutable(prev, next);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConversationRuleViolation);
    expect((caught as ConversationRuleViolation).code).toBe(
      "conversation_document_immutable",
    );
  });
});

describe("ConversationRuleViolation", () => {
  it("preserves the code and sets the standard error name", () => {
    const error = new ConversationRuleViolation(
      "strategy_not_allowed_for_mode",
      "focused conversations only allow standard",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ConversationRuleViolation");
    expect(error.code).toBe("strategy_not_allowed_for_mode");
    expect(error.message).toBe(
      "focused conversations only allow standard",
    );
  });
});
