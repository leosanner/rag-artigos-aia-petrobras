import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { documents, type DocumentStatus } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import {
  DocumentLifecycleError,
  DocumentsRepository,
} from "./documents-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

type IndexingDocumentInput = {
  id: string;
  title: string;
  status: DocumentStatus;
  refinedText?: string | null;
  updatedAt?: Date;
};

const ALPHA_HIGH_ID = "22222222-2222-4222-8222-222222222222";
const ALPHA_LOW_ID = "11111111-1111-4111-8111-111111111111";
const BETA_ID = "33333333-3333-4333-8333-333333333333";
const PENDING_ID = "44444444-4444-4444-8444-444444444444";
const FAILED_ID = "55555555-5555-4555-8555-555555555555";
const BLANK_REFINED_TEXT_ID = "66666666-6666-4666-8666-666666666666";

async function insertDocumentForIndexing(
  db: TestDatabase,
  input: IndexingDocumentInput,
): Promise<void> {
  await db.insert(documents).values({
    id: input.id,
    title: input.title,
    driveFileId: `drive-${input.id}`,
    fileHash: `hash-${input.id}`,
    pipelineVersion: "f02-b02-test",
    status: input.status,
    rawText: input.status === "processed" ? "raw text" : null,
    refinedText: input.refinedText ?? null,
    updatedAt: input.updatedAt,
  });
}

describe("DocumentsRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let repository: DocumentsRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    repository = new DocumentsRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a governed pending document without inferring bibliographic fields", async () => {
    const created = await repository.createPendingDocument({
      title: "paper.pdf",
      driveFileId: "drive-file-1",
      fileHash: "sha256:abc",
      pipelineVersion: "f01-b02-test",
    });

    expect(created.status).toBe("pending");
    expect(created.title).toBe("paper.pdf");
    expect(created.driveFileId).toBe("drive-file-1");
    expect(created.origin).toBe("google_drive");
    expect(created.fileHash).toBe("sha256:abc");
    expect(created.pipelineVersion).toBe("f01-b02-test");
    expect(created.doi).toBeNull();
    expect(created.authors).toBeNull();
    expect(created.publicationYear).toBeNull();
    expect(created.notes).toBeNull();
    expect(created.rawText).toBeNull();
    expect(created.refinedText).toBeNull();
    expect(created.lastError).toBeNull();

    await expect(
      repository.existsByDriveFileId("drive-file-1"),
    ).resolves.toBe(true);
    await expect(
      repository.existsByDriveFileId("missing-drive-file"),
    ).resolves.toBe(false);
  });

  it("persists raw text, refined text, and marks a pending document processed", async () => {
    const created = await repository.createPendingDocument({
      title: "processed.pdf",
      driveFileId: "drive-file-2",
      fileHash: "sha256:def",
      pipelineVersion: "f01-b02-test",
    });

    const withRawText = await repository.saveRawText(
      created.id,
      "Extracted text",
    );
    expect(withRawText.status).toBe("pending");
    expect(withRawText.rawText).toBe("Extracted text");

    const processed = await repository.markProcessed(
      created.id,
      "Refined text",
    );

    expect(processed.status).toBe("processed");
    expect(processed.rawText).toBe("Extracted text");
    expect(processed.refinedText).toBe("Refined text");
    expect(processed.lastError).toBeNull();

    const [stored] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, created.id));
    expect(stored?.status).toBe("processed");
    expect(stored?.rawText).toBe("Extracted text");
    expect(stored?.refinedText).toBe("Refined text");
  });

  it("marks a pending document failed with a safe error code and preserves persisted text", async () => {
    const created = await repository.createPendingDocument({
      title: "failed.pdf",
      driveFileId: "drive-file-3",
      fileHash: "sha256:ghi",
      pipelineVersion: "f01-b02-test",
    });
    await repository.saveRawText(created.id, "Extracted before failure");

    const failed = await repository.markFailed(
      created.id,
      "refinement_failed",
    );

    expect(failed.status).toBe("failed");
    expect(failed.rawText).toBe("Extracted before failure");
    expect(failed.refinedText).toBeNull();
    expect(failed.lastError).toBe("refinement_failed");
  });

  it("rejects empty text and processing without raw text", async () => {
    const created = await repository.createPendingDocument({
      title: "invalid.pdf",
      driveFileId: "drive-file-4",
      fileHash: "sha256:jkl",
      pipelineVersion: "f01-b02-test",
    });

    await expect(repository.saveRawText(created.id, "   ")).rejects.toThrow(
      DocumentLifecycleError,
    );
    await expect(
      repository.markProcessed(created.id, "Refined text"),
    ).rejects.toThrow(DocumentLifecycleError);

    await repository.saveRawText(created.id, "Raw text");
    await expect(repository.markProcessed(created.id, "\n\t")).rejects.toThrow(
      DocumentLifecycleError,
    );
  });

  it("does not mutate terminal documents through lifecycle methods", async () => {
    const created = await repository.createPendingDocument({
      title: "terminal.pdf",
      driveFileId: "drive-file-5",
      fileHash: "sha256:mno",
      pipelineVersion: "f01-b02-test",
    });
    await repository.markFailed(created.id, "extraction_failed");

    await expect(
      repository.saveRawText(created.id, "Late raw text"),
    ).rejects.toThrow(DocumentLifecycleError);
    await expect(
      repository.markProcessed(created.id, "Late refined text"),
    ).rejects.toThrow(DocumentLifecycleError);
    await expect(
      repository.markFailed(created.id, "unknown_error"),
    ).rejects.toThrow(DocumentLifecycleError);
  });

  it("lists only processed documents for indexing in title and id order", async () => {
    await insertDocumentForIndexing(db, {
      id: ALPHA_HIGH_ID,
      title: "alpha.pdf",
      status: "processed",
      refinedText: "alpha high",
    });
    await insertDocumentForIndexing(db, {
      id: BETA_ID,
      title: "beta.pdf",
      status: "processed",
      refinedText: "beta",
    });
    await insertDocumentForIndexing(db, {
      id: PENDING_ID,
      title: "pending.pdf",
      status: "pending",
    });
    await insertDocumentForIndexing(db, {
      id: FAILED_ID,
      title: "failed.pdf",
      status: "failed",
    });
    await insertDocumentForIndexing(db, {
      id: ALPHA_LOW_ID,
      title: "alpha.pdf",
      status: "processed",
      refinedText: "alpha low",
    });

    const indexedDocuments = await repository.listProcessedForIndexing();

    expect(indexedDocuments.map((document) => document.id)).toEqual([
      ALPHA_LOW_ID,
      ALPHA_HIGH_ID,
      BETA_ID,
    ]);
    expect(indexedDocuments.every((document) => document.status === "processed"))
      .toBe(true);
  });

  it("finds documents for indexing without mutating source rows", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    await insertDocumentForIndexing(db, {
      id: BLANK_REFINED_TEXT_ID,
      title: "blank-refined-text.pdf",
      status: "processed",
      refinedText: "   ",
      updatedAt,
    });

    const [before] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, BLANK_REFINED_TEXT_ID));

    const found = await repository.findByIdForIndexing(BLANK_REFINED_TEXT_ID);
    await expect(
      repository.findByIdForIndexing("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBeNull();

    const [after] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, BLANK_REFINED_TEXT_ID));

    expect(found?.id).toBe(BLANK_REFINED_TEXT_ID);
    expect(found?.status).toBe("processed");
    expect(found?.refinedText).toBe("   ");
    expect(after).toEqual(before);
  });
});
