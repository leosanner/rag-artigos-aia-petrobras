import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import {
  getCandidateTopK,
  selectDiversifiedMatches,
  type RagRetrievalSettings,
  type RetrievedChunkMatch,
} from "@/domain/rag";

import type {
  EmbeddingUsage,
  GlobalChunkSearchRepository,
  QuestionEmbeddingProvider,
} from "./ports";

export type RetrieveChunksDeps = {
  questionEmbeddingProvider: QuestionEmbeddingProvider;
  chunksRepository: GlobalChunkSearchRepository;
  embeddingModel: string;
};

export type RetrieveChunksInput = {
  question: string;
  retrieval: RagRetrievalSettings;
};

export type RetrieveChunksResult = {
  matches: RetrievedChunkMatch[];
  embedding: EmbeddingUsage;
};

export class RetrieveChunks {
  readonly embeddingModel: string;
  readonly chunkingVersion: string;

  private readonly questionEmbeddingProvider: QuestionEmbeddingProvider;
  private readonly chunksRepository: GlobalChunkSearchRepository;

  constructor(deps: RetrieveChunksDeps) {
    this.questionEmbeddingProvider = deps.questionEmbeddingProvider;
    this.chunksRepository = deps.chunksRepository;
    this.embeddingModel = deps.embeddingModel;
    this.chunkingVersion = DEFAULT_CHUNKING_CONFIG.chunkingVersion;
  }

  async search(input: RetrieveChunksInput): Promise<RetrieveChunksResult> {
    const { embedding: queryEmbedding, usage } =
      await this.questionEmbeddingProvider.embedQuestion(input.question);
    const candidateTopK = getCandidateTopK(input.retrieval);

    const matches = await this.chunksRepository.searchGlobal({
      queryEmbedding,
      topK: candidateTopK,
      chunkingVersion: this.chunkingVersion,
      embeddingModel: this.embeddingModel,
    });

    if (input.retrieval.strategy === "standard") {
      return {
        matches,
        embedding: usage,
      };
    }

    return {
      matches: selectDiversifiedMatches({
        matches,
        topK: input.retrieval.topK,
      }),
      embedding: usage,
    };
  }
}
