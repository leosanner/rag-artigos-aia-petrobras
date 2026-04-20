import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { documents, ragIndexingRunItems, ragIndexingRuns } from "@/db/schema";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import {
  ActiveIndexingRunConflictError,
  RagIndexingRunsRepository,
} from "./rag-indexing-runs-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

async function insertProcessedDocument(db: TestDatabase): Promise<void> {
  await db.insert(documents).values({
    id: DOCUMENT_ID,
    title: "document.pdf",
    driveFileId: "drive-document",
    fileHash: "hash-document",
    pipelineVersion,
    status: "processed",
    rawText: "raw text",
    refinedText: "refined text",
  });
}

describe("RagIndexingRunsRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let repository: RagIndexingRunsRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    repository = new RagIndexingRunsRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await insertProcessedDocument(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a queued run with persisted options and finds it as active", async () => {
    const run = await repository.createQueuedRun({
      documentId: DOCUMENT_ID,
      force: true,
    });

    expect(run.status).toBe("queued");
    expect(run.documentId).toBe(DOCUMENT_ID);
    expect(run.force).toBe(true);
    expect(run.selectedCount).toBe(0);
    expect(run.processedCount).toBe(0);
    expect(run.failedCount).toBe(0);
    expect(run.skippedCount).toBe(0);
    expect((await repository.findActiveRun())?.id).toBe(run.id);
  });

  it("surfaces active-run conflicts through the partial unique index", async () => {
    const active = await repository.createQueuedRun({
      documentId: null,
      force: false,
    });

    await expect(
      repository.createQueuedRun({ documentId: DOCUMENT_ID, force: false }),
    ).rejects.toMatchObject(
      new ActiveIndexingRunConflictError(active.id),
    );

    await expect(
      db.insert(ragIndexingRuns).values({
        status: "processing",
        documentId: null,
        force: false,
      }),
    ).rejects.toThrow();
  });

  it("moves runs through processing, completed, and inactive states", async () => {
    const run = await repository.createQueuedRun({
      documentId: null,
      force: false,
    });

    const processing = await repository.markProcessing(run.id);
    expect(processing.status).toBe("processing");
    expect(processing.startedAt).toBeInstanceOf(Date);

    const completed = await repository.completeRun(run.id, {
      selectedCount: 3,
      processedCount: 1,
      failedCount: 1,
      skippedCount: 1,
    });

    expect(completed.status).toBe("completed");
    expect(completed.selectedCount).toBe(3);
    expect(completed.processedCount).toBe(1);
    expect(completed.failedCount).toBe(1);
    expect(completed.skippedCount).toBe(1);
    expect(completed.finishedAt).toBeInstanceOf(Date);
    await expect(repository.findActiveRun()).resolves.toBeNull();
  });

  it("records processing, processed, and failed document items", async () => {
    const run = await repository.createQueuedRun({
      documentId: null,
      force: false,
    });
    const item = await repository.createRunItem({
      runId: run.id,
      documentId: DOCUMENT_ID,
      title: "document.pdf",
    });

    expect(item.status).toBe("processing");
    expect(item.chunkCount).toBe(0);

    const processed = await repository.markRunItemProcessed(item.id, {
      chunkCount: 7,
    });
    expect(processed.status).toBe("processed");
    expect(processed.chunkCount).toBe(7);
    expect(processed.lastError).toBeNull();

    const failedItem = await repository.createRunItem({
      runId: run.id,
      documentId: DOCUMENT_ID,
      title: "document.pdf",
    });
    const failed = await repository.markRunItemFailed(failedItem.id, {
      errorCode: "embedding_failed",
    });
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toBe("embedding_failed");
  });

  it("returns run details with item ordering", async () => {
    const run = await repository.createQueuedRun({
      documentId: DOCUMENT_ID,
      force: true,
    });
    const sameCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const laterCreatedAt = new Date("2026-01-01T00:00:01.000Z");
    const lowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const highId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const laterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    await db.insert(ragIndexingRunItems).values([
      {
        id: highId,
        runId: run.id,
        documentId: DOCUMENT_ID,
        title: "b.pdf",
        status: "processing",
        createdAt: sameCreatedAt,
        updatedAt: sameCreatedAt,
      },
      {
        id: lowId,
        runId: run.id,
        documentId: DOCUMENT_ID,
        title: "a.pdf",
        status: "processing",
        createdAt: sameCreatedAt,
        updatedAt: sameCreatedAt,
      },
      {
        id: laterId,
        runId: run.id,
        documentId: DOCUMENT_ID,
        title: "c.pdf",
        status: "processing",
        createdAt: laterCreatedAt,
        updatedAt: laterCreatedAt,
      },
    ]);

    const details = await repository.getRunWithItems(run.id);

    expect(details?.run.id).toBe(run.id);
    expect(details?.items.map((item) => item.id)).toEqual([
      lowId,
      highId,
      laterId,
    ]);
  });
});
