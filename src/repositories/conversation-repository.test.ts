import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  documentChunks,
  documents,
  ragConversationMessages,
  ragConversations,
} from "@/db/schema";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { ConversationRepository } from "./conversation-repository";
import {
  type PersistRagQueryRunInput,
  RagQueryRunsRepository,
} from "./rag-query-runs-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const CHUNK_ID = "22222222-2222-4222-8222-222222222222";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

async function insertProcessedDocument(db: TestDatabase): Promise<void> {
  await db.insert(documents).values({
    id: DOCUMENT_ID,
    title: "artigo-original.pdf",
    driveFileId: `drive-${DOCUMENT_ID}`,
    fileHash: `hash-${DOCUMENT_ID}`,
    pipelineVersion,
    status: "processed",
    rawText: "raw text",
    refinedText: "refined text",
  });
}

async function insertDocumentChunk(db: TestDatabase): Promise<void> {
  await db.insert(documentChunks).values({
    id: CHUNK_ID,
    documentId: DOCUMENT_ID,
    chunkIndex: 0,
    content: "Trecho original do chunk.",
    contentHash: `hash-${CHUNK_ID}`,
    estimatedTokens: 12,
    documentPipelineVersion: pipelineVersion,
    chunkingVersion: CHUNKING_VERSION,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embedding: vector(0.1),
  });
}

function buildPersistRagQueryRunInput(): PersistRagQueryRunInput {
  return {
    question: "Quais tecnicas aparecem com maior frequencia?",
    answer: "Os estudos destacam classificacao supervisionada [1].",
    mode: "global",
    status: "answered",
    errorCode: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: EMBEDDING_MODEL,
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
        score: 0.91,
        documentPipelineVersion: pipelineVersion,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: true,
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
    ],
  };
}

describe("ConversationRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let runs: RagQueryRunsRepository;
  let repository: ConversationRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    runs = new RagQueryRunsRepository(db);
    repository = new ConversationRepository(db, runs);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates an empty conversation with null title and null lastMessageAt", async () => {
    const created = await repository.create();

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const [row] = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, created.id));

    expect(row.title).toBeNull();
    expect(row.lastMessageAt).toBeNull();
  });

  it("sets the title on the first updateTitleIfUnset call and is a no-op on subsequent calls", async () => {
    const created = await repository.create();

    await repository.updateTitleIfUnset(created.id, "Primeiro titulo");
    await repository.updateTitleIfUnset(created.id, "Segundo titulo");

    const [row] = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, created.id));

    expect(row.title).toBe("Primeiro titulo");
  });

  it("touches lastMessageAt and updatedAt without overwriting the title", async () => {
    const created = await repository.create();
    await repository.updateTitleIfUnset(created.id, "Titulo fixo");

    const touchedAt = new Date("2026-03-01T10:00:00.000Z");
    await repository.touchLastMessageAt(created.id, touchedAt);

    const [row] = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, created.id));

    expect(row.title).toBe("Titulo fixo");
    expect(row.lastMessageAt).toEqual(touchedAt);
    expect(row.updatedAt).toEqual(touchedAt);
  });

  it("returns null for an unknown conversation id", async () => {
    await expect(
      repository.getDetail("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBeNull();
  });

  it("returns messages in chronological order and hydrates assistant rows with the F-05 trace", async () => {
    await insertProcessedDocument(db);
    await insertDocumentChunk(db);

    const created = await repository.create();
    const traceRun = await runs.create(buildPersistRagQueryRunInput());

    await db.insert(ragConversationMessages).values({
      conversationId: created.id,
      role: "user",
      content: "Pergunta inicial",
      traceId: null,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    await db.insert(ragConversationMessages).values({
      conversationId: created.id,
      role: "assistant",
      content: "Resposta com citacao [1].",
      traceId: traceRun.id,
      createdAt: new Date("2026-03-01T10:00:01.000Z"),
    });

    const detail = await repository.getDetail(created.id);

    expect(detail).not.toBeNull();
    expect(detail!.messages).toHaveLength(2);

    const [userMessage, assistantMessage] = detail!.messages;
    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toBe("Pergunta inicial");
    expect(userMessage.trace).toBeNull();

    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.content).toBe("Resposta com citacao [1].");
    expect(assistantMessage.trace).not.toBeNull();
    expect(assistantMessage.trace!.id).toBe(traceRun.id);
    expect(assistantMessage.trace!.status).toBe("answered");
    expect(assistantMessage.trace!.sources).toHaveLength(1);
  });

  it("cascades message deletion when the parent conversation is deleted", async () => {
    const created = await repository.create();
    await db.insert(ragConversationMessages).values({
      conversationId: created.id,
      role: "user",
      content: "Orphan-test",
      traceId: null,
    });

    await db
      .delete(ragConversations)
      .where(eq(ragConversations.id, created.id));

    await expect(
      db.select().from(ragConversationMessages),
    ).resolves.toEqual([]);
  });
});
