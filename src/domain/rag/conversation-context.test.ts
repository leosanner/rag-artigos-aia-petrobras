import { describe, expect, it } from "vitest";

import {
  CONVERSATION_CONTEXT_MAX_PREDECESSORS,
  CONVERSATION_ROLE_LABELS,
  buildConversationRetrievalContext,
  type ConversationMessageForContext,
} from "./conversation-context";

describe("buildConversationRetrievalContext", () => {
  it("returns only the newest user segment when no predecessors are provided", () => {
    const result = buildConversationRetrievalContext({
      latestUserMessage: "O que é AIA?",
      previousStoredMessages: [],
    });

    expect(result).toBe("User: O que é AIA?");
  });

  it("preserves display order and labels for 1-to-4 predecessors", () => {
    const previous: ConversationMessageForContext[] = [
      { role: "user", content: "Olá" },
      { role: "assistant", content: "Oi, como posso ajudar?" },
      { role: "user", content: "Fale sobre AIA" },
      { role: "assistant", content: "AIA é ..." },
    ];

    const result = buildConversationRetrievalContext({
      latestUserMessage: "E sobre sensoriamento remoto?",
      previousStoredMessages: previous,
    });

    expect(result).toBe(
      [
        "User: Olá",
        "Assistant: Oi, como posso ajudar?",
        "User: Fale sobre AIA",
        "Assistant: AIA é ...",
        "User: E sobre sensoriamento remoto?",
      ].join("\n\n"),
    );
  });

  it("keeps only the last four predecessors when more than four are provided", () => {
    const previous: ConversationMessageForContext[] = [
      { role: "user", content: "m1" },
      { role: "assistant", content: "m2" },
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
      { role: "assistant", content: "m6" },
    ];

    const result = buildConversationRetrievalContext({
      latestUserMessage: "final",
      previousStoredMessages: previous,
    });

    expect(result).not.toContain("m1");
    expect(result).not.toContain("m2");
    expect(result).toBe(
      [
        "User: m3",
        "Assistant: m4",
        "User: m5",
        "Assistant: m6",
        "User: final",
      ].join("\n\n"),
    );
  });

  it("always ends with the newest user message as the last segment", () => {
    const previous: ConversationMessageForContext[] = [
      { role: "assistant", content: "prev" },
    ];

    const result = buildConversationRetrievalContext({
      latestUserMessage: "newest",
      previousStoredMessages: previous,
    });

    expect(result.endsWith("User: newest")).toBe(true);
  });

  it("does not mutate the input array", () => {
    const previous: ConversationMessageForContext[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
      { role: "user", content: "e" },
    ];
    const snapshot = previous.map((m) => ({ ...m }));

    buildConversationRetrievalContext({
      latestUserMessage: "z",
      previousStoredMessages: previous,
    });

    expect(previous).toEqual(snapshot);
  });

  it("is deterministic for equal inputs", () => {
    const input = {
      latestUserMessage: "repita",
      previousStoredMessages: [
        { role: "user", content: "alpha" },
        { role: "assistant", content: "beta" },
      ] satisfies ConversationMessageForContext[],
    };

    expect(buildConversationRetrievalContext(input)).toBe(
      buildConversationRetrievalContext(input),
    );
  });

  it("exposes stable role labels and the predecessor cap as constants", () => {
    expect(CONVERSATION_ROLE_LABELS.user).toBe("User:");
    expect(CONVERSATION_ROLE_LABELS.assistant).toBe("Assistant:");
    expect(CONVERSATION_CONTEXT_MAX_PREDECESSORS).toBe(4);
  });
});
