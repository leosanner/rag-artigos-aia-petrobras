import { asc, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ragConversationMessages,
  ragConversations,
  ragQueryRuns,
} from "@/db/schema";
import { buildNoEvidenceAnswer } from "@/domain/rag";
import { createTestDatabase, resetTestDatabase } from "@/test/db";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import {
  type PersistRagQueryRunInput,
  RagQueryRunsRepository,
} from "@/repositories/rag-query-runs-repository";

import { CreateConversation } from "./create-conversation";
import { AppendConversationMessage } from "./append-conversation-message";
import type { AnswerQuestionInput, AnswerQuestionResult } from "./schemas";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

type SuccessfulTurnStatus = "answered" | "answered_no_evidence";
type FailedTurnStatus = "generation_failed" | "generation_unavailable";
type FocusedRejectedReason = "not_found" | "not_processed" | "not_indexed";

type RecordedTurnInvocation = {
  input: AnswerQuestionInput;
  storedMessages: Array<{
    role: "user" | "assistant";
    content: string;
    traceId: string | null;
    createdAt: Date;
  }>;
  conversation: {
    title: string | null;
    lastMessageAt: Date | null;
  };
};

function buildPersistRagQueryRunInput(
  overrides: Partial<PersistRagQueryRunInput> = {},
): PersistRagQueryRunInput {
  return {
    question: "Quais tecnicas aparecem?",
    answer: "Classificacao supervisionada [1].",
    mode: "global",
    documentId: null,
    status: "answered",
    errorCode: null,
    topK: 6,
    retrievalStrategy: "standard",
    candidateTopK: 6,
    promptVersion: "f05-audit-v1",
    generationModel: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
    rerankerProvider: null,
    rerankerModel: null,
    rerankingLatencyMs: null,
    rerankingCandidatesEvaluated: null,
    rerankingInputTokens: null,
    rerankingCostUsd: null,
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
        retrievalScore: 0.91,
        rerankScore: null,
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

async function insertRun(
  runsRepository: RagQueryRunsRepository,
  overrides: Partial<PersistRagQueryRunInput> = {},
): Promise<{ id: string; createdAt: Date }> {
  return runsRepository.create(buildPersistRagQueryRunInput(overrides));
}

async function insertStoredMessage(
  db: TestDatabase,
  input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
    traceId?: string | null;
  },
): Promise<void> {
  await db.insert(ragConversationMessages).values({
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    traceId: input.traceId ?? null,
    createdAt: input.createdAt,
  });
}

function createFakeAnswerQuestion(
  db: TestDatabase,
  runsRepository: RagQueryRunsRepository,
  conversationId: string,
  outcome:
    | {
        status: SuccessfulTurnStatus;
        answer: string;
      }
    | {
        status: FailedTurnStatus;
      }
    | {
        focusedRejectedReason: FocusedRejectedReason;
      },
) {
  const invocations: RecordedTurnInvocation[] = [];

  const execute = vi.fn(
    async (input: AnswerQuestionInput): Promise<AnswerQuestionResult> => {
      const storedMessages = await db
        .select({
          role: ragConversationMessages.role,
          content: ragConversationMessages.content,
          traceId: ragConversationMessages.traceId,
          createdAt: ragConversationMessages.createdAt,
        })
        .from(ragConversationMessages)
        .where(eq(ragConversationMessages.conversationId, conversationId))
        .orderBy(
          asc(ragConversationMessages.createdAt),
          asc(ragConversationMessages.id),
        );
      const [conversation] = await db
        .select({
          title: ragConversations.title,
          lastMessageAt: ragConversations.lastMessageAt,
        })
        .from(ragConversations)
        .where(eq(ragConversations.id, conversationId));

      invocations.push({
        input,
        storedMessages,
        conversation,
      });

      if ("status" in outcome && outcome.status === "generation_failed") {
        await insertRun(runsRepository, {
          question: input.question,
          answer: null,
          status: "generation_failed",
          errorCode: "generation_failed",
          sources: [],
          relatedTerms: [],
          generationInputTokens: null,
          generationOutputTokens: null,
          generationTotalTokens: null,
          generationCostUsd: null,
          totalCostUsd: 0.000002,
        });

        return {
          kind: "error",
          error: "generation_failed",
        };
      }

      if ("status" in outcome && outcome.status === "generation_unavailable") {
        await insertRun(runsRepository, {
          question: input.question,
          answer: null,
          status: "generation_unavailable",
          errorCode: "generation_unavailable",
          sources: [],
          relatedTerms: [],
          generationInputTokens: null,
          generationOutputTokens: null,
          generationTotalTokens: null,
          generationCostUsd: null,
          totalCostUsd: 0.000002,
        });

        return {
          kind: "error",
          error: "generation_unavailable",
        };
      }

      if ("focusedRejectedReason" in outcome) {
        return {
          kind: "focused_document_rejected",
          reason: outcome.focusedRejectedReason,
        };
      }

      if (!("answer" in outcome)) {
        throw new Error("Expected a successful turn outcome");
      }

      const answer = outcome.answer;

      const persisted = await insertRun(runsRepository, {
        question: input.question,
        answer,
        status: outcome.status,
        errorCode: null,
        sources:
          outcome.status === "answered_no_evidence"
            ? []
            : buildPersistRagQueryRunInput().sources,
        relatedTerms:
          outcome.status === "answered_no_evidence"
            ? []
            : buildPersistRagQueryRunInput().relatedTerms,
        generationInputTokens:
          outcome.status === "answered_no_evidence" ? null : 120,
        generationOutputTokens:
          outcome.status === "answered_no_evidence" ? null : 42,
        generationTotalTokens:
          outcome.status === "answered_no_evidence" ? null : 162,
        generationCostUsd:
          outcome.status === "answered_no_evidence" ? null : 0.00048,
        totalCostUsd:
          outcome.status === "answered_no_evidence" ? 0.000002 : 0.000482,
      });

      return {
        kind: "answered",
        status: outcome.status,
        traceId: persisted.id,
        answer,
        mode: input.mode,
        sources:
          outcome.status === "answered_no_evidence"
            ? []
            : [
                {
                  sourceNumber: 1,
                  chunkId: "11111111-1111-4111-8111-111111111111",
                  documentId: "22222222-2222-4222-8222-222222222222",
                  documentTitle: "artigo.pdf",
                  chunkIndex: 0,
                  excerpt: "Trecho governado do artigo.",
                  retrievalScore: 0.91,
                  rerankScore: null,
                  documentPipelineVersion: "documents-v1",
                  chunkingVersion: "hybrid-v1-900-150",
                  embeddingModel: "text-embedding-3-large",
                },
              ],
        relatedTerms:
          outcome.status === "answered_no_evidence"
            ? []
            : [
                {
                  rank: 1,
                  term: "classificacao supervisionada",
                  ngramSize: 2,
                  frequency: 3,
                  sourceCoverageCount: 1,
                },
              ],
        metadata: {
          mode: input.mode,
          documentId: input.mode === "focused" ? input.documentId : null,
          topK: input.retrieval?.topK ?? 6,
          retrievalStrategy: input.retrieval?.strategy ?? "standard",
          candidateTopK:
            input.retrieval?.strategy === "explore"
              ? (input.retrieval?.topK ?? 6) * 3
              : (input.retrieval?.topK ?? 6),
          promptVersion: "f05-audit-v1",
          generationModel: "gpt-4.1-mini",
          embeddingModel: "text-embedding-3-large",
          rerankerProvider: null,
          rerankerModel: null,
        },
        audit: {
          latencyMs: 432,
          embedding: {
            inputTokens: 17,
            estimatedCostUsd: 0.000002,
          },
          reranking: null,
          generation:
            outcome.status === "answered_no_evidence"
              ? null
              : {
                  inputTokens: 120,
                  outputTokens: 42,
                  totalTokens: 162,
                  estimatedCostUsd: 0.00048,
                },
          totalCostUsd:
            outcome.status === "answered_no_evidence" ? 0.000002 : 0.000482,
        },
      };
    },
  );

  return {
    answerQuestion: { execute },
    invocations,
  };
}

describe("AppendConversationMessage", () => {
  let db: TestDatabase;
  let pool: Pool;
  let runsRepository: RagQueryRunsRepository;
  let conversations: ConversationRepository;
  let messages: ConversationMessageRepository;
  let createConversation: CreateConversation;

  beforeAll(() => {
    const testDatabase = createTestDatabase();
    db = testDatabase.db;
    pool = testDatabase.pool;
    runsRepository = new RagQueryRunsRepository(db);
    conversations = new ConversationRepository(db, runsRepository);
    messages = new ConversationMessageRepository(db);
    createConversation = new CreateConversation({ conversations });
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns not_found for an unknown conversation id", async () => {
    const answerQuestion = {
      execute: vi.fn(),
    };
    const service = new AppendConversationMessage({
      conversations,
      messages,
      answerQuestion,
    });

    await expect(
      service.execute({
        conversationId: "99999999-9999-4999-8999-999999999999",
        userMessageContent: "Pergunta inexistente",
      }),
    ).resolves.toEqual({
      status: "not_found",
    });
    expect(answerQuestion.execute).not.toHaveBeenCalled();
  });

  it("persists the first user message before calling the turn engine, assigns the title, and appends an assistant trace-backed row", async () => {
    const conversation = await createConversation.execute();
    const userMessageContent =
      "  Como a base descreve o uso de sensoriamento remoto na AIA?  ";
    const { answerQuestion, invocations } = createFakeAnswerQuestion(
      db,
      runsRepository,
      conversation.id,
      {
        status: "answered",
        answer: "A base destaca classificacao supervisionada [1].",
      },
    );
    const service = new AppendConversationMessage({
      conversations,
      messages,
      answerQuestion,
    });

    const result = await service.execute({
      conversationId: conversation.id,
      userMessageContent,
    });
    if (result.status === "not_found") {
      throw new Error("Expected the conversation to exist");
    }
    if (result.status !== "answered") {
      throw new Error("Expected an answered result");
    }

    expect(result).toEqual({
      status: "answered",
      userMessage: {
        id: expect.any(String),
        role: "user",
        content: userMessageContent,
        createdAt: expect.any(Date),
        trace: null,
      },
      assistantMessage: {
        id: expect.any(String),
        role: "assistant",
        content: "A base destaca classificacao supervisionada [1].",
        createdAt: expect.any(Date),
        trace: expect.objectContaining({
          status: "answered",
          question: userMessageContent,
          answer: "A base destaca classificacao supervisionada [1].",
        }),
      },
    });

    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toEqual({
      input: {
        question: userMessageContent,
        mode: "global",
        conversationContext: {
          transcript: `User: ${userMessageContent}`,
        },
      },
      storedMessages: [
        {
          role: "user",
          content: userMessageContent,
          traceId: null,
          createdAt: result.userMessage.createdAt,
        },
      ],
      conversation: {
        title:
          "Como a base descreve o uso de sensoriamento remoto na AIA?",
        lastMessageAt: result.userMessage.createdAt,
      },
    });

    const [conversationRow] = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, conversation.id));
    expect(conversationRow.title).toBe(
      "Como a base descreve o uso de sensoriamento remoto na AIA?",
    );
    expect(conversationRow.lastMessageAt).toEqual(
      result.assistantMessage.createdAt,
    );

    const messageRows = await db
      .select()
      .from(ragConversationMessages)
      .where(eq(ragConversationMessages.conversationId, conversation.id))
      .orderBy(
        asc(ragConversationMessages.createdAt),
        asc(ragConversationMessages.id),
      );
    expect(messageRows).toHaveLength(2);
    expect(messageRows[0]?.role).toBe("user");
    expect(messageRows[1]?.role).toBe("assistant");
    expect(messageRows[1]?.traceId).toBe(result.assistantMessage.trace?.id);
  });

  it("forwards retrieval settings unchanged, caps transcript context to the previous four messages, and appends assistant rows for answered_no_evidence", async () => {
    const conversation = await createConversation.execute();
    await conversations.updateTitleIfUnset(conversation.id, "Titulo inicial");

    const priorAssistantTraceA = await insertRun(runsRepository);
    const priorAssistantTraceB = await insertRun(runsRepository, {
      question: "Pergunta anterior 2",
      answer: "Resposta anterior 2 [1].",
    });

    await insertStoredMessage(db, {
      conversationId: conversation.id,
      role: "user",
      content: "mensagem 0",
      createdAt: new Date("2026-04-24T12:00:00.000Z"),
    });
    await insertStoredMessage(db, {
      conversationId: conversation.id,
      role: "assistant",
      content: "mensagem 1",
      traceId: priorAssistantTraceA.id,
      createdAt: new Date("2026-04-24T12:00:01.000Z"),
    });
    await insertStoredMessage(db, {
      conversationId: conversation.id,
      role: "user",
      content: "mensagem 2",
      createdAt: new Date("2026-04-24T12:00:02.000Z"),
    });
    await insertStoredMessage(db, {
      conversationId: conversation.id,
      role: "assistant",
      content: "mensagem 3",
      traceId: priorAssistantTraceB.id,
      createdAt: new Date("2026-04-24T12:00:03.000Z"),
    });
    await insertStoredMessage(db, {
      conversationId: conversation.id,
      role: "user",
      content: "mensagem 4",
      createdAt: new Date("2026-04-24T12:00:04.000Z"),
    });

    const { answerQuestion, invocations } = createFakeAnswerQuestion(
      db,
      runsRepository,
      conversation.id,
      {
        status: "answered_no_evidence",
        answer: buildNoEvidenceAnswer(),
      },
    );
    const service = new AppendConversationMessage({
      conversations,
      messages,
      answerQuestion,
    });

    const result = await service.execute({
      conversationId: conversation.id,
      userMessageContent: "mensagem 5",
      retrievalSettings: {
        topK: 9,
        strategy: "explore",
      },
    });
    if (result.status === "not_found") {
      throw new Error("Expected the conversation to exist");
    }
    if (result.status !== "answered_no_evidence") {
      throw new Error("Expected an answered_no_evidence result");
    }

    expect(result.status).toBe("answered_no_evidence");
    expect(result.assistantMessage.trace).toEqual(
      expect.objectContaining({
        status: "answered_no_evidence",
        answer: buildNoEvidenceAnswer(),
        sources: [],
      }),
    );
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.input).toEqual({
      question: "mensagem 5",
      mode: "global",
      retrieval: {
        topK: 9,
        strategy: "explore",
      },
      conversationContext: {
        transcript: [
          "Assistant: mensagem 1",
          "User: mensagem 2",
          "Assistant: mensagem 3",
          "User: mensagem 4",
          "User: mensagem 5",
        ].join("\n\n"),
      },
    });

    const [conversationRow] = await db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, conversation.id));
    expect(conversationRow.title).toBe("Titulo inicial");
    expect(conversationRow.lastMessageAt).toEqual(
      result.assistantMessage.createdAt,
    );
  });

  it.each([
    "generation_failed",
    "generation_unavailable",
  ] as const)(
    "persists the user message but does not append an assistant row on %s",
    async (status) => {
      const conversation = await createConversation.execute();
      await conversations.updateTitleIfUnset(conversation.id, "Titulo fixo");
      await insertStoredMessage(db, {
        conversationId: conversation.id,
        role: "user",
        content: "mensagem anterior",
        createdAt: new Date("2026-04-23T12:00:00.000Z"),
      });

      const { answerQuestion } = createFakeAnswerQuestion(
        db,
        runsRepository,
        conversation.id,
        { status },
      );
      const service = new AppendConversationMessage({
        conversations,
        messages,
        answerQuestion,
      });

      const result = await service.execute({
        conversationId: conversation.id,
        userMessageContent: "mensagem que falha",
      });
      if (result.status === "not_found") {
        throw new Error("Expected the conversation to exist");
      }

      expect(result).toEqual({
        status,
        userMessage: {
          id: expect.any(String),
          role: "user",
          content: "mensagem que falha",
          createdAt: expect.any(Date),
          trace: null,
        },
        errorCode: status,
      });

      const messageRows = await db
        .select()
        .from(ragConversationMessages)
        .where(eq(ragConversationMessages.conversationId, conversation.id))
        .orderBy(
          asc(ragConversationMessages.createdAt),
          asc(ragConversationMessages.id),
        );
      expect(messageRows).toHaveLength(2);
      expect(messageRows[0]?.content).toBe("mensagem anterior");
      expect(messageRows[1]?.role).toBe("user");
      expect(messageRows[1]?.content).toBe("mensagem que falha");

      const [conversationRow] = await db
        .select()
        .from(ragConversations)
        .where(eq(ragConversations.id, conversation.id));
      expect(conversationRow.title).toBe("Titulo fixo");
      expect(conversationRow.lastMessageAt).toEqual(result.userMessage.createdAt);

      const persistedRuns = await db.select().from(ragQueryRuns);
      expect(persistedRuns).toHaveLength(1);
      expect(persistedRuns[0]?.status).toBe(status);
      expect(persistedRuns[0]?.question).toBe("mensagem que falha");
    },
  );

  it.each([
    ["not_found", "document_not_found"],
    ["not_processed", "document_not_focusable"],
    ["not_indexed", "document_not_focusable"],
  ] as const)(
    "persists the user message, forwards focused scope, and skips the assistant row on focused rejection %s",
    async (reason, expectedStatus) => {
      const conversation = await createConversation.execute();
      const { answerQuestion, invocations } = createFakeAnswerQuestion(
        db,
        runsRepository,
        conversation.id,
        { focusedRejectedReason: reason },
      );
      const service = new AppendConversationMessage({
        conversations,
        messages,
        answerQuestion,
      });

      const result = await service.execute({
        conversationId: conversation.id,
        userMessageContent: "mensagem focada",
        mode: "focused",
        documentId: "77777777-7777-4777-8777-777777777777",
        retrievalSettings: {
          topK: 8,
          strategy: "explore",
        },
      });
      if (result.status === "not_found") {
        throw new Error("Expected the conversation to exist");
      }

      expect(result).toEqual({
        status: expectedStatus,
        userMessage: {
          id: expect.any(String),
          role: "user",
          content: "mensagem focada",
          createdAt: expect.any(Date),
          trace: null,
        },
        errorCode: expectedStatus,
      });
      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.input).toEqual({
        question: "mensagem focada",
        mode: "focused",
        documentId: "77777777-7777-4777-8777-777777777777",
        retrieval: {
          topK: 8,
          strategy: "explore",
        },
        conversationContext: {
          transcript: "User: mensagem focada",
        },
      });

      const messageRows = await db
        .select()
        .from(ragConversationMessages)
        .where(eq(ragConversationMessages.conversationId, conversation.id))
        .orderBy(
          asc(ragConversationMessages.createdAt),
          asc(ragConversationMessages.id),
        );
      expect(messageRows).toHaveLength(1);
      expect(messageRows[0]?.role).toBe("user");

      const persistedRuns = await db.select().from(ragQueryRuns);
      expect(persistedRuns).toHaveLength(0);
    },
  );
});
