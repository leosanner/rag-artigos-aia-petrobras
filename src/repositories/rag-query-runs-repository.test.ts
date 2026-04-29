import { desc, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  documentChunks,
  documents,
  type NewRagQueryRun,
  ragQueryRunRelatedTerms,
  ragQueryRunSources,
  ragQueryRuns,
} from "@/db/schema";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import {
  type PersistRagQueryRunInput,
  RagQueryRunsRepository,
} from "./rag-query-runs-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const CHUNK_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CHUNK_ID = "33333333-3333-4333-8333-333333333333";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

async function insertProcessedDocument(
  db: TestDatabase,
  {
    id = DOCUMENT_ID,
    title = "artigo-original.pdf",
  }: {
    id?: string;
    title?: string;
  } = {},
): Promise<void> {
  await db.insert(documents).values({
    id,
    title,
    driveFileId: `drive-${id}`,
    fileHash: `hash-${id}`,
    pipelineVersion,
    status: "processed",
    rawText: "raw text",
    refinedText: "refined text",
  });
}

async function insertDocumentChunk(
  db: TestDatabase,
  {
    id = CHUNK_ID,
    documentId = DOCUMENT_ID,
    content = "Trecho original do chunk.",
    chunkIndex = 0,
  }: {
    id?: string;
    documentId?: string;
    content?: string;
    chunkIndex?: number;
  } = {},
): Promise<void> {
  await db.insert(documentChunks).values({
    id,
    documentId,
    chunkIndex,
    content,
    contentHash: `hash-${id}`,
    estimatedTokens: 12,
    documentPipelineVersion: pipelineVersion,
    chunkingVersion: CHUNKING_VERSION,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embedding: vector(0.1),
  });
}

function buildPersistInput(
  overrides: Partial<PersistRagQueryRunInput> = {},
): PersistRagQueryRunInput {
  return {
    question: "Quais tecnicas aparecem com maior frequencia?",
    answer: "Os estudos destacam classificacao supervisionada [1].",
    mode: "global",
    documentId: null,
    status: "answered",
    errorCode: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: EMBEDDING_MODEL,
    rerankerProvider: null,
    rerankerModel: null,
    rerankingLatencyMs: null,
    rerankingCandidatesEvaluated: null,
    rerankingInputTokens: null,
    rerankingCostUsd: null,
    latencyMs: 432,
    embeddingInputTokens: 17,
    embeddingCostUsd: 0.000002,
    generationInputTokens: 120,
    generationOutputTokens: 42,
    generationTotalTokens: 162,
    generationCostUsd: 0.00048,
    totalCostUsd: 0.000482,
    sources: [
      {
        sourceNumber: 1,
        chunkId: CHUNK_ID,
        documentId: DOCUMENT_ID,
        documentTitle: "artigo-original.pdf",
        chunkIndex: 0,
        excerpt: "Trecho original do chunk.",
        retrievalScore: 0.91,
        rerankScore: null,
        documentPipelineVersion: pipelineVersion,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: true,
      },
      {
        sourceNumber: 2,
        chunkId: OTHER_CHUNK_ID,
        documentId: DOCUMENT_ID,
        documentTitle: "artigo-secundario.pdf",
        chunkIndex: 1,
        excerpt: "Trecho complementar.",
        retrievalScore: 0.84,
        rerankScore: null,
        documentPipelineVersion: pipelineVersion,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: false,
      },
    ],
    relatedTerms: [
      {
        rank: 1,
        term: "classificacao supervisionada",
        ngramSize: 2,
        frequency: 3,
        sourceCoverageCount: 2,
      },
      {
        rank: 2,
        term: "sensoriamento remoto",
        ngramSize: 2,
        frequency: 2,
        sourceCoverageCount: 1,
      },
    ],
    ...overrides,
  };
}

describe("RagQueryRunsRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let repository: RagQueryRunsRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    repository = new RagQueryRunsRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await insertProcessedDocument(db);
    await insertDocumentChunk(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists an answered run with immutable source and related-term snapshots", async () => {
    const input = buildPersistInput();

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(detail).toEqual({
      id: created.id,
      question: input.question,
      answer: input.answer,
      mode: "global",
      documentId: null,
      status: "answered",
      errorCode: null,
      sources: input.sources,
      relatedTerms: input.relatedTerms,
      metadata: {
        mode: "global",
        documentId: null,
        topK: input.topK,
        retrievalStrategy: input.retrievalStrategy,
        candidateTopK: input.candidateTopK,
        promptVersion: input.promptVersion,
        generationModel: input.generationModel,
        embeddingModel: input.embeddingModel,
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: input.latencyMs,
        embedding: {
          inputTokens: input.embeddingInputTokens,
          estimatedCostUsd: input.embeddingCostUsd,
        },
        reranking: null,
        generation: {
          inputTokens: input.generationInputTokens!,
          outputTokens: input.generationOutputTokens!,
          totalTokens: input.generationTotalTokens!,
          estimatedCostUsd: input.generationCostUsd!,
        },
        totalCostUsd: input.totalCostUsd,
      },
      createdAt: created.createdAt,
    });

    const storedSources = await db
      .select()
      .from(ragQueryRunSources)
      .where(eq(ragQueryRunSources.runId, created.id))
      .orderBy(ragQueryRunSources.sourceNumber);
    const storedTerms = await db
      .select()
      .from(ragQueryRunRelatedTerms)
      .where(eq(ragQueryRunRelatedTerms.runId, created.id))
      .orderBy(ragQueryRunRelatedTerms.rank);

    expect(storedSources).toHaveLength(2);
    expect(storedTerms).toHaveLength(2);
  });

  it("persists an explore run with null rerank scores and no rerank audit", async () => {
    const input = buildPersistInput({
      retrievalStrategy: "explore",
      candidateTopK: 18,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail?.metadata.retrievalStrategy).toBe("explore");
    expect(detail?.metadata.rerankerProvider).toBeNull();
    expect(detail?.sources.every((source) => source.rerankScore === null)).toBe(
      true,
    );
    expect(detail?.audit.reranking).toBeNull();
  });

  it("persists a rerank success run with rerank metadata, audit, and split source scores", async () => {
    const input = buildPersistInput({
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      rerankerProvider: "openai",
      rerankerModel: "rerank-1",
      rerankingLatencyMs: 89,
      rerankingCandidatesEvaluated: 18,
      rerankingInputTokens: 54,
      rerankingCostUsd: 0.00013,
      sources: [
        {
          ...buildPersistInput().sources[0]!,
          retrievalScore: 0.91,
          rerankScore: 0.83,
        },
        {
          ...buildPersistInput().sources[1]!,
          retrievalScore: 0.84,
          rerankScore: 0.77,
        },
      ],
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      status: "answered",
      metadata: {
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        rerankerProvider: "openai",
        rerankerModel: "rerank-1",
      },
      audit: {
        reranking: {
          latencyMs: 89,
          candidatesEvaluated: 18,
          inputTokens: 54,
          estimatedCostUsd: 0.00013,
        },
      },
    });
    expect(detail?.sources).toEqual(input.sources);
  });

  it("persists a rerank answered_no_evidence run without rerank audit and maps null generation audit to null", async () => {
    const input = buildPersistInput({
      answer: "Nao encontrei nada relacionado a essa pergunta na base de dados.",
      status: "answered_no_evidence",
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      sources: [],
      relatedTerms: [
        {
          rank: 1,
          term: "avaliacao ambiental",
          ngramSize: 2,
          frequency: 1,
          sourceCoverageCount: 0,
        },
      ],
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: 0.000002,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail?.status).toBe("answered_no_evidence");
    expect(detail?.metadata.retrievalStrategy).toBe("rerank");
    expect(detail?.metadata.rerankerProvider).toBeNull();
    expect(detail?.sources).toEqual([]);
    expect(detail?.audit.reranking).toBeNull();
    expect(detail?.audit.generation).toBeNull();
    expect(detail?.relatedTerms).toEqual(input.relatedTerms);
  });

  it("persists a reranking_failed run with null generation and reranking audit", async () => {
    const input = buildPersistInput({
      answer: null,
      status: "reranking_failed",
      errorCode: "reranking_failed",
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      sources: [],
      relatedTerms: [buildPersistInput().relatedTerms[0]!],
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: 0.000002,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      answer: null,
      status: "reranking_failed",
      errorCode: "reranking_failed",
      sources: [],
      relatedTerms: input.relatedTerms,
    });
    expect(detail?.audit.reranking).toBeNull();
    expect(detail?.audit.generation).toBeNull();
  });

  it("persists a reranking_unavailable run with the safe failure vocabulary", async () => {
    const input = buildPersistInput({
      answer: null,
      status: "reranking_unavailable",
      errorCode: "reranking_unavailable",
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      sources: [],
      relatedTerms: [buildPersistInput().relatedTerms[0]!],
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: 0.000002,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      answer: null,
      status: "reranking_unavailable",
      errorCode: "reranking_unavailable",
      sources: [],
      relatedTerms: input.relatedTerms,
    });
    expect(detail?.audit.reranking).toBeNull();
    expect(detail?.audit.generation).toBeNull();
  });

  it("persists a failed run with null answer and null generation usage metrics", async () => {
    const input = buildPersistInput({
      answer: null,
      status: "generation_failed",
      errorCode: "generation_failed",
      sources: [buildPersistInput().sources[0]!],
      relatedTerms: [buildPersistInput().relatedTerms[0]!],
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: 0.000002,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      answer: null,
      status: "generation_failed",
      errorCode: "generation_failed",
      sources: input.sources,
      relatedTerms: input.relatedTerms,
    });
    expect(detail?.audit.generation).toBeNull();
  });

  it("persists a generation_unavailable run with the safe failure vocabulary", async () => {
    const input = buildPersistInput({
      answer: null,
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      sources: [buildPersistInput().sources[0]!],
      relatedTerms: [buildPersistInput().relatedTerms[0]!],
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: 0.000002,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      answer: null,
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      sources: input.sources,
      relatedTerms: input.relatedTerms,
    });
    expect(detail?.audit.generation).toBeNull();
  });

  it("lists recent runs in reverse chronological order with a stable id tiebreaker", async () => {
    const sameCreatedAt = new Date("2026-02-01T00:00:00.000Z");
    const laterCreatedAt = new Date("2026-02-01T00:00:01.000Z");
    const lowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const highId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const laterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const baseValues: Omit<NewRagQueryRun, "id" | "createdAt"> = {
      question: "Pergunta de auditoria",
      answer: "Resposta [1].",
      mode: "global",
      documentId: null,
      status: "answered",
      errorCode: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: "f05-audit-v1",
      generationModel: "gpt-4.1-mini",
      embeddingModel: EMBEDDING_MODEL,
      latencyMs: 111,
      embeddingInputTokens: 10,
      embeddingCostUsd: 0.000001,
      generationInputTokens: 20,
      generationOutputTokens: 5,
      generationTotalTokens: 25,
      generationCostUsd: 0.0001,
      totalCostUsd: 0.000101,
    };
    const rows: NewRagQueryRun[] = [
      {
        id: lowId,
        ...baseValues,
        question: "alpha",
        createdAt: sameCreatedAt,
      },
      {
        id: highId,
        ...baseValues,
        question: "beta",
        createdAt: sameCreatedAt,
      },
      {
        id: laterId,
        ...baseValues,
        question: "gamma",
        createdAt: laterCreatedAt,
      },
    ];

    await db.insert(ragQueryRuns).values(rows);

    const summaries = await repository.listRecent();

    expect(summaries).toEqual([
      {
        id: laterId,
        question: "gamma",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 111,
        totalCostUsd: 0.000101,
        createdAt: laterCreatedAt,
      },
      {
        id: highId,
        question: "beta",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 111,
        totalCostUsd: 0.000101,
        createdAt: sameCreatedAt,
      },
      {
        id: lowId,
        question: "alpha",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 111,
        totalCostUsd: 0.000101,
        createdAt: sameCreatedAt,
      },
    ]);
  });

  it("persists a focused run with the document scope and reads it back unchanged", async () => {
    const input = buildPersistInput({
      mode: "focused",
      documentId: DOCUMENT_ID,
    });

    const created = await repository.create(input);
    const detail = await repository.getById(created.id);

    expect(detail).toMatchObject({
      mode: "focused",
      documentId: DOCUMENT_ID,
      metadata: expect.objectContaining({
        mode: "focused",
        documentId: DOCUMENT_ID,
      }),
    });
  });

  it("rejects a focused run with a null document_id (db check enforces consistency)", async () => {
    const input = buildPersistInput({
      mode: "focused",
      documentId: null,
    });

    await expect(repository.create(input)).rejects.toThrow();
  });

  it("rejects a global run with a non-null document_id (db check enforces consistency)", async () => {
    const input = buildPersistInput({
      mode: "global",
      documentId: DOCUMENT_ID,
    });

    await expect(repository.create(input)).rejects.toThrow();
  });

  it("rejects a rerank run with partially populated reranking metadata or audit", async () => {
    const input = buildPersistInput({
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      rerankerProvider: "openai",
    });

    await expect(repository.create(input)).rejects.toThrow();
  });

  it("rolls back the entire create transaction when a child snapshot violates a constraint", async () => {
    const input = buildPersistInput({
      sources: [
        {
          ...buildPersistInput().sources[0]!,
          sourceNumber: 1,
        },
        {
          ...buildPersistInput().sources[1]!,
          sourceNumber: 1,
        },
      ],
    });

    await expect(repository.create(input)).rejects.toThrow();

    await expect(
      db.select().from(ragQueryRuns).orderBy(desc(ragQueryRuns.createdAt)),
    ).resolves.toEqual([]);
    await expect(db.select().from(ragQueryRunSources)).resolves.toEqual([]);
    await expect(db.select().from(ragQueryRunRelatedTerms)).resolves.toEqual([]);
  });

  it("reads stored snapshots instead of recomputing from mutated live documents and chunks", async () => {
    const input = buildPersistInput();
    const created = await repository.create(input);

    await db
      .update(documents)
      .set({
        title: "artigo-mutado.pdf",
        pipelineVersion: "mutated-documents-v2",
      })
      .where(eq(documents.id, DOCUMENT_ID));
    await db
      .update(documentChunks)
      .set({
        content: "Trecho mutado que nao deve vazar.",
        documentPipelineVersion: "mutated-documents-v2",
      })
      .where(eq(documentChunks.id, CHUNK_ID));

    const detail = await repository.getById(created.id);

    expect(detail?.sources[0]).toEqual(input.sources[0]);
  });

  it("reads a migrated legacy source row as retrievalScore with rerankScore null", async () => {
    const created = await repository.create(
      buildPersistInput({
        sources: [
          {
            ...buildPersistInput().sources[0]!,
            retrievalScore: 0.73,
            rerankScore: null,
          },
        ],
      }),
    );

    const detail = await repository.getById(created.id);

    expect(detail?.sources).toEqual([
      expect.objectContaining({
        retrievalScore: 0.73,
        rerankScore: null,
      }),
    ]);
  });

  it("cascades child snapshots when the parent run is deleted", async () => {
    const created = await repository.create(buildPersistInput());

    await db.delete(ragQueryRuns).where(eq(ragQueryRuns.id, created.id));

    await expect(db.select().from(ragQueryRunSources)).resolves.toEqual([]);
    await expect(db.select().from(ragQueryRunRelatedTerms)).resolves.toEqual([]);
  });

  it("returns null when the requested run does not exist", async () => {
    await expect(
      repository.getById("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBeNull();
  });

  it("returns child snapshots ordered by source number and term rank", async () => {
    const created = await repository.create(buildPersistInput());

    const detail = await repository.getById(created.id);
    const runSources = await db
      .select()
      .from(ragQueryRunSources)
      .where(eq(ragQueryRunSources.runId, created.id))
      .orderBy(desc(ragQueryRunSources.sourceNumber));

    expect(runSources.map((source) => source.sourceNumber)).toEqual([2, 1]);
    expect(detail?.sources.map((source) => source.sourceNumber)).toEqual([1, 2]);
    expect(detail?.relatedTerms.map((term) => term.rank)).toEqual([1, 2]);
  });
});
