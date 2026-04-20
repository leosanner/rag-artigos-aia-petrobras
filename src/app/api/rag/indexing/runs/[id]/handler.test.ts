import { describe, expect, it, vi } from "vitest";

import type { GetIndexingRun } from "@/application/indexing/get-indexing-run";

import { createIndexingRunDetailHandler } from "./handler";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";

function buildGetRun(
  result: Awaited<ReturnType<GetIndexingRun["execute"]>>,
): GetIndexingRun {
  return {
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as GetIndexingRun;
}

async function invoke(
  handler: ReturnType<typeof createIndexingRunDetailHandler>,
  id: string,
): Promise<Response> {
  return handler(new Request(`http://localhost/api/rag/indexing/runs/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/rag/indexing/runs/:id handler", () => {
  it("returns run detail with aggregate counts and item statuses", async () => {
    const getRun = buildGetRun({
      id: RUN_ID,
      status: "completed",
      documentId: null,
      force: false,
      selectedCount: 2,
      processedCount: 1,
      failedCount: 0,
      skippedCount: 1,
      lastError: null,
      items: [
        {
          id: ITEM_ID,
          documentId: DOCUMENT_ID,
          title: "document.pdf",
          status: "processed",
          chunkCount: 4,
          lastError: null,
        },
      ],
    });
    const handler = createIndexingRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      id: RUN_ID,
      status: "completed",
      documentId: null,
      force: false,
      selectedCount: 2,
      processedCount: 1,
      failedCount: 0,
      skippedCount: 1,
      lastError: null,
      items: [
        {
          id: ITEM_ID,
          documentId: DOCUMENT_ID,
          title: "document.pdf",
          status: "processed",
          chunkCount: 4,
          lastError: null,
        },
      ],
    });
  });

  it("returns 400 for invalid ids and never calls the service", async () => {
    const getRun = buildGetRun(null);
    const handler = createIndexingRunDetailHandler({ getRun });

    const response = await invoke(handler, "not-a-uuid");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_id" });
    expect(getRun.execute).not.toHaveBeenCalled();
  });

  it("returns 404 when the run does not exist", async () => {
    const getRun = buildGetRun(null);
    const handler = createIndexingRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_ID);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("strips unknown sensitive fields before returning JSON", async () => {
    const getRun = buildGetRun({
      id: RUN_ID,
      status: "failed",
      documentId: null,
      force: false,
      selectedCount: 0,
      processedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      lastError: "unknown_error",
      items: [],
      // @ts-expect-error - stripped by response schema
      OPENAI_API_KEY: "sk-secret",
    });
    const handler = createIndexingRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_ID);
    const text = await response.text();

    expect(text).not.toContain("OPENAI_API_KEY");
    expect(text).not.toContain("sk-secret");
  });
});
