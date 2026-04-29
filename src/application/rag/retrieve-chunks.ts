import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import {
  assertValidRerankedSelection,
  getCandidateTopK,
  ragRerankingAuditSchema,
  ragRerankingMetadataSchema,
  selectDiversifiedMatches,
  type FirstPassChunkMatch,
  type RagRetrievalSettings,
  type RetrievedChunkMatch,
  type RerankedChunkMatch,
} from "@/domain/rag";

import type {
  EmbeddingUsage,
  GlobalChunkSearchRepository,
  QuestionEmbeddingProvider,
  RerankingProvider,
} from "./ports";

export type RetrieveChunksDeps = {
  questionEmbeddingProvider: QuestionEmbeddingProvider;
  chunksRepository: GlobalChunkSearchRepository;
  rerankingProvider?: RerankingProvider;
  embeddingModel: string;
};

export type RetrieveChunksInput = {
  question: string;
  retrieval: RagRetrievalSettings;
  documentId?: string;
};

export type RetrieveChunksResult = {
  matches: RerankedChunkMatch[];
  embedding: EmbeddingUsage;
  reranking: {
    metadata: ReturnType<typeof ragRerankingMetadataSchema.parse>;
    audit: ReturnType<typeof ragRerankingAuditSchema.parse>;
  } | null;
};

export class RetrieveChunksFailure extends Error {
  readonly cause: unknown;
  readonly embedding: EmbeddingUsage | null;

  constructor(cause: unknown, embedding: EmbeddingUsage | null) {
    super("retrieve_chunks_failed");
    this.name = "RetrieveChunksFailure";
    this.cause = cause;
    this.embedding = embedding;
  }
}

export class RerankingFailure extends Error {
  readonly code: "reranking_failed" | "reranking_unavailable";
  readonly embedding: EmbeddingUsage | null;
  readonly cause: unknown;

  constructor(
    code: "reranking_failed" | "reranking_unavailable",
    cause: unknown,
    embedding: EmbeddingUsage | null,
  ) {
    super(code);
    this.name = "RerankingFailure";
    this.code = code;
    this.embedding = embedding;
    this.cause = cause;
  }
}

export class RetrieveChunks {
  readonly embeddingModel: string;
  readonly chunkingVersion: string;

  private readonly questionEmbeddingProvider: QuestionEmbeddingProvider;
  private readonly chunksRepository: GlobalChunkSearchRepository;
  private readonly rerankingProvider?: RerankingProvider;

  constructor(deps: RetrieveChunksDeps) {
    this.questionEmbeddingProvider = deps.questionEmbeddingProvider;
    this.chunksRepository = deps.chunksRepository;
    this.rerankingProvider = deps.rerankingProvider;
    this.embeddingModel = deps.embeddingModel;
    this.chunkingVersion = DEFAULT_CHUNKING_CONFIG.chunkingVersion;
  }

  async search(input: RetrieveChunksInput): Promise<RetrieveChunksResult> {
    let embeddingUsage: EmbeddingUsage | null = null;

    try {
      const { embedding: queryEmbedding, usage } =
        await this.questionEmbeddingProvider.embedQuestion(input.question);
      embeddingUsage = usage;
      const candidateTopK = getCandidateTopK(input.retrieval);

      const rawMatches = await this.chunksRepository.searchGlobal({
        queryEmbedding,
        topK: candidateTopK,
        chunkingVersion: this.chunkingVersion,
        embeddingModel: this.embeddingModel,
        ...(input.documentId !== undefined
          ? { documentId: input.documentId }
          : {}),
      });

      if (input.retrieval.strategy === "standard") {
        return {
          matches: rawMatches.map(toFirstPassMatch),
          embedding: usage,
          reranking: null,
        };
      }

      if (input.retrieval.strategy === "explore") {
        return {
          matches: selectDiversifiedMatches({
            matches: rawMatches,
            topK: input.retrieval.topK,
          }).map(toFirstPassMatch),
          embedding: usage,
          reranking: null,
        };
      }

      if (rawMatches.length === 0) {
        return {
          matches: [],
          embedding: usage,
          reranking: null,
        };
      }

      if (!this.rerankingProvider) {
        throw new RerankingFailure(
          "reranking_unavailable",
          new Error("reranking_provider_unavailable"),
          usage,
        );
      }

      const firstPassMatches = rawMatches.map(toFirstPassMatch);
      const rerankedResult = await this.rerankMatches({
        question: input.question,
        matches: firstPassMatches,
        topK: input.retrieval.topK,
        candidateTopK,
        embedding: usage,
      });

      return {
        matches: rerankedResult.matches,
        embedding: usage,
        reranking: {
          metadata: rerankedResult.metadata,
          audit: rerankedResult.audit,
        },
      };
    } catch (error) {
      if (error instanceof RerankingFailure) {
        throw error;
      }

      throw new RetrieveChunksFailure(error, embeddingUsage);
    }
  }

  private async rerankMatches(input: {
    question: string;
    matches: FirstPassChunkMatch[];
    topK: number;
    candidateTopK: number;
    embedding: EmbeddingUsage;
  }): Promise<{
    matches: RerankedChunkMatch[];
    metadata: ReturnType<typeof ragRerankingMetadataSchema.parse>;
    audit: ReturnType<typeof ragRerankingAuditSchema.parse>;
  }> {
    try {
      const result = await this.rerankingProvider!.rerank({
        question: input.question,
        matches: input.matches,
        topK: input.topK,
        candidateTopK: input.candidateTopK,
      });

      const metadata = ragRerankingMetadataSchema.parse(result.metadata);
      const audit = ragRerankingAuditSchema.parse(result.audit);

      assertValidRerankedSelection({
        candidateChunkIds: input.matches.map((match) => match.chunkId),
        selectedChunkIds: result.matches.map((match) => match.chunkId),
        topK: input.topK,
      });

      const candidatesById = new Map(
        input.matches.map((match) => [match.chunkId, match] as const),
      );

      return {
        matches: result.matches.map((match) => {
          const candidate = candidatesById.get(match.chunkId);

          if (!candidate) {
            throw new Error("reranked_selection_contains_unknown_chunk_id");
          }

          return {
            ...candidate,
            rerankScore: match.rerankScore ?? null,
          };
        }),
        metadata,
        audit,
      };
    } catch (error) {
      if (error instanceof RerankingFailure) {
        throw error;
      }

      throw new RerankingFailure(
        classifyRerankingFailure(error),
        error,
        input.embedding,
      );
    }
  }
}

function toFirstPassMatch(match: RetrievedChunkMatch): FirstPassChunkMatch {
  return {
    chunkId: match.chunkId,
    documentId: match.documentId,
    documentTitle: match.documentTitle,
    chunkIndex: match.chunkIndex,
    excerpt: match.excerpt,
    retrievalScore: match.score,
    rerankScore: null,
    documentPipelineVersion: match.documentPipelineVersion,
    chunkingVersion: match.chunkingVersion,
    embeddingModel: match.embeddingModel,
  };
}

function classifyRerankingFailure(
  error: unknown,
): "reranking_failed" | "reranking_unavailable" {
  const statusCode = extractStatusCode(error);

  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return "reranking_unavailable";
  }

  const message = extractMessage(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("network") ||
    message.includes("unavailable")
  ) {
    return "reranking_unavailable";
  }

  return "reranking_failed";
}

function extractStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = Reflect.get(error, "statusCode") ?? Reflect.get(error, "status");
  return typeof value === "number" ? value : null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null) {
    return "";
  }

  const value = Reflect.get(error, "message");
  return typeof value === "string" ? value : "";
}
