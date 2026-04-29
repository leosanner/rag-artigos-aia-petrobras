import { describe, expect, it, vi } from "vitest";

import type { GetConversationDetail } from "@/application/rag/get-conversation-detail";

import { createRagConversationDetailHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const TRACE_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-04-23T12:34:56.000Z");
const UPDATED_AT = new Date("2026-04-23T12:35:00.000Z");
const MESSAGE_AT = new Date("2026-04-23T12:35:01.000Z");

function buildGetConversationDetail(
  result: Awaited<ReturnType<GetConversationDetail["execute"]>>,
): Pick<GetConversationDetail, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function get(headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/rag/conversations/${CONVERSATION_ID}`, {
    method: "GET",
    headers,
  });
}

function context(id: string = CONVERSATION_ID) {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("GET /api/rag/conversations/:id handler", () => {
  it("returns one conversation with ordered messages and hydrated safe traces", async () => {
    const getConversation = buildGetConversationDetail({
      status: "found",
      conversation: {
        id: CONVERSATION_ID,
        title: "Impactos ambientais",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        lastMessageAt: MESSAGE_AT,
        messages: [
          {
            id: USER_MESSAGE_ID,
            role: "user",
            content: "Quais tecnicas aparecem?",
            createdAt: MESSAGE_AT,
            trace: null,
          },
          {
            id: ASSISTANT_MESSAGE_ID,
            role: "assistant",
            content: "Classificacao supervisionada [1].",
            createdAt: new Date("2026-04-23T12:35:02.000Z"),
            trace: {
              id: TRACE_ID,
              question: "Quais tecnicas aparecem?",
              answer: "Classificacao supervisionada [1].",
              mode: "global",
              documentId: null,
              status: "answered",
              errorCode: null,
              sources: [
                {
                  sourceNumber: 1,
                  chunkId: "55555555-5555-4555-8555-555555555555",
                  documentId: "66666666-6666-4666-8666-666666666666",
                  documentTitle: "artigo.pdf",
                  chunkIndex: 0,
                  excerpt: "Trecho recuperado.",
                  retrievalScore: 0.91,
                  rerankScore: null,
                  documentPipelineVersion: "documents-v1",
                  chunkingVersion: "hybrid-v1-900-150",
                  embeddingModel: "text-embedding-3-large",
                  citedInAnswer: true,
                },
              ],
              relatedTerms: [],
              metadata: {
                mode: "global",
                documentId: null,
                topK: 6,
                retrievalStrategy: "standard",
                candidateTopK: 6,
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
              createdAt: new Date("2026-04-23T12:35:02.000Z"),
            },
          },
        ],
      },
    });
    const handler = createRagConversationDetailHandler({
      getConversation,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.id).toBe(CONVERSATION_ID);
    expect(body.createdAt).toBe(CREATED_AT.toISOString());
    expect(body.messages[0]).toEqual({
      id: USER_MESSAGE_ID,
      role: "user",
      content: "Quais tecnicas aparecem?",
      createdAt: MESSAGE_AT.toISOString(),
      trace: null,
    });
    expect(body.messages[1].trace.id).toBe(TRACE_ID);
    expect(body.messages[1].trace.createdAt).toBe(
      "2026-04-23T12:35:02.000Z",
    );
    expect(JSON.stringify(body)).not.toContain("OPENAI_API_KEY");
    expect(getConversation.execute).toHaveBeenCalledWith({ id: CONVERSATION_ID });
  });

  it("returns 401 before validating route params", async () => {
    const getConversation = buildGetConversationDetail({ status: "not_found" });
    const handler = createRagConversationDetailHandler({
      getConversation,
      secret: VALID_SECRET,
    });

    const response = await handler(get(), context("not-a-uuid"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(getConversation.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid ids and 404 for unknown conversations", async () => {
    const getConversation = buildGetConversationDetail({ status: "not_found" });
    const handler = createRagConversationDetailHandler({
      getConversation,
      secret: VALID_SECRET,
    });

    const invalid = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
      context("not-a-uuid"),
    );
    const missing = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "invalid_id" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
  });

  it("returns 500 with a sanitized body on unexpected failure", async () => {
    const getConversation: Pick<GetConversationDetail, "execute"> = {
      execute: vi.fn().mockRejectedValue(new Error("providerPayload secret")),
    };
    const handler = createRagConversationDetailHandler({
      getConversation,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
      context(),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toBe(JSON.stringify({ error: "technical_error" }));
    expect(text).not.toContain("providerPayload");
  });
});
