import { describe, expect, it, vi } from "vitest";

import type { StartIndexingRun } from "@/application/indexing/start-indexing-run";

import { createIndexingRunStartHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const RUN_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVE_RUN_ID = "33333333-3333-4333-8333-333333333333";

function buildStartRun(
  result: Awaited<ReturnType<StartIndexingRun["execute"]>>,
): StartIndexingRun {
  return {
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as StartIndexingRun;
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/rag/indexing/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rag/indexing/runs handler", () => {
  it("returns 202 with queued metadata and forwards validated options", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      status: "queued",
      documentId: DOCUMENT_ID,
      force: true,
    });
    const handler = createIndexingRunStartHandler({
      startRun,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { documentId: DOCUMENT_ID, force: true },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      runId: RUN_ID,
      status: "queued",
      documentId: DOCUMENT_ID,
      force: true,
    });
    expect(startRun.execute).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      force: true,
    });
  });

  it("returns 401 without creating a run when the bearer secret is missing or wrong", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      status: "queued",
      documentId: null,
      force: false,
    });
    const handler = createIndexingRunStartHandler({
      startRun,
      secret: VALID_SECRET,
    });

    const missing = await handler(post({}));
    const wrong = await handler(
      post({}, { Authorization: "Bearer wrong-secret" }),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "unauthorized" });
    expect(startRun.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid request bodies", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      status: "queued",
      documentId: null,
      force: false,
    });
    const handler = createIndexingRunStartHandler({
      startRun,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post(
        { documentId: "not-a-uuid", force: "yes" },
        { Authorization: `Bearer ${VALID_SECRET}` },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(startRun.execute).not.toHaveBeenCalled();
  });

  it("returns 409 with the active run id on active-run conflict", async () => {
    const startRun = buildStartRun({
      kind: "conflict",
      activeRunId: ACTIVE_RUN_ID,
    });
    const handler = createIndexingRunStartHandler({
      startRun,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post({}, { Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ activeRunId: ACTIVE_RUN_ID });
  });

  it("does not leak the operator secret in any response body", async () => {
    const startRun = buildStartRun({
      kind: "queued",
      runId: RUN_ID,
      status: "queued",
      documentId: null,
      force: false,
    });
    const handler = createIndexingRunStartHandler({
      startRun,
      secret: VALID_SECRET,
    });

    const ok = await handler(
      post({}, { Authorization: `Bearer ${VALID_SECRET}` }),
    );
    const bad = await handler(post({}, { Authorization: "Bearer nope" }));

    expect(await ok.text()).not.toContain(VALID_SECRET);
    expect(await bad.text()).not.toContain(VALID_SECRET);
  });
});
