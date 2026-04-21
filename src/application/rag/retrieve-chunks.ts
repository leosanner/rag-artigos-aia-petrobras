import { DEFAULT_CHUNKING_CONFIG } from "@/domain/chunking/hybrid-text-chunker";
import type { RetrievedChunkMatch } from "@/domain/rag";

import { GLOBAL_RAG_TOP_K } from "./constants";
import type {
  GlobalChunkSearchRepository,
  QuestionEmbeddingProvider,
} from "./ports";

export type RetrieveChunksDeps = {
  questionEmbeddingProvider: QuestionEmbeddingProvider;
  chunksRepository: GlobalChunkSearchRepository;
  embeddingModel: string;
};

export class RetrieveChunks {
  readonly topK: number;
  readonly embeddingModel: string;
  readonly chunkingVersion: string;

  private readonly questionEmbeddingProvider: QuestionEmbeddingProvider;
  private readonly chunksRepository: GlobalChunkSearchRepository;

  constructor(deps: RetrieveChunksDeps) {
    this.questionEmbeddingProvider = deps.questionEmbeddingProvider;
    this.chunksRepository = deps.chunksRepository;
    this.embeddingModel = deps.embeddingModel;
    this.topK = GLOBAL_RAG_TOP_K;
    this.chunkingVersion = DEFAULT_CHUNKING_CONFIG.chunkingVersion;
  }

  async search(question: string): Promise<RetrievedChunkMatch[]> {
    const queryEmbedding = await this.questionEmbeddingProvider.embedQuestion(
      question,
    );

    return this.chunksRepository.searchGlobal({
      queryEmbedding,
      topK: this.topK,
      chunkingVersion: this.chunkingVersion,
      embeddingModel: this.embeddingModel,
    });
  }
}
