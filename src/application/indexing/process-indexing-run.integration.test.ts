import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  documentChunks,
  documents,
  ragIndexingRunItems,
  ragIndexingRuns,
} from "@/db/schema";
import { HybridTextChunker } from "@/domain/chunking/hybrid-text-chunker";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import type { EmbeddingProvider } from "@/application/indexing/ports";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { ProcessIndexingRun } from "./process-indexing-run";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const SKIPPED_DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const VALID_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const BLANK_DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const EMBEDDING_FAIL_DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";
const PENDING_DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const EMBEDDING_DIMENSIONS = 3072;

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed);
}

async function insertDocument(
  db: TestDatabase,
  input: {
    id: string;
    title: string;
    status: "pending" | "processed" | "failed";
    refinedText: string | null;
    rawText?: string | null;
    lastError?: string | null;
  },
): Promise<void> {
  await db.insert(documents).values({
    id: input.id,
    title: input.title,
    driveFileId: `drive-${input.id}`,
    fileHash: `hash-${input.id}`,
    pipelineVersion,
    status: input.status,
    rawText: input.rawText ?? (input.status === "processed" ? "raw text" : null),
    refinedText: input.refinedText,
    lastError: input.lastError ?? null,
  });
}

describe("ProcessIndexingRun (integration)", () => {
  let db: TestDatabase;
  let pool: Pool;
  let documentsRepository: DocumentsRepository;
  let runsRepository: RagIndexingRunsRepository;
  let chunksRepository: DocumentChunksRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    documentsRepository = new DocumentsRepository(db);
    runsRepository = new RagIndexingRunsRepository(db);
    chunksRepository = new DocumentChunksRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("processes a mixed indexing run end to end with skipped and failed-item isolation", async () => {
    await insertDocument(db, {
      id: SKIPPED_DOCUMENT_ID,
      title: "a-skipped.pdf",
      status: "processed",
      refinedText: "already indexed refined text",
    });
    await insertDocument(db, {
      id: VALID_DOCUMENT_ID,
      title: "b-valid.pdf",
      status: "processed",
      refinedText:
        "Documento valido para indexacao.\n\nSegundo paragrafo para manter um chunk pequeno.",
    });
    await insertDocument(db, {
      id: BLANK_DOCUMENT_ID,
      title: "c-blank.pdf",
      status: "processed",
      refinedText: " \n\t ",
    });
    await insertDocument(db, {
      id: EMBEDDING_FAIL_DOCUMENT_ID,
      title: "d-embedding-fail.pdf",
      status: "processed",
      refinedText: "EMBED_FAIL texto que deve acionar a falha fake.",
    });
    await insertDocument(db, {
      id: PENDING_DOCUMENT_ID,
      title: "e-pending.pdf",
      status: "pending",
      refinedText: null,
    });

    await chunksRepository.replaceDocumentChunks({
      documentId: SKIPPED_DOCUMENT_ID,
      documentPipelineVersion: pipelineVersion,
      chunkingVersion: "hybrid-v1-900-150",
      embeddingModel: "text-embedding-3-large",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      chunks: [
        {
          chunkIndex: 0,
          content: "chunk preexistente",
          contentHash: "preexisting-hash",
          estimatedTokens: 2,
          embedding: vector(0.1),
        },
      ],
    });

    const embeddingProvider: EmbeddingProvider = {
      async embedMany(texts) {
        if (texts.some((text) => text.includes("EMBED_FAIL"))) {
          throw new Error("provider detail");
        }

        return texts.map((text, index) => vector(text.length + index));
      },
    };

    const run = await runsRepository.createQueuedRun({
      documentId: null,
      force: false,
    });
    const service = new ProcessIndexingRun({
      documentsRepository,
      runsRepository,
      chunksRepository,
      chunker: new HybridTextChunker(),
      embeddingProvider,
    });

    await service.execute(run.id);

    const [persistedRun] = await db
      .select()
      .from(ragIndexingRuns)
      .where(eq(ragIndexingRuns.id, run.id));
    expect(persistedRun.status).toBe("completed");
    expect(persistedRun.selectedCount).toBe(4);
    expect(persistedRun.processedCount).toBe(1);
    expect(persistedRun.failedCount).toBe(2);
    expect(persistedRun.skippedCount).toBe(1);
    expect(persistedRun.lastError).toBeNull();

    const items = await db
      .select()
      .from(ragIndexingRunItems)
      .where(eq(ragIndexingRunItems.runId, run.id));
    expect(items).toHaveLength(3);
    const itemsByDocumentId = Object.fromEntries(
      items.map((item) => [item.documentId, item]),
    );
    expect(itemsByDocumentId[VALID_DOCUMENT_ID]?.status).toBe("processed");
    expect(itemsByDocumentId[VALID_DOCUMENT_ID]?.lastError).toBeNull();
    expect(itemsByDocumentId[BLANK_DOCUMENT_ID]?.status).toBe("failed");
    expect(itemsByDocumentId[BLANK_DOCUMENT_ID]?.lastError).toBe(
      "refined_text_empty",
    );
    expect(itemsByDocumentId[EMBEDDING_FAIL_DOCUMENT_ID]?.status).toBe("failed");
    expect(itemsByDocumentId[EMBEDDING_FAIL_DOCUMENT_ID]?.lastError).toBe(
      "embedding_failed",
    );
    expect(itemsByDocumentId[SKIPPED_DOCUMENT_ID]).toBeUndefined();
    expect(itemsByDocumentId[PENDING_DOCUMENT_ID]).toBeUndefined();

    const validChunks = await chunksRepository.listByDocument(VALID_DOCUMENT_ID);
    expect(validChunks.length).toBeGreaterThan(0);
    expect(itemsByDocumentId[VALID_DOCUMENT_ID]?.chunkCount).toBe(
      validChunks.length,
    );
    for (const chunk of validChunks) {
      expect(chunk.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(chunk.embeddingModel).toBe("text-embedding-3-large");
      expect(chunk.embeddingDimensions).toBe(EMBEDDING_DIMENSIONS);
      expect(chunk.documentPipelineVersion).toBe(pipelineVersion);
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }

    await expect(
      chunksRepository.listByDocument(EMBEDDING_FAIL_DOCUMENT_ID),
    ).resolves.toHaveLength(0);
    await expect(
      chunksRepository.listByDocument(BLANK_DOCUMENT_ID),
    ).resolves.toHaveLength(0);
    await expect(
      chunksRepository.listByDocument(PENDING_DOCUMENT_ID),
    ).resolves.toHaveLength(0);

    const skippedChunks = await chunksRepository.listByDocument(SKIPPED_DOCUMENT_ID);
    expect(skippedChunks).toHaveLength(1);
    expect(skippedChunks[0]?.content).toBe("chunk preexistente");

    const allChunks = await db.select().from(documentChunks);
    expect(allChunks.map((chunk) => chunk.documentId).sort()).toEqual([
      SKIPPED_DOCUMENT_ID,
      ...validChunks.map(() => VALID_DOCUMENT_ID),
    ]);
  });
});
