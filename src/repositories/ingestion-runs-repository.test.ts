import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { ingestionRuns } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { DocumentsRepository } from "./documents-repository";
import {
  ActiveIngestionRunConflictError,
  IngestionRunsRepository,
} from "./ingestion-runs-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

describe("IngestionRunsRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let runsRepository: IngestionRunsRepository;
  let documentsRepository: DocumentsRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    runsRepository = new IngestionRunsRepository(db);
    documentsRepository = new DocumentsRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a queued run with zero counts and finds it as active", async () => {
    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });

    expect(run.status).toBe("queued");
    expect(run.maxDocuments).toBe(3);
    expect(run.selectedCount).toBe(0);
    expect(run.processedCount).toBe(0);
    expect(run.failedCount).toBe(0);
    expect(run.skippedExistingCount).toBe(0);
    expect(run.lastError).toBeNull();
    expect(run.startedAt).toBeNull();
    expect(run.finishedAt).toBeNull();

    const active = await runsRepository.findActiveRun();
    expect(active?.id).toBe(run.id);
  });

  it("finds a processing run as active and completed runs as inactive", async () => {
    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });
    const processing = await runsRepository.markProcessing(run.id);

    expect(processing.status).toBe("processing");
    expect(processing.startedAt).toBeInstanceOf(Date);
    expect((await runsRepository.findActiveRun())?.id).toBe(run.id);

    const completed = await runsRepository.completeRun(run.id, {
      selectedCount: 2,
      processedCount: 2,
      failedCount: 0,
      skippedExistingCount: 1,
    });

    expect(completed.status).toBe("completed");
    expect(completed.selectedCount).toBe(2);
    expect(completed.processedCount).toBe(2);
    expect(completed.failedCount).toBe(0);
    expect(completed.skippedExistingCount).toBe(1);
    expect(completed.lastError).toBeNull();
    expect(completed.finishedAt).toBeInstanceOf(Date);
    await expect(runsRepository.findActiveRun()).resolves.toBeNull();
  });

  it("surfaces active-run conflicts and relies on a Postgres partial unique index", async () => {
    await runsRepository.createQueuedRun({ maxDocuments: 3 });

    await expect(
      runsRepository.createQueuedRun({ maxDocuments: 3 }),
    ).rejects.toThrow(ActiveIngestionRunConflictError);

    await expect(
      db.insert(ingestionRuns).values({
        status: "processing",
        maxDocuments: 3,
      }),
    ).rejects.toThrow();
  });

  it("marks a run failed with a safe error code", async () => {
    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });

    const failed = await runsRepository.failRun(run.id, "unknown_error");

    expect(failed.status).toBe("failed");
    expect(failed.lastError).toBe("unknown_error");
    expect(failed.finishedAt).toBeInstanceOf(Date);
    await expect(runsRepository.findActiveRun()).resolves.toBeNull();
  });

  it("creates run items, links processed documents, and returns run details with ordered items", async () => {
    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });
    const firstItem = await runsRepository.createRunItem({
      runId: run.id,
      driveFileId: "drive-a",
      title: "A.pdf",
    });
    await db.execute(sql`select pg_sleep(0.001)`);
    const secondItem = await runsRepository.createRunItem({
      runId: run.id,
      driveFileId: "drive-b",
      title: "B.pdf",
    });
    const document = await documentsRepository.createPendingDocument({
      title: "A.pdf",
      driveFileId: "drive-a",
      fileHash: "sha256:a",
      pipelineVersion: "f01-b02-test",
    });

    const processedItem = await runsRepository.markRunItemProcessed(
      firstItem.id,
      document.id,
    );

    expect(processedItem.status).toBe("processed");
    expect(processedItem.documentId).toBe(document.id);
    expect(processedItem.lastError).toBeNull();

    const details = await runsRepository.getRunWithItems(run.id);
    expect(details?.run.id).toBe(run.id);
    expect(details?.items.map((item) => item.id)).toEqual([
      firstItem.id,
      secondItem.id,
    ]);
  });

  it("marks run items failed with a safe error code before or after document creation", async () => {
    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });
    const preDocumentItem = await runsRepository.createRunItem({
      runId: run.id,
      driveFileId: "drive-pre-doc",
      title: "Pre doc.pdf",
    });
    const postDocumentItem = await runsRepository.createRunItem({
      runId: run.id,
      driveFileId: "drive-post-doc",
      title: "Post doc.pdf",
    });
    const document = await documentsRepository.createPendingDocument({
      title: "Post doc.pdf",
      driveFileId: "drive-post-doc",
      fileHash: "sha256:post",
      pipelineVersion: "f01-b02-test",
    });

    const failedBeforeDocument = await runsRepository.markRunItemFailed(
      preDocumentItem.id,
      { errorCode: "drive_download_failed" },
    );
    const failedAfterDocument = await runsRepository.markRunItemFailed(
      postDocumentItem.id,
      { errorCode: "extraction_failed", documentId: document.id },
    );

    expect(failedBeforeDocument.status).toBe("failed");
    expect(failedBeforeDocument.documentId).toBeNull();
    expect(failedBeforeDocument.lastError).toBe("drive_download_failed");
    expect(failedAfterDocument.status).toBe("failed");
    expect(failedAfterDocument.documentId).toBe(document.id);
    expect(failedAfterDocument.lastError).toBe("extraction_failed");
  });
});
