import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessIngestionRunHandler } from "@/application/ingestion/ports";
import type { ProcessIndexingRunHandler } from "@/application/indexing/ports";

describe("/api/inngest route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("inngest/next");
    vi.doUnmock("@/infrastructure/ingestion/inngest");
    vi.doUnmock("@/infrastructure/drive/google-drive-file-source");
    vi.doUnmock("@/infrastructure/pdf/unpdf-pdf-extractor");
    vi.doUnmock("@/infrastructure/crypto/sha256-file-hasher");
    vi.doUnmock("@/infrastructure/ai/openai-embedding-provider");
    vi.doUnmock("@/infrastructure/indexing/inngest");
    vi.doUnmock("@/application/ingestion/process-ingestion-run");
    vi.doUnmock("@/application/indexing/process-indexing-run");
    vi.doUnmock("@/domain/chunking/hybrid-text-chunker");
    vi.doUnmock("@/repositories/documents-repository");
    vi.doUnmock("@/repositories/document-chunks-repository");
    vi.doUnmock("@/repositories/ingestion-runs-repository");
    vi.doUnmock("@/repositories/rag-indexing-runs-repository");
    vi.doUnmock("@/env/server");
    vi.doUnmock("@/db/client");
  });

  it("registers ingestion and indexing handlers built from production adapters and exports serve handlers", async () => {
    const routeHandlers = {
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
    };
    const processIngestionRunFunction = { id: "process-ingestion-run" };
    const processIndexingRunFunction = { id: "process-indexing-run" };
    const inngestClient = { id: "mock-inngest-client" };
    const registeredHandlers: ProcessIngestionRunHandler[] = [];
    const registeredIndexingHandlers: ProcessIndexingRunHandler[] = [];
    const createProcessIngestionRunFunction = vi.fn(
      (handler: ProcessIngestionRunHandler) => {
        registeredHandlers.push(handler);
        return processIngestionRunFunction;
      },
    );
    const createProcessIndexingRunFunction = vi.fn(
      (handler: ProcessIndexingRunHandler) => {
        registeredIndexingHandlers.push(handler);
        return processIndexingRunFunction;
      },
    );
    const serve = vi.fn(() => routeHandlers);

    const ProcessIngestionRunSpy = vi.fn();
    const ProcessIndexingRunSpy = vi.fn();
    const driveSourceStub = { listFiles: vi.fn(), downloadFile: vi.fn() };
    const createGoogleDriveFileSourceFromEnv = vi.fn(() => driveSourceStub);
    const pdfExtractorInstance = { extract: vi.fn() };
    const UnpdfPdfExtractor = vi.fn(() => pdfExtractorInstance);
    const hasherInstance = { hash: vi.fn() };
    const Sha256FileHasher = vi.fn(() => hasherInstance);
    const chunkerInstance = { chunk: vi.fn() };
    const HybridTextChunker = vi.fn(() => chunkerInstance);
    const embeddingProviderInstance = { embedMany: vi.fn() };
    const createOpenAiEmbeddingProviderFromEnv = vi.fn(
      () => embeddingProviderInstance,
    );
    const documentsRepositoryInstance = {};
    const DocumentsRepository = vi.fn(() => documentsRepositoryInstance);
    const chunksRepositoryInstance = {};
    const DocumentChunksRepository = vi.fn(() => chunksRepositoryInstance);
    const runsRepositoryInstance = {};
    const IngestionRunsRepository = vi.fn(() => runsRepositoryInstance);
    const indexingRunsRepositoryInstance = {};
    const RagIndexingRunsRepository = vi.fn(
      () => indexingRunsRepositoryInstance,
    );
    const dbStub = { __mock: "db" };
    const env = { RAG_EMBEDDING_MODEL: "text-embedding-3-large" };

    vi.doMock("inngest/next", () => ({ serve }));
    vi.doMock("@/infrastructure/ingestion/inngest", () => ({
      createProcessIngestionRunFunction,
      inngest: inngestClient,
    }));
    vi.doMock("@/infrastructure/indexing/inngest", () => ({
      createProcessIndexingRunFunction,
    }));
    vi.doMock("@/infrastructure/drive/google-drive-file-source", () => ({
      createGoogleDriveFileSourceFromEnv,
    }));
    vi.doMock("@/infrastructure/pdf/unpdf-pdf-extractor", () => ({
      UnpdfPdfExtractor,
    }));
    vi.doMock("@/infrastructure/crypto/sha256-file-hasher", () => ({
      Sha256FileHasher,
    }));
    vi.doMock("@/infrastructure/ai/openai-embedding-provider", () => ({
      createOpenAiEmbeddingProviderFromEnv,
    }));
    vi.doMock("@/application/ingestion/process-ingestion-run", () => ({
      ProcessIngestionRun: ProcessIngestionRunSpy,
    }));
    vi.doMock("@/application/indexing/process-indexing-run", () => ({
      ProcessIndexingRun: ProcessIndexingRunSpy,
    }));
    vi.doMock("@/domain/chunking/hybrid-text-chunker", () => ({
      HybridTextChunker,
    }));
    vi.doMock("@/repositories/documents-repository", () => ({
      DocumentsRepository,
    }));
    vi.doMock("@/repositories/document-chunks-repository", () => ({
      DocumentChunksRepository,
    }));
    vi.doMock("@/repositories/ingestion-runs-repository", () => ({
      IngestionRunsRepository,
    }));
    vi.doMock("@/repositories/rag-indexing-runs-repository", () => ({
      RagIndexingRunsRepository,
    }));
    vi.doMock("@/env/server", () => ({ env }));
    vi.doMock("@/db/client", () => ({ db: dbStub }));

    const route = await import("./route");

    expect(route.GET).toBe(routeHandlers.GET);
    expect(route.POST).toBe(routeHandlers.POST);
    expect(route.PUT).toBe(routeHandlers.PUT);

    expect(serve).toHaveBeenCalledWith({
      client: inngestClient,
      functions: [processIngestionRunFunction, processIndexingRunFunction],
    });

    expect(ProcessIngestionRunSpy).toHaveBeenCalledTimes(1);
    const deps = ProcessIngestionRunSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(deps.driveSource).toBe(driveSourceStub);
    expect(deps.pdfExtractor).toBe(pdfExtractorInstance);
    expect(deps.hasher).toBe(hasherInstance);
    expect(deps.documentsRepository).toBe(documentsRepositoryInstance);
    expect(deps.runsRepository).toBe(runsRepositoryInstance);
    expect(typeof deps.refiner).toBe("function");

    expect(createProcessIngestionRunFunction).toHaveBeenCalledOnce();
    expect(registeredHandlers[0]).toBeInstanceOf(ProcessIngestionRunSpy);

    expect(ProcessIndexingRunSpy).toHaveBeenCalledTimes(1);
    const indexingDeps = ProcessIndexingRunSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(indexingDeps.documentsRepository).toBe(documentsRepositoryInstance);
    expect(indexingDeps.runsRepository).toBe(indexingRunsRepositoryInstance);
    expect(indexingDeps.chunksRepository).toBe(chunksRepositoryInstance);
    expect(indexingDeps.chunker).toBe(chunkerInstance);
    expect(indexingDeps.embeddingProvider).toBe(embeddingProviderInstance);
    expect(indexingDeps.embeddingModel).toBe("text-embedding-3-large");

    expect(createProcessIndexingRunFunction).toHaveBeenCalledOnce();
    expect(registeredIndexingHandlers[0]).toBeInstanceOf(ProcessIndexingRunSpy);

    expect(DocumentsRepository).toHaveBeenCalledWith(dbStub);
    expect(DocumentChunksRepository).toHaveBeenCalledWith(dbStub);
    expect(IngestionRunsRepository).toHaveBeenCalledWith(dbStub);
    expect(RagIndexingRunsRepository).toHaveBeenCalledWith(dbStub);
    expect(createOpenAiEmbeddingProviderFromEnv).toHaveBeenCalledWith(env);
  });
});
