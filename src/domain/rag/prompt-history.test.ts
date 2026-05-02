import { describe, expect, it } from "vitest";

import {
  filterPromptHistory,
  type PromptHistoryMessage,
} from "./prompt-history";
import type { RagRetrievalStrategy } from "./retrieval-settings";

type TestMessage = PromptHistoryMessage & { id: string };

const userMsg = (id: string): TestMessage => ({
  id,
  role: "user",
  content: `prompt ${id}`,
  trace: null,
});

const assistantMsg = (
  id: string,
  strategy: RagRetrievalStrategy | null,
): TestMessage => ({
  id,
  role: "assistant",
  content: `answer ${id}`,
  trace: strategy === null ? null : { strategy },
});

describe("filterPromptHistory", () => {
  it("returns empty for empty input", () => {
    expect(filterPromptHistory([])).toEqual([]);
  });

  it("preserves a history with only standard turns", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "standard"),
      userMsg("u2"),
      assistantMsg("a2", "standard"),
    ];

    expect(filterPromptHistory(messages)).toEqual(messages);
  });

  it("preserves rerank turns (rerank is not explore)", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "rerank"),
    ];

    expect(filterPromptHistory(messages)).toEqual(messages);
  });

  it("drops every turn when all are explore", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "explore"),
      userMsg("u2"),
      assistantMsg("a2", "explore"),
    ];

    expect(filterPromptHistory(messages)).toEqual([]);
  });

  it("drops only the explore pairs in an alternating history", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "standard"),
      userMsg("u2"),
      assistantMsg("a2", "explore"),
      userMsg("u3"),
      assistantMsg("a3", "rerank"),
      userMsg("u4"),
      assistantMsg("a4", "explore"),
    ];

    const result = filterPromptHistory(messages);

    expect(result.map((m) => m.id)).toEqual(["u1", "a1", "u3", "a3"]);
  });

  it("drops the trailing explore pair while keeping earlier turns", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "standard"),
      userMsg("u2"),
      assistantMsg("a2", "explore"),
    ];

    const result = filterPromptHistory(messages);

    expect(result.map((m) => m.id)).toEqual(["u1", "a1"]);
  });

  it("preserves an assistant turn whose trace is null (not classified as explore)", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", null),
    ];

    expect(filterPromptHistory(messages)).toEqual(messages);
  });

  it("preserves a trailing user message with no assistant reply yet", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "standard"),
      userMsg("u2"),
    ];

    expect(filterPromptHistory(messages).map((m) => m.id)).toEqual([
      "u1",
      "a1",
      "u2",
    ]);
  });

  it("does not mutate the input array", () => {
    const messages: TestMessage[] = [
      userMsg("u1"),
      assistantMsg("a1", "explore"),
    ];
    const snapshot = [...messages];

    filterPromptHistory(messages);

    expect(messages).toEqual(snapshot);
  });
});
