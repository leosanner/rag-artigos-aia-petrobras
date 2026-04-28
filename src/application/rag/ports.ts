import type { RagRetrievalStrategy, RetrievedChunkMatch } from "@/domain/rag";
import type {
  FocusedDocumentClassification,
  SelectableDocumentRow,
} from "@/repositories/documents-repository";

export type SearchGlobalChunksInput = {
  queryEmbedding: number[];
  topK: number;
  chunkingVersion: string;
  embeddingModel: string;
  documentId?: string;
};

export interface GlobalChunkSearchRepository {
  searchGlobal(input: SearchGlobalChunksInput): Promise<RetrievedChunkMatch[]>;
}

export interface FocusedDocumentClassifier {
  classifyForFocusedRag(
    documentId: string,
  ): Promise<FocusedDocumentClassification>;
}

export interface SelectableDocumentsReader {
  listSelectableForFocusedRag(): Promise<SelectableDocumentRow[]>;
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
  conversationContext?: {
    transcript: string;
  };
  promptContext: string;
  promptVersion: string;
  generationModel: string;
  retrievalStrategy: RagRetrievalStrategy;
};

export type StreamAnswerInput = GenerateAnswerInput & {
  onTextDelta?: (textDelta: string) => Promise<void> | void;
};

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
  streamAnswer(input: StreamAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
}
