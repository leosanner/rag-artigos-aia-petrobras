import { describe, expect, it, vi } from "vitest";

import type { RagIndexingRun } from "@/db/schema";
import {
  ActiveIndexingRunConflictError,
  type RagIndexingRunsRepository,
} from "@/repositories/rag-indexing-runs-repository";

import { StartIndexingRun } from "./start-indexing-run";
import type { IndexingEventPublisher } from "./ports";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";

function buildRun(overrides: Partial<RagIndexingRun> = {}): RagIndexingRun {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: RUN_ID,
    status: "queued",
    documentId: null,
    force: false,
    selectedCount: 0,
    processedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    lastError: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

describe("StartIndexingRun", () => {
  it("creates a queued run, persists options, and publishes the Inngest event", async () => {
    const runsRepository = {
      createQueuedRun: vi.fn().mockResolvedValue(
        buildRun({ documentId: DOCUMENT_ID, force: true }),
      ),
    } satisfies Partial<RagIndexingRunsRepository>;
    const eventPublisher: IndexingEventPublisher = {
      publishIndexingRequested: vi.fn().mockResolvedValue(undefined),
    };
    const service = new StartIndexingRun({
      runsRepository,
      eventPublisher,
    });

    const result = await service.execute({
      documentId: DOCUMENT_ID,
      force: true,
    });

    expect(result).toEqual({
      kind: "queued",
      runId: RUN_ID,
      status: "queued",
      documentId: DOCUMENT_ID,
      force: true,
    });
    expect(runsRepository.createQueuedRun).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      force: true,
    });
    expect(eventPublisher.publishIndexingRequested).toHaveBeenCalledWith(RUN_ID);
  });

  it("returns conflict without publishing an event when another run is active", async () => {
    const runsRepository = {
      createQueuedRun: vi
        .fn()
        .mockRejectedValue(new ActiveIndexingRunConflictError(RUN_ID)),
    } satisfies Partial<RagIndexingRunsRepository>;
    const eventPublisher: IndexingEventPublisher = {
      publishIndexingRequested: vi.fn().mockResolvedValue(undefined),
    };
    const service = new StartIndexingRun({
      runsRepository,
      eventPublisher,
    });

    await expect(service.execute({ force: false })).resolves.toEqual({
      kind: "conflict",
      activeRunId: RUN_ID,
    });
    expect(eventPublisher.publishIndexingRequested).not.toHaveBeenCalled();
  });
});
