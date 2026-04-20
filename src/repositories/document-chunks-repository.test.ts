import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { documentChunks, documents } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { DocumentChunksRepository } from "./document-chunks-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

async function insertProcessedDocument(
  db: TestDatabase,
  id = DOCUMENT_ID,
): Promise<void> {
  await db.insert(documents).values({
    id,
    title: `${id}.pdf`,
    driveFileId: `drive-${id}`,
    fileHash: `hash-${id}`,
    pipelineVersion: "f01-1.0.0",
    status: "processed",
    rawText: "raw text",
    refinedText: "refined text for indexing",
  });
}

describe("DocumentChunksRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let repository: DocumentChunksRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    repository = new DocumentChunksRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await insertProcessedDocument(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists retrieval-ready chunks with 3072-dimension pgvector embeddings", async () => {
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "first chunk",
          contentHash: "hash-a",
          estimatedTokens: 2,
          embedding: vector(0.1),
        },
        {
          chunkIndex: 1,
          content: "second chunk",
          contentHash: "hash-b",
          estimatedTokens: 2,
          embedding: vector(0.2),
        },
      ],
    });

    const chunks = await repository.listByDocument(DOCUMENT_ID);

    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(chunks[0]?.embeddingDimensions).toBe(EMBEDDING_DIMENSIONS);
    await expect(
      repository.hasChunksForConfig(DOCUMENT_ID, {
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
      }),
    ).resolves.toBe(true);
  });

  it("replaces only chunks for the selected document and active configuration", async () => {
    await insertProcessedDocument(db, OTHER_DOCUMENT_ID);
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "old active",
          contentHash: "old-active",
          estimatedTokens: 2,
          embedding: vector(0.1),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: "other-model",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "other model",
          contentHash: "other-model",
          estimatedTokens: 2,
          embedding: vector(0.3),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "other document",
          contentHash: "other-document",
          estimatedTokens: 2,
          embedding: vector(0.4),
        },
      ],
    });

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "new active",
          contentHash: "new-active",
          estimatedTokens: 2,
          embedding: vector(0.9),
        },
      ],
    });

    const allChunks = await db.select().from(documentChunks);
    expect(allChunks.map((chunk) => chunk.content).sort()).toEqual([
      "new active",
      "other document",
      "other model",
    ]);
  });

  it("does not delete existing chunks when replacement insertion fails", async () => {
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "stable chunk",
          contentHash: "stable",
          estimatedTokens: 2,
          embedding: vector(0.1),
        },
      ],
    });

    await expect(
      repository.replaceDocumentChunks({
        documentId: DOCUMENT_ID,
        documentPipelineVersion: "f01-1.0.0",
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        chunks: [
          {
            chunkIndex: 0,
            content: "bad replacement",
            contentHash: "bad",
            estimatedTokens: 2,
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    ).rejects.toThrow();

    const chunks = await repository.listByDocument(DOCUMENT_ID);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("stable chunk");
  });

  it("removes chunks when a force rebuild starts from an empty replacement", async () => {
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: "f01-1.0.0",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "chunk",
          contentHash: "hash",
          estimatedTokens: 1,
          embedding: vector(0.1),
        },
      ],
    });

    await repository.deleteDocumentChunksForConfig(DOCUMENT_ID, {
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, DOCUMENT_ID));
    expect(chunks).toHaveLength(0);
  });
});
