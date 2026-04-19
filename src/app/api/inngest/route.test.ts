import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessIngestionRunHandler } from "@/application/ingestion/ports";

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
    vi.doUnmock("@/application/ingestion/process-ingestion-run");
    vi.doUnmock("@/repositories/documents-repository");
    vi.doUnmock("@/repositories/ingestion-runs-repository");
    vi.doUnmock("@/db/client");
  });

  it("registers a ProcessIngestionRun handler built from production adapters and exports serve handlers", async () => {
    const routeHandlers = {
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
    };
    const processIngestionRunFunction = { id: "process-ingestion-run" };
    const inngestClient = { id: "mock-inngest-client" };
    const registeredHandlers: ProcessIngestionRunHandler[] = [];
    const createProcessIngestionRunFunction = vi.fn(
      (handler: ProcessIngestionRunHandler) => {
        registeredHandlers.push(handler);
        return processIngestionRunFunction;
      },
    );
    const serve = vi.fn(() => routeHandlers);

    const ProcessIngestionRunSpy = vi.fn();
    const driveSourceStub = { listFiles: vi.fn(), downloadFile: vi.fn() };
    const createGoogleDriveFileSourceFromEnv = vi.fn(() => driveSourceStub);
    const pdfExtractorInstance = { extract: vi.fn() };
    const UnpdfPdfExtractor = vi.fn(() => pdfExtractorInstance);
    const hasherInstance = { hash: vi.fn() };
    const Sha256FileHasher = vi.fn(() => hasherInstance);
    const documentsRepositoryInstance = {};
    const DocumentsRepository = vi.fn(() => documentsRepositoryInstance);
    const runsRepositoryInstance = {};
    const IngestionRunsRepository = vi.fn(() => runsRepositoryInstance);
    const dbStub = { __mock: "db" };

    vi.doMock("inngest/next", () => ({ serve }));
    vi.doMock("@/infrastructure/ingestion/inngest", () => ({
      createProcessIngestionRunFunction,
      inngest: inngestClient,
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
    vi.doMock("@/application/ingestion/process-ingestion-run", () => ({
      ProcessIngestionRun: ProcessIngestionRunSpy,
    }));
    vi.doMock("@/repositories/documents-repository", () => ({
      DocumentsRepository,
    }));
    vi.doMock("@/repositories/ingestion-runs-repository", () => ({
      IngestionRunsRepository,
    }));
    vi.doMock("@/db/client", () => ({ db: dbStub }));

    const route = await import("./route");

    expect(route.GET).toBe(routeHandlers.GET);
    expect(route.POST).toBe(routeHandlers.POST);
    expect(route.PUT).toBe(routeHandlers.PUT);

    expect(serve).toHaveBeenCalledWith({
      client: inngestClient,
      functions: [processIngestionRunFunction],
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

    expect(DocumentsRepository).toHaveBeenCalledWith(dbStub);
    expect(IngestionRunsRepository).toHaveBeenCalledWith(dbStub);
  });
});
