import type { RetrievedChunkMatch } from "@/domain/rag";

export type SearchGlobalChunksInput = {
  queryEmbedding: number[];
  topK: number;
  chunkingVersion: string;
  embeddingModel: string;
};

export interface GlobalChunkSearchRepository {
  searchGlobal(input: SearchGlobalChunksInput): Promise<RetrievedChunkMatch[]>;
}

export interface QuestionEmbeddingProvider {
  embedQuestion(question: string): Promise<number[]>;
}

export type GenerateAnswerInput = {
  question: string;
  promptContext: string;
  promptVersion: string;
  generationModel: string;
};

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{ answer: string }>;
}
