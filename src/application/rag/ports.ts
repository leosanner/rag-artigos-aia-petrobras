import type { RagRetrievalStrategy, RetrievedChunkMatch } from "@/domain/rag";

export type SearchGlobalChunksInput = {
  queryEmbedding: number[];
  topK: number;
  chunkingVersion: string;
  embeddingModel: string;
};

export interface GlobalChunkSearchRepository {
  searchGlobal(input: SearchGlobalChunksInput): Promise<RetrievedChunkMatch[]>;
}

export type EmbeddingUsage = {
  inputTokens: number;
  estimatedCostUsd: number;
};

export interface QuestionEmbeddingProvider {
  embedQuestion(question: string): Promise<{
    embedding: number[];
    usage: EmbeddingUsage;
  }>;
}

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type GenerateAnswerInput = {
  question: string;
  promptContext: string;
  promptVersion: string;
  generationModel: string;
  retrievalStrategy: RagRetrievalStrategy;
};

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
}
