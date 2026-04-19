import { describe, expect, it, vi } from "vitest";

import type {
  DriveFileCandidate,
  DriveFileSource,
  FileHasher,
  PdfExtractor,
} from "@/application/ingestion/ports";
import type { Document, IngestionRun, IngestionRunItem } from "@/db/schema";
import { IngestionError } from "@/domain/documents/errors";
import { pipelineVersion as DEFAULT_PIPELINE_VERSION } from "@/domain/documents/pipeline-version";
import type { DocumentsRepository } from "@/repositories/documents-repository";
import type { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";

import { ProcessIngestionRun } from "./process-ingestion-run";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

type DocsRepoStub = Pick<
  DocumentsRepository,
  | "existsByDriveFileId"
  | "createPendingDocument"
  | "saveRawText"
  | "markProcessed"
  | "markFailed"
>;

type RunsRepoStub = Pick<
  IngestionRunsRepository,
  | "markProcessing"
  | "failRun"
  | "createRunItem"
  | "markRunItemProcessed"
  | "markRunItemFailed"
  | "completeRun"
>;

type Deps = {
  driveSource: DriveFileSource;
  pdfExtractor: PdfExtractor;
  refiner: (rawText: string) => string;
  hasher: FileHasher;
  documentsRepository: DocsRepoStub;
  runsRepository: RunsRepoStub;
  pipelineVersion?: string;
  maxDocuments?: number;
};

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

function buildDocument(overrides: Partial<Document> = {}): Document {
  const now = new Date("2026-04-18T10:00:00.000Z");
  return {
    id: "doc-id",
    title: "title",
    driveFileId: "drive-file",
    origin: "google_drive",
    fileHash: "hash",
    pipelineVersion: DEFAULT_PIPELINE_VERSION,
    status: "pending",
    doi: null,
    authors: null,
    publicationYear: null,
    notes: null,
    rawText: null,
    refinedText: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  const now = new Date("2026-04-18T10:00:00.000Z");
  return {
    id: RUN_ID,
    status: "processing",
    maxDocuments: 3,
    selectedCount: 0,
    processedCount: 0,
    failedCount: 0,
    skippedExistingCount: 0,
    lastError: null,
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function buildRunItem(overrides: Partial<IngestionRunItem> = {}): IngestionRunItem {
  const now = new Date("2026-04-18T10:00:00.000Z");
  return {
    id: "item-id",
    runId: RUN_ID,
    driveFileId: "drive-file",
    documentId: null,
    title: "title",
    status: "processing",
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function bytesFor(id: string): Uint8Array {
  return new TextEncoder().encode(`pdf:${id}`);
}

function buildDefaultDeps(overrides: Partial<Deps> = {}): Deps {
  const documentsById = new Map<string, Document>();
  const itemsById = new Map<string, IngestionRunItem>();
  const maxDocuments = overrides.maxDocuments ?? 3;

  const documentsRepository: DocsRepoStub = {
    existsByDriveFileId: vi.fn().mockResolvedValue(false),
    createPendingDocument: vi.fn(async ({ driveFileId, title, fileHash, pipelineVersion }) => {
      const id = `doc-${driveFileId}`;
      const doc = buildDocument({ id, driveFileId, title, fileHash, pipelineVersion });
      documentsById.set(id, doc);
      return doc;
    }),
    saveRawText: vi.fn(async (documentId: string, rawText: string) => {
      const existing = documentsById.get(documentId) ?? buildDocument({ id: documentId });
      const next = { ...existing, rawText };
      documentsById.set(documentId, next);
      return next;
    }),
    markProcessed: vi.fn(async (documentId: string, refinedText: string) => {
      const existing = documentsById.get(documentId) ?? buildDocument({ id: documentId });
      const next: Document = { ...existing, status: "processed", refinedText };
      documentsById.set(documentId, next);
      return next;
    }),
    markFailed: vi.fn(async (documentId: string, errorCode) => {
      const existing = documentsById.get(documentId) ?? buildDocument({ id: documentId });
      const next: Document = { ...existing, status: "failed", lastError: errorCode };
      documentsById.set(documentId, next);
      return next;
    }),
  };

  const runsRepository: RunsRepoStub = {
    markProcessing: vi.fn().mockResolvedValue(buildRun({ maxDocuments })),
    failRun: vi.fn().mockResolvedValue(undefined),
    createRunItem: vi.fn(async ({ runId, driveFileId, title }) => {
      const id = `item-${driveFileId}`;
      const item = buildRunItem({ id, runId, driveFileId, title });
      itemsById.set(id, item);
      return item;
    }),
    markRunItemProcessed: vi.fn(async (itemId, documentId) => {
      const existing = itemsById.get(itemId) ?? buildRunItem({ id: itemId });
      const next: IngestionRunItem = {
        ...existing,
        status: "processed",
        documentId,
      };
      itemsById.set(itemId, next);
      return next;
    }),
    markRunItemFailed: vi.fn(async (itemId, input) => {
      const existing = itemsById.get(itemId) ?? buildRunItem({ id: itemId });
      const next: IngestionRunItem = {
        ...existing,
        status: "failed",
        lastError: input.errorCode,
        documentId: input.documentId ?? null,
      };
      itemsById.set(itemId, next);
      return next;
    }),
    completeRun: vi.fn().mockResolvedValue(undefined),
  };

  return {
    driveSource: {
      listFiles: vi.fn().mockResolvedValue([]),
      downloadFile: vi.fn(async (id: string) => bytesFor(id)),
    },
    pdfExtractor: {
      extract: vi.fn(async (bytes: Uint8Array) => `raw:${new TextDecoder().decode(bytes)}`),
    },
    refiner: vi.fn((raw: string) => `refined:${raw}`),
    hasher: {
      hash: vi.fn((bytes: Uint8Array) => `hash:${new TextDecoder().decode(bytes)}`),
    },
    documentsRepository,
    runsRepository,
    ...overrides,
  };
}

function buildService(deps: Deps) {
  return new ProcessIngestionRun({
    driveSource: deps.driveSource,
    pdfExtractor: deps.pdfExtractor,
    refiner: deps.refiner,
    hasher: deps.hasher,
    documentsRepository: deps.documentsRepository as unknown as DocumentsRepository,
    runsRepository: deps.runsRepository as unknown as IngestionRunsRepository,
    pipelineVersion: deps.pipelineVersion,
    maxDocuments: deps.maxDocuments,
  });
}

describe("ProcessIngestionRun", () => {
  it("marks the run processing before listing Drive files", async () => {
    const calls: string[] = [];
    const deps = buildDefaultDeps();
    (deps.runsRepository.markProcessing as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        calls.push("markProcessing");
        return buildRun();
      },
    );
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        calls.push("listFiles");
        return [];
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(calls).toEqual(["markProcessing", "listFiles"]);
    expect(deps.runsRepository.markProcessing).toHaveBeenCalledWith(RUN_ID);
  });

  it("completes the run with skippedExistingCount and no new items when every candidate already exists", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "existing-1", name: "a.pdf" }),
      buildCandidate({ driveFileId: "existing-2", name: "b.pdf" }),
    ]);
    (deps.documentsRepository.existsByDriveFileId as ReturnType<typeof vi.fn>).mockResolvedValue(
      true,
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.createRunItem).not.toHaveBeenCalled();
    expect(deps.driveSource.downloadFile).not.toHaveBeenCalled();
    expect(deps.documentsRepository.createPendingDocument).not.toHaveBeenCalled();
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 0,
      processedCount: 0,
      failedCount: 0,
      skippedExistingCount: 2,
    });
  });

  it("caps selection at maxDocuments in Drive listing order", async () => {
    const deps = buildDefaultDeps({ maxDocuments: 3 });
    const candidates = [1, 2, 3, 4, 5].map((i) =>
      buildCandidate({ driveFileId: `new-${i}`, name: `f-${i}.pdf` }),
    );
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue(candidates);

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.createRunItem).toHaveBeenCalledTimes(3);
    const calls = (deps.runsRepository.createRunItem as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => c[0].driveFileId)).toEqual(["new-1", "new-2", "new-3"]);
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 3,
      processedCount: 3,
      failedCount: 0,
      skippedExistingCount: 0,
    });
  });

  it("uses the maxDocuments value persisted on the run returned by markProcessing", async () => {
    const deps = buildDefaultDeps({ maxDocuments: 3 });
    (deps.runsRepository.markProcessing as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildRun({ maxDocuments: 2 }),
    );
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "new-1", name: "f-1.pdf" }),
      buildCandidate({ driveFileId: "new-2", name: "f-2.pdf" }),
      buildCandidate({ driveFileId: "new-3", name: "f-3.pdf" }),
    ]);

    await buildService(deps).execute(RUN_ID);

    const calls = (deps.runsRepository.createRunItem as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => c[0].driveFileId)).toEqual(["new-1", "new-2"]);
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 2,
      failedCount: 0,
      skippedExistingCount: 0,
    });
  });

  it("skips existing candidates and selects only new ones while respecting the cap", async () => {
    const deps = buildDefaultDeps({ maxDocuments: 3 });
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "new-a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "existing-x", name: "x.pdf" }),
      buildCandidate({ driveFileId: "new-b", name: "b.pdf" }),
      buildCandidate({ driveFileId: "new-c", name: "c.pdf" }),
    ]);
    (deps.documentsRepository.existsByDriveFileId as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: string) => id === "existing-x",
    );

    await buildService(deps).execute(RUN_ID);

    const createdIds = (deps.runsRepository.createRunItem as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].driveFileId,
    );
    expect(createdIds).toEqual(["new-a", "new-b", "new-c"]);
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 3,
      processedCount: 3,
      failedCount: 0,
      skippedExistingCount: 1,
    });
  });

  it("drops non-PDF candidates before partitioning", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "pdf-1", name: "a.pdf" }),
      buildCandidate({
        driveFileId: "notes",
        name: "notes.txt",
        mimeType: "text/plain",
      }),
      buildCandidate({ driveFileId: "pdf-2", name: "b.PDF", mimeType: null }),
    ]);

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.existsByDriveFileId).not.toHaveBeenCalledWith("notes");
    const createdIds = (deps.runsRepository.createRunItem as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].driveFileId,
    );
    expect(createdIds).toEqual(["pdf-1", "pdf-2"]);
  });

  it("passes title, driveFileId, fileHash, and pipelineVersion to createPendingDocument", async () => {
    const deps = buildDefaultDeps({ pipelineVersion: "test-version" });
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "abc", name: "art.pdf" }),
    ]);
    (deps.hasher.hash as ReturnType<typeof vi.fn>).mockReturnValue("fixed-hash");

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.createPendingDocument).toHaveBeenCalledWith({
      title: "art.pdf",
      driveFileId: "abc",
      fileHash: "fixed-hash",
      pipelineVersion: "test-version",
    });
  });

  it("defaults pipelineVersion to the domain constant when not provided", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "abc", name: "art.pdf" }),
    ]);

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.createPendingDocument).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineVersion: DEFAULT_PIPELINE_VERSION }),
    );
  });

  it("creates the run item before downloading the file", async () => {
    const deps = buildDefaultDeps();
    const calls: string[] = [];
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "abc", name: "art.pdf" }),
    ]);
    (deps.runsRepository.createRunItem as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ driveFileId }) => {
        calls.push("createRunItem");
        return buildRunItem({ id: `item-${driveFileId}`, driveFileId });
      },
    );
    (deps.driveSource.downloadFile as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        calls.push("downloadFile");
        return bytesFor("abc");
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(calls).toEqual(["createRunItem", "downloadFile"]);
  });

  it("marks the run item failed and does not create a document when the Drive download throws", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "abc", name: "art.pdf" }),
      buildCandidate({ driveFileId: "def", name: "ok.pdf" }),
    ]);
    (deps.driveSource.downloadFile as ReturnType<typeof vi.fn>).mockImplementation(
      async (id: string) => {
        if (id === "abc") {
          throw new IngestionError("drive_download_failed", "boom");
        }
        return bytesFor(id);
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.createPendingDocument).toHaveBeenCalledTimes(1);
    const createdIds = (
      deps.documentsRepository.createPendingDocument as ReturnType<typeof vi.fn>
    ).mock.calls.map((c) => c[0].driveFileId);
    expect(createdIds).toEqual(["def"]);

    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-abc", {
      errorCode: "drive_download_failed",
    });
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("marks the run item failed and keeps processing when hashing fails before document creation", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
    ]);
    (deps.hasher.hash as ReturnType<typeof vi.fn>).mockImplementation(
      (bytes: Uint8Array) => {
        const decoded = new TextDecoder().decode(bytes);
        if (decoded === "pdf:a") {
          throw new Error("hash provider leaked detail");
        }
        return `hash:${decoded}`;
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "unknown_error",
    });
    expect(deps.documentsRepository.createPendingDocument).toHaveBeenCalledTimes(1);
    expect(deps.documentsRepository.createPendingDocument).toHaveBeenCalledWith(
      expect.objectContaining({ driveFileId: "b" }),
    );
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-b", "doc-b");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("marks the run item failed and keeps processing when pending document creation fails", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
    ]);
    (
      deps.documentsRepository.createPendingDocument as ReturnType<typeof vi.fn>
    ).mockImplementation(async ({ driveFileId, title, fileHash, pipelineVersion }) => {
      if (driveFileId === "a") {
        throw new Error("unique violation with raw provider text");
      }
      return buildDocument({
        id: `doc-${driveFileId}`,
        driveFileId,
        title,
        fileHash,
        pipelineVersion,
      });
    });

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "unknown_error",
    });
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-b", "doc-b");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("marks document and run item failed on extraction error and keeps processing other items", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
      buildCandidate({ driveFileId: "c", name: "c.pdf" }),
    ]);
    (deps.pdfExtractor.extract as ReturnType<typeof vi.fn>).mockImplementation(
      async (bytes: Uint8Array) => {
        const decoded = new TextDecoder().decode(bytes);
        if (decoded === "pdf:b") {
          throw new IngestionError("extraction_failed", "oh no");
        }
        return `raw:${decoded}`;
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.markFailed).toHaveBeenCalledWith(
      "doc-b",
      "extraction_failed",
    );
    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-b", {
      errorCode: "extraction_failed",
      documentId: "doc-b",
    });
    expect(deps.documentsRepository.saveRawText).not.toHaveBeenCalledWith(
      "doc-b",
      expect.anything(),
    );
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-a", "doc-a");
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-c", "doc-c");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 3,
      processedCount: 2,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("marks the document and run item failed when saving raw_text fails after document creation", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
    ]);
    (deps.documentsRepository.saveRawText as ReturnType<typeof vi.fn>).mockImplementation(
      async (docId: string, rawText: string) => {
        if (docId === "doc-a") {
          throw new Error("database raw text detail");
        }
        return buildDocument({ id: docId, rawText });
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.markFailed).toHaveBeenCalledWith(
      "doc-a",
      "unknown_error",
    );
    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "unknown_error",
      documentId: "doc-a",
    });
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-b", "doc-b");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("marks the document failed on refinement error after raw_text is persisted", async () => {
    const deps = buildDefaultDeps();
    const calls: string[] = [];
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
    ]);
    (deps.documentsRepository.saveRawText as ReturnType<typeof vi.fn>).mockImplementation(
      async (docId: string, rawText: string) => {
        calls.push("saveRawText");
        return buildDocument({ id: docId, rawText });
      },
    );
    (deps.refiner as ReturnType<typeof vi.fn>).mockImplementation(() => {
      calls.push("refiner");
      throw new IngestionError("refined_text_empty", "empty");
    });
    (deps.documentsRepository.markFailed as ReturnType<typeof vi.fn>).mockImplementation(
      async (docId: string, code) => {
        calls.push("markFailed");
        return buildDocument({ id: docId, status: "failed", lastError: code });
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(calls).toEqual(["saveRawText", "refiner", "markFailed"]);
    expect(deps.documentsRepository.markFailed).toHaveBeenCalledWith(
      "doc-a",
      "refined_text_empty",
    );
    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "refined_text_empty",
      documentId: "doc-a",
    });
  });

  it("fails the run with drive_listing_failed and creates no items when listing throws", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("quota exceeded"),
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.failRun).toHaveBeenCalledWith(
      RUN_ID,
      "drive_listing_failed",
    );
    expect(deps.runsRepository.createRunItem).not.toHaveBeenCalled();
    expect(deps.documentsRepository.createPendingDocument).not.toHaveBeenCalled();
    expect(deps.runsRepository.completeRun).not.toHaveBeenCalled();
  });

  it("propagates errors from markProcessing and does not call Drive", async () => {
    const deps = buildDefaultDeps();
    (deps.runsRepository.markProcessing as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("lifecycle error"),
    );

    await expect(buildService(deps).execute(RUN_ID)).rejects.toThrow("lifecycle error");
    expect(deps.driveSource.listFiles).not.toHaveBeenCalled();
    expect(deps.runsRepository.failRun).not.toHaveBeenCalled();
  });

  it("marks the run item failed with unknown_error when markProcessed throws for non-IngestionError reasons", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
    ]);
    (deps.documentsRepository.markProcessed as ReturnType<typeof vi.fn>).mockImplementation(
      async (docId: string, refined: string) => {
        if (docId === "doc-a") {
          throw new Error("concurrent update");
        }
        return buildDocument({ id: docId, status: "processed", refinedText: refined });
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "unknown_error",
      documentId: "doc-a",
    });
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-b", "doc-b");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("follows markProcessed with markRunItemProcessed on success", async () => {
    const deps = buildDefaultDeps();
    const calls: string[] = [];
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
    ]);
    (deps.documentsRepository.markProcessed as ReturnType<typeof vi.fn>).mockImplementation(
      async (docId: string, refined: string) => {
        calls.push("markProcessed");
        return buildDocument({ id: docId, status: "processed", refinedText: refined });
      },
    );
    (deps.runsRepository.markRunItemProcessed as ReturnType<typeof vi.fn>).mockImplementation(
      async (itemId: string, docId: string) => {
        calls.push("markRunItemProcessed");
        return buildRunItem({ id: itemId, status: "processed", documentId: docId });
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(calls).toEqual(["markProcessed", "markRunItemProcessed"]);
  });

  it("marks the run item failed and keeps processing when markRunItemProcessed throws", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
      buildCandidate({ driveFileId: "b", name: "b.pdf" }),
    ]);
    (deps.runsRepository.markRunItemProcessed as ReturnType<typeof vi.fn>).mockImplementation(
      async (itemId: string, docId: string) => {
        if (itemId === "item-a") {
          throw new Error("item lifecycle conflict");
        }
        return buildRunItem({ id: itemId, status: "processed", documentId: docId });
      },
    );

    await buildService(deps).execute(RUN_ID);

    expect(deps.documentsRepository.markProcessed).toHaveBeenCalledWith(
      "doc-a",
      "refined:raw:pdf:a",
    );
    expect(deps.runsRepository.markRunItemFailed).toHaveBeenCalledWith("item-a", {
      errorCode: "unknown_error",
      documentId: "doc-a",
    });
    expect(deps.runsRepository.markRunItemProcessed).toHaveBeenCalledWith("item-b", "doc-b");
    expect(deps.runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedExistingCount: 0,
    });
  });

  it("derives refined_text through the injected refiner", async () => {
    const deps = buildDefaultDeps();
    (deps.driveSource.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      buildCandidate({ driveFileId: "a", name: "a.pdf" }),
    ]);

    await buildService(deps).execute(RUN_ID);

    expect(deps.refiner).toHaveBeenCalledWith("raw:pdf:a");
    expect(deps.documentsRepository.markProcessed).toHaveBeenCalledWith(
      "doc-a",
      "refined:raw:pdf:a",
    );
  });
});
