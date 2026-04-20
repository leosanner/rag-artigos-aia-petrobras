import { describe, expect, it, vi } from "vitest";

import type { Document, RagIndexingRun, RagIndexingRunItem } from "@/db/schema";
import type { ChunkedText } from "@/domain/chunking/hybrid-text-chunker";
import type { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import type { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

import { ProcessIndexingRun } from "./process-indexing-run";
import type { EmbeddingProvider, IndexingDocumentsRepository } from "./ports";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const DOC_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMBEDDING_DIMENSIONS = 3072;

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

function buildRun(overrides: Partial<RagIndexingRun> = {}): RagIndexingRun {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: RUN_ID,
    status: "processing",
    documentId: null,
    force: false,
    selectedCount: 0,
    processedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    lastError: null,
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function buildDocument(overrides: Partial<Document> = {}): Document {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: DOC_A_ID,
    title: "doc-a.pdf",
    driveFileId: "drive-a",
    origin: "google_drive",
    fileHash: "hash-a",
    pipelineVersion: "f01-1.0.0",
    status: "processed",
    doi: null,
    authors: null,
    publicationYear: null,
    notes: null,
    rawText: "raw text",
    refinedText: "refined text",
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildItem(overrides: Partial<RagIndexingRunItem> = {}): RagIndexingRunItem {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: `item-${overrides.documentId ?? DOC_A_ID}`,
    runId: RUN_ID,
    documentId: DOC_A_ID,
    title: "doc-a.pdf",
    status: "processing",
    chunkCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function chunk(index: number, content = `chunk ${index}`): ChunkedText {
  return {
    chunkIndex: index,
    content,
    estimatedTokens: content.split(/\s+/).length,
  };
}

function buildDeps(overrides: {
  run?: Partial<RagIndexingRun>;
  documents?: Document[];
  hasChunks?: (documentId: string) => boolean;
  embedMany?: EmbeddingProvider["embedMany"];
  chunk?: (input: { refinedText: string }) => ChunkedText[];
} = {}) {
  const docs = overrides.documents ?? [buildDocument({ id: DOC_A_ID })];
  const run = buildRun(overrides.run);

  const runsRepository = {
    markProcessing: vi.fn().mockResolvedValue(run),
    createRunItem: vi.fn(async ({ runId, documentId, title }) =>
      buildItem({ id: `item-${documentId}`, runId, documentId, title }),
    ),
    markRunItemProcessed: vi.fn(async (itemId, { chunkCount }) =>
      buildItem({ id: itemId, status: "processed", chunkCount }),
    ),
    markRunItemFailed: vi.fn(async (itemId, { errorCode }) =>
      buildItem({ id: itemId, status: "failed", lastError: errorCode }),
    ),
    completeRun: vi.fn().mockResolvedValue(buildRun({ status: "completed" })),
    failRun: vi.fn().mockResolvedValue(buildRun({ status: "failed" })),
  } satisfies Partial<RagIndexingRunsRepository>;

  const documentsRepository = {
    listProcessedForIndexing: vi.fn(async () =>
      docs.filter((doc) => doc.status === "processed"),
    ),
    findByIdForIndexing: vi.fn(async (documentId: string) =>
      docs.find((doc) => doc.id === documentId) ?? null,
    ),
  } satisfies IndexingDocumentsRepository;

  const chunksRepository = {
    hasChunksForConfig: vi.fn(async (documentId: string) =>
      overrides.hasChunks?.(documentId) ?? false,
    ),
    replaceDocumentChunks: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<DocumentChunksRepository>;

  const chunker = {
    chunk: vi.fn((input: { refinedText: string }) =>
      overrides.chunk?.(input) ?? [chunk(0, input.refinedText)],
    ),
  };

  const embeddingProvider: EmbeddingProvider = {
    embedMany: vi.fn(
      overrides.embedMany ??
        (async (texts) => texts.map((_, index) => vector(index / 10))),
    ),
  };

  const service = new ProcessIndexingRun({
    runsRepository: runsRepository as RagIndexingRunsRepository,
    documentsRepository,
    chunksRepository: chunksRepository as DocumentChunksRepository,
    chunker,
    embeddingProvider,
  });

  return {
    service,
    runsRepository,
    documentsRepository,
    chunksRepository,
    chunker,
    embeddingProvider,
  };
}

describe("ProcessIndexingRun", () => {
  it("selects only processed documents in repository order and never reads raw_text", async () => {
    const docs = [
      buildDocument({ id: DOC_A_ID, refinedText: "alpha refined", rawText: "alpha raw" }),
      buildDocument({
        id: DOC_B_ID,
        title: "doc-b.pdf",
        refinedText: "beta refined",
        rawText: "beta raw",
      }),
      buildDocument({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "pending",
        refinedText: "pending refined",
      }),
    ];
    const { service, documentsRepository, chunker, embeddingProvider } = buildDeps({
      documents: docs,
    });

    await service.execute(RUN_ID);

    expect(documentsRepository.listProcessedForIndexing).toHaveBeenCalledOnce();
    expect(chunker.chunk).toHaveBeenCalledWith({ refinedText: "alpha refined" });
    expect(chunker.chunk).toHaveBeenCalledWith({ refinedText: "beta refined" });
    expect(embeddingProvider.embedMany).toHaveBeenCalledWith(["alpha refined"]);
    expect(embeddingProvider.embedMany).toHaveBeenCalledWith(["beta refined"]);
  });

  it("skips documents already indexed when force is false and records only aggregate skippedCount", async () => {
    const docs = [
      buildDocument({ id: DOC_A_ID }),
      buildDocument({ id: DOC_B_ID, title: "doc-b.pdf" }),
    ];
    const { service, runsRepository, chunksRepository } = buildDeps({
      documents: docs,
      hasChunks: (documentId) => documentId === DOC_A_ID,
    });

    await service.execute(RUN_ID);

    expect(chunksRepository.replaceDocumentChunks).toHaveBeenCalledTimes(1);
    expect(runsRepository.createRunItem).toHaveBeenCalledTimes(1);
    expect(runsRepository.createRunItem).toHaveBeenCalledWith({
      runId: RUN_ID,
      documentId: DOC_B_ID,
      title: "doc-b.pdf",
    });
    expect(runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 0,
      skippedCount: 1,
    });
  });

  it("rebuilds already indexed documents when force is true", async () => {
    const { service, chunksRepository, runsRepository } = buildDeps({
      run: { force: true },
      hasChunks: () => true,
    });

    await service.execute(RUN_ID);

    expect(chunksRepository.replaceDocumentChunks).toHaveBeenCalledOnce();
    expect(runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 1,
      processedCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it("fails a processed document with blank refined_text without chunking it", async () => {
    const { service, runsRepository, chunker } = buildDeps({
      documents: [buildDocument({ refinedText: " \n " })],
    });

    await service.execute(RUN_ID);

    expect(chunker.chunk).not.toHaveBeenCalled();
    expect(runsRepository.markRunItemFailed).toHaveBeenCalledWith(
      `item-${DOC_A_ID}`,
      { errorCode: "refined_text_empty" },
    );
    expect(runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 1,
      processedCount: 0,
      failedCount: 1,
      skippedCount: 0,
    });
  });

  it("fails only the affected item when the embedding provider fails", async () => {
    const { service, runsRepository } = buildDeps({
      documents: [
        buildDocument({ id: DOC_A_ID, refinedText: "bad refined" }),
        buildDocument({ id: DOC_B_ID, title: "doc-b.pdf", refinedText: "good refined" }),
      ],
      embedMany: async (texts) => {
        if (texts[0] === "bad refined") {
          throw new Error("provider leaked detail");
        }
        return texts.map(() => vector(0.2));
      },
    });

    await service.execute(RUN_ID);

    expect(runsRepository.markRunItemFailed).toHaveBeenCalledWith(
      `item-${DOC_A_ID}`,
      { errorCode: "embedding_failed" },
    );
    expect(runsRepository.markRunItemProcessed).toHaveBeenCalledWith(
      `item-${DOC_B_ID}`,
      { chunkCount: 1 },
    );
    expect(runsRepository.completeRun).toHaveBeenCalledWith(RUN_ID, {
      selectedCount: 2,
      processedCount: 1,
      failedCount: 1,
      skippedCount: 0,
    });
  });

  it("fails the item and does not persist chunks on embedding dimension mismatch", async () => {
    const { service, runsRepository, chunksRepository } = buildDeps({
      embedMany: async () => [[0.1, 0.2, 0.3]],
    });

    await service.execute(RUN_ID);

    expect(chunksRepository.replaceDocumentChunks).not.toHaveBeenCalled();
    expect(runsRepository.markRunItemFailed).toHaveBeenCalledWith(
      `item-${DOC_A_ID}`,
      { errorCode: "embedding_dimensions_mismatch" },
    );
  });
});
