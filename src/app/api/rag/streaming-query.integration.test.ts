import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AnswerQuestion } from "@/application/rag/answer-question";
import { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import { StreamConversationMessage } from "@/application/rag/stream-conversation-message";
import type {
  GenerationProvider,
  QuestionEmbeddingProvider,
} from "@/application/rag/ports";
import {
  ragConversationStreamEventSchema,
  type RagConversationStreamEvent,
} from "@/application/rag/schemas";
import { documentChunks, documents, ragQueryRuns } from "@/db/schema";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { createRagConversationDetailHandler } from "./conversations/[id]/handler";
import { createRagConversationMessagesHandler } from "./conversations/[id]/messages/handler";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const SECRET = "streaming-query-secret";
const EMBEDDING_MODEL = "text-embedding-3-large";
const GENERATION_MODEL = "gpt-4.1-mini";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const PIPELINE_VERSION = "f10-streaming-test";
const EMBEDDING_DIMENSIONS = 3072;
const ZERO_EMBEDDING = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);

const DOC_PROCESSED = "11111111-1111-4111-8111-111111111111";

async function seedFixtures(db: TestDatabase): Promise<void> {
  await db.insert(documents).values({
    id: DOC_PROCESSED,
    title: "doc-streamed.pdf",
    driveFileId: `drive-${DOC_PROCESSED}`,
    fileHash: `hash-${DOC_PROCESSED}`,
    pipelineVersion: PIPELINE_VERSION,
    status: "processed",
    rawText: "raw streamed",
    refinedText: "refined streamed",
  });

  await db.insert(documentChunks).values([
    {
      documentId: DOC_PROCESSED,
      chunkIndex: 0,
      content: "Chunk 0 fala sobre classificacao supervisionada.",
      contentHash: `hash-${DOC_PROCESSED}-0`,
      estimatedTokens: 8,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
    {
      documentId: DOC_PROCESSED,
      chunkIndex: 1,
      content: "Chunk 1 compara metodos e evidencia resultados.",
      contentHash: `hash-${DOC_PROCESSED}-1`,
      estimatedTokens: 8,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
  ]);
}

function buildEmbeddingProvider(): QuestionEmbeddingProvider {
  return {
    embedQuestion: vi.fn().mockResolvedValue({
      embedding: ZERO_EMBEDDING,
      usage: { inputTokens: 9, estimatedCostUsd: 0.0000011 },
    }),
  };
}

function buildGenerationProvider(options?: {
  failStreaming?: boolean;
}): GenerationProvider {
  return {
    generateAnswer: vi.fn().mockResolvedValue({
      answer: "Resposta sincronizada [1].",
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
        estimatedCostUsd: 0.0000123,
      },
    }),
    streamAnswer: vi.fn().mockImplementation(async (input) => {
      if (options?.failStreaming) {
        throw new Error("streaming provider failed");
      }

      await input.onTextDelta?.("Resposta");
      await input.onTextDelta?.(" em");
      await input.onTextDelta?.(" stream [1].");

      return {
        answer: "Resposta em stream [1].",
        usage: {
          inputTokens: 50,
          outputTokens: 20,
          totalTokens: 70,
          estimatedCostUsd: 0.0000123,
        },
      };
    }),
  };
}

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
    ...extra,
  };
}

function postStream(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: authHeaders({
      Accept: "text/event-stream",
    }),
    body: JSON.stringify(body),
  });
}

function getRequest(url: string): Request {
  return new Request(url, {
    method: "GET",
    headers: authHeaders(),
  });
}

function conversationContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function wire(db: TestDatabase, options?: { failStreaming?: boolean }) {
  const documentsRepository = new DocumentsRepository(db);
  const chunksRepository = new DocumentChunksRepository(db);
  const runsRepository = new RagQueryRunsRepository(db);
  const conversationsRepository = new ConversationRepository(db, runsRepository);
  const messagesRepository = new ConversationMessageRepository(db);

  const retrieveChunks = new RetrieveChunks({
    questionEmbeddingProvider: buildEmbeddingProvider(),
    chunksRepository,
    embeddingModel: EMBEDDING_MODEL,
  });
  const answerQuestion = new AnswerQuestion({
    retrieveChunks,
    generationProvider: buildGenerationProvider(options),
    runsRepository,
    focusedDocumentClassifier: documentsRepository,
    generationModel: GENERATION_MODEL,
  });
  const getConversation = new GetConversationDetail({
    conversations: conversationsRepository,
  });
  const streamMessage = new StreamConversationMessage({
    conversations: conversationsRepository,
    messages: messagesRepository,
    answerQuestion,
  });

  return {
    conversationsRepository,
    messagesHandler: createRagConversationMessagesHandler({
      appendMessage: {
        execute: vi.fn(),
      },
      getConversationDetail: getConversation,
      streamMessage,
      secret: SECRET,
    }),
    detailHandler: createRagConversationDetailHandler({
      getConversation,
      secret: SECRET,
    }),
    db,
  };
}

async function readSseEvents(response: Response): Promise<RagConversationStreamEvent[]> {
  const raw = await response.text();

  return raw
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const data = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.replace("data: ", "");

      if (!data) {
        throw new Error("missing_sse_data");
      }

      return ragConversationStreamEventSchema.parse(JSON.parse(data));
    });
}

describe("F-10 streaming query integration (real Postgres + real handlers)", () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await seedFixtures(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("streams a successful conversation turn and reloads the persisted assistant trace", async () => {
    const { conversationsRepository, messagesHandler, detailHandler } = wire(db);
    const conversation = await conversationsRepository.create();

    const response = await messagesHandler(
      postStream(
        `http://localhost/api/rag/conversations/${conversation.id}/messages`,
        {
          content: "Quais tecnicas aparecem?",
          retrievalSettings: {
            topK: 6,
            strategy: "standard",
          },
        },
      ),
      conversationContext(conversation.id),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const events = await readSseEvents(response);

    expect(events.map((event) => event.type)).toEqual([
      "user_message_created",
      "phase",
      "source",
      "source",
      "phase",
      "answer_delta",
      "answer_delta",
      "answer_delta",
      "done",
    ]);
    expect(events.at(-1)?.type).toBe("done");

    const reloadResponse = await detailHandler(
      getRequest(`http://localhost/api/rag/conversations/${conversation.id}`),
      conversationContext(conversation.id),
    );

    expect(reloadResponse.status).toBe(200);
    const reloadBody = (await reloadResponse.json()) as {
      messages: Array<{
        role: string;
        trace: { id: string; status: string } | null;
      }>;
    };

    expect(reloadBody.messages).toHaveLength(2);
    expect(reloadBody.messages[0]?.role).toBe("user");
    expect(reloadBody.messages[1]?.role).toBe("assistant");
    expect(reloadBody.messages[1]?.trace?.status).toBe("answered");
    expect(reloadBody.messages[1]?.trace?.id).toBeDefined();
  });

  it("persists a failed run but does not create an assistant transcript row when the streamed turn fails", async () => {
    const { conversationsRepository, messagesHandler } = wire(db, {
      failStreaming: true,
    });
    const conversation = await conversationsRepository.create();

    const response = await messagesHandler(
      postStream(
        `http://localhost/api/rag/conversations/${conversation.id}/messages`,
        {
          content: "Pergunta com falha",
        },
      ),
      conversationContext(conversation.id),
    );

    expect(response.status).toBe(200);

    const events = await readSseEvents(response);

    expect(events.map((event) => event.type)).toEqual([
      "user_message_created",
      "phase",
      "source",
      "source",
      "phase",
      "error",
    ]);
    expect(events.at(-1)).toEqual({
      type: "error",
      status: "generation_failed",
      errorCode: "generation_failed",
    });

    const persistedRuns = await db.select().from(ragQueryRuns);
    expect(persistedRuns).toHaveLength(1);
    expect(persistedRuns[0]?.status).toBe("generation_failed");

    const conversationDetail = await conversationsRepository.getDetail(conversation.id);
    expect(conversationDetail?.messages).toHaveLength(1);
    expect(conversationDetail?.messages[0]?.role).toBe("user");
    expect(conversationDetail?.messages[0]?.trace).toBeNull();

    const failedRun = await db
      .select()
      .from(ragQueryRuns)
      .where(eq(ragQueryRuns.id, persistedRuns[0]!.id));
    expect(failedRun[0]?.answer).toBeNull();
  });
});
