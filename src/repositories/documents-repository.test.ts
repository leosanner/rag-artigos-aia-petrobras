import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { documents } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import {
  DocumentLifecycleError,
  DocumentsRepository,
} from "./documents-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

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
});
