import { describe, expect, it, vi } from "vitest";

import type { ListRagDocuments } from "@/application/rag/list-rag-documents";

import { createRagDocumentsHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";

function buildListDocuments(
  result: Awaited<ReturnType<ListRagDocuments["execute"]>>,
): Pick<ListRagDocuments, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function get(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/rag/documents", {
    method: "GET",
    headers,
  });
}

describe("GET /api/rag/documents handler", () => {
  it("returns 200 with the validated selectable documents payload", async () => {
    const listDocuments = buildListDocuments({
      documents: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "artigo-a.pdf",
          authors: "Silva et al.",
          publicationYear: 2024,
          doi: "10.1000/a",
          chunkCount: 12,
          updatedAt: "2026-04-25T10:30:00.000Z",
        },
      ],
    });
    const handler = createRagDocumentsHandler({
      listDocuments,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      documents: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "artigo-a.pdf",
          authors: "Silva et al.",
          publicationYear: 2024,
          doi: "10.1000/a",
          chunkCount: 12,
          updatedAt: "2026-04-25T10:30:00.000Z",
        },
      ],
    });
    expect(listDocuments.execute).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when there are no selectable documents", async () => {
    const listDocuments = buildListDocuments({ documents: [] });
    const handler = createRagDocumentsHandler({
      listDocuments,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ documents: [] });
  });

  it("returns 401 when the bearer secret is missing or wrong", async () => {
    const listDocuments = buildListDocuments({ documents: [] });
    const handler = createRagDocumentsHandler({
      listDocuments,
      secret: VALID_SECRET,
    });

    const missing = await handler(get());
    const wrong = await handler(get({ Authorization: "Bearer wrong-secret" }));

    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "unauthorized" });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "unauthorized" });
    expect(listDocuments.execute).not.toHaveBeenCalled();
  });

  it("strips unknown document fields before returning JSON", async () => {
    const listDocuments = buildListDocuments({
      documents: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "artigo-a.pdf",
          authors: null,
          publicationYear: null,
          doi: null,
          chunkCount: 2,
          updatedAt: "2026-04-25T10:30:00.000Z",
          // @ts-expect-error - extra field must not leak
          OPENAI_API_KEY: "sk-secret",
        },
      ],
    });
    const handler = createRagDocumentsHandler({
      listDocuments,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );
    const text = await response.text();

    expect(text).not.toContain("OPENAI_API_KEY");
    expect(text).not.toContain("sk-secret");
  });

  it("returns 500 with a sanitized body on unexpected failures", async () => {
    const listDocuments: Pick<ListRagDocuments, "execute"> = {
      execute: vi.fn().mockRejectedValue(new Error("database unavailable")),
    };
    const handler = createRagDocumentsHandler({
      listDocuments,
      secret: VALID_SECRET,
    });

    const response = await handler(
      get({ Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "technical_error" });
  });
});
