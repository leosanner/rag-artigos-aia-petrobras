import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ragConversationMessages } from "@/db/schema";
import { createTestDatabase, resetTestDatabase } from "@/test/db";
import { ConversationRepository } from "@/repositories/conversation-repository";
import {
  type PersistRagQueryRunInput,
  RagQueryRunsRepository,
} from "@/repositories/rag-query-runs-repository";

import { CreateConversation } from "./create-conversation";
import { GetConversationDetail } from "./get-conversation-detail";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

function buildPersistRagQueryRunInput(
  overrides: Partial<PersistRagQueryRunInput> = {},
): PersistRagQueryRunInput {
  return {
    question: "Quais tecnicas aparecem?",
    answer: "Classificacao supervisionada [1].",
    mode: "global",
    status: "answered",
    errorCode: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
    latencyMs: 432,
    embeddingInputTokens: 17,
    embeddingCostUsd: 0.000002,
    generationInputTokens: 120,
    generationOutputTokens: 42,
    generationTotalTokens: 162,
    generationCostUsd: 0.00048,
    totalCostUsd: 0.000482,
    sources: [
      {
        sourceNumber: 1,
        chunkId: "11111111-1111-4111-8111-111111111111",
        documentId: "22222222-2222-4222-8222-222222222222",
        documentTitle: "artigo.pdf",
        chunkIndex: 0,
        excerpt: "Trecho governado do artigo.",
        score: 0.91,
        documentPipelineVersion: "documents-v1",
        chunkingVersion: "hybrid-v1-900-150",
        embeddingModel: "text-embedding-3-large",
        citedInAnswer: true,
      },
    ],
    relatedTerms: [
      {
        rank: 1,
        term: "classificacao supervisionada",
        ngramSize: 2,
        frequency: 3,
        sourceCoverageCount: 1,
      },
    ],
    ...overrides,
  };
}

describe("GetConversationDetail", () => {
  let db: TestDatabase;
  let pool: Pool;
  let runsRepository: RagQueryRunsRepository;
  let createConversation: CreateConversation;
  let service: GetConversationDetail;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    runsRepository = new RagQueryRunsRepository(db);

    const conversations = new ConversationRepository(db, runsRepository);
    createConversation = new CreateConversation({ conversations });
    service = new GetConversationDetail({ conversations });
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns not_found for an unknown conversation id", async () => {
    await expect(
      service.execute({
        id: "99999999-9999-4999-8999-999999999999",
      }),
    ).resolves.toEqual({
      status: "not_found",
    });
  });

  it("returns ordered messages with hydrated assistant traces", async () => {
    const conversation = await createConversation.execute();
    const trace = await runsRepository.create(buildPersistRagQueryRunInput());

    await db.insert(ragConversationMessages).values([
      {
        conversationId: conversation.id,
        role: "user",
        content: "Pergunta inicial",
        traceId: null,
        createdAt: new Date("2026-04-24T12:00:00.000Z"),
      },
      {
        conversationId: conversation.id,
        role: "assistant",
        content: "Resposta com citacao [1].",
        traceId: trace.id,
        createdAt: new Date("2026-04-24T12:00:01.000Z"),
      },
    ]);

    const result = await service.execute({ id: conversation.id });

    expect(result).toEqual({
      status: "found",
      conversation: {
        id: conversation.id,
        title: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastMessageAt: null,
        messages: [
          {
            id: expect.any(String),
            role: "user",
            content: "Pergunta inicial",
            createdAt: new Date("2026-04-24T12:00:00.000Z"),
            trace: null,
          },
          {
            id: expect.any(String),
            role: "assistant",
            content: "Resposta com citacao [1].",
            createdAt: new Date("2026-04-24T12:00:01.000Z"),
            trace: expect.objectContaining({
              id: trace.id,
              status: "answered",
              answer: "Classificacao supervisionada [1].",
              sources: [
                expect.objectContaining({
                  sourceNumber: 1,
                  documentTitle: "artigo.pdf",
                }),
              ],
            }),
          },
        ],
      },
    });
  });
});
