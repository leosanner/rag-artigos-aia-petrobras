import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GLOBAL_RAG_PROMPT_VERSION } from "@/application/rag/constants";
import { GetQueryRun } from "@/application/rag/get-query-run";
import { AnswerQuestion } from "@/application/rag/answer-question";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import type {
  GenerationProvider,
  QuestionEmbeddingProvider,
  RerankingProvider,
} from "@/application/rag/ports";
import {
  ragAskSuccessResponseSchema,
  ragQueryRunDetailResponseSchema,
  type RagAskSuccessResponse,
  type RagQueryRunDetailResponse,
} from "@/application/rag/schemas";
import { buildNoEvidenceAnswer } from "@/domain/rag";
import { documentChunks, documents, ragQueryRuns } from "@/db/schema";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { createRagAskHandler } from "./ask/handler";
import { createRagQueryRunDetailHandler } from "./query-runs/[id]/handler";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const SECRET = "f08-rerank-integration-secret";
const EMBEDDING_MODEL = "text-embedding-3-large";
const GENERATION_MODEL = "gpt-4.1-mini";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const PIPELINE_VERSION = "f08-rerank-test";
const EMBEDDING_DIMENSIONS = 3072;
const ZERO_EMBEDDING = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);

const DOC_A = "11111111-1111-4111-8111-111111111111";
const DOC_B = "22222222-2222-4222-8222-222222222222";

async function seedFixtures(db: TestDatabase): Promise<void> {
  await db.insert(documents).values([
    {
      id: DOC_A,
      title: "artigo-a.pdf",
      driveFileId: `drive-${DOC_A}`,
      fileHash: `hash-${DOC_A}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "processed",
      rawText: "raw a",
      refinedText: "refined a",
    },
    {
      id: DOC_B,
      title: "artigo-b.pdf",
      driveFileId: `drive-${DOC_B}`,
      fileHash: `hash-${DOC_B}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "processed",
      rawText: "raw b",
      refinedText: "refined b",
    },
  ]);

  await db.insert(documentChunks).values([
    {
      documentId: DOC_A,
      chunkIndex: 0,
      content: "Chunk A0 fala de classificacao supervisionada.",
      contentHash: `hash-${DOC_A}-0`,
      estimatedTokens: 7,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
    {
      documentId: DOC_A,
      chunkIndex: 1,
      content: "Chunk A1 aprofunda segmentacao semantica.",
      contentHash: `hash-${DOC_A}-1`,
      estimatedTokens: 7,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
    {
      documentId: DOC_B,
      chunkIndex: 0,
      content: "Chunk B0 conecta classificacao com validacao de campo.",
      contentHash: `hash-${DOC_B}-0`,
      estimatedTokens: 8,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
  ]);
}

type Wired = {
  askHandler: ReturnType<typeof createRagAskHandler>;
  detailHandler: ReturnType<typeof createRagQueryRunDetailHandler>;
  rerankSpy: ReturnType<typeof vi.fn>;
  generateSpy: ReturnType<typeof vi.fn>;
};

type WireOptions = {
  rerankingProvider?: RerankingProvider;
  generateAnswer?: string;
};

function buildEmbeddingProvider(): QuestionEmbeddingProvider {
  return {
    embedQuestion: vi.fn().mockResolvedValue({
      embedding: ZERO_EMBEDDING,
      usage: { inputTokens: 11, estimatedCostUsd: 0.00000143 },
    }),
  };
}

function buildGenerationProvider(
  spy: ReturnType<typeof vi.fn>,
  answer: string,
): GenerationProvider {
  return {
    generateAnswer: spy.mockImplementation(async () => ({
      answer,
      usage: {
        inputTokens: 52,
        outputTokens: 18,
        totalTokens: 70,
        estimatedCostUsd: 0.0000128,
      },
    })),
    streamAnswer: spy.mockImplementation(async () => ({
      answer,
      usage: {
        inputTokens: 52,
        outputTokens: 18,
        totalTokens: 70,
        estimatedCostUsd: 0.0000128,
      },
    })),
  };
}

function buildDefaultRerankingProvider(
  rerankSpy: ReturnType<typeof vi.fn>,
): RerankingProvider {
  return {
    rerank: rerankSpy.mockImplementation(async ({ matches }) => ({
      matches: [
        {
          ...matches[1]!,
          rerankScore: 0.97,
        },
        {
          ...matches[2]!,
          rerankScore: 0.93,
        },
        {
          ...matches[0]!,
          rerankScore: 0.89,
        },
      ],
      metadata: {
        rerankerProvider: "cohere",
        rerankerModel: "rerank-v3.5",
      },
      audit: {
        latencyMs: 37,
        candidatesEvaluated: matches.length,
        inputTokens: 0,
        estimatedCostUsd: 0,
      },
    })),
  };
}

function wire(db: TestDatabase, options: WireOptions = {}): Wired {
  const documentsRepository = new DocumentsRepository(db);
  const chunksRepository = new DocumentChunksRepository(db);
  const runsRepository = new RagQueryRunsRepository(db);
  const rerankSpy = vi.fn();
  const generateSpy = vi.fn();

  const retrieveChunks = new RetrieveChunks({
    questionEmbeddingProvider: buildEmbeddingProvider(),
    chunksRepository,
    rerankingProvider:
      options.rerankingProvider ?? buildDefaultRerankingProvider(rerankSpy),
    embeddingModel: EMBEDDING_MODEL,
  });
  const answerQuestion = new AnswerQuestion({
    retrieveChunks,
    generationProvider: buildGenerationProvider(
      generateSpy,
      options.generateAnswer ?? "Resposta reranqueada [1][2].",
    ),
    runsRepository,
    focusedDocumentClassifier: documentsRepository,
    generationModel: GENERATION_MODEL,
  });
  const getRun = new GetQueryRun({
    runsRepository,
  });

  return {
    askHandler: createRagAskHandler({
      answerQuestion,
      secret: SECRET,
    }),
    detailHandler: createRagQueryRunDetailHandler({
      getRun,
      secret: SECRET,
    }),
    rerankSpy,
    generateSpy,
  };
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  };
}

function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

function getRequest(url: string): Request {
  return new Request(url, {
    method: "GET",
    headers: authHeaders(),
  });
}

async function getOnlyPersistedRunId(db: TestDatabase): Promise<string> {
  const runs = await db.select().from(ragQueryRuns);
  expect(runs).toHaveLength(1);

  return runs[0]!.id;
}

async function loadRunDetail(
  detailHandler: ReturnType<typeof createRagQueryRunDetailHandler>,
  id: string,
): Promise<RagQueryRunDetailResponse> {
  const response = await detailHandler(
    getRequest(`http://localhost/api/rag/query-runs/${id}`),
    {
      params: Promise.resolve({ id }),
    },
  );

  expect(response.status).toBe(200);

  return ragQueryRunDetailResponseSchema.parse(await response.json());
}

describe("F-08 reranked retrieval integration (real Postgres + real handlers)", () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await seedFixtures(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists rerank metadata, reranking audit, retrievalScore, and rerankScore on a successful global rerank ask", async () => {
    const { askHandler, detailHandler, rerankSpy, generateSpy } = wire(db);

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais evidencias devem ser priorizadas?",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "rerank",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = ragAskSuccessResponseSchema.parse(
      await response.json(),
    ) satisfies RagAskSuccessResponse;
    expect(body.answer).toContain("[1]");
    expect(body.metadata).toEqual({
      mode: "global",
      documentId: null,
      topK: 3,
      retrievalStrategy: "rerank",
      candidateTopK: 9,
      promptVersion: GLOBAL_RAG_PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      rerankerProvider: "cohere",
      rerankerModel: "rerank-v3.5",
    });
    expect(body.audit.embedding).toEqual({
      inputTokens: 11,
      estimatedCostUsd: 0.00000143,
    });
    expect(body.audit.reranking).toEqual({
      latencyMs: 37,
      candidatesEvaluated: 3,
      inputTokens: 0,
      estimatedCostUsd: 0,
    });
    expect(body.audit.generation).toEqual({
      inputTokens: 52,
      outputTokens: 18,
      totalTokens: 70,
      estimatedCostUsd: 0.0000128,
    });
    expect(body.sources).toHaveLength(3);
    expect(body.sources[0]?.rerankScore).toBe(0.97);
    expect(body.sources[1]?.rerankScore).toBe(0.93);
    expect(body.sources[2]?.rerankScore).toBe(0.89);
    expect(rerankSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledTimes(1);

    const detail = await loadRunDetail(detailHandler, body.traceId);
    expect(detail.status).toBe("answered");
    expect(detail.metadata.retrievalStrategy).toBe("rerank");
    expect(detail.metadata.rerankerProvider).toBe("cohere");
    expect(detail.metadata.rerankerModel).toBe("rerank-v3.5");
    expect(detail.audit.reranking).toEqual({
      latencyMs: 37,
      candidatesEvaluated: 3,
      inputTokens: 0,
      estimatedCostUsd: 0,
    });
    expect(detail.sources.map((source) => source.rerankScore)).toEqual([
      0.97, 0.93, 0.89,
    ]);
    for (const source of detail.sources) {
      expect(source.retrievalScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns answered_no_evidence for rerank when first-pass retrieval finds no candidates and never calls rerank or generation", async () => {
    await resetTestDatabase(db);

    const rerankSpy = vi.fn();
    const { askHandler, detailHandler, generateSpy } = wire(db, {
      rerankingProvider: {
        rerank: rerankSpy,
      },
    });

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Ha evidencias suficientes?",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "rerank",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = ragAskSuccessResponseSchema.parse(
      await response.json(),
    ) satisfies RagAskSuccessResponse;
    expect(body.answer).toBe(buildNoEvidenceAnswer());
    expect(body.sources).toEqual([]);
    expect(body.metadata.retrievalStrategy).toBe("rerank");
    expect(body.metadata.rerankerProvider).toBeNull();
    expect(body.audit.reranking).toBeNull();
    expect(rerankSpy).not.toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();

    const runId = await getOnlyPersistedRunId(db);
    const detail = await loadRunDetail(detailHandler, runId);
    expect(detail.status).toBe("answered_no_evidence");
    expect(detail.errorCode).toBeNull();
    expect(detail.metadata.retrievalStrategy).toBe("rerank");
    expect(detail.metadata.rerankerProvider).toBeNull();
    expect(detail.audit.reranking).toBeNull();
    expect(detail.audit.generation).toBeNull();
  });

  it("persists a safe reranking_failed run and skips generation", async () => {
    const rerankingProvider: RerankingProvider = {
      rerank: vi.fn().mockRejectedValue(new Error("invalid rerank payload")),
    };
    const { askHandler, detailHandler, generateSpy } = wire(db, {
      rerankingProvider,
    });

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Forque a falha do rerank",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "rerank",
        },
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "reranking_failed" });
    expect(generateSpy).not.toHaveBeenCalled();

    const runId = await getOnlyPersistedRunId(db);
    const detail = await loadRunDetail(detailHandler, runId);
    expect(detail.status).toBe("reranking_failed");
    expect(detail.errorCode).toBe("reranking_failed");
    expect(detail.metadata.retrievalStrategy).toBe("rerank");
    expect(detail.metadata.rerankerProvider).toBeNull();
    expect(detail.sources).toEqual([]);
    expect(detail.audit.reranking).toBeNull();
    expect(detail.audit.generation).toBeNull();
  });

  it("persists a safe reranking_unavailable run and skips generation", async () => {
    const unavailableError = Object.assign(new Error("provider unavailable"), {
      statusCode: 503,
    });
    const rerankingProvider: RerankingProvider = {
      rerank: vi.fn().mockRejectedValue(unavailableError),
    };
    const { askHandler, detailHandler, generateSpy } = wire(db, {
      rerankingProvider,
    });

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Forque indisponibilidade do rerank",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "rerank",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "reranking_unavailable" });
    expect(generateSpy).not.toHaveBeenCalled();

    const runId = await getOnlyPersistedRunId(db);
    const detail = await loadRunDetail(detailHandler, runId);
    expect(detail.status).toBe("reranking_unavailable");
    expect(detail.errorCode).toBe("reranking_unavailable");
    expect(detail.metadata.retrievalStrategy).toBe("rerank");
    expect(detail.metadata.rerankerProvider).toBeNull();
    expect(detail.sources).toEqual([]);
    expect(detail.audit.reranking).toBeNull();
    expect(detail.audit.generation).toBeNull();
  });

  it("keeps standard and explore ask flows plus persisted run reads stable without calling the reranker", async () => {
    const rerankSpy = vi.fn();
    const { askHandler, detailHandler, generateSpy } = wire(db, {
      rerankingProvider: {
        rerank: rerankSpy,
      },
    });

    const standardResponse = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Mostre a resposta padrao",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "standard",
        },
      }),
    );
    expect(standardResponse.status).toBe(200);
    const standardBody = ragAskSuccessResponseSchema.parse(
      await standardResponse.json(),
    ) satisfies RagAskSuccessResponse;
    expect(standardBody.metadata.retrievalStrategy).toBe("standard");
    expect(standardBody.metadata.candidateTopK).toBe(3);
    expect(standardBody.metadata.rerankerProvider).toBeNull();
    expect(standardBody.audit.reranking).toBeNull();

    const exploreResponse = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Mostre a resposta explore",
        mode: "global",
        retrieval: {
          topK: 3,
          strategy: "explore",
        },
      }),
    );
    expect(exploreResponse.status).toBe(200);
    const exploreBody = ragAskSuccessResponseSchema.parse(
      await exploreResponse.json(),
    ) satisfies RagAskSuccessResponse;
    expect(exploreBody.metadata.retrievalStrategy).toBe("explore");
    expect(exploreBody.metadata.candidateTopK).toBe(9);
    expect(exploreBody.metadata.rerankerProvider).toBeNull();
    expect(exploreBody.audit.reranking).toBeNull();

    const standardDetail = await loadRunDetail(detailHandler, standardBody.traceId);
    expect(standardDetail.metadata.retrievalStrategy).toBe("standard");
    expect(standardDetail.audit.reranking).toBeNull();

    const exploreDetail = await loadRunDetail(detailHandler, exploreBody.traceId);
    expect(exploreDetail.metadata.retrievalStrategy).toBe("explore");
    expect(exploreDetail.audit.reranking).toBeNull();

    expect(rerankSpy).not.toHaveBeenCalled();
    expect(generateSpy).toHaveBeenCalledTimes(2);
  });
});
