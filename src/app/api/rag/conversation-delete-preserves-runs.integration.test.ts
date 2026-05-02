import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ragConversationMessages,
  ragConversations,
  ragQueryRuns,
} from "@/db/schema";
import { projectRunWithConversationStatus } from "@/domain/rag";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import {
  RagQueryRunsRepository,
  type PersistRagQueryRunInput,
} from "@/repositories/rag-query-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const PROMPT_VERSION = "f12-b02-test";
const EMBEDDING_MODEL = "text-embedding-3-large";
const GENERATION_MODEL = "gpt-4.1-mini";

function buildStandardRunInput(question: string): PersistRagQueryRunInput {
  return {
    question,
    answer: "Resposta deterministica [1].",
    mode: "global",
    documentId: null,
    status: "answered",
    errorCode: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 6,
    promptVersion: PROMPT_VERSION,
    generationModel: GENERATION_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    rerankerProvider: null,
    rerankerModel: null,
    rerankingLatencyMs: null,
    rerankingCandidatesEvaluated: null,
    rerankingInputTokens: null,
    rerankingCostUsd: null,
    latencyMs: 120,
    embeddingInputTokens: 10,
    embeddingCostUsd: 0.0000013,
    generationInputTokens: 50,
    generationOutputTokens: 20,
    generationTotalTokens: 70,
    generationCostUsd: 0.0000123,
    totalCostUsd: 0.0000136,
    sources: [],
    relatedTerms: [],
  };
}

describe("F-12 / RN-09 — deleting a conversation preserves its query runs", () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("keeps the run row intact and lets the helper flag it as archived after the parent conversation is deleted", async () => {
    const runs = new RagQueryRunsRepository(db);
    const conversations = new ConversationRepository(db, runs);
    const messages = new ConversationMessageRepository(db);

    const conversation = await conversations.create();
    const run = await runs.create(buildStandardRunInput("Questao inicial?"));
    await messages.append({
      conversationId: conversation.id,
      role: "user",
      content: "Questao inicial?",
      traceId: null,
    });
    await messages.append({
      conversationId: conversation.id,
      role: "assistant",
      content: "Resposta deterministica [1].",
      traceId: run.id,
    });

    await db
      .delete(ragConversations)
      .where(eq(ragConversations.id, conversation.id));

    const remainingConversations = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, conversation.id));
    expect(remainingConversations).toHaveLength(0);

    const remainingMessages = await db
      .select()
      .from(ragConversationMessages)
      .where(eq(ragConversationMessages.conversationId, conversation.id));
    expect(remainingMessages).toHaveLength(0);

    const remainingRuns = await db
      .select()
      .from(ragQueryRuns)
      .where(eq(ragQueryRuns.id, run.id));
    expect(remainingRuns).toHaveLength(1);

    const reloaded = await runs.getById(run.id);
    expect(reloaded).not.toBeNull();

    const referencingMessages = await db
      .select({ id: ragConversationMessages.id })
      .from(ragConversationMessages)
      .where(eq(ragConversationMessages.traceId, run.id));
    const conversationExists = referencingMessages.length > 0;
    expect(conversationExists).toBe(false);

    const projected = projectRunWithConversationStatus(reloaded!, {
      conversationExists,
    });
    expect(projected.conversationArchived).toBe(true);
    expect(projected.id).toBe(run.id);
    expect(projected.question).toBe("Questao inicial?");
  });
});
