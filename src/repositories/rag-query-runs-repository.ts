import { asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  ragQueryRunRelatedTerms,
  ragQueryRunSources,
  ragQueryRuns,
} from "@/db/schema";
import type {
  RagQueryRunErrorCode,
  RagQueryRunStatus,
  RagRetrievalStrategy,
  RelatedTerm,
} from "@/domain/rag";

type DatabaseClient = NodePgDatabase<typeof schema>;

export type PersistedRagSourceSnapshot = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
  citedInAnswer: boolean;
};

export type PersistRagQueryRunInput = {
  question: string;
  answer: string | null;
  mode: "global";
  status: RagQueryRunStatus;
  errorCode: RagQueryRunErrorCode | null;
  topK: number;
  retrievalStrategy: RagRetrievalStrategy;
  candidateTopK: number;
  promptVersion: string;
  generationModel: string;
  embeddingModel: string;
  latencyMs: number;
  embeddingInputTokens: number;
  embeddingCostUsd: number;
  generationInputTokens: number | null;
  generationOutputTokens: number | null;
  generationTotalTokens: number | null;
  generationCostUsd: number | null;
  totalCostUsd: number;
  sources: PersistedRagSourceSnapshot[];
  relatedTerms: RelatedTerm[];
};

export type RagRunMetadata = {
  mode: "global";
  topK: number;
  retrievalStrategy: RagRetrievalStrategy;
  candidateTopK: number;
  promptVersion: string;
  generationModel: string;
  embeddingModel: string;
};

export type RagRunEmbeddingAudit = {
  inputTokens: number;
  estimatedCostUsd: number;
};

export type RagRunGenerationAudit = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type RagRunAudit = {
  latencyMs: number;
  embedding: RagRunEmbeddingAudit;
  generation: RagRunGenerationAudit | null;
  totalCostUsd: number;
};

export type RagRunSummary = {
  id: string;
  question: string;
  status: RagQueryRunStatus;
  topK: number;
  retrievalStrategy: RagRetrievalStrategy;
  latencyMs: number;
  totalCostUsd: number;
  createdAt: Date;
};

export type RagRunDetail = {
  id: string;
  question: string;
  answer: string | null;
  mode: "global";
  status: RagQueryRunStatus;
  errorCode: RagQueryRunErrorCode | null;
  sources: PersistedRagSourceSnapshot[];
  relatedTerms: RelatedTerm[];
  metadata: RagRunMetadata;
  audit: RagRunAudit;
  createdAt: Date;
};

export class RagQueryRunsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(
    input: PersistRagQueryRunInput,
  ): Promise<{ id: string; createdAt: Date }> {
    return this.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(ragQueryRuns)
        .values({
          question: input.question,
          answer: input.answer,
          mode: input.mode,
          status: input.status,
          errorCode: input.errorCode,
          topK: input.topK,
          retrievalStrategy: input.retrievalStrategy,
          candidateTopK: input.candidateTopK,
          promptVersion: input.promptVersion,
          generationModel: input.generationModel,
          embeddingModel: input.embeddingModel,
          latencyMs: input.latencyMs,
          embeddingInputTokens: input.embeddingInputTokens,
          embeddingCostUsd: input.embeddingCostUsd,
          generationInputTokens: input.generationInputTokens,
          generationOutputTokens: input.generationOutputTokens,
          generationTotalTokens: input.generationTotalTokens,
          generationCostUsd: input.generationCostUsd,
          totalCostUsd: input.totalCostUsd,
        })
        .returning({
          id: ragQueryRuns.id,
          createdAt: ragQueryRuns.createdAt,
        });

      if (input.sources.length > 0) {
        await tx.insert(ragQueryRunSources).values(
          input.sources.map((source) => ({
            runId: run.id,
            sourceNumber: source.sourceNumber,
            chunkId: source.chunkId,
            documentId: source.documentId,
            documentTitle: source.documentTitle,
            chunkIndex: source.chunkIndex,
            excerpt: source.excerpt,
            score: source.score,
            documentPipelineVersion: source.documentPipelineVersion,
            chunkingVersion: source.chunkingVersion,
            embeddingModel: source.embeddingModel,
            citedInAnswer: source.citedInAnswer,
          })),
        );
      }

      if (input.relatedTerms.length > 0) {
        await tx.insert(ragQueryRunRelatedTerms).values(
          input.relatedTerms.map((term) => ({
            runId: run.id,
            rank: term.rank,
            term: term.term,
            ngramSize: term.ngramSize,
            frequency: term.frequency,
            sourceCoverageCount: term.sourceCoverageCount,
          })),
        );
      }

      return run;
    });
  }

  async listRecent(): Promise<RagRunSummary[]> {
    const runs = await this.db
      .select({
        id: ragQueryRuns.id,
        question: ragQueryRuns.question,
        status: ragQueryRuns.status,
        topK: ragQueryRuns.topK,
        retrievalStrategy: ragQueryRuns.retrievalStrategy,
        latencyMs: ragQueryRuns.latencyMs,
        totalCostUsd: ragQueryRuns.totalCostUsd,
        createdAt: ragQueryRuns.createdAt,
      })
      .from(ragQueryRuns)
      .orderBy(desc(ragQueryRuns.createdAt), desc(ragQueryRuns.id));

    return runs.map((run) => ({
      id: run.id,
      question: run.question,
      status: run.status,
      topK: run.topK,
      retrievalStrategy: run.retrievalStrategy,
      latencyMs: run.latencyMs,
      totalCostUsd: run.totalCostUsd,
      createdAt: run.createdAt,
    }));
  }

  async getById(id: string): Promise<RagRunDetail | null> {
    return this.db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(ragQueryRuns)
        .where(eq(ragQueryRuns.id, id))
        .limit(1)
        .for("update");

      if (!run) {
        return null;
      }

      const sources = await tx
        .select()
        .from(ragQueryRunSources)
        .where(eq(ragQueryRunSources.runId, id))
        .orderBy(asc(ragQueryRunSources.sourceNumber));

      const relatedTerms = await tx
        .select()
        .from(ragQueryRunRelatedTerms)
        .where(eq(ragQueryRunRelatedTerms.runId, id))
        .orderBy(asc(ragQueryRunRelatedTerms.rank));

      return {
        id: run.id,
        question: run.question,
        answer: run.answer,
        mode: run.mode,
        status: run.status,
        errorCode: run.errorCode,
        sources: sources.map((source) => ({
          sourceNumber: source.sourceNumber,
          chunkId: source.chunkId,
          documentId: source.documentId,
          documentTitle: source.documentTitle,
          chunkIndex: source.chunkIndex,
          excerpt: source.excerpt,
          score: source.score,
          documentPipelineVersion: source.documentPipelineVersion,
          chunkingVersion: source.chunkingVersion,
          embeddingModel: source.embeddingModel,
          citedInAnswer: source.citedInAnswer,
        })),
        relatedTerms: relatedTerms.map((term) => ({
          rank: term.rank,
          term: term.term,
          ngramSize: term.ngramSize,
          frequency: term.frequency,
          sourceCoverageCount: term.sourceCoverageCount,
        })),
        metadata: {
          mode: run.mode,
          topK: run.topK,
          retrievalStrategy: run.retrievalStrategy,
          candidateTopK: run.candidateTopK,
          promptVersion: run.promptVersion,
          generationModel: run.generationModel,
          embeddingModel: run.embeddingModel,
        },
        audit: {
          latencyMs: run.latencyMs,
          embedding: {
            inputTokens: run.embeddingInputTokens,
            estimatedCostUsd: run.embeddingCostUsd,
          },
          generation: mapGenerationAudit(run),
          totalCostUsd: run.totalCostUsd,
        },
        createdAt: run.createdAt,
      };
    });
  }
}

function mapGenerationAudit(
  run: Pick<
    schema.RagQueryRun,
    | "generationInputTokens"
    | "generationOutputTokens"
    | "generationTotalTokens"
    | "generationCostUsd"
  >,
): RagRunGenerationAudit | null {
  const inputTokens = run.generationInputTokens;
  const outputTokens = run.generationOutputTokens;
  const totalTokens = run.generationTotalTokens;
  const estimatedCostUsd = run.generationCostUsd;
  const values = [
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
  ];

  if (values.every((value) => value === null)) {
    return null;
  }

  if (
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    estimatedCostUsd === null
  ) {
    throw new Error("Inconsistent generation audit metrics for persisted query run");
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
  };
}
