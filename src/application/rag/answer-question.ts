import {
  GenerationFailure,
  assertValidCitationMarkers,
  assembleRagContext,
  buildNoEvidenceAnswer,
  getCandidateTopK,
  normalizeRetrievalSettings,
  type RagRetrievalSettings,
  toSafeGenerationFailureCode,
} from "@/domain/rag";

import { GLOBAL_RAG_PROMPT_VERSION } from "./constants";
import type { GenerationProvider } from "./ports";
import type {
  AnswerQuestionResult,
  GlobalRagAskInput,
  RagAnswerMetadata,
} from "./schemas";
import { answerQuestionResultSchema } from "./schemas";
import type { RetrieveChunks } from "./retrieve-chunks";

export type AnswerQuestionDeps = {
  retrieveChunks: Pick<RetrieveChunks, "search" | "embeddingModel">;
  generationProvider: GenerationProvider;
  generationModel: string;
  promptVersion?: string;
};

const NO_EVIDENCE_ANSWER = buildNoEvidenceAnswer();

export class AnswerQuestion {
  private readonly retrieveChunks: Pick<
    RetrieveChunks,
    "search" | "embeddingModel"
  >;
  private readonly generationProvider: GenerationProvider;
  private readonly generationModel: string;
  private readonly promptVersion: string;

  constructor(deps: AnswerQuestionDeps) {
    this.retrieveChunks = deps.retrieveChunks;
    this.generationProvider = deps.generationProvider;
    this.generationModel = deps.generationModel;
    this.promptVersion = deps.promptVersion ?? GLOBAL_RAG_PROMPT_VERSION;
  }

  async execute(input: GlobalRagAskInput): Promise<AnswerQuestionResult> {
    if (input.mode !== "global") {
      throw new Error("Unsupported RAG mode");
    }

    const retrieval = normalizeRetrievalSettings(input.retrieval);
    const matches = await this.retrieveChunks.search({
      question: input.question,
      retrieval,
    });
    const metadata = this.buildMetadata(retrieval);

    if (matches.length === 0) {
      return answerQuestionResultSchema.parse({
        kind: "answered",
        answer: NO_EVIDENCE_ANSWER,
        mode: "global",
        sources: [],
        metadata,
      });
    }

    const { sources, promptContext } = assembleRagContext(matches);

    try {
      const result = await this.generationProvider.generateAnswer({
        question: input.question,
        promptContext,
        promptVersion: this.promptVersion,
        generationModel: this.generationModel,
        retrievalStrategy: retrieval.strategy,
      });

      if (result.answer.trim() === NO_EVIDENCE_ANSWER) {
        return answerQuestionResultSchema.parse({
          kind: "answered",
          answer: NO_EVIDENCE_ANSWER,
          mode: "global",
          sources,
          metadata,
        });
      }

      assertValidCitationMarkers(result.answer, sources);

      return answerQuestionResultSchema.parse({
        kind: "answered",
        answer: result.answer,
        mode: "global",
        sources,
        metadata,
      });
    } catch (error) {
      return answerQuestionResultSchema.parse({
        kind: "error",
        error: toApplicationGenerationFailureCode(error),
      });
    }
  }

  private buildMetadata(retrieval: RagRetrievalSettings): RagAnswerMetadata {
    return {
      mode: "global",
      topK: retrieval.topK,
      retrievalStrategy: retrieval.strategy,
      candidateTopK: getCandidateTopK(retrieval),
      promptVersion: this.promptVersion,
      generationModel: this.generationModel,
      embeddingModel: this.retrieveChunks.embeddingModel,
    };
  }
}

function toApplicationGenerationFailureCode(
  error: unknown,
): "generation_failed" | "generation_unavailable" {
  if (error instanceof GenerationFailure) {
    return toSafeGenerationFailureCode(error);
  }

  const statusCode = extractStatusCode(error);
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return "generation_unavailable";
  }

  const message = extractMessage(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("network")
  ) {
    return "generation_unavailable";
  }

  return toSafeGenerationFailureCode(error);
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
