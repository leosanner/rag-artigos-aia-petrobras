import { describe, expect, it, vi } from "vitest";

import type { GetIngestionRun } from "@/application/ingestion/get-ingestion-run";

import { createRunDetailHandler } from "./handler";

const RUN_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC_UUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function buildGetRun(
  result: Awaited<ReturnType<GetIngestionRun["execute"]>>,
): GetIngestionRun {
  return {
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as GetIngestionRun;
}

async function invoke(
  handler: ReturnType<typeof createRunDetailHandler>,
  id: string,
): Promise<Response> {
  const request = new Request(
    `http://localhost/api/ingestion/runs/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  return handler(request, { params: Promise.resolve({ id }) });
}

describe("GET /api/ingestion/runs/:id handler", () => {
  it("returns 200 with the run detail and no-store cache when the run exists", async () => {
    const getRun = buildGetRun({
      id: RUN_UUID,
      status: "processing",
      maxDocuments: 3,
      selectedCount: 1,
      processedCount: 0,
      failedCount: 0,
      skippedExistingCount: 0,
      lastError: null,
      items: [
        {
          id: ITEM_UUID,
          driveFileId: "drive-file-1",
          title: "example.pdf",
          status: "processing",
          lastError: null,
          documentId: DOC_UUID,
        },
      ],
    });
    const handler = createRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_UUID);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.id).toBe(RUN_UUID);
    expect(body.items).toHaveLength(1);
    expect(getRun.execute).toHaveBeenCalledWith(RUN_UUID);
  });

  it("returns 404 when the service returns null", async () => {
    const getRun = buildGetRun(null);
    const handler = createRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_UUID);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns 400 for a non-UUID id and never calls the service", async () => {
    const getRun = buildGetRun(null);
    const handler = createRunDetailHandler({ getRun });

    const response = await invoke(handler, "not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_id" });
    expect(getRun.execute).not.toHaveBeenCalled();
  });

  it("drops unknown fields that the service might try to return", async () => {
    const getRun = buildGetRun({
      id: RUN_UUID,
      status: "completed",
      maxDocuments: 3,
      selectedCount: 0,
      processedCount: 0,
      failedCount: 0,
      skippedExistingCount: 0,
      lastError: null,
      items: [],
      // @ts-expect-error - extra field is stripped by the schema
      DATABASE_URL: "postgres://user:secret@host/db",
    });
    const handler = createRunDetailHandler({ getRun });

    const response = await invoke(handler, RUN_UUID);
    const text = await response.text();

    expect(text).not.toContain("postgres://");
    expect(text).not.toContain("DATABASE_URL");
  });
});
