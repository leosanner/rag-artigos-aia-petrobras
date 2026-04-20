import type { Document } from "@/db/schema";
import type { TextChunker } from "@/domain/chunking/hybrid-text-chunker";

export interface IndexingDocumentsRepository {
  listProcessedForIndexing(): Promise<Document[]>;
  findByIdForIndexing(documentId: string): Promise<Document | null>;
}

export interface EmbeddingProvider {
  embedMany(texts: string[]): Promise<number[][]>;
}

export interface IndexingEventPublisher {
  publishIndexingRequested(runId: string): Promise<void>;
}

export type ProcessIndexingRunHandler = {
  execute(runId: string): Promise<void>;
};

export type { TextChunker };
