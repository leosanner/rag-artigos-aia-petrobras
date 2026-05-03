import { logRagError } from "@/infrastructure/observability/log-rag-error";
import {
  GenerationFailure,
  assertValidCitationMarkers,
  assembleRagContext,
  buildExploreArtifactContent,
  buildNoEvidenceAnswer,
  extractCitationNumbers,
  extractRelatedTerms,
  getCandidateTopK,
  isNoEvidenceAnswer,
  normalizeRetrievalSettings,
  toSafeGenerationFailureCode,
  type RagQueryRunErrorCode,
  type RagQueryRunStatus,
  type RagRetrievalSettings,
  type RagSource,
  type RetrievedChunkMatch,
  type RerankedChunkMatch,
} from "@/domain/rag";
import type {
  PersistRagQueryRunInput,
  PersistedRagSourceSnapshot,
  RagQueryRunsRepository,
} from "@/repositories/rag-query-runs-repository";

import { GLOBAL_RAG_PROMPT_VERSION } from "./constants";
import type {
  EmbeddingUsage,
  FocusedDocumentClassifier,
  GenerationProvider,
  GenerationUsage,
} from "./ports";
import type {
  AnswerQuestionAudit,
  AnswerQuestionInput,
  AnswerQuestionMetadata,
  AnswerQuestionResult,
  RagSource as PublicRagSource,
  RelatedTerm,
} from "./schemas";
import { answerQuestionResultSchema } from "./schemas";
import {
  RerankingFailure,
  RetrieveChunksFailure,
  type RetrieveChunks,
} from "./retrieve-chunks";

export type AnswerQuestionDeps = {
  retrieveChunks: Pick<RetrieveChunks, "search" | "embeddingModel">;
  generationProvider: GenerationProvider;
  runsRepository: Pick<RagQueryRunsRepository, "create">;
  focusedDocumentClassifier: FocusedDocumentClassifier;
  generationModel: string;
  promptVersion?: string;
  nowMs?: () => number;
};

export type AnswerQuestionStreamCallbacks = {
  onSources?: (sources: RagSource[]) => Promise<void> | void;
  onRerankingStart?: () => Promise<void> | void;
  onGenerationStart?: () => Promise<void> | void;
  onAnswerDelta?: (textDelta: string) => Promise<void> | void;
};

const NO_EVIDENCE_ANSWER = buildNoEvidenceAnswer();
const ZERO_EMBEDDING_USAGE: EmbeddingUsage = {
  inputTokens: 0,
  estimatedCostUsd: 0,
};

export class TracePersistenceFailure extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("trace_persistence_failed");
    this.name = "TracePersistenceFailure";
    this.cause = cause;
  }
}

export class AnswerQuestion {
  private readonly retrieveChunks: Pick<
    RetrieveChunks,
    "search" | "embeddingModel"
  >;
  private readonly generationProvider: GenerationProvider;
  private readonly runsRepository: Pick<RagQueryRunsRepository, "create">;
  private readonly focusedDocumentClassifier: FocusedDocumentClassifier;
  private readonly generationModel: string;
  private readonly promptVersion: string;
  private readonly nowMs: () => number;

  constructor(deps: AnswerQuestionDeps) {
    this.retrieveChunks = deps.retrieveChunks;
    this.generationProvider = deps.generationProvider;
    this.runsRepository = deps.runsRepository;
    this.focusedDocumentClassifier = deps.focusedDocumentClassifier;
    this.generationModel = deps.generationModel;
    this.promptVersion = deps.promptVersion ?? GLOBAL_RAG_PROMPT_VERSION;
    this.nowMs = deps.nowMs ?? Date.now;
  }

  async execute(input: AnswerQuestionInput): Promise<AnswerQuestionResult> {
    return this.executeInternal(input, null);
  }

  async executeStream(
    input: AnswerQuestionInput,
    callbacks: AnswerQuestionStreamCallbacks,
  ): Promise<AnswerQuestionResult> {
    return this.executeInternal(input, callbacks);
  }

  private async executeInternal(
    input: AnswerQuestionInput,
    callbacks: AnswerQuestionStreamCallbacks | null,
  ): Promise<AnswerQuestionResult> {
    const documentId = input.mode === "focused" ? input.documentId : null;

    if (input.mode === "focused") {
      const classification =
        await this.focusedDocumentClassifier.classifyForFocusedRag(
          input.documentId,
        );

      if (classification !== "ok") {
        return answerQuestionResultSchema.parse({
          kind: "focused_document_rejected",
          reason: classification,
        });
      }
    }

    const mode: "global" | "focused" = input.mode;
    const retrieval = normalizeRetrievalSettings(input.retrieval);
    const retrievalQuestion =
      input.conversationContext?.transcript ?? input.question;
    const startedAtMs = this.nowMs();
    const baseMetadata = this.buildMetadata(mode, documentId, retrieval, null);
    let retrievalResult: Awaited<ReturnType<RetrieveChunks["search"]>>;

    try {
      retrievalResult = await this.retrieveChunks.search({
        question: retrievalQuestion,
        retrieval,
        ...(documentId !== null ? { documentId } : {}),
        ...(callbacks?.onRerankingStart !== undefined
          ? { onRerankingStart: callbacks.onRerankingStart }
          : {}),
      });
    } catch (error) {
      const failureCode = toApplicationFailureCode(error);
      logRagError(
        error instanceof RerankingFailure
          ? "answer.reranking_failed"
          : "answer.retrieval_failed",
        {
          requestTraceId: input.requestTraceId,
          failureCode,
          embeddingModel: this.retrieveChunks.embeddingModel,
          retrievalStrategy: retrieval.strategy,
          topK: retrieval.topK,
        },
        error,
      );
      const embedding =
        (error instanceof RetrieveChunksFailure ||
          error instanceof RerankingFailure) &&
        error.embedding !== null
          ? error.embedding
          : ZERO_EMBEDDING_USAGE;
      const relatedTerms = extractRelatedTerms({
        question: input.question,
        sourceExcerpts: [],
      });
      const audit = this.buildAudit(startedAtMs, embedding, null, null);

      await this.persistRun(
        this.buildPersistInput({
          question: input.question,
          answer: null,
          status: failureCode,
          errorCode: failureCode,
          metadata: baseMetadata,
          audit,
          sources: [],
          relatedTerms,
          generation: null,
        }),
        input.requestTraceId,
      );

      return answerQuestionResultSchema.parse({
        kind: "error",
        error: failureCode,
      });
    }

    const { matches, embedding, reranking } = retrievalResult;
    const metadata = this.buildMetadata(
      mode,
      documentId,
      retrieval,
      reranking?.metadata ?? null,
    );

    if (matches.length === 0) {
      const relatedTerms = extractRelatedTerms({
        question: input.question,
        sourceExcerpts: [],
      });
      const audit = this.buildAudit(
        startedAtMs,
        embedding,
        reranking?.audit ?? null,
        null,
      );
      const persisted = await this.persistRun(
        this.buildPersistInput({
          question: input.question,
          answer: NO_EVIDENCE_ANSWER,
          status: "answered_no_evidence",
          errorCode: null,
          metadata,
          audit,
          sources: [],
          relatedTerms,
          generation: null,
        }),
        input.requestTraceId,
      );

      return answerQuestionResultSchema.parse({
        kind: "answered",
        status: "answered_no_evidence",
        traceId: persisted.id,
        answer: NO_EVIDENCE_ANSWER,
        mode,
        sources: [],
        relatedTerms,
        metadata,
        audit,
      });
    }

    const streamingMatches = matches.map(toStreamingRetrievedChunkMatch);
    const { sources, promptContext } = assembleRagContext(streamingMatches);
    const publicSources = matches.map((match, index) =>
      toPublicSource(match, index + 1),
    );
    const relatedTerms = extractRelatedTerms({
      question: input.question,
      sourceExcerpts: matches.map((match) => match.excerpt),
    });

    if (retrieval.strategy === "explore") {
      const exploreAnswer = buildExploreArtifactContent(relatedTerms);
      const audit = this.buildAudit(
        startedAtMs,
        embedding,
        reranking?.audit ?? null,
        null,
      );
      const persisted = await this.persistRun(
        this.buildPersistInput({
          question: input.question,
          answer: exploreAnswer,
          status: "answered",
          errorCode: null,
          metadata,
          audit,
          sources: toPersistedSources(matches, new Set<number>()),
          relatedTerms,
          generation: null,
        }),
        input.requestTraceId,
      );

      return answerQuestionResultSchema.parse({
        kind: "answered",
        status: "answered",
        traceId: persisted.id,
        answer: exploreAnswer,
        mode,
        sources: [],
        relatedTerms,
        metadata,
        audit,
      });
    }

    let generation: GenerationUsage | null = null;
    let answer: string;
    let citedSourceNumbers: Set<number>;

    await callbacks?.onSources?.(sources);

    try {
      const result =
        callbacks === null
          ? await this.generationProvider.generateAnswer({
              question: input.question,
              conversationContext: input.conversationContext,
              promptContext,
              promptVersion: this.promptVersion,
              generationModel: this.generationModel,
              retrievalStrategy: retrieval.strategy,
            })
          : await this.streamGeneratedAnswer({
              input,
              promptContext,
              retrieval,
              callbacks,
            });
      generation = result.usage;

      const generatedAnswer = result.answer.trim();

      if (isNoEvidenceAnswer(generatedAnswer)) {
        const noEvidenceRelatedTerms = extractRelatedTerms({
          question: input.question,
          sourceExcerpts: [],
        });
        const audit = this.buildAudit(
          startedAtMs,
          embedding,
          reranking?.audit ?? null,
          generation,
        );
        const persisted = await this.persistRun(
          this.buildPersistInput({
            question: input.question,
            answer: NO_EVIDENCE_ANSWER,
            status: "answered_no_evidence",
            errorCode: null,
            metadata,
            audit,
            sources: [],
            relatedTerms: noEvidenceRelatedTerms,
            generation,
          }),
          input.requestTraceId,
        );

        return answerQuestionResultSchema.parse({
          kind: "answered",
          status: "answered_no_evidence",
          traceId: persisted.id,
          answer: NO_EVIDENCE_ANSWER,
          mode,
          sources: [],
          relatedTerms: noEvidenceRelatedTerms,
          metadata,
          audit,
        });
      }

      answer = generatedAnswer;

      citedSourceNumbers =
        answer === NO_EVIDENCE_ANSWER
          ? new Set<number>()
          : new Set(extractCitationNumbers(answer));

      if (answer !== NO_EVIDENCE_ANSWER) {
        assertValidCitationMarkers(answer, sources);
      }
    } catch (error) {
      const failureCode = toApplicationFailureCode(error);
      logRagError(
        "answer.generation_failed",
        {
          requestTraceId: input.requestTraceId,
          failureCode,
          generationModel: this.generationModel,
          promptVersion: this.promptVersion,
          sourcesCount: sources.length,
        },
        error,
      );
      const audit = this.buildAudit(
        startedAtMs,
        embedding,
        reranking?.audit ?? null,
        generation,
      );

      await this.persistRun(
        this.buildPersistInput({
          question: input.question,
          answer: null,
          status: failureCode,
          errorCode: failureCode,
          metadata,
          audit,
          sources: toPersistedSources(matches, new Set<number>()),
          relatedTerms,
          generation,
        }),
        input.requestTraceId,
      );

      return answerQuestionResultSchema.parse({
        kind: "error",
        error: failureCode,
      });
    }

    const audit = this.buildAudit(
      startedAtMs,
      embedding,
      reranking?.audit ?? null,
      generation,
    );
    const persisted = await this.persistRun(
      this.buildPersistInput({
        question: input.question,
        answer,
        status: "answered",
        errorCode: null,
        metadata,
        audit,
        sources: toPersistedSources(matches, citedSourceNumbers),
        relatedTerms,
        generation,
      }),
      input.requestTraceId,
    );

    return answerQuestionResultSchema.parse({
        kind: "answered",
        status: "answered",
        traceId: persisted.id,
        answer,
        mode,
        sources: publicSources,
        relatedTerms,
        metadata,
        audit,
    });
  }

  private async streamGeneratedAnswer(input: {
    input: AnswerQuestionInput;
    promptContext: string;
    retrieval: RagRetrievalSettings;
    callbacks: AnswerQuestionStreamCallbacks;
  }) {
    await input.callbacks.onGenerationStart?.();

    return this.generationProvider.streamAnswer({
      question: input.input.question,
      conversationContext: input.input.conversationContext,
      promptContext: input.promptContext,
      promptVersion: this.promptVersion,
      generationModel: this.generationModel,
      retrievalStrategy: input.retrieval.strategy,
      onTextDelta: async (textDelta) => {
        await input.callbacks.onAnswerDelta?.(textDelta);
      },
    });
  }

  private buildMetadata(
    mode: "global" | "focused",
    documentId: string | null,
    retrieval: RagRetrievalSettings,
    reranking:
      | {
          rerankerProvider: string;
          rerankerModel: string;
        }
      | null,
  ): AnswerQuestionMetadata {
    return {
      mode,
      documentId,
      topK: retrieval.topK,
      retrievalStrategy: retrieval.strategy,
      candidateTopK: getCandidateTopK(retrieval),
      promptVersion: this.promptVersion,
      generationModel: this.generationModel,
      embeddingModel: this.retrieveChunks.embeddingModel,
      rerankerProvider: reranking?.rerankerProvider ?? null,
      rerankerModel: reranking?.rerankerModel ?? null,
    };
  }

  private buildAudit(
    startedAtMs: number,
    embedding: EmbeddingUsage,
    reranking:
      | {
          latencyMs: number;
          candidatesEvaluated: number;
          inputTokens: number;
          estimatedCostUsd: number;
        }
      | null,
    generation: GenerationUsage | null,
  ): AnswerQuestionAudit {
    return {
      latencyMs: Math.max(0, Math.round(this.nowMs() - startedAtMs)),
      embedding,
      reranking,
      generation,
      totalCostUsd:
        embedding.estimatedCostUsd +
        (reranking?.estimatedCostUsd ?? 0) +
        (generation?.estimatedCostUsd ?? 0),
    };
  }

  private buildPersistInput(input: {
    question: string;
    answer: string | null;
    status: RagQueryRunStatus;
    errorCode: RagQueryRunErrorCode | null;
    metadata: AnswerQuestionMetadata;
    audit: AnswerQuestionAudit;
    sources: PersistedRagSourceSnapshot[];
    relatedTerms: RelatedTerm[];
    generation: GenerationUsage | null;
  }): PersistRagQueryRunInput {
    return {
      question: input.question,
      answer: input.answer,
      mode: input.metadata.mode,
      documentId: input.metadata.documentId,
      status: input.status,
      errorCode: input.errorCode,
      topK: input.metadata.topK,
      retrievalStrategy: input.metadata.retrievalStrategy,
      candidateTopK: input.metadata.candidateTopK,
      promptVersion: input.metadata.promptVersion,
      generationModel: input.metadata.generationModel,
      embeddingModel: input.metadata.embeddingModel,
      rerankerProvider: input.metadata.rerankerProvider,
      rerankerModel: input.metadata.rerankerModel,
      rerankingLatencyMs: input.audit.reranking?.latencyMs ?? null,
      rerankingCandidatesEvaluated:
        input.audit.reranking?.candidatesEvaluated ?? null,
      rerankingInputTokens: input.audit.reranking?.inputTokens ?? null,
      rerankingCostUsd: input.audit.reranking?.estimatedCostUsd ?? null,
      latencyMs: input.audit.latencyMs,
      embeddingInputTokens: input.audit.embedding.inputTokens,
      embeddingCostUsd: input.audit.embedding.estimatedCostUsd,
      generationInputTokens: input.generation?.inputTokens ?? null,
      generationOutputTokens: input.generation?.outputTokens ?? null,
      generationTotalTokens: input.generation?.totalTokens ?? null,
      generationCostUsd: input.generation?.estimatedCostUsd ?? null,
      totalCostUsd: input.audit.totalCostUsd,
      sources: input.sources,
      relatedTerms: input.relatedTerms,
    };
  }

  private async persistRun(
    input: PersistRagQueryRunInput,
    requestTraceId: string | undefined,
  ): Promise<{ id: string; createdAt: Date }> {
    try {
      return await this.runsRepository.create(input);
    } catch (error) {
      logRagError(
        "answer.trace_persistence_failed",
        { requestTraceId, status: input.status },
        error,
      );
      throw new TracePersistenceFailure(error);
    }
  }
}

function toStreamingRetrievedChunkMatch(
  match: RerankedChunkMatch,
): RetrievedChunkMatch {
  return {
    chunkId: match.chunkId,
    documentId: match.documentId,
    documentTitle: match.documentTitle,
    chunkIndex: match.chunkIndex,
    excerpt: match.excerpt,
    score: match.retrievalScore,
    documentPipelineVersion: match.documentPipelineVersion,
    chunkingVersion: match.chunkingVersion,
    embeddingModel: match.embeddingModel,
  };
}

function toPublicSource(
  match: RerankedChunkMatch,
  sourceNumber: number,
): PublicRagSource {
  return {
    sourceNumber,
    chunkId: match.chunkId,
    documentId: match.documentId,
    documentTitle: match.documentTitle,
    chunkIndex: match.chunkIndex,
    excerpt: match.excerpt,
    retrievalScore: match.retrievalScore,
    rerankScore: match.rerankScore,
    documentPipelineVersion: match.documentPipelineVersion,
    chunkingVersion: match.chunkingVersion,
    embeddingModel: match.embeddingModel,
  };
}

function toPersistedSources(
  matches: RerankedChunkMatch[],
  citedSourceNumbers: Set<number>,
): PersistedRagSourceSnapshot[] {
  return matches.map((match, index) => {
    const sourceNumber = index + 1;

    return {
      sourceNumber,
      chunkId: match.chunkId,
      documentId: match.documentId,
      documentTitle: match.documentTitle,
      chunkIndex: match.chunkIndex,
      excerpt: match.excerpt,
      retrievalScore: match.retrievalScore,
      rerankScore: match.rerankScore,
      documentPipelineVersion: match.documentPipelineVersion,
      chunkingVersion: match.chunkingVersion,
      embeddingModel: match.embeddingModel,
      citedInAnswer: citedSourceNumbers.has(sourceNumber),
    };
  });
}

function toApplicationFailureCode(error: unknown): RagQueryRunErrorCode {
  if (error instanceof RerankingFailure) {
    return error.code;
  }

  const failure = unwrapApplicationFailure(error);

  if (failure instanceof GenerationFailure) {
    return toSafeGenerationFailureCode(failure);
  }

  const statusCode = extractStatusCode(failure);
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return "generation_unavailable";
  }

  const message = extractMessage(failure).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("network")
  ) {
    return "generation_unavailable";
  }

  return toSafeGenerationFailureCode(failure);
}

function unwrapApplicationFailure(error: unknown): unknown {
  if (error instanceof RetrieveChunksFailure) {
    return error.cause;
  }

  return error;
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
