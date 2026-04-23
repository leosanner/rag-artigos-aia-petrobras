import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { documentChunks, documents } from "@/db/schema";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { DocumentChunksRepository } from "./document-chunks-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const THIRD_DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const NON_PROCESSED_DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

function documentIdForIndex(index: number): string {
  return `00000000-0000-4000-8000-${index
    .toString()
    .padStart(12, "0")}`;
}

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

function directionalVector(...components: number[]): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);

  components.forEach((component, index) => {
    vector[index] = component;
  });

  return vector;
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
    pipelineVersion,
    status: "processed",
    rawText: "raw text",
    refinedText: "refined text for indexing",
  });
}

async function insertDocument(
  db: TestDatabase,
  {
    id,
    title = `${id}.pdf`,
    status = "processed",
    documentPipelineVersion = pipelineVersion,
  }: {
    id: string;
    title?: string;
    status?: "pending" | "processed" | "failed";
    documentPipelineVersion?: string;
  },
): Promise<void> {
  await db.insert(documents).values({
    id,
    title,
    driveFileId: `drive-${id}`,
    fileHash: `hash-${id}`,
    pipelineVersion: documentPipelineVersion,
    status,
    rawText: "raw text",
    refinedText: status === "processed" ? "refined text for indexing" : null,
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
      documentPipelineVersion: pipelineVersion,
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
      documentPipelineVersion: pipelineVersion,
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
      documentPipelineVersion: pipelineVersion,
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
      documentPipelineVersion: pipelineVersion,
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
      documentPipelineVersion: pipelineVersion,
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
      documentPipelineVersion: pipelineVersion,
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
        documentPipelineVersion: pipelineVersion,
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

  it("deletes only chunks for the selected document and active configuration", async () => {
    await insertProcessedDocument(db, OTHER_DOCUMENT_ID);
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
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
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: "other-model",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "other model chunk",
          contentHash: "other-model-hash",
          estimatedTokens: 2,
          embedding: vector(0.2),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "other document chunk",
          contentHash: "other-document-hash",
          estimatedTokens: 2,
          embedding: vector(0.3),
        },
      ],
    });

    await repository.deleteDocumentChunksForConfig(DOCUMENT_ID, {
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    const chunks = await db.select().from(documentChunks);
    expect(chunks.map((chunk) => chunk.content).sort()).toEqual([
      "other document chunk",
      "other model chunk",
    ]);
  });

  it("searches only retrieval-ready chunks from the active config in cosine-score order with deterministic tie-breaks", async () => {
    await insertDocument(db, {
      id: OTHER_DOCUMENT_ID,
      title: "Documento B.pdf",
    });
    await insertDocument(db, {
      id: THIRD_DOCUMENT_ID,
      title: "Documento C.pdf",
    });
    await insertDocument(db, {
      id: NON_PROCESSED_DOCUMENT_ID,
      title: "Documento pendente.pdf",
      status: "pending",
    });

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Full excerpt from the strongest active chunk.",
          contentHash: "best-active",
          estimatedTokens: 7,
          embedding: directionalVector(1, 0, 0),
        },
        {
          chunkIndex: 1,
          content: "First tie chunk in the first document.",
          contentHash: "first-tie-doc-1",
          estimatedTokens: 8,
          embedding: directionalVector(1, 1, 0),
        },
        {
          chunkIndex: 3,
          content: "Second tie chunk in the first document.",
          contentHash: "second-tie-doc-1",
          estimatedTokens: 8,
          embedding: directionalVector(1, 1, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Second-best active chunk from another document.",
          contentHash: "second-best-active",
          estimatedTokens: 8,
          embedding: directionalVector(0.8, 0.6, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: THIRD_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Tie chunk from the third document.",
          contentHash: "tie-doc-3",
          estimatedTokens: 6,
          embedding: directionalVector(1, 1, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: "hybrid-v0-700-100",
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 4,
          content: "Old config chunk that must stay hidden.",
          contentHash: "old-config-hidden",
          estimatedTokens: 7,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 2,
          content: "Other model chunk that must stay hidden.",
          contentHash: "other-model-hidden",
          estimatedTokens: 7,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: NON_PROCESSED_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Pending document chunk that must stay hidden.",
          contentHash: "pending-hidden",
          estimatedTokens: 8,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });

    const matches = await repository.searchGlobal({
      queryEmbedding: directionalVector(1, 0, 0),
      topK: 10,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    expect(matches).toHaveLength(5);
    expect(
      matches.map((match) => ({
        documentId: match.documentId,
        chunkIndex: match.chunkIndex,
      })),
    ).toEqual([
      { documentId: DOCUMENT_ID, chunkIndex: 0 },
      { documentId: OTHER_DOCUMENT_ID, chunkIndex: 0 },
      { documentId: DOCUMENT_ID, chunkIndex: 1 },
      { documentId: DOCUMENT_ID, chunkIndex: 3 },
      { documentId: THIRD_DOCUMENT_ID, chunkIndex: 0 },
    ]);
    expect(matches.map((match) => match.excerpt)).toEqual([
      "Full excerpt from the strongest active chunk.",
      "Second-best active chunk from another document.",
      "First tie chunk in the first document.",
      "Second tie chunk in the first document.",
      "Tie chunk from the third document.",
    ]);
    expect(matches[0]).toMatchObject({
      documentId: DOCUMENT_ID,
      documentTitle: `${DOCUMENT_ID}.pdf`,
      chunkIndex: 0,
      excerpt: "Full excerpt from the strongest active chunk.",
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });
    expect(matches[1]).toMatchObject({
      documentId: OTHER_DOCUMENT_ID,
      documentTitle: "Documento B.pdf",
    });
    expect(matches[0]?.score).toBeCloseTo(1, 5);
    expect(matches[1]?.score).toBeCloseTo(0.8, 5);
    expect(matches[2]?.score).toBeCloseTo(Math.SQRT1_2, 5);
    expect(matches[3]?.score).toBeCloseTo(Math.SQRT1_2, 5);
    expect(matches[4]?.score).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("respects topK when multiple active-config matches exist", async () => {
    await insertDocument(db, {
      id: OTHER_DOCUMENT_ID,
      title: "Documento B.pdf",
    });

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Best chunk",
          contentHash: "best-chunk",
          estimatedTokens: 2,
          embedding: directionalVector(1, 0, 0),
        },
        {
          chunkIndex: 1,
          content: "Tie chunk",
          contentHash: "tie-chunk",
          estimatedTokens: 2,
          embedding: directionalVector(1, 1, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Second-best chunk",
          contentHash: "second-best-chunk",
          estimatedTokens: 2,
          embedding: directionalVector(0.8, 0.6, 0),
        },
      ],
    });

    const matches = await repository.searchGlobal({
      queryEmbedding: directionalVector(1, 0, 0),
      topK: 2,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    expect(matches).toHaveLength(2);
    expect(
      matches.map((match) => ({
        documentId: match.documentId,
        chunkIndex: match.chunkIndex,
      })),
    ).toEqual([
      { documentId: DOCUMENT_ID, chunkIndex: 0 },
      { documentId: OTHER_DOCUMENT_ID, chunkIndex: 0 },
    ]);
  });

  it("returns only the requested standard top-k size from score-ordered active matches", async () => {
    await insertDocument(db, {
      id: OTHER_DOCUMENT_ID,
      title: "Documento B.pdf",
    });
    await insertDocument(db, {
      id: THIRD_DOCUMENT_ID,
      title: "Documento C.pdf",
    });

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Best standard chunk",
          contentHash: "best-standard",
          estimatedTokens: 3,
          embedding: directionalVector(1, 0, 0),
        },
        {
          chunkIndex: 1,
          content: "Fourth standard chunk",
          contentHash: "fourth-standard",
          estimatedTokens: 3,
          embedding: directionalVector(0.7, 0.714, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Second standard chunk",
          contentHash: "second-standard",
          estimatedTokens: 3,
          embedding: directionalVector(0.9, 0.436, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: THIRD_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Third standard chunk",
          contentHash: "third-standard",
          estimatedTokens: 3,
          embedding: directionalVector(0.8, 0.6, 0),
        },
      ],
    });

    const matches = await repository.searchGlobal({
      queryEmbedding: directionalVector(1, 0, 0),
      topK: 3,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    expect(matches).toHaveLength(3);
    expect(matches.map((match) => match.excerpt)).toEqual([
      "Best standard chunk",
      "Second standard chunk",
      "Third standard chunk",
    ]);
  });

  it("returns an explore-sized candidate set while still ignoring stale configs and non-processed documents", async () => {
    await insertDocument(db, {
      id: NON_PROCESSED_DOCUMENT_ID,
      title: "Documento pendente.pdf",
      status: "pending",
    });

    const activeDocumentIds = Array.from({ length: 26 }, (_, index) =>
      documentIdForIndex(index + 1),
    );

    for (const [index, documentId] of activeDocumentIds.entries()) {
      await insertDocument(db, {
        id: documentId,
        title: `Documento ativo ${index + 1}.pdf`,
      });
      await repository.replaceDocumentChunks({
        documentId,
        documentPipelineVersion: pipelineVersion,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
        chunks: [
          {
            chunkIndex: 0,
            content: `Active candidate ${index + 1}`,
            contentHash: `active-candidate-${index + 1}`,
            estimatedTokens: 3,
            embedding: directionalVector(26 - index, index + 1, 0),
          },
        ],
      });
    }

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: "hybrid-v0-700-100",
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Stale chunk with a stronger score",
          contentHash: "stale-stronger-score",
          estimatedTokens: 5,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: activeDocumentIds[0] ?? DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 1,
          content: "Other model chunk with a stronger score",
          contentHash: "other-model-stronger-score",
          estimatedTokens: 6,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: NON_PROCESSED_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Pending chunk with a stronger score",
          contentHash: "pending-stronger-score",
          estimatedTokens: 6,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });

    const matches = await repository.searchGlobal({
      queryEmbedding: directionalVector(1, 0, 0),
      topK: 24,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    expect(matches).toHaveLength(24);
    expect(matches.map((match) => match.excerpt)).toEqual(
      Array.from({ length: 24 }, (_, index) => `Active candidate ${index + 1}`),
    );
    expect(matches.map((match) => match.excerpt)).not.toContain(
      "Stale chunk with a stronger score",
    );
    expect(matches.map((match) => match.excerpt)).not.toContain(
      "Other model chunk with a stronger score",
    );
    expect(matches.map((match) => match.excerpt)).not.toContain(
      "Pending chunk with a stronger score",
    );
    expect(matches.every((match) => match.chunkingVersion === CHUNKING_VERSION))
      .toBe(true);
    expect(matches.every((match) => match.embeddingModel === EMBEDDING_MODEL))
      .toBe(true);
  });

  it("returns the pipeline version from the joined document metadata", async () => {
    await insertDocument(db, {
      id: OTHER_DOCUMENT_ID,
      title: "Documento B.pdf",
      documentPipelineVersion: "f01-2.0.0",
    });

    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: "chunk-snapshot-v1",
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Chunk with stale pipeline snapshot",
          contentHash: "stale-pipeline-snapshot",
          estimatedTokens: 4,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });

    const [match] = await repository.searchGlobal({
      queryEmbedding: directionalVector(1, 0, 0),
      topK: 1,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
    });

    expect(match?.documentId).toBe(OTHER_DOCUMENT_ID);
    expect(match?.documentPipelineVersion).toBe("f01-2.0.0");
  });

  it("returns an empty array when no retrieval-ready chunks exist for the active config", async () => {
    await insertDocument(db, {
      id: OTHER_DOCUMENT_ID,
      title: "Documento B.pdf",
      status: "failed",
    });

    await repository.replaceDocumentChunks({
      documentId: DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: "hybrid-v0-700-100",
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Old config only",
          contentHash: "old-config-only",
          estimatedTokens: 2,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });
    await repository.replaceDocumentChunks({
      documentId: OTHER_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "Failed document chunk",
          contentHash: "failed-document-chunk",
          estimatedTokens: 2,
          embedding: directionalVector(1, 0, 0),
        },
      ],
    });

    await expect(
      repository.searchGlobal({
        queryEmbedding: directionalVector(1, 0, 0),
        topK: 6,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
      }),
    ).resolves.toEqual([]);
  });
});
