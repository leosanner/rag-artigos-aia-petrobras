import { describe, expect, it, vi } from "vitest";

import type {
  RagIndexingRun,
  RagIndexingRunItem,
} from "@/db/schema";
import type { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

import { GetIndexingRun } from "./get-indexing-run";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

function buildRun(overrides: Partial<RagIndexingRun> = {}): RagIndexingRun {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: RUN_ID,
    status: "completed",
    documentId: null,
    force: false,
    selectedCount: 1,
    processedCount: 1,
    failedCount: 0,
    skippedCount: 0,
    lastError: null,
    createdAt: now,
    startedAt: now,
    finishedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildItem(overrides: Partial<RagIndexingRunItem> = {}): RagIndexingRunItem {
  const now = new Date("2026-04-20T10:00:00.000Z");
  return {
    id: ITEM_ID,
    runId: RUN_ID,
    documentId: DOCUMENT_ID,
    title: "document.pdf",
    status: "processed",
    chunkCount: 4,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GetIndexingRun", () => {
  it("maps persisted runs and items to safe DTOs", async () => {
    const runsRepository = {
      getRunWithItems: vi.fn().mockResolvedValue({
        run: buildRun({
          documentId: DOCUMENT_ID,
          force: true,
          lastError: "provider stack trace should be normalized",
        }),
        items: [
          buildItem({
            lastError: "embedding_failed",
          }),
          buildItem({
            id: "44444444-4444-4444-8444-444444444444",
            lastError: "raw provider detail",
          }),
        ],
      }),
    } satisfies Partial<RagIndexingRunsRepository>;
    const service = new GetIndexingRun({
      runsRepository,
    });

    await expect(service.execute(RUN_ID)).resolves.toEqual({
      id: RUN_ID,
      status: "completed",
      documentId: DOCUMENT_ID,
      force: true,
      selectedCount: 1,
      processedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      lastError: "unknown_error",
      items: [
        {
          id: ITEM_ID,
          documentId: DOCUMENT_ID,
          title: "document.pdf",
          status: "processed",
          chunkCount: 4,
          lastError: "embedding_failed",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          documentId: DOCUMENT_ID,
          title: "document.pdf",
          status: "processed",
          chunkCount: 4,
          lastError: "unknown_error",
        },
      ],
    });
  });

  it("returns null when the run does not exist", async () => {
    const runsRepository = {
      getRunWithItems: vi.fn().mockResolvedValue(null),
    } satisfies Partial<RagIndexingRunsRepository>;
    const service = new GetIndexingRun({
      runsRepository,
    });

    await expect(service.execute(RUN_ID)).resolves.toBeNull();
  });
});
