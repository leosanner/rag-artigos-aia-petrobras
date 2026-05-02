import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import {
  RagQueryRunsRepository,
  type PersistRagQueryRunInput,
} from "@/repositories/rag-query-runs-repository";
import { createTestDatabase, resetTestDatabase } from "@/test/db";

import { createRagConversationDetailHandler } from "./conversations/[id]/handler";

type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const SECRET = "trace-completeness-integration-secret";
const PROMPT_VERSION = "f12-b02-test";
const EMBEDDING_MODEL = "text-embedding-3-large";
const GENERATION_MODEL = "gpt-4.1-mini";
const RERANKER_PROVIDER = "voyage";
const RERANKER_MODEL = "rerank-2";
const DOC_ID = "11111111-1111-4111-8111-111111111111";
const CHUNK_ID_A = "22222222-2222-4222-8222-222222222222";
const CHUNK_ID_B = "33333333-3333-4333-8333-333333333333";
const CHUNKING_VERSION = "hybrid-v1-900-150";
const PIPELINE_VERSION = "f12-b02-test";

function baseRunInput(question: string): PersistRagQueryRunInput {
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
    latencyMs: 130,
    embeddingInputTokens: 10,
    embeddingCostUsd: 0.0000013,
    generationInputTokens: 50,
    generationOutputTokens: 20,
    generationTotalTokens: 70,
    generationCostUsd: 0.0000123,
    totalCostUsd: 0.0000136,
    sources: [
      {
        sourceNumber: 1,
        chunkId: CHUNK_ID_A,
        documentId: DOC_ID,
        documentTitle: "doc-standard.pdf",
        chunkIndex: 0,
        excerpt: "Trecho relevante para a pergunta padrao.",
        retrievalScore: 0.81,
        rerankScore: null,
        documentPipelineVersion: PIPELINE_VERSION,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: true,
      },
    ],
    relatedTerms: [],
  };
}

function exploreRunInput(): PersistRagQueryRunInput {
  return {
    ...baseRunInput("Pergunta de exploracao?"),
    retrievalStrategy: "explore",
    relatedTerms: [
      {
        rank: 1,
        term: "segmentacao semantica",
        ngramSize: 2,
        frequency: 4,
        sourceCoverageCount: 2,
      },
      {
        rank: 2,
        term: "deteccao de mudancas",
        ngramSize: 3,
        frequency: 3,
        sourceCoverageCount: 1,
      },
    ],
  };
}

function rerankRunInput(): PersistRagQueryRunInput {
  return {
    ...baseRunInput("Pergunta com rerank?"),
    retrievalStrategy: "rerank",
    rerankerProvider: RERANKER_PROVIDER,
    rerankerModel: RERANKER_MODEL,
    rerankingLatencyMs: 75,
    rerankingCandidatesEvaluated: 12,
    rerankingInputTokens: 320,
    rerankingCostUsd: 0.0000045,
    sources: [
      {
        sourceNumber: 1,
        chunkId: CHUNK_ID_A,
        documentId: DOC_ID,
        documentTitle: "doc-rerank.pdf",
        chunkIndex: 0,
        excerpt: "Trecho relevante apos rerank.",
        retrievalScore: 0.71,
        rerankScore: 0.93,
        documentPipelineVersion: PIPELINE_VERSION,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: true,
      },
      {
        sourceNumber: 2,
        chunkId: CHUNK_ID_B,
        documentId: DOC_ID,
        documentTitle: "doc-rerank.pdf",
        chunkIndex: 1,
        excerpt: "Outro trecho posicionado pelo rerank.",
        retrievalScore: 0.63,
        rerankScore: 0.85,
        documentPipelineVersion: PIPELINE_VERSION,
        chunkingVersion: CHUNKING_VERSION,
        embeddingModel: EMBEDDING_MODEL,
        citedInAnswer: false,
      },
    ],
  };
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${SECRET}` };
}

describe("F-12 / RN-10 — GET /api/rag/conversations/:id returns full inline trace per assistant message", () => {
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

  it("hydrates standard, explore and rerank assistant messages with sources, related terms, audit and rerank metadata", async () => {
    const runs = new RagQueryRunsRepository(db);
    const conversations = new ConversationRepository(db, runs);
    const messages = new ConversationMessageRepository(db);

    const conversation = await conversations.create();

    const standard = await runs.create(baseRunInput("Pergunta padrao?"));
    await messages.append({
      conversationId: conversation.id,
      role: "user",
      content: "Pergunta padrao?",
      traceId: null,
    });
    await messages.append({
      conversationId: conversation.id,
      role: "assistant",
      content: "Resposta padrao [1].",
      traceId: standard.id,
    });

    const explore = await runs.create(exploreRunInput());
    await messages.append({
      conversationId: conversation.id,
      role: "user",
      content: "Pergunta de exploracao?",
      traceId: null,
    });
    await messages.append({
      conversationId: conversation.id,
      role: "assistant",
      content: "Resposta de exploracao [1].",
      traceId: explore.id,
    });

    const rerank = await runs.create(rerankRunInput());
    await messages.append({
      conversationId: conversation.id,
      role: "user",
      content: "Pergunta com rerank?",
      traceId: null,
    });
    await messages.append({
      conversationId: conversation.id,
      role: "assistant",
      content: "Resposta com rerank [1].",
      traceId: rerank.id,
    });

    const handler = createRagConversationDetailHandler({
      getConversation: new GetConversationDetail({ conversations }),
      secret: SECRET,
    });

    const response = await handler(
      new Request(
        `http://localhost/api/rag/conversations/${conversation.id}`,
        { method: "GET", headers: authHeaders() },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      messages: Array<{
        role: "user" | "assistant";
        trace: null | {
          id: string;
          metadata: {
            retrievalStrategy: "standard" | "explore" | "rerank";
            promptVersion: string;
            generationModel: string;
            embeddingModel: string;
            rerankerProvider: string | null;
            rerankerModel: string | null;
          };
          sources: Array<{
            sourceNumber: number;
            documentId: string;
            documentTitle: string;
            excerpt: string;
            retrievalScore: number;
            rerankScore: number | null;
            citedInAnswer: boolean;
          }>;
          relatedTerms: Array<{ rank: number; term: string }>;
          audit: {
            latencyMs: number;
            embedding: { inputTokens: number; estimatedCostUsd: number };
            generation: {
              inputTokens: number;
              outputTokens: number;
              totalTokens: number;
              estimatedCostUsd: number;
            } | null;
            reranking: {
              latencyMs: number;
              candidatesEvaluated: number;
              inputTokens: number;
              estimatedCostUsd: number;
            } | null;
            totalCostUsd: number;
          };
        };
      }>;
    };

    expect(body.id).toBe(conversation.id);
    const assistantMessages = body.messages.filter(
      (msg) => msg.role === "assistant",
    );
    expect(assistantMessages).toHaveLength(3);

    const [standardMsg, exploreMsg, rerankMsg] = assistantMessages;

    expect(standardMsg.trace).not.toBeNull();
    expect(standardMsg.trace!.id).toBe(standard.id);
    expect(standardMsg.trace!.metadata.retrievalStrategy).toBe("standard");
    expect(standardMsg.trace!.metadata.promptVersion).toBe(PROMPT_VERSION);
    expect(standardMsg.trace!.metadata.generationModel).toBe(GENERATION_MODEL);
    expect(standardMsg.trace!.metadata.embeddingModel).toBe(EMBEDDING_MODEL);
    expect(standardMsg.trace!.metadata.rerankerProvider).toBeNull();
    expect(standardMsg.trace!.metadata.rerankerModel).toBeNull();
    expect(standardMsg.trace!.sources.length).toBeGreaterThan(0);
    expect(standardMsg.trace!.sources[0].rerankScore).toBeNull();
    expect(standardMsg.trace!.sources[0].documentTitle).toBe("doc-standard.pdf");
    expect(standardMsg.trace!.sources[0].excerpt).toMatch(/padrao/);
    expect(standardMsg.trace!.relatedTerms).toEqual([]);
    expect(standardMsg.trace!.audit.latencyMs).toBeGreaterThanOrEqual(0);
    expect(standardMsg.trace!.audit.embedding.inputTokens).toBe(10);
    expect(standardMsg.trace!.audit.generation).not.toBeNull();
    expect(standardMsg.trace!.audit.reranking).toBeNull();
    expect(standardMsg.trace!.audit.totalCostUsd).toBeGreaterThan(0);

    expect(exploreMsg.trace!.metadata.retrievalStrategy).toBe("explore");
    expect(exploreMsg.trace!.relatedTerms).toHaveLength(2);
    expect(exploreMsg.trace!.relatedTerms[0]).toMatchObject({
      rank: 1,
      term: "segmentacao semantica",
    });
    expect(exploreMsg.trace!.audit.reranking).toBeNull();

    expect(rerankMsg.trace!.metadata.retrievalStrategy).toBe("rerank");
    expect(rerankMsg.trace!.metadata.rerankerProvider).toBe(RERANKER_PROVIDER);
    expect(rerankMsg.trace!.metadata.rerankerModel).toBe(RERANKER_MODEL);
    expect(rerankMsg.trace!.audit.reranking).toEqual({
      latencyMs: 75,
      candidatesEvaluated: 12,
      inputTokens: 320,
      estimatedCostUsd: 0.0000045,
    });
    expect(rerankMsg.trace!.sources).toHaveLength(2);
    for (const source of rerankMsg.trace!.sources) {
      expect(source.rerankScore).not.toBeNull();
    }
    expect(rerankMsg.trace!.relatedTerms).toEqual([]);

    for (const msg of body.messages.filter((m) => m.role === "user")) {
      expect(msg.trace).toBeNull();
    }
  });
});
