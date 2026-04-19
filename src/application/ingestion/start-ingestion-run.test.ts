import { describe, expect, it, vi } from "vitest";

import {
  ActiveIngestionRunConflictError,
  type IngestionRunsRepository,
} from "@/repositories/ingestion-runs-repository";
import type { IngestionRun } from "@/db/schema";
import type { IngestionEventPublisher } from "@/application/ingestion/ports";

import { StartIngestionRun } from "./start-ingestion-run";

function buildRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  const now = new Date("2026-04-18T10:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "queued",
    maxDocuments: 3,
    selectedCount: 0,
    processedCount: 0,
    failedCount: 0,
    skippedExistingCount: 0,
    lastError: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

type RepoStub = Pick<IngestionRunsRepository, "createQueuedRun" | "findActiveRun">;

function buildRepository(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    createQueuedRun: vi.fn().mockResolvedValue(buildRun()),
    findActiveRun: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function buildPublisher(): IngestionEventPublisher {
  return {
    publishSyncRequested: vi.fn().mockResolvedValue(undefined),
  };
}

describe("StartIngestionRun", () => {
  it("creates a queued run with the configured max documents and publishes the Inngest event", async () => {
    const run = buildRun({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const repo = buildRepository({
      createQueuedRun: vi.fn().mockResolvedValue(run),
    });
    const publisher = buildPublisher();
    const service = new StartIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
      eventPublisher: publisher,
      maxDocuments: 3,
    });

    const result = await service.execute();

    expect(repo.createQueuedRun).toHaveBeenCalledWith({ maxDocuments: 3 });
    expect(publisher.publishSyncRequested).toHaveBeenCalledWith(run.id);
    expect(result).toEqual({
      kind: "queued",
      runId: run.id,
      maxDocuments: 3,
    });
  });

  it("returns a conflict and does not publish when another run is active", async () => {
    const repo = buildRepository({
      createQueuedRun: vi
        .fn()
        .mockRejectedValue(
          new ActiveIngestionRunConflictError(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          ),
        ),
    });
    const publisher = buildPublisher();
    const service = new StartIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
      eventPublisher: publisher,
    });

    const result = await service.execute();

    expect(result).toEqual({
      kind: "conflict",
      activeRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(publisher.publishSyncRequested).not.toHaveBeenCalled();
  });

  it("propagates unexpected repository errors", async () => {
    const repo = buildRepository({
      createQueuedRun: vi.fn().mockRejectedValue(new Error("connection lost")),
    });
    const publisher = buildPublisher();
    const service = new StartIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
      eventPublisher: publisher,
    });

    await expect(service.execute()).rejects.toThrow("connection lost");
    expect(publisher.publishSyncRequested).not.toHaveBeenCalled();
  });

  it("propagates unexpected publisher errors after creating the run", async () => {
    const repo = buildRepository();
    const publisher: IngestionEventPublisher = {
      publishSyncRequested: vi.fn().mockRejectedValue(new Error("inngest down")),
    };
    const service = new StartIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
      eventPublisher: publisher,
    });

    await expect(service.execute()).rejects.toThrow("inngest down");
  });

  it("defaults maxDocuments to 3 when not provided", async () => {
    const repo = buildRepository();
    const publisher = buildPublisher();
    const service = new StartIngestionRun({
      runsRepository: repo as IngestionRunsRepository,
      eventPublisher: publisher,
    });

    await service.execute();

    expect(repo.createQueuedRun).toHaveBeenCalledWith({ maxDocuments: 3 });
  });
});
