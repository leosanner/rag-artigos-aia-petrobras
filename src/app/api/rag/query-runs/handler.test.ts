import { describe, expect, it, vi } from "vitest";

import type { ListQueryRuns } from "@/application/rag/list-query-runs";

import { createRagQueryRunsHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const RUN_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-04-23T12:34:56.000Z");

function buildListRuns(
  result: Awaited<ReturnType<ListQueryRuns["execute"]>>,
): Pick<ListQueryRuns, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function get(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/rag/query-runs", {
    method: "GET",
    headers,
  });
}

describe("GET /api/rag/query-runs handler", () => {
  it("returns 200 with reverse-chronological run summaries", async () => {
    const listRuns = buildListRuns([
      {
        id: RUN_ID,
        question: "Quais tecnicas aparecem com maior frequencia?",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 432,
        totalCostUsd: 0.000482,
        createdAt: CREATED_AT,
      },
    ]);
    const handler = createRagQueryRunsHandler({
      listRuns,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual([
      {
        id: RUN_ID,
        question: "Quais tecnicas aparecem com maior frequencia?",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 432,
        totalCostUsd: 0.000482,
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(listRuns.execute).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the bearer secret is missing or wrong", async () => {
    const listRuns = buildListRuns([]);
    const handler = createRagQueryRunsHandler({
      listRuns,
      secret: VALID_SECRET,
    });

    const missing = await handler(get());
    const wrong = await handler(
      get({ Authorization: "Bearer wrong-secret" }),
    );

    expect(missing.status).toBe(401);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    expect(await missing.json()).toEqual({ error: "unauthorized" });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "unauthorized" });
    expect(listRuns.execute).not.toHaveBeenCalled();
  });

  it("strips unknown fields before returning JSON", async () => {
    const listRuns = buildListRuns([
      {
        id: RUN_ID,
        question: "Quais tecnicas aparecem com maior frequencia?",
        status: "answered",
        topK: 6,
        retrievalStrategy: "standard",
        latencyMs: 432,
        totalCostUsd: 0.000482,
        createdAt: CREATED_AT,
        // @ts-expect-error - extra field must not leak
        OPENAI_API_KEY: "sk-secret",
      },
    ]);
    const handler = createRagQueryRunsHandler({
      listRuns,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );
    const text = await response.text();

    expect(text).not.toContain("OPENAI_API_KEY");
    expect(text).not.toContain("sk-secret");
  });
});
