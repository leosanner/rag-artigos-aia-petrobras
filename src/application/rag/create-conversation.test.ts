import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase, resetTestDatabase } from "@/test/db";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { CreateConversation } from "./create-conversation";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

describe("CreateConversation", () => {
  let db: TestDatabase;
  let pool: Pool;
  let service: CreateConversation;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;

    const runsRepository = new RagQueryRunsRepository(db);
    const conversations = new ConversationRepository(db, runsRepository);

    service = new CreateConversation({ conversations });
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates an empty conversation with a null title and null lastMessageAt", async () => {
    await expect(service.execute()).resolves.toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      title: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      lastMessageAt: null,
    });
  });
});
