import { describe, expect, it, vi } from "vitest";

import type { CreateConversation } from "@/application/rag/create-conversation";

import { createRagConversationsHandler } from "./handler";

const VALID_SECRET = "operator-secret-value";
const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-04-23T12:34:56.000Z");
const UPDATED_AT = new Date("2026-04-23T12:34:56.000Z");

function buildCreateConversation(
  result: Awaited<ReturnType<CreateConversation["execute"]>>,
): Pick<CreateConversation, "execute"> {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function post(body: string | undefined = "{}",
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/rag/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("POST /api/rag/conversations handler", () => {
  it("creates an empty conversation and returns a validated DTO", async () => {
    const createConversation = buildCreateConversation({
      id: CONVERSATION_ID,
      title: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      lastMessageAt: null,
    });
    const handler = createRagConversationsHandler({
      createConversation,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post("{}", { Authorization: `Bearer ${VALID_SECRET}` }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      id: CONVERSATION_ID,
      title: null,
      createdAt: CREATED_AT.toISOString(),
      updatedAt: UPDATED_AT.toISOString(),
      lastMessageAt: null,
    });
    expect(createConversation.execute).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the bearer secret is missing or wrong", async () => {
    const createConversation = buildCreateConversation({
      id: CONVERSATION_ID,
      title: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      lastMessageAt: null,
    });
    const handler = createRagConversationsHandler({
      createConversation,
      secret: VALID_SECRET,
    });

    const missing = await handler(post());
    const wrong = await handler(
      post("{}", { Authorization: "Bearer wrong-secret" }),
    );

    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "unauthorized" });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "unauthorized" });
    expect(createConversation.execute).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON or non-empty bodies", async () => {
    const createConversation = buildCreateConversation({
      id: CONVERSATION_ID,
      title: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      lastMessageAt: null,
    });
    const handler = createRagConversationsHandler({
      createConversation,
      secret: VALID_SECRET,
    });

    const malformed = await handler(
      post("{", { Authorization: `Bearer ${VALID_SECRET}` }),
    );
    const nonEmpty = await handler(
      post(JSON.stringify({ title: "ignored" }), {
        Authorization: `Bearer ${VALID_SECRET}`,
      }),
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "invalid_request" });
    expect(nonEmpty.status).toBe(400);
    expect(await nonEmpty.json()).toEqual({ error: "invalid_request" });
    expect(createConversation.execute).not.toHaveBeenCalled();
  });

  it("returns 500 with a sanitized body on unexpected failure", async () => {
    const createConversation: Pick<CreateConversation, "execute"> = {
      execute: vi.fn().mockRejectedValue(new Error("OPENAI_API_KEY=sk-secret")),
    };
    const handler = createRagConversationsHandler({
      createConversation,
      secret: VALID_SECRET,
    });

    const response = await handler(
      post("{}", { Authorization: `Bearer ${VALID_SECRET}` }),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toBe(JSON.stringify({ error: "technical_error" }));
    expect(text).not.toContain("sk-secret");
  });
});
