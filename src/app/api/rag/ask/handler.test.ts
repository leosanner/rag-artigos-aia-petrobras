import { describe, expect, it, vi } from "vitest";

import type { AnswerQuestion } from "@/application/rag/answer-question";
import type { AnswerQuestionResult } from "@/application/rag/schemas";

import { createRagAskHandler } from "./handler";

const QUESTION = "Quais tecnicas aparecem com mais frequencia?";
const CHUNK_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const OPENAI_API_KEY = "sk-test-super-secret";
const DATABASE_URL = "postgres://user:password@localhost:5432/app";

function buildAnsweredResult(): AnswerQuestionResult {
  return {
    kind: "answered",
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
        score: 0.91,
        documentPipelineVersion: "documents-v1",
        chunkingVersion: "hybrid-v1-900-150",
        embeddingModel: "text-embedding-3-large",
      },
    ],
    metadata: {
      mode: "global",
      topK: 6,
      promptVersion: "f03-global-rag-v1",
      generationModel: "gpt-4.1-mini",
      embeddingModel: "text-embedding-3-large",
    },
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

function post(body: unknown): Request {
  return new Request("http://localhost/api/rag/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function malformedJson(body: string): Request {
  return new Request("http://localhost/api/rag/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
}

describe("POST /api/rag/ask handler", () => {
  it("returns 200 with the validated success payload", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(post({ question: QUESTION, mode: "global" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
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
          score: 0.91,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
        },
      ],
      metadata: {
        mode: "global",
        topK: 6,
        promptVersion: "f03-global-rag-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
      },
    });
    expect(answerQuestion.execute).toHaveBeenCalledWith({
      question: QUESTION,
      mode: "global",
    });
  });

  it("returns 400 for malformed JSON without calling the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(malformedJson("{"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid parsed bodies without calling the service", async () => {
    const answerQuestion = buildAnswerQuestion(buildAnsweredResult());
    const handler = createRagAskHandler({ answerQuestion });

    const blankQuestion = await handler(
      post({ question: "   ", mode: "global" }),
    );
    const invalidShape = await handler(
      post({ question: QUESTION, mode: "focused" }),
    );
    const extraField = await handler(
      post({ question: QUESTION, mode: "global", ignored: true }),
    );

    expect(blankQuestion.status).toBe(400);
    expect(await blankQuestion.json()).toEqual({ error: "invalid_request" });
    expect(invalidShape.status).toBe(400);
    expect(await invalidShape.json()).toEqual({ error: "invalid_request" });
    expect(extraField.status).toBe(400);
    expect(await extraField.json()).toEqual({ error: "invalid_request" });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it("maps generation_failed to 502 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "generation_failed",
    });
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(post({ question: QUESTION, mode: "global" }));
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "generation_failed" });
    expect(body).not.toHaveProperty("sources");
  });

  it("maps generation_unavailable to 503 without exposing sources", async () => {
    const answerQuestion = buildAnswerQuestion({
      kind: "error",
      error: "generation_unavailable",
    });
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(post({ question: QUESTION, mode: "global" }));
    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "generation_unavailable" });
    expect(body).not.toHaveProperty("sources");
  });

  it("sanitizes unexpected failures to generation_unavailable", async () => {
    const answerQuestion = buildAnswerQuestion(async () => {
      throw new Error(
        `raw provider error OPENAI_API_KEY=${OPENAI_API_KEY} DATABASE_URL=${DATABASE_URL}`,
      );
    });
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(post({ question: QUESTION, mode: "global" }));
    const bodyText = await response.clone().text();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "generation_unavailable" });
    expect(bodyText).not.toContain(OPENAI_API_KEY);
    expect(bodyText).not.toContain(DATABASE_URL);
    expect(bodyText).not.toContain("raw provider error");
  });

  it("maps invalid application result payloads to generation_failed", async () => {
    const answerQuestion = {
      execute: vi.fn().mockResolvedValue({
        kind: "answered",
        answer: "Resposta sem metadata valida",
        mode: "global",
        sources: [],
      }),
    } as unknown as Pick<AnswerQuestion, "execute">;
    const handler = createRagAskHandler({ answerQuestion });

    const response = await handler(post({ question: QUESTION, mode: "global" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "generation_failed" });
  });
});
