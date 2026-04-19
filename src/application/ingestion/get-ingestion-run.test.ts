import { describe, expect, it, vi } from "vitest";

import type {
  IngestionRun,
  IngestionRunItem,
} from "@/db/schema";
import type {
  IngestionRunWithItems,
  IngestionRunsRepository,
} from "@/repositories/ingestion-runs-repository";

import { GetIngestionRun } from "./get-ingestion-run";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";

function buildRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  const now = new Date("2026-04-18T10:00:00.000Z");
  return {
    id: RUN_ID,
    status: "processing",
    maxDocuments: 3,
    selectedCount: 2,
    processedCount: 1,
    failedCount: 0,
    skippedExistingCount: 1,
    lastError: null,
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function buildItem(overrides: Partial<IngestionRunItem> = {}): IngestionRunItem {
  const now = new Date("2026-04-18T10:01:00.000Z");
  return {
    id: ITEM_ID,
    runId: RUN_ID,
    driveFileId: "drive-file-1",
    documentId: DOCUMENT_ID,
    title: "example.pdf",
    status: "processed",
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

type RepoStub = Pick<IngestionRunsRepository, "getRunWithItems">;

function buildRepository(result: IngestionRunWithItems | null): RepoStub {
  return {
    getRunWithItems: vi.fn().mockResolvedValue(result),
  };
}

describe("GetIngestionRun", () => {
  it("returns null when the repository has no run for the id", async () => {
    const repo = buildRepository(null);
    const service = new GetIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
    });

    const result = await service.execute(RUN_ID);

    expect(result).toBeNull();
    expect(repo.getRunWithItems).toHaveBeenCalledWith(RUN_ID);
  });

  it("maps run + items into a polling DTO without internal timestamps", async () => {
    const repo = buildRepository({
      run: buildRun(),
      items: [buildItem()],
    });
    const service = new GetIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
    });

    const result = await service.execute(RUN_ID);

    expect(result).toEqual({
      id: RUN_ID,
      status: "processing",
      maxDocuments: 3,
      selectedCount: 2,
      processedCount: 1,
      failedCount: 0,
      skippedExistingCount: 1,
      lastError: null,
      items: [
        {
          id: ITEM_ID,
          driveFileId: "drive-file-1",
          title: "example.pdf",
          status: "processed",
          lastError: null,
          documentId: DOCUMENT_ID,
        },
      ],
    });
  });

  it("coerces a failed run's last_error into a safe error code", async () => {
    const repo = buildRepository({
      run: buildRun({
        status: "failed",
        lastError: "drive_download_failed",
      }),
      items: [
        buildItem({ status: "failed", lastError: "raw_text_empty", documentId: null }),
      ],
    });
    const service = new GetIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
    });

    const result = await service.execute(RUN_ID);

    expect(result?.status).toBe("failed");
    expect(result?.lastError).toBe("drive_download_failed");
    expect(result?.items[0]).toMatchObject({
      status: "failed",
      lastError: "raw_text_empty",
      documentId: null,
    });
  });

  it("maps an unknown persisted last_error string to unknown_error", async () => {
    const repo = buildRepository({
      run: buildRun({ status: "failed", lastError: "not_a_real_code" }),
      items: [],
    });
    const service = new GetIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
    });

    const result = await service.execute(RUN_ID);

    expect(result?.lastError).toBe("unknown_error");
  });

  it("does not leak DB-only columns (createdAt, updatedAt) on the DTO", async () => {
    const repo = buildRepository({
      run: buildRun(),
      items: [buildItem()],
    });
    const service = new GetIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
    });

    const result = await service.execute(RUN_ID);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("createdAt");
    expect(serialized).not.toContain("updatedAt");
    expect(serialized).not.toContain("startedAt");
    expect(serialized).not.toContain("finishedAt");
  });
});
