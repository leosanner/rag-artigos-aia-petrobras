import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { refineText } from "@/domain/text/deterministic-refiner";
import { pipelineVersion } from "@/domain/documents/pipeline-version";
import { Sha256FileHasher } from "@/infrastructure/crypto/sha256-file-hasher";
import { UnpdfPdfExtractor } from "@/infrastructure/pdf/unpdf-pdf-extractor";
import {
  documents,
  ingestionRunItems,
  ingestionRuns,
} from "@/db/schema";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import type {
  DriveFileCandidate,
  DriveFileSource,
} from "./ports";
import { ProcessIngestionRun } from "./process-ingestion-run";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const EXISTING_DRIVE_FILE_ID = "existing-drive-file-id";

function buildCandidate(
  overrides: Partial<DriveFileCandidate> & {
    driveFileId: string;
    name: string;
  },
): DriveFileCandidate {
  return {
    mimeType: "application/pdf",
    createdTime: "2026-01-01T00:00:00.000Z",
    modifiedTime: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProcessIngestionRun (integration)", () => {
  let db: TestDatabase;
  let pool: Pool;
  let documentsRepository: DocumentsRepository;
  let runsRepository: IngestionRunsRepository;
  let pdfBytes: Uint8Array;

  beforeAll(async () => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    documentsRepository = new DocumentsRepository(db);
    runsRepository = new IngestionRunsRepository(db);
    const fixturePath = path.resolve(
      process.cwd(),
      "assets/pdfs/art3.pdf",
    );
    const buffer = await readFile(fixturePath);
    pdfBytes = new Uint8Array(buffer);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("processes a mixed batch end-to-end with per-item failure isolation", async () => {
    const existing = await documentsRepository.createPendingDocument({
      title: "existing.pdf",
      driveFileId: EXISTING_DRIVE_FILE_ID,
      fileHash: "preseed-hash",
      pipelineVersion: "preseed-version",
    });

    const candidates: DriveFileCandidate[] = [
      buildCandidate({ driveFileId: "new-1", name: "new-1.pdf" }),
      buildCandidate({
        driveFileId: EXISTING_DRIVE_FILE_ID,
        name: "existing.pdf",
      }),
      buildCandidate({ driveFileId: "new-2", name: "new-2.pdf" }),
      buildCandidate({ driveFileId: "broken", name: "broken.pdf" }),
      buildCandidate({ driveFileId: "overflow", name: "overflow.pdf" }),
    ];

    const driveSource: DriveFileSource = {
      listFiles: async () => candidates,
      downloadFile: async (driveFileId: string) => {
        if (driveFileId === "broken") {
          return new Uint8Array([0, 1, 2, 3, 4]);
        }
        return new Uint8Array(pdfBytes);
      },
    };

    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });
    const service = new ProcessIngestionRun({
      driveSource,
      pdfExtractor: new UnpdfPdfExtractor(),
      refiner: refineText,
      hasher: new Sha256FileHasher(),
      documentsRepository,
      runsRepository,
    });

    await service.execute(run.id);

    const [persistedRun] = await db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, run.id));
    expect(persistedRun.status).toBe("completed");
    expect(persistedRun.selectedCount).toBe(3);
    expect(persistedRun.processedCount).toBe(2);
    expect(persistedRun.failedCount).toBe(1);
    expect(persistedRun.skippedExistingCount).toBe(1);
    expect(persistedRun.lastError).toBeNull();

    const items = await db
      .select()
      .from(ingestionRunItems)
      .where(eq(ingestionRunItems.runId, run.id));
    expect(items).toHaveLength(3);
    const itemsByDrive = Object.fromEntries(
      items.map((item) => [item.driveFileId, item]),
    );
    expect(itemsByDrive["new-1"].status).toBe("processed");
    expect(itemsByDrive["new-1"].documentId).not.toBeNull();
    expect(itemsByDrive["new-2"].status).toBe("processed");
    expect(itemsByDrive["new-2"].documentId).not.toBeNull();
    expect(itemsByDrive["broken"].status).toBe("failed");
    expect(itemsByDrive["broken"].lastError).toBe("extraction_failed");
    expect(itemsByDrive["broken"].documentId).not.toBeNull();
    expect(itemsByDrive).not.toHaveProperty("overflow");
    expect(itemsByDrive).not.toHaveProperty(EXISTING_DRIVE_FILE_ID);

    const allDocuments = await db.select().from(documents);
    expect(allDocuments).toHaveLength(4);

    const newProcessed = allDocuments.filter(
      (doc) => doc.driveFileId === "new-1" || doc.driveFileId === "new-2",
    );
    expect(newProcessed).toHaveLength(2);
    for (const doc of newProcessed) {
      expect(doc.status).toBe("processed");
      expect(doc.pipelineVersion).toBe(pipelineVersion);
      expect(doc.origin).toBe("google_drive");
      expect(doc.rawText?.length ?? 0).toBeGreaterThan(0);
      expect(doc.refinedText?.length ?? 0).toBeGreaterThan(0);
      expect(doc.fileHash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.doi).toBeNull();
      expect(doc.authors).toBeNull();
      expect(doc.publicationYear).toBeNull();
      expect(doc.notes).toBeNull();
      expect(doc.lastError).toBeNull();
    }

    const brokenDoc = allDocuments.find(
      (doc) => doc.driveFileId === "broken",
    );
    expect(brokenDoc).toBeDefined();
    expect(brokenDoc?.status).toBe("failed");
    expect(brokenDoc?.lastError).toBe("extraction_failed");
    expect(brokenDoc?.rawText).toBeNull();
    expect(brokenDoc?.refinedText).toBeNull();

    const preservedExisting = allDocuments.find(
      (doc) => doc.id === existing.id,
    );
    expect(preservedExisting).toBeDefined();
    expect(preservedExisting?.status).toBe("pending");
    expect(preservedExisting?.fileHash).toBe("preseed-hash");
    expect(preservedExisting?.pipelineVersion).toBe("preseed-version");
  });

  it("fails the run with drive_listing_failed when listFiles throws", async () => {
    const driveSource: DriveFileSource = {
      listFiles: async () => {
        throw new Error("quota exceeded");
      },
      downloadFile: async () => {
        throw new Error("should not be called");
      },
    };

    const run = await runsRepository.createQueuedRun({ maxDocuments: 3 });
    const service = new ProcessIngestionRun({
      driveSource,
      pdfExtractor: new UnpdfPdfExtractor(),
      refiner: refineText,
      hasher: new Sha256FileHasher(),
      documentsRepository,
      runsRepository,
    });

    await service.execute(run.id);

    const [persistedRun] = await db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, run.id));
    expect(persistedRun.status).toBe("failed");
    expect(persistedRun.lastError).toBe("drive_listing_failed");

    const items = await db
      .select()
      .from(ingestionRunItems)
      .where(eq(ingestionRunItems.runId, run.id));
    expect(items).toHaveLength(0);
  });
});
