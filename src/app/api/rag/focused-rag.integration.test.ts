import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GLOBAL_RAG_PROMPT_VERSION } from "@/application/rag/constants";
import { AnswerQuestion } from "@/application/rag/answer-question";
import { AppendConversationMessage } from "@/application/rag/append-conversation-message";
import { ListRagDocuments } from "@/application/rag/list-rag-documents";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import { StreamConversationMessage } from "@/application/rag/stream-conversation-message";
import type {
  GenerationProvider,
  QuestionEmbeddingProvider,
} from "@/application/rag/ports";
import {
  ragAskSuccessResponseSchema,
  type RagAskSuccessResponse,
} from "@/application/rag/schemas";
import { documentChunks, documents, ragQueryRuns } from "@/db/schema";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { createRagAskHandler } from "./ask/handler";
import { createRagConversationMessagesHandler } from "./conversations/[id]/messages/handler";
import { createRagDocumentsHandler } from "./documents/handler";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const SECRET = "focused-rag-integration-secret";
const EMBEDDING_MODEL = "text-embedding-3-large";
const GENERATION_MODEL = "gpt-4.1-mini";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const PIPELINE_VERSION = "f02-b02-test";
const EMBEDDING_DIMENSIONS = 3072;
const ZERO_EMBEDDING = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);

const DOC_PROCESSED_A = "11111111-1111-4111-8111-111111111111";
const DOC_PROCESSED_B = "22222222-2222-4222-8222-222222222222";
const DOC_PROCESSED_UNINDEXED = "33333333-3333-4333-8333-333333333333";
const DOC_PENDING = "44444444-4444-4444-8444-444444444444";
const DOC_FAILED = "55555555-5555-4555-8555-555555555555";
const UNKNOWN_DOC_ID = "99999999-9999-4999-8999-999999999999";

async function seedFixtures(db: TestDatabase): Promise<void> {
  await db.insert(documents).values([
    {
      id: DOC_PROCESSED_A,
      title: "doc-a-processed-indexed.pdf",
      driveFileId: `drive-${DOC_PROCESSED_A}`,
      fileHash: `hash-${DOC_PROCESSED_A}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "processed",
      authors: "Alice; Bob",
      publicationYear: 2025,
      doi: "10.1000/doc-a",
      rawText: "raw a",
      refinedText: "refined a",
      updatedAt: new Date("2026-04-10T00:00:00.000Z"),
    },
    {
      id: DOC_PROCESSED_B,
      title: "doc-b-processed-indexed.pdf",
      driveFileId: `drive-${DOC_PROCESSED_B}`,
      fileHash: `hash-${DOC_PROCESSED_B}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "processed",
      rawText: "raw b",
      refinedText: "refined b",
      updatedAt: new Date("2026-04-05T00:00:00.000Z"),
    },
    {
      id: DOC_PROCESSED_UNINDEXED,
      title: "doc-c-processed-unindexed.pdf",
      driveFileId: `drive-${DOC_PROCESSED_UNINDEXED}`,
      fileHash: `hash-${DOC_PROCESSED_UNINDEXED}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "processed",
      rawText: "raw c",
      refinedText: "refined c",
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    {
      id: DOC_PENDING,
      title: "doc-d-pending.pdf",
      driveFileId: `drive-${DOC_PENDING}`,
      fileHash: `hash-${DOC_PENDING}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "pending",
    },
    {
      id: DOC_FAILED,
      title: "doc-e-failed.pdf",
      driveFileId: `drive-${DOC_FAILED}`,
      fileHash: `hash-${DOC_FAILED}`,
      pipelineVersion: PIPELINE_VERSION,
      status: "failed",
      lastError: "extraction_failed",
    },
  ]);

  await db.insert(documentChunks).values([
    {
      documentId: DOC_PROCESSED_A,
      chunkIndex: 0,
      content: "Doc A chunk 0 talks about segmentacao and classificacao.",
      contentHash: `hash-${DOC_PROCESSED_A}-0`,
      estimatedTokens: 8,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
    {
      documentId: DOC_PROCESSED_A,
      chunkIndex: 1,
      content: "Doc A chunk 1 elaborates on segmentacao methodology.",
      contentHash: `hash-${DOC_PROCESSED_A}-1`,
      estimatedTokens: 8,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
    {
      documentId: DOC_PROCESSED_B,
      chunkIndex: 0,
      content: "Doc B chunk 0 discusses unrelated topics.",
      contentHash: `hash-${DOC_PROCESSED_B}-0`,
      estimatedTokens: 6,
      documentPipelineVersion: PIPELINE_VERSION,
      chunkingVersion: CHUNKING_VERSION,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      embedding: ZERO_EMBEDDING,
    },
  ]);
}

type Wired = {
  askHandler: ReturnType<typeof createRagAskHandler>;
  documentsHandler: ReturnType<typeof createRagDocumentsHandler>;
  messagesHandler: ReturnType<typeof createRagConversationMessagesHandler>;
  embedSpy: ReturnType<typeof vi.fn>;
  generateSpy: ReturnType<typeof vi.fn>;
  conversations: ConversationRepository;
};

function buildEmbeddingProvider(spy: ReturnType<typeof vi.fn>): QuestionEmbeddingProvider {
  return {
    embedQuestion: spy.mockImplementation(async () => ({
      embedding: ZERO_EMBEDDING,
      usage: { inputTokens: 10, estimatedCostUsd: 0.0000013 },
    })),
  };
}

function buildGenerationProvider(spy: ReturnType<typeof vi.fn>): GenerationProvider {
  return {
    generateAnswer: spy.mockImplementation(async () => ({
      answer: "Resposta deterministica para o teste de integracao [1].",
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
        estimatedCostUsd: 0.0000123,
      },
    })),
    streamAnswer: spy.mockImplementation(async (input) => {
      const answer = "Resposta deterministica para o teste de integracao [1].";

      await input.onTextDelta?.(answer);

      return {
        answer,
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

function wire(db: TestDatabase): Wired {
  const documentsRepository = new DocumentsRepository(db);
  const chunksRepository = new DocumentChunksRepository(db);
  const runsRepository = new RagQueryRunsRepository(db);
  const conversations = new ConversationRepository(db, runsRepository);
  const messagesRepository = new ConversationMessageRepository(db);

  const embedSpy = vi.fn();
  const generateSpy = vi.fn();
  const questionEmbeddingProvider = buildEmbeddingProvider(embedSpy);
  const generationProvider = buildGenerationProvider(generateSpy);

  const retrieveChunks = new RetrieveChunks({
    questionEmbeddingProvider,
    chunksRepository,
    embeddingModel: EMBEDDING_MODEL,
  });

  const answerQuestion = new AnswerQuestion({
    retrieveChunks,
    generationProvider,
    runsRepository,
    focusedDocumentClassifier: documentsRepository,
    generationModel: GENERATION_MODEL,
  });

  const appendMessage = new AppendConversationMessage({
    conversations,
    messages: messagesRepository,
    answerQuestion,
  });
  const getConversationDetail = new GetConversationDetail({
    conversations,
  });
  const streamMessage = new StreamConversationMessage({
    conversations,
    messages: messagesRepository,
    answerQuestion,
  });

  const askHandler = createRagAskHandler({
    answerQuestion,
    secret: SECRET,
  });
  const documentsHandler = createRagDocumentsHandler({
    listDocuments: new ListRagDocuments({
      selectableDocumentsReader: documentsRepository,
    }),
    secret: SECRET,
  });
  const messagesHandler = createRagConversationMessagesHandler({
    appendMessage,
    getConversationDetail,
    streamMessage,
    secret: SECRET,
  });

  return {
    askHandler,
    documentsHandler,
    messagesHandler,
    embedSpy,
    generateSpy,
    conversations,
  };
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  };
}

function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

function getRequest(url: string): Request {
  return new Request(url, {
    method: "GET",
    headers: authHeaders(),
  });
}

describe("F-07 focused RAG integration (real Postgres + real handlers)", () => {
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

  it("GET /api/rag/documents lists only processed documents with chunks", async () => {
    const { documentsHandler } = wire(db);

    const response = await documentsHandler(
      getRequest("http://localhost/api/rag/documents"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      documents: Array<{ id: string; chunkCount: number }>;
    };
    const ids = body.documents.map((doc) => doc.id);

    expect(ids).toEqual([DOC_PROCESSED_A, DOC_PROCESSED_B]);
    expect(ids).not.toContain(DOC_PROCESSED_UNINDEXED);
    expect(ids).not.toContain(DOC_PENDING);
    expect(ids).not.toContain(DOC_FAILED);
    const docA = body.documents.find((doc) => doc.id === DOC_PROCESSED_A);
    expect(docA?.chunkCount).toBe(2);
  });

  it("focused ask with unknown documentId returns 404 and skips embedding/generation/persistence", async () => {
    const { askHandler, embedSpy, generateSpy } = wire(db);

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas?",
        mode: "focused",
        documentId: UNKNOWN_DOC_ID,
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "document_not_found" });
    expect(embedSpy).not.toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();

    const runs = await db.select().from(ragQueryRuns);
    expect(runs).toHaveLength(0);
  });

  it("focused ask with non-processed documentId returns 422 without persisting a run", async () => {
    const { askHandler, embedSpy, generateSpy } = wire(db);

    const responsePending = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas?",
        mode: "focused",
        documentId: DOC_PENDING,
      }),
    );

    expect(responsePending.status).toBe(422);
    expect(await responsePending.json()).toEqual({
      error: "document_not_focusable",
    });

    const responseUnindexed = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas?",
        mode: "focused",
        documentId: DOC_PROCESSED_UNINDEXED,
      }),
    );

    expect(responseUnindexed.status).toBe(422);
    expect(await responseUnindexed.json()).toEqual({
      error: "document_not_focusable",
    });

    expect(embedSpy).not.toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();

    const runs = await db.select().from(ragQueryRuns);
    expect(runs).toHaveLength(0);
  });

  it("focused ask with valid documentId returns the shared answer/audit shape, only same-document sources, and persists a focused trace", async () => {
    const { askHandler, embedSpy, generateSpy } = wire(db);

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas aparecem?",
        mode: "focused",
        documentId: DOC_PROCESSED_A,
      }),
    );

    expect(response.status).toBe(200);
    const body = ragAskSuccessResponseSchema.parse(
      await response.json(),
    ) satisfies RagAskSuccessResponse;
    expect(body.mode).toBe("focused");
    expect(body.answer).toContain("[1]");
    expect(body.metadata).toEqual({
      mode: "focused",
      documentId: DOC_PROCESSED_A,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: GLOBAL_RAG_PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
    });
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.relatedTerms.length).toBeGreaterThan(0);
    expect(body.audit.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.audit.embedding).toEqual({
      inputTokens: 10,
      estimatedCostUsd: 0.0000013,
    });
    expect(body.audit.generation).toEqual({
      inputTokens: 50,
      outputTokens: 20,
      totalTokens: 70,
      estimatedCostUsd: 0.0000123,
    });
    expect(body.audit.totalCostUsd).toBeCloseTo(0.0000136, 12);
    for (const source of body.sources) {
      expect(source.documentId).toBe(DOC_PROCESSED_A);
    }
    expect(embedSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledTimes(1);

    const globalResponse = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas aparecem?",
        mode: "global",
      }),
    );

    expect(globalResponse.status).toBe(200);
    const globalBody = ragAskSuccessResponseSchema.parse(
      await globalResponse.json(),
    ) satisfies RagAskSuccessResponse;
    expect(Object.keys(body).sort()).toEqual(Object.keys(globalBody).sort());
    expect(Object.keys(body.metadata).sort()).toEqual(
      Object.keys(globalBody.metadata).sort(),
    );
    expect(Object.keys(body.sources[0] ?? {}).sort()).toEqual(
      Object.keys(globalBody.sources[0] ?? {}).sort(),
    );
    expect(Object.keys(body.relatedTerms[0] ?? {}).sort()).toEqual(
      Object.keys(globalBody.relatedTerms[0] ?? {}).sort(),
    );
    expect(Object.keys(body.audit).sort()).toEqual(
      Object.keys(globalBody.audit).sort(),
    );
    expect(Object.keys(body.audit.embedding).sort()).toEqual(
      Object.keys(globalBody.audit.embedding).sort(),
    );
    expect(body.audit.generation).not.toBeNull();
    expect(globalBody.audit.generation).not.toBeNull();
    expect(Object.keys(body.audit.generation ?? {}).sort()).toEqual(
      Object.keys(globalBody.audit.generation ?? {}).sort(),
    );

    const persistedRuns = await db
      .select()
      .from(ragQueryRuns)
      .where(eq(ragQueryRuns.id, body.traceId));
    expect(persistedRuns).toHaveLength(1);
    const run = persistedRuns[0];
    expect(run.mode).toBe("focused");
    expect(run.documentId).toBe(DOC_PROCESSED_A);
    expect(run.status).toBe("answered");
    expect(run.topK).toBe(6);
    expect(run.retrievalStrategy).toBe("standard");
    expect(run.candidateTopK).toBe(6);
    expect(run.promptVersion).toBe(GLOBAL_RAG_PROMPT_VERSION);
    expect(run.embeddingModel).toBe(EMBEDDING_MODEL);
    expect(run.generationModel).toBe(GENERATION_MODEL);
  });

  it("focused turn appended via conversation route persists an assistant message linked to the focused trace", async () => {
    const { messagesHandler, conversations } = wire(db);

    const conversation = await conversations.create();

    const response = await messagesHandler(
      postJson(
        `http://localhost/api/rag/conversations/${conversation.id}/messages`,
        {
          content: "Quais tecnicas aparecem no documento selecionado?",
          mode: "focused",
          documentId: DOC_PROCESSED_A,
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      assistantMessage: {
        trace: {
          mode: string;
          documentId: string | null;
          sources: Array<{ documentId: string }>;
        } | null;
      };
    };
    expect(body.status).toBe("answered");
    expect(body.assistantMessage.trace?.mode).toBe("focused");
    expect(body.assistantMessage.trace?.documentId).toBe(DOC_PROCESSED_A);
    expect(body.assistantMessage.trace?.sources.length).toBeGreaterThan(0);
    for (const source of body.assistantMessage.trace?.sources ?? []) {
      expect(source.documentId).toBe(DOC_PROCESSED_A);
    }
  });

  it("global ask remains unchanged after focused mode is added (regression)", async () => {
    const { askHandler } = wire(db);

    const response = await askHandler(
      postJson("http://localhost/api/rag/ask", {
        question: "Quais tecnicas aparecem?",
        mode: "global",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      metadata: { mode: string; documentId: string | null };
      sources: Array<{ documentId: string }>;
    };
    expect(body.mode).toBe("global");
    expect(body.metadata.mode).toBe("global");
    expect(body.metadata.documentId).toBeNull();
    const documentIds = new Set(body.sources.map((source) => source.documentId));
    expect(documentIds.size).toBeGreaterThanOrEqual(1);
  });
});
