import { describe, expect, it, vi } from "vitest";

import type { StartIngestionRun } from "@/application/ingestion/start-ingestion-run";

import { createSyncHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVE_RUN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function buildStartRun(
  result: Awaited<ReturnType<StartIngestionRun["execute"]>>,
): StartIngestionRun {
  return {
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as StartIngestionRun;
}

function post(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/ingestion/sync", {
    method: "POST",
    headers,
  });
}

describe("POST /api/ingestion/sync handler", () => {
  it("returns 202 with the queued response when the service returns queued", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      maxDocuments: 3,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const response = await handler(
      post({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      runId: RUN_ID,
      status: "queued",
      maxDocuments: 3,
    });
    expect(startRun.execute).toHaveBeenCalledOnce();
  });

  it("returns 409 with the active run id when the service returns conflict", async () => {
    const startRun = buildStartRun({
      kind: "conflict",
      activeRunId: ACTIVE_RUN_ID,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const response = await handler(
      post({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ activeRunId: ACTIVE_RUN_ID });
  });

  it("returns 401 when the Authorization header is missing and never calls the service", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      maxDocuments: 3,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const response = await handler(post());

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(startRun.execute).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret does not match and never calls the service", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      maxDocuments: 3,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const response = await handler(
      post({ Authorization: "Bearer the-wrong-secret" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(startRun.execute).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is not a bearer token", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      maxDocuments: 3,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const response = await handler(
      post({ Authorization: `Basic ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(401);
    expect(startRun.execute).not.toHaveBeenCalled();
  });

  it("does not leak the operator secret in any response body", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      maxDocuments: 3,
    });
    const handler = createSyncHandler({ startRun, secret: VALID_SECRET });

    const ok = await handler(post({ Authorization: `Bearer ${VALID_SECRET}` }));
    const bad = await handler(post({ Authorization: "Bearer wrong" }));

    expect(await ok.text()).not.toContain(VALID_SECRET);
    expect(await bad.text()).not.toContain(VALID_SECRET);
  });
});
