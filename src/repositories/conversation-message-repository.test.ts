import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ragConversations, ragQueryRuns } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { ConversationMessageRepository } from "./conversation-message-repository";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

async function insertConversation(db: TestDatabase): Promise<string> {
  const [row] = await db
    .insert(ragConversations)
    .values({})
    .returning({ id: ragConversations.id });
  return row.id;
}

describe("ConversationMessageRepository", () => {
  let db: TestDatabase;
  let pool: Pool;
  let repository: ConversationMessageRepository;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    repository = new ConversationMessageRepository(db);
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("appends a user message with no trace and returns its id and createdAt", async () => {
    const conversationId = await insertConversation(db);

    const result = await repository.append({
      conversationId,
      role: "user",
      content: "Primeira pergunta do operador.",
      traceId: null,
    });

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("rejects an assistant row without a traceId via the assistant_requires_trace check", async () => {
    const conversationId = await insertConversation(db);

    await expect(
      repository.append({
        conversationId,
        role: "assistant",
        content: "Resposta sem trace.",
        traceId: null,
      }),
    ).rejects.toThrow(/rag_conversation_messages_assistant_requires_trace/);
  });

  it("rejects a user row with a non-null traceId via the user_has_no_trace check", async () => {
    const conversationId = await insertConversation(db);

    await expect(
      repository.append({
        conversationId,
        role: "user",
        content: "Usuario nao deve ter trace.",
        traceId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow(/rag_conversation_messages_user_has_no_trace/);
  });

  it("rejects empty content via the content_non_empty check", async () => {
    const conversationId = await insertConversation(db);

    await expect(
      repository.append({
        conversationId,
        role: "user",
        content: "   ",
        traceId: null,
      }),
    ).rejects.toThrow(/rag_conversation_messages_content_non_empty/);
  });

  it("returns the most recent messages in chronological order, capped at the limit", async () => {
    const conversationId = await insertConversation(db);

    for (let index = 0; index < 6; index += 1) {
      await repository.append({
        conversationId,
        role: "user",
        content: `mensagem ${index}`,
        traceId: null,
      });
    }

    const previous = await repository.listPreviousVisible(conversationId, 4);

    expect(previous).toEqual([
      { role: "user", content: "mensagem 2", trace: null },
      { role: "user", content: "mensagem 3", trace: null },
      { role: "user", content: "mensagem 4", trace: null },
      { role: "user", content: "mensagem 5", trace: null },
    ]);
  });

  it("hydrates assistant messages with the retrieval strategy of their query run", async () => {
    const conversationId = await insertConversation(db);

    await repository.append({
      conversationId,
      role: "user",
      content: "Pergunta exploratória",
      traceId: null,
    });

    const exploreRunId = await insertRun(db, "explore");
    await repository.append({
      conversationId,
      role: "assistant",
      content: "Resposta explore",
      traceId: exploreRunId,
    });

    await repository.append({
      conversationId,
      role: "user",
      content: "Outra pergunta",
      traceId: null,
    });

    const standardRunId = await insertRun(db, "standard");
    await repository.append({
      conversationId,
      role: "assistant",
      content: "Resposta standard",
      traceId: standardRunId,
    });

    const previous = await repository.listPreviousVisible(conversationId, 4);

    expect(previous).toEqual([
      { role: "user", content: "Pergunta exploratória", trace: null },
      {
        role: "assistant",
        content: "Resposta explore",
        trace: { strategy: "explore" },
      },
      { role: "user", content: "Outra pergunta", trace: null },
      {
        role: "assistant",
        content: "Resposta standard",
        trace: { strategy: "standard" },
      },
    ]);
  });

  it("returns an empty slice when the conversation has no messages yet", async () => {
    const conversationId = await insertConversation(db);

    await expect(
      repository.listPreviousVisible(conversationId, 4),
    ).resolves.toEqual([]);
  });

  it("applies the default limit of 4 when no limit is provided", async () => {
    const conversationId = await insertConversation(db);

    for (let index = 0; index < 6; index += 1) {
      await repository.append({
        conversationId,
        role: "user",
        content: `mensagem ${index}`,
        traceId: null,
      });
    }

    const previous = await repository.listPreviousVisible(conversationId);

    expect(previous).toHaveLength(4);
    expect(previous[0]).toEqual({
      role: "user",
      content: "mensagem 2",
      trace: null,
    });
    expect(previous[3]).toEqual({
      role: "user",
      content: "mensagem 5",
      trace: null,
    });
  });
});

async function insertRun(
  db: TestDatabase,
  strategy: "standard" | "explore" | "rerank",
): Promise<string> {
  const [run] = await db
    .insert(ragQueryRuns)
    .values({
      question: `pergunta ${strategy}`,
      answer: `resposta ${strategy}`,
      mode: "global",
      status: "answered",
      retrievalStrategy: strategy,
      topK: 6,
      candidateTopK: strategy === "rerank" ? 24 : 6,
      latencyMs: 10,
      embeddingInputTokens: 0,
      embeddingCostUsd: 0,
      totalCostUsd: 0,
      promptVersion: "test/v1",
      generationModel: "test-model",
      embeddingModel: "test-embed",
    })
    .returning({ id: ragQueryRuns.id });
  return run.id;
}
