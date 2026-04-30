import { describe, expect, it, vi } from "vitest";

import type { AnswerQuestion } from "@/application/rag/answer-question";
import type { AnswerQuestionResult } from "@/application/rag/schemas";

import { createRagAskHandler } from "./handler";

const QUESTION = "Quais tecnicas aparecem com mais frequencia?";
const CHUNK_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_SECRET = "query-secret-value";
const OPENAI_API_KEY = "sk-test-super-secret";
const DATABASE_URL = "postgres://user:password@localhost:5432/app";

function buildAnsweredResult(
  overrides: Partial<Extract<AnswerQuestionResult, { kind: "answered" }>> = {},
): AnswerQuestionResult {
  return {
    kind: "answered",
    status: "answered",
    traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    answer: "As tecnicas mais citadas sao segmentacao e classificacao [1].",
    mode: "global",
    sources: [
      {
        sourceNumber: 1,
        chunkId: CHUNK_ID,
        documentId: DOCUMENT_ID,
        documentTitle: "artigo.pdf",
        chunkIndex: 0,
        excerpt: "Trecho completo do chunk recuperado para a resposta.",
        retrievalScore: 0.91,
        rerankScore: null,
        documentPipelineVersion: "documents-v1",
        chunkingVersion: "hybrid-v1-900-150",
        embeddingModel: "text-embedding-3-large",
      },
    ],
    metadata: {
      mode: "global",
      documentId: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: "f04-global-rag-v1",
      generationModel: "gpt-4.1-mini",
      embeddingModel: "text-embedding-3-large",
      rerankerProvider: null,
      rerankerModel: null,
    },
    relatedTerms: [
      {
        rank: 1,
        term: "segmentacao",
        ngramSize: 1,
        frequency: 2,
        sourceCoverageCount: 1,
      },
    ],
    audit: {
      latencyMs: 123,
      embedding: {
        inputTokens: 11,
        estimatedCostUsd: 0.00000143,
      },
      reranking: null,
      generation: {
        inputTokens: 42,
        outputTokens: 16,
        totalTokens: 58,
        estimatedCostUsd: 0.0000192,
      },
      totalCostUsd: 0.00002063,
    },
    ...overrides,
  };
}

function buildAnswerQuestion(
  implementation: AnswerQuestionResult | (() => Promise<AnswerQuestionResult>),
): Pick<AnswerQuestion, "execute"> {
  if (typeof implementation === "function") {
    return {
      execute: vi.fn(implementation),
    };
  }

  return {
    execute: vi.fn().mockResolvedValue(implementation),
  };
}

function post(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("http://localhost/api/rag/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rag/ask handler", () => {
  it("returns 200 with the validated success payload", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      traceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      answer:
        "As tecnicas mais citadas sao segmentacao e classificacao [1].",
      mode: "global",
      sources: [
        {
          sourceNumber: 1,
          chunkId: CHUNK_ID,
          documentId: DOCUMENT_ID,
          documentTitle: "artigo.pdf",
          chunkIndex: 0,
          excerpt: "Trecho completo do chunk recuperado para a resposta.",
          retrievalScore: 0.91,
          rerankScore: null,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
        },
      ],
      relatedTerms: [
        {
          rank: 1,
          term: "segmentacao",
          ngramSize: 1,
          frequency: 2,
          sourceCoverageCount: 1,
        },
      ],
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: "f04-global-rag-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: 123,
        embedding: {
          inputTokens: 11,
          estimatedCostUsd: 0.00000143,
        },
        reranking: null,
        generation: {
          inputTokens: 42,
          outputTokens: 16,
          totalTokens: 58,
          estimatedCostUsd: 0.0000192,
        },
        totalCostUsd: 0.00002063,
      },
    });
    expect(answerQuestion.execute).toHaveBeenCalledWith({
      question: QUESTION,
      mode: "global",
    });
  });

  it("returns rerank-aware metadata, audit, and split scores for a reranked global ask", async () => {
    const answerQuestion = buildAnswerQuestion(
      buildAnsweredResult({
        sources: [
          {
            sourceNumber: 1,
            chunkId: CHUNK_ID,
            documentId: DOCUMENT_ID,
            documentTitle: "artigo.pdf",
            chunkIndex: 0,
            excerpt: "Trecho completo do chunk recuperado para a resposta.",
            retrievalScore: 0.91,
            rerankScore: 0.83,
            documentPipelineVersion: "documents-v1",
            chunkingVersion: "hybrid-v1-900-150",
            embeddingModel: "text-embedding-3-large",
          },
        ],
        metadata: {
          mode: "global",
          documentId: null,
          topK: 6,
          retrievalStrategy: "rerank",
          candidateTopK: 18,
          promptVersion: "f08-rerank-v1",
          generationModel: "gpt-4.1-mini",
          embeddingModel: "text-embedding-3-large",
          rerankerProvider: "test-reranker",
          rerankerModel: "rerank-v1",
        },
        audit: {
          latencyMs: 123,
          embedding: {
            inputTokens: 11,
            estimatedCostUsd: 0.00000143,
          },
          reranking: {
            latencyMs: 41,
            candidatesEvaluated: 6,
            inputTokens: 22,
            estimatedCostUsd: 0.000031,
          },
          generation: {
            inputTokens: 42,
            outputTokens: 16,
            totalTokens: 58,
            estimatedCostUsd: 0.0000192,
          },
          totalCostUsd: 0.00005163,
        },
      }),
    );
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          question: `  ${QUESTION}  `,
          mode: "global",
          retrieval: {
            topK: 6,
            strategy: "rerank",
          },
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        sources: [
          expect.objectContaining({
            retrievalScore: 0.91,
            rerankScore: 0.83,
          }),
        ],
        metadata: expect.objectContaining({
          retrievalStrategy: "rerank",
          candidateTopK: 18,
          rerankerProvider: "test-reranker",
          rerankerModel: "rerank-v1",
        }),
        audit: expect.objectContaining({
          reranking: {
            latencyMs: 41,
            candidatesEvaluated: 6,
            inputTokens: 22,
            estimatedCostUsd: 0.000031,
          },
        }),
      }),
    );
    expect(answerQuestion.execute).toHaveBeenCalledWith({
      question: QUESTION,
      mode: "global",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });
  });

  it("accepts retrieval controls and forwards only the validated input to the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          question: `  ${QUESTION}  `,
          mode: "global",
          retrieval: {
            topK: 9,
            strategy: "explore",
          },
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(200);
    expect(answerQuestion.execute).toHaveBeenCalledWith({
      question: QUESTION,
      mode: "global",
      retrieval: {
        topK: 9,
        strategy: "explore",
      },
    });
  });

  it("accepts focused requests and forwards the validated document scope to the service", async () => {
    const answerQuestion = buildAnswerQuestion(
      buildAnsweredResult({
        mode: "focused",
        metadata: {
          mode: "focused",
          documentId: DOCUMENT_ID,
          topK: 6,
          retrievalStrategy: "standard",
          candidateTopK: 6,
          promptVersion: "f04-global-rag-v1",
          generationModel: "gpt-4.1-mini",
          embeddingModel: "text-embedding-3-large",
          rerankerProvider: null,
          rerankerModel: null,
        },
      }),
    );
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        {
          question: `  ${QUESTION}  `,
          mode: "focused",
          documentId: DOCUMENT_ID,
          retrieval: {
            topK: 9,
            strategy: "explore",
          },
        },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        mode: "focused",
        metadata: expect.objectContaining({
          mode: "focused",
          documentId: DOCUMENT_ID,
          topK: 6,
        }),
      }),
    );
    expect(answerQuestion.execute).toHaveBeenCalledWith({
      question: QUESTION,
      mode: "focused",
      documentId: DOCUMENT_ID,
      retrieval: {
        topK: 9,
        strategy: "explore",
      },
    });
  });

  it("returns 400 for malformed JSON without calling the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      new Request("http://localhost/api/rag/ask", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_SECRET}`,
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid parsed bodies without calling the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const blankQuestion = await handler(
      post(
        { question: "   ", mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const invalidShape = await handler(
      post(
        { question: QUESTION, mode: "focused" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const invalidFocusedId = await handler(
      post(
        { question: QUESTION, mode: "focused", documentId: "not-a-uuid" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const extraField = await handler(
      post(
        { question: QUESTION, mode: "global", ignored: true },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(blankQuestion.status).toBe(400);
    expect(await blankQuestion.json()).toEqual({ error: "invalid_request" });
    expect(invalidShape.status).toBe(400);
    expect(await invalidShape.json()).toEqual({ error: "invalid_request" });
    expect(invalidFocusedId.status).toBe(400);
    expect(await invalidFocusedId.json()).toEqual({ error: "invalid_request" });
    expect(extraField.status).toBe(400);
    expect(await extraField.json()).toEqual({ error: "invalid_request" });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it.each([
    ["topK below the allowed range", { retrieval: { topK: 2 } }],
    ["topK above the allowed range", { retrieval: { topK: 13 } }],
    ["non-integer topK", { retrieval: { topK: 6.5 } }],
    ["invalid strategy", { retrieval: { strategy: "auto" } }],
    [
      "unknown retrieval fields",
      { retrieval: { topK: 6, strategy: "standard", ignored: true } },
    ],
  ])(
    "returns 400 for invalid retrieval controls: %s",
    async (_name, bodyOverride) => {
      const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
      const handler = createRagAskHandler({
        answerQuestion,
        secret: VALID_SECRET,
      });

      const response = await handler(
        post(
          {
            question: QUESTION,
            mode: "global",
            ...bodyOverride,
          },
          { Authorization: `Bearer ${VALID_SECRET}` },
        ),
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "invalid_request" });
      expect(answerQuestion.execute).not.toHaveBeenCalled();
    },
  );

  it("returns 401 when the bearer secret is missing or wrong and never calls the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const missingSecret = await handler(post({ question: QUESTION, mode: "global" }));
    const wrongSecret = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: "Bearer wrong-secret" },
      ),
    );

    expect(missingSecret.status).toBe(401);
    expect(missingSecret.headers.get("Cache-Control")).toBe("no-store");
    expect(await missingSecret.json()).toEqual({ error: "unauthorized" });
    expect(wrongSecret.status).toBe(401);
    expect(await wrongSecret.json()).toEqual({ error: "unauthorized" });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it("maps generation_failed to 502 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "generation_failed",
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "generation_failed" });
    expect(body).not.toHaveProperty("sources");
  });

  it("maps a focused not_found rejection to 404 with a sanitized code", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "focused_document_rejected",
      reason: "not_found",
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "focused", documentId: DOCUMENT_ID },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "document_not_found" });
  });

  it.each(["not_processed", "not_indexed"] as const)(
    "maps a focused %s rejection to 422 with the sanitized focusable code",
    async (reason) => {
      const answerQuestion = buildAnswerQuestion({
        kind: "focused_document_rejected",
        reason,
      });
      const handler = createRagAskHandler({
        answerQuestion,
        secret: VALID_SECRET,
      });

      const response = await handler(
        post(
          { question: QUESTION, mode: "focused", documentId: DOCUMENT_ID },
          { Authorization: `Bearer ${VALID_SECRET}` },
        ),
      );

      expect(response.status).toBe(422);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "document_not_focusable" });
    },
  );

  it("maps generation_unavailable to 503 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "generation_unavailable",
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "generation_unavailable" });
    expect(body).not.toHaveProperty("sources");
  });

  it("maps reranking_failed to 502 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "reranking_failed",
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "reranking_failed" });
    expect(body).not.toHaveProperty("sources");
  });

  it("maps reranking_unavailable to 503 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "reranking_unavailable",
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "reranking_unavailable" });
    expect(body).not.toHaveProperty("sources");
  });

  it("sanitizes unexpected failures to technical_error", async () => {
    const answerQuestion = buildAnswerQuestion(async () => {
      throw new Error(
        `raw provider error OPENAI_API_KEY=${OPENAI_API_KEY} DATABASE_URL=${DATABASE_URL}`,
      );
    });
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );
    const bodyText = await response.clone().text();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "technical_error" });
    expect(bodyText).not.toContain(OPENAI_API_KEY);
    expect(bodyText).not.toContain(DATABASE_URL);
    expect(bodyText).not.toContain("raw provider error");
  });

  it("maps invalid application result payloads to technical_error", async () => {
    const answerQuestion = {
      execute: vi.fn().mockResolvedValue({
        kind: "answered",
        answer: "Resposta sem metadata valida",
        mode: "global",
        sources: [],
      }),
    } as unknown as Pick<AnswerQuestion, "execute">;
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "technical_error" });
  });

  it("does not leak the configured query secret in any response body", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({
      answerQuestion,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { question: QUESTION, mode: "global" },
        { Authorization: "Bearer wrong-secret" },
      ),
    );
    const bodyText = await response.clone().text();

    expect(response.status).toBe(401);
    expect(bodyText).not.toContain(VALID_SECRET);
  });
});
