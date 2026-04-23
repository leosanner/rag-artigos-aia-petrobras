import { describe, expect, it, vi } from "vitest";

import type { GetQueryRun } from "@/application/rag/get-query-run";

import { createRagQueryRunDetailHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const RUN_ID = "11111111-1111-4111-8111-111111111111";
const CHUNK_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = new Date("2026-04-23T12:34:56.000Z");

function buildGetRun(
  result: Awaited<ReturnType<GetQueryRun["execute"]>>,
): Pick<GetQueryRun, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

async function invoke(
  handler: ReturnType<typeof createRagQueryRunDetailHandler>,
  id: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return handler(new Request(`http://localhost/api/rag/query-runs/${id}`, {
    method: "GET",
    headers,
  }), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/rag/query-runs/:id handler", () => {
  it("returns 200 with one sanitized run detail", async () => {
    const getRun = buildGetRun({
      id: RUN_ID,
      question: "Quais tecnicas aparecem com maior frequencia?",
      answer: "Classificacao supervisionada [1].",
      mode: "global",
      status: "answered",
      errorCode: null,
      sources: [
        {
          sourceNumber: 1,
          chunkId: CHUNK_ID,
          documentId: DOCUMENT_ID,
          documentTitle: "artigo-a.pdf",
          chunkIndex: 0,
          excerpt: "Trecho persistido da fonte selecionada.",
          score: 0.91,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
          citedInAnswer: true,
        },
      ],
      relatedTerms: [
        {
          rank: 1,
          term: "classificacao supervisionada",
          ngramSize: 2,
          frequency: 3,
          sourceCoverageCount: 1,
        },
      ],
      metadata: {
        mode: "global",
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: "f05-audit-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
      },
      audit: {
        latencyMs: 432,
        embedding: {
          inputTokens: 17,
          estimatedCostUsd: 0.000002,
        },
        generation: {
          inputTokens: 120,
          outputTokens: 42,
          totalTokens: 162,
          estimatedCostUsd: 0.00048,
        },
        totalCostUsd: 0.000482,
      },
      createdAt: CREATED_AT,
    });
    const handler = createRagQueryRunDetailHandler({
      getRun,
      secret: VALID_SECRET,
    });

    const response = await invoke(handler, RUN_ID, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      id: RUN_ID,
      question: "Quais tecnicas aparecem com maior frequencia?",
      answer: "Classificacao supervisionada [1].",
      mode: "global",
      status: "answered",
      errorCode: null,
      sources: [
        {
          sourceNumber: 1,
          chunkId: CHUNK_ID,
          documentId: DOCUMENT_ID,
          documentTitle: "artigo-a.pdf",
          chunkIndex: 0,
          excerpt: "Trecho persistido da fonte selecionada.",
          score: 0.91,
          documentPipelineVersion: "documents-v1",
          chunkingVersion: "hybrid-v1-900-150",
          embeddingModel: "text-embedding-3-large",
          citedInAnswer: true,
        },
      ],
      relatedTerms: [
        {
          rank: 1,
          term: "classificacao supervisionada",
          ngramSize: 2,
          frequency: 3,
          sourceCoverageCount: 1,
        },
      ],
      metadata: {
        mode: "global",
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: "f05-audit-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
      },
      audit: {
        latencyMs: 432,
        embedding: {
          inputTokens: 17,
          estimatedCostUsd: 0.000002,
        },
        generation: {
          inputTokens: 120,
          outputTokens: 42,
          totalTokens: 162,
          estimatedCostUsd: 0.00048,
        },
        totalCostUsd: 0.000482,
      },
      createdAt: CREATED_AT.toISOString(),
    });
    expect(getRun.execute).toHaveBeenCalledWith(RUN_ID);
  });

  it("returns 401 before validating ids when the bearer secret is missing or wrong", async () => {
    const getRun = buildGetRun(null);
    const handler = createRagQueryRunDetailHandler({
      getRun,
      secret: VALID_SECRET,
    });

    const missing = await invoke(handler, "not-a-uuid");
    const wrong = await invoke(handler, RUN_ID, {
      Authorization: "Bearer wrong-secret",
    });

    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "unauthorized" });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "unauthorized" });
    expect(getRun.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid ids after authorization", async () => {
    const getRun = buildGetRun(null);
    const handler = createRagQueryRunDetailHandler({
      getRun,
      secret: VALID_SECRET,
    });

    const response = await invoke(handler, "not-a-uuid", {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_id" });
    expect(getRun.execute).not.toHaveBeenCalled();
  });

  it("returns 404 when the run does not exist", async () => {
    const getRun = buildGetRun(null);
    const handler = createRagQueryRunDetailHandler({
      getRun,
      secret: VALID_SECRET,
    });

    const response = await invoke(handler, RUN_ID, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("strips unknown fields before returning JSON", async () => {
    const getRun = buildGetRun({
      id: RUN_ID,
      question: "Quais tecnicas aparecem com maior frequencia?",
      answer: null,
      mode: "global",
      status: "generation_failed",
      errorCode: "generation_failed",
      sources: [],
      relatedTerms: [],
      metadata: {
        mode: "global",
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: "f05-audit-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
      },
      audit: {
        latencyMs: 432,
        embedding: {
          inputTokens: 17,
          estimatedCostUsd: 0.000002,
        },
        generation: null,
        totalCostUsd: 0.000002,
      },
      createdAt: CREATED_AT,
      // @ts-expect-error - extra field must not leak
      providerPayload: { raw: "secret" },
    });
    const handler = createRagQueryRunDetailHandler({
      getRun,
      secret: VALID_SECRET,
    });

    const response = await invoke(handler, RUN_ID, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });
    const text = await response.text();

    expect(text).not.toContain("providerPayload");
    expect(text).not.toContain("secret");
  });
});
