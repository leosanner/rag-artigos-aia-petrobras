import { describe, expect, it, vi } from "vitest";

import type { AppendConversationMessage } from "@/application/rag/append-conversation-message";
import type { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import type { StreamConversationMessage } from "@/application/rag/stream-conversation-message";

import { createRagConversationMessagesHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const TRACE_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const MESSAGE_AT = new Date("2026-04-23T12:35:01.000Z");
const ASSISTANT_AT = new Date("2026-04-23T12:35:02.000Z");

function buildAppendMessage(
  result: Awaited<ReturnType<AppendConversationMessage["execute"]>>,
): Pick<AppendConversationMessage, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function buildGetConversationDetail(
  result:
    | { status: "found" }
    | { status: "not_found" } = { status: "found" },
): Pick<GetConversationDetail, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(
      result.status === "found"
        ? {
            status: "found",
            conversation: {
              id: CONVERSATION_ID,
              title: null,
              createdAt: MESSAGE_AT,
              updatedAt: MESSAGE_AT,
              lastMessageAt: null,
              messages: [],
            },
          }
        : result,
    ),
  };
}

function buildStreamMessage(
  implementation?: (
    onEvent: Parameters<StreamConversationMessage["execute"]>[1]["onEvent"],
  ) => Promise<"completed" | "not_found">,
): Pick<StreamConversationMessage, "execute"> {
  return {
    execute: vi.fn().mockImplementation(async (_input, options) => {
      if (implementation) {
        return implementation(options.onEvent);
      }

      return "completed";
    }),
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(
    `http://localhost/api/rag/conversations/${CONVERSATION_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function context(id: string = CONVERSATION_ID) {
  return {
    params: Promise.resolve({ id }),
  };
}

function postStream(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return post(body, {
    Accept: "text/event-stream",
    ...headers,
  });
}

function userMessage() {
  return {
    id: USER_MESSAGE_ID,
    role: "user" as const,
    content: "Quais tecnicas aparecem?",
    createdAt: MESSAGE_AT,
    trace: null,
  };
}

function assistantMessage() {
  return {
    id: ASSISTANT_MESSAGE_ID,
    role: "assistant" as const,
    content: "Classificacao supervisionada [1].",
    createdAt: ASSISTANT_AT,
    trace: {
      id: TRACE_ID,
      question: "Quais tecnicas aparecem?",
      answer: "Classificacao supervisionada [1].",
      mode: "global" as const,
      documentId: null,
      status: "answered" as const,
      errorCode: null,
      sources: [],
      relatedTerms: [],
      metadata: {
        mode: "global" as const,
        documentId: null,
        topK: 8,
        retrievalStrategy: "explore" as const,
        candidateTopK: 24,
        promptVersion: "f05-audit-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: 123,
        embedding: {
          inputTokens: 11,
          estimatedCostUsd: 0.000001,
        },
        reranking: null,
        generation: null,
        totalCostUsd: 0.000001,
      },
      createdAt: ASSISTANT_AT,
    },
  };
}

async function readSseEvents(response: Response) {
  const payload = await response.text();

  return payload
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines
        .find((line) => line.startsWith("event: "))
        ?.replace("event: ", "");
      const data = lines
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.replace("data: ", ""))
        .join("\n");

      return {
        event,
        data: JSON.parse(data) as Record<string, unknown>,
      };
    });
}

describe("POST /api/rag/conversations/:id/messages handler", () => {
  it("appends a user message with retrieval settings and returns the transcript slice", async () => {
    const appendMessage = buildAppendMessage({
      status: "answered",
      userMessage: userMessage(),
      assistantMessage: assistantMessage(),
    });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          content: "  Quais tecnicas aparecem?  ",
          retrievalSettings: {
            topK: 8,
            strategy: "explore",
          },
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("answered");
    expect(body.userMessage.createdAt).toBe(MESSAGE_AT.toISOString());
    expect(body.assistantMessage.trace.id).toBe(TRACE_ID);
    expect(appendMessage.execute).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      userMessageContent: "Quais tecnicas aparecem?",
      retrievalSettings: {
        topK: 8,
        strategy: "explore",
      },
      requestTraceId: expect.any(String),
    });
  });

  it("returns 401, 400, and 404 for protected, invalid, or missing conversations", async () => {
    const appendMessage = buildAppendMessage({ status: "not_found" });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const unauthorized = await handler(post({ content: "Pergunta" }), context());
    const invalidId = await handler(
      post({ content: "Pergunta" }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context("not-a-uuid"),
    );
    const invalidBody = await handler(
      post({ content: "   " }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );
    const invalidFocusedBody = await handler(
      post(
        { content: "Pergunta", mode: "focused" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );
    const notFound = await handler(
      post({ content: "Pergunta" }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );

    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "unauthorized" });
    expect(invalidId.status).toBe(400);
    expect(await invalidId.json()).toEqual({ error: "invalid_id" });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toEqual({ error: "invalid_request" });
    expect(invalidFocusedBody.status).toBe(400);
    expect(await invalidFocusedBody.json()).toEqual({ error: "invalid_request" });
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "not_found" });
  });

  it("returns 400 for malformed JSON without calling the use case", async () => {
    const appendMessage = buildAppendMessage({ status: "not_found" });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const response = await handler(
      post("{", { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(appendMessage.execute).not.toHaveBeenCalled();
  });

  it("maps safe generation failures while keeping the persisted user message", async () => {
    const failed = buildAppendMessage({
      status: "generation_failed",
      userMessage: userMessage(),
      errorCode: "generation_failed",
    });
    const unavailable = buildAppendMessage({
      status: "generation_unavailable",
      userMessage: userMessage(),
      errorCode: "generation_unavailable",
    });
    const failedHandler = createRagConversationMessagesHandler({
      appendMessage: failed,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });
    const unavailableHandler = createRagConversationMessagesHandler({
      appendMessage: unavailable,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const failedResponse = await failedHandler(
      post({ content: "Pergunta" }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );
    const unavailableResponse = await unavailableHandler(
      post({ content: "Pergunta" }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );

    expect(failedResponse.status).toBe(502);
    expect(await failedResponse.json()).toEqual({
      status: "generation_failed",
      userMessage: {
        id: USER_MESSAGE_ID,
        role: "user",
        content: "Quais tecnicas aparecem?",
        createdAt: MESSAGE_AT.toISOString(),
        trace: null,
      },
      errorCode: "generation_failed",
    });
    expect(unavailableResponse.status).toBe(503);
    expect((await unavailableResponse.json()).errorCode).toBe(
      "generation_unavailable",
    );
  });

  it("accepts a focused request body and maps a missing focused document to 404", async () => {
    const appendMessage = buildAppendMessage({
      status: "document_not_found",
      userMessage: userMessage(),
      errorCode: "document_not_found",
    });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          content: "  Quais tecnicas aparecem?  ",
          mode: "focused",
          documentId: DOCUMENT_ID,
          retrievalSettings: {
            topK: 8,
            strategy: "explore",
          },
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      status: "document_not_found",
      userMessage: {
        id: USER_MESSAGE_ID,
        role: "user",
        content: "Quais tecnicas aparecem?",
        createdAt: MESSAGE_AT.toISOString(),
        trace: null,
      },
      errorCode: "document_not_found",
    });
    expect(appendMessage.execute).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      userMessageContent: "Quais tecnicas aparecem?",
      mode: "focused",
      documentId: DOCUMENT_ID,
      retrievalSettings: {
        topK: 8,
        strategy: "explore",
      },
      requestTraceId: expect.any(String),
    });
  });

  it("maps non-focusable focused documents to 422 without changing the conversation-not-found contract", async () => {
    const appendMessage = buildAppendMessage({
      status: "document_not_focusable",
      userMessage: userMessage(),
      errorCode: "document_not_focusable",
    });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          content: "Pergunta",
          mode: "focused",
          documentId: DOCUMENT_ID,
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      status: "document_not_focusable",
      userMessage: {
        id: USER_MESSAGE_ID,
        role: "user",
        content: "Quais tecnicas aparecem?",
        createdAt: MESSAGE_AT.toISOString(),
        trace: null,
      },
      errorCode: "document_not_focusable",
    });
  });

  it("returns 500 with a sanitized body on unexpected failure and logs structured details", async () => {
    const appendMessage: Pick<AppendConversationMessage, "execute"> = {
      execute: vi.fn().mockRejectedValue(new Error("raw provider body")),
    };
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handler(
      post({ content: "Pergunta" }, { Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toBe(JSON.stringify({ error: "technical_error" }));
    expect(text).not.toContain("provider");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(payload.event).toBe("handler.append_message_failed");
    expect(payload.scope).toBe("rag");
    expect(payload.conversationId).toBe(CONVERSATION_ID);
    expect(typeof payload.requestTraceId).toBe("string");

    errorSpy.mockRestore();
  });

  it("returns an SSE stream when the client requests text/event-stream", async () => {
    const appendMessage = buildAppendMessage({
      status: "answered",
      userMessage: userMessage(),
      assistantMessage: assistantMessage(),
    });
    const getConversationDetail = buildGetConversationDetail();
    const streamMessage = buildStreamMessage(async (onEvent) => {
      await onEvent({
        type: "user_message_created",
        userMessage: userMessage(),
      });
      await onEvent({
        type: "phase",
        phase: "retrieving_sources",
      });
      await onEvent({
        type: "source",
        source: {
          sourceNumber: 1,
          chunkId: "77777777-7777-4777-8777-777777777777",
          documentId: "88888888-8888-4888-8888-888888888888",
          documentTitle: "artigo.pdf",
          chunkIndex: 0,
          excerpt: "Trecho governado",
          score: 0.91,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
        },
      });
      await onEvent({
        type: "phase",
        phase: "generating_answer",
      });
      await onEvent({
        type: "answer_delta",
        textDelta: "Classificacao",
      });
      await onEvent({
        type: "done",
        status: "answered",
        assistantMessage: assistantMessage(),
      });

      return "completed";
    });
    const handler = createRagConversationMessagesHandler({
      appendMessage,
      getConversationDetail,
      streamMessage,
      secret: VALID_SECRET,
    });

    const response = await handler(
      postStream(
        {
          content: "Quais tecnicas aparecem?",
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getConversationDetail.execute).toHaveBeenCalledWith({
      id: CONVERSATION_ID,
    });
    expect(appendMessage.execute).not.toHaveBeenCalled();
    expect(streamMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        userMessageContent: "Quais tecnicas aparecem?",
      }),
      expect.any(Object),
    );

    const events = await readSseEvents(response);

    expect(events.map((event) => event.event)).toEqual([
      "user_message_created",
      "phase",
      "source",
      "phase",
      "answer_delta",
      "done",
    ]);
    expect(events[0]?.data.type).toBe("user_message_created");
    expect(events[4]?.data).toEqual({
      type: "answer_delta",
      textDelta: "Classificacao",
    });
    expect(events[5]?.data.type).toBe("done");
  });

  it("keeps unknown conversations as a pre-stream 404 in SSE mode", async () => {
    const handler = createRagConversationMessagesHandler({
      appendMessage: buildAppendMessage({ status: "not_found" }),
      getConversationDetail: buildGetConversationDetail({ status: "not_found" }),
      streamMessage: buildStreamMessage(),
      secret: VALID_SECRET,
    });

    const response = await handler(
      postStream(
        {
          content: "Pergunta",
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("serializes safe mid-stream errors as SSE events under HTTP 200", async () => {
    const handler = createRagConversationMessagesHandler({
      appendMessage: buildAppendMessage({ status: "not_found" }),
      getConversationDetail: buildGetConversationDetail(),
      streamMessage: buildStreamMessage(async (onEvent) => {
        await onEvent({
          type: "user_message_created",
          userMessage: userMessage(),
        });
        await onEvent({
          type: "phase",
          phase: "retrieving_sources",
        });
        await onEvent({
          type: "error",
          status: "generation_unavailable",
          errorCode: "generation_unavailable",
        });

        return "completed";
      }),
      secret: VALID_SECRET,
    });

    const response = await handler(
      postStream(
        {
          content: "Pergunta",
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
      context(),
    );
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(events.map((event) => event.event)).toEqual([
      "user_message_created",
      "phase",
      "error",
    ]);
    expect(events[2]?.data).toEqual({
      type: "error",
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
    });
  });
});
