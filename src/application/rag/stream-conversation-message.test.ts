import { describe, expect, it, vi } from "vitest";

import type { RagSource } from "@/domain/rag";

import { StreamConversationMessage } from "./stream-conversation-message";
import type { AnswerQuestionStreamCallbacks } from "./answer-question";
import type { AnswerQuestionResult } from "./schemas";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const TRACE_ID = "44444444-4444-4444-8444-444444444444";
const USER_CREATED_AT = new Date("2026-04-28T12:00:00.000Z");
const ASSISTANT_CREATED_AT = new Date("2026-04-28T12:00:02.000Z");

function buildSource(overrides: Partial<RagSource> = {}): RagSource {
  return {
    sourceNumber: 1,
    chunkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    documentTitle: "artigo.pdf",
    chunkIndex: 0,
    excerpt: "Trecho governado.",
    score: 0.91,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
    ...overrides,
  };
}

function buildAnsweredResult(
  overrides: Partial<
    Extract<AnswerQuestionResult, { kind: "answered" }>
  > = {},
): Extract<AnswerQuestionResult, { kind: "answered" }> {
  return {
    kind: "answered",
    status: "answered",
    traceId: TRACE_ID,
    answer: "Resposta em stream [1].",
    mode: "global",
    sources: [buildSource()],
    relatedTerms: [],
    metadata: {
      mode: "global",
      documentId: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: "f10-streaming-v1",
      generationModel: "gpt-4.1-mini",
      embeddingModel: "text-embedding-3-large",
      rerankerProvider: null,
      rerankerModel: null,
    },
    audit: {
      latencyMs: 120,
      embedding: {
        inputTokens: 14,
        estimatedCostUsd: 0.0000014,
      },
      reranking: null,
      generation: {
        inputTokens: 90,
        outputTokens: 18,
        totalTokens: 108,
        estimatedCostUsd: 0.0000625,
      },
      totalCostUsd: 0.0000639,
    },
    ...overrides,
  };
}

function createService(overrides: {
  executeStream?: (
    callbacks: AnswerQuestionStreamCallbacks,
  ) => Promise<AnswerQuestionResult>;
  initialMessages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  hydratedAssistantTraceId?: string | null;
} = {}) {
  const initialConversation = {
    id: CONVERSATION_ID,
    title: null,
    createdAt: new Date("2026-04-28T11:59:00.000Z"),
    updatedAt: new Date("2026-04-28T11:59:00.000Z"),
    lastMessageAt: null,
    messages: (overrides.initialMessages ?? []).map((message) => ({
      ...message,
      createdAt: new Date("2026-04-28T11:59:30.000Z"),
      trace: null,
    })),
  };
  const hydratedConversation = {
    ...initialConversation,
    updatedAt: ASSISTANT_CREATED_AT,
    lastMessageAt: ASSISTANT_CREATED_AT,
    messages: [
      ...initialConversation.messages,
      {
        id: USER_MESSAGE_ID,
        role: "user" as const,
        content: "Quais tecnicas aparecem?",
        createdAt: USER_CREATED_AT,
        trace: null,
      },
      {
        id: ASSISTANT_MESSAGE_ID,
        role: "assistant" as const,
        content: "Resposta em stream [1].",
        createdAt: ASSISTANT_CREATED_AT,
        trace:
          overrides.hydratedAssistantTraceId === null
            ? null
            : {
                id: overrides.hydratedAssistantTraceId ?? TRACE_ID,
                question: "Quais tecnicas aparecem?",
                answer: "Resposta em stream [1].",
                mode: "global" as const,
                documentId: null,
                status: "answered" as const,
                errorCode: null,
                sources: [
                  {
                    ...buildSource(),
                    retrievalScore: buildSource().score,
                    rerankScore: null,
                    citedInAnswer: true,
                  },
                ],
                relatedTerms: [],
                metadata: {
                  ...buildAnsweredResult().metadata,
                  rerankerProvider: null,
                  rerankerModel: null,
                },
                audit: {
                  ...buildAnsweredResult().audit,
                  reranking: null,
                },
                createdAt: ASSISTANT_CREATED_AT,
              },
      },
    ],
  };

  const conversations = {
    getDetail: vi
      .fn()
      .mockResolvedValueOnce(initialConversation)
      .mockResolvedValueOnce(hydratedConversation),
    touchLastMessageAt: vi.fn().mockResolvedValue(undefined),
    updateTitleIfUnset: vi.fn().mockResolvedValue(undefined),
  };
  const messages = {
    listPreviousVisible: vi.fn().mockResolvedValue([]),
    append: vi
      .fn()
      .mockResolvedValueOnce({
        id: USER_MESSAGE_ID,
        createdAt: USER_CREATED_AT,
      })
      .mockResolvedValueOnce({
        id: ASSISTANT_MESSAGE_ID,
        createdAt: ASSISTANT_CREATED_AT,
      }),
  };
  const answerQuestion = {
    executeStream: vi.fn().mockImplementation(
      async (_input, callbacks: AnswerQuestionStreamCallbacks) => {
        if (overrides.executeStream) {
          return overrides.executeStream(callbacks);
        }

        await callbacks.onSources?.([buildSource()]);
        await callbacks.onGenerationStart?.();
        await callbacks.onAnswerDelta?.("Resposta");
        await callbacks.onAnswerDelta?.(" em stream [1].");

        return buildAnsweredResult();
      },
    ),
  };

  return {
    service: new StreamConversationMessage({
      conversations,
      messages,
      answerQuestion,
    }),
    conversations,
    messages,
    answerQuestion,
  };
}

describe("StreamConversationMessage", () => {
  it("emits user, phase, source, delta, and done events in order and persists the assistant only on success", async () => {
    const events: string[] = [];
    const { service, messages, conversations } = createService();

    const result = await service.execute(
      {
        conversationId: CONVERSATION_ID,
        userMessageContent: "Quais tecnicas aparecem?",
      },
      {
        onEvent: async (event) => {
          events.push(event.type);
        },
      },
    );

    expect(result).toBe("completed");
    expect(events).toEqual([
      "user_message_created",
      "phase",
      "source",
      "phase",
      "answer_delta",
      "answer_delta",
      "done",
    ]);
    expect(messages.append).toHaveBeenCalledTimes(2);
    expect(messages.append).toHaveBeenNthCalledWith(2, {
      conversationId: CONVERSATION_ID,
      role: "assistant",
      content: "Resposta em stream [1].",
      traceId: TRACE_ID,
    });
    expect(conversations.touchLastMessageAt).toHaveBeenNthCalledWith(
      2,
      CONVERSATION_ID,
      ASSISTANT_CREATED_AT,
    );
  });

  it("emits done directly for a no-evidence answer without sources or deltas", async () => {
    const events: string[] = [];
    const { service, messages } = createService({
      executeStream: async () =>
        buildAnsweredResult({
          status: "answered_no_evidence",
          answer: "Nao encontrei evidencias suficientes nos documentos recuperados.",
          sources: [],
          audit: {
            latencyMs: 80,
            embedding: {
              inputTokens: 10,
              estimatedCostUsd: 0.000001,
            },
            reranking: null,
            generation: null,
            totalCostUsd: 0.000001,
          },
        }),
    });

    await service.execute(
      {
        conversationId: CONVERSATION_ID,
        userMessageContent: "Existe evidencia suficiente?",
      },
      {
        onEvent: async (event) => {
          events.push(event.type);
        },
      },
    );

    expect(events).toEqual(["user_message_created", "phase", "done"]);
    expect(messages.append).toHaveBeenCalledTimes(2);
  });

  it("emits a focused-document error and does not create an assistant row", async () => {
    const events: Array<{ type: string; status?: string }> = [];
    const { service, messages } = createService({
      executeStream: async () => ({
        kind: "focused_document_rejected",
        reason: "not_processed",
      }),
    });

    await service.execute(
      {
        conversationId: CONVERSATION_ID,
        userMessageContent: "Pergunta focada",
        mode: "focused",
        documentId: "55555555-5555-4555-8555-555555555555",
      },
      {
        onEvent: async (event) => {
          events.push(
            event.type === "error"
              ? { type: event.type, status: event.status }
              : { type: event.type },
          );
        },
      },
    );

    expect(events).toEqual([
      { type: "user_message_created" },
      { type: "phase" },
      { type: "error", status: "document_not_focusable" },
    ]);
    expect(messages.append).toHaveBeenCalledTimes(1);
  });

  it("emits a generation failure after the user message and does not create an assistant row", async () => {
    const events: Array<{ type: string; status?: string }> = [];
    const { service, messages } = createService({
      executeStream: async (callbacks) => {
        await callbacks.onSources?.([buildSource()]);
        await callbacks.onGenerationStart?.();

        return {
          kind: "error",
          error: "generation_failed",
        };
      },
    });

    await service.execute(
      {
        conversationId: CONVERSATION_ID,
        userMessageContent: "Pergunta com falha",
      },
      {
        onEvent: async (event) => {
          events.push(
            event.type === "error"
              ? { type: event.type, status: event.status }
              : { type: event.type },
          );
        },
      },
    );

    expect(events).toEqual([
      { type: "user_message_created" },
      { type: "phase" },
      { type: "source" },
      { type: "phase" },
      { type: "error", status: "generation_failed" },
    ]);
    expect(messages.append).toHaveBeenCalledTimes(1);
  });
});
