import { createHash } from "node:crypto";

import type { Document } from "@/db/schema";
import {
  DEFAULT_CHUNKING_CONFIG,
  type ChunkedText,
  type TextChunker,
} from "@/domain/chunking/hybrid-text-chunker";
import { IndexingError } from "@/domain/indexing/errors";
import type { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import type { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

import type {
  EmbeddingProvider,
  IndexingDocumentsRepository,
  ProcessIndexingRunHandler,
} from "./ports";

type ProcessIndexingRunsRepository = Pick<
  RagIndexingRunsRepository,
  | "markProcessing"
  | "createRunItem"
  | "markRunItemProcessed"
  | "markRunItemFailed"
  | "completeRun"
  | "failRun"
>;

type ProcessDocumentChunksRepository = Pick<
  DocumentChunksRepository,
  "hasChunksForConfig" | "replaceDocumentChunks"
>;

export type ProcessIndexingRunDeps = {
  runsRepository: ProcessIndexingRunsRepository;
  documentsRepository: IndexingDocumentsRepository;
  chunksRepository: ProcessDocumentChunksRepository;
  chunker: TextChunker;
  embeddingProvider: EmbeddingProvider;
  chunkingVersion?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";
const DEFAULT_EMBEDDING_DIMENSIONS = 3072;

export class ProcessIndexingRun implements ProcessIndexingRunHandler {
  private readonly runsRepository: ProcessIndexingRunsRepository;
  private readonly documentsRepository: IndexingDocumentsRepository;
  private readonly chunksRepository: ProcessDocumentChunksRepository;
  private readonly chunker: TextChunker;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly chunkingVersion: string;
  private readonly embeddingModel: string;
  private readonly embeddingDimensions: number;

  constructor(deps: ProcessIndexingRunDeps) {
    this.runsRepository = deps.runsRepository;
    this.documentsRepository = deps.documentsRepository;
    this.chunksRepository = deps.chunksRepository;
    this.chunker = deps.chunker;
    this.embeddingProvider = deps.embeddingProvider;
    this.chunkingVersion =
      deps.chunkingVersion ?? DEFAULT_CHUNKING_CONFIG.chunkingVersion;
    this.embeddingModel = deps.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
    this.embeddingDimensions =
      deps.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  }

  async execute(runId: string): Promise<void> {
    const run = await this.runsRepository.markProcessing(runId);
    const documents = await this.selectDocuments(run.documentId);

    if (documents === null) {
      await this.runsRepository.failRun(runId, "document_not_indexable");
      return;
    }

    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const document of documents) {
      if (document.status !== "processed") {
        const item = await this.runsRepository.createRunItem({
          runId,
          documentId: document.id,
          title: document.title,
        });
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: "document_not_indexable",
        });
        failedCount += 1;
        continue;
      }

      if (!run.force) {
        const alreadyIndexed = await this.chunksRepository.hasChunksForConfig(
          document.id,
          {
            chunkingVersion: this.chunkingVersion,
            embeddingModel: this.embeddingModel,
          },
        );
        if (alreadyIndexed) {
          skippedCount += 1;
          continue;
        }
      }

      const item = await this.runsRepository.createRunItem({
        runId,
        documentId: document.id,
        title: document.title,
      });

      if (!document.refinedText || document.refinedText.trim().length === 0) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: "refined_text_empty",
        });
        failedCount += 1;
        continue;
      }

      let chunks: ChunkedText[];
      try {
        chunks = this.chunker.chunk({ refinedText: document.refinedText });
      } catch {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: "chunking_failed",
        });
        failedCount += 1;
        continue;
      }

      let embeddings: number[][];
      try {
        embeddings = await this.embeddingProvider.embedMany(
          chunks.map((chunk) => chunk.content),
        );
        this.assertEmbeddingShape(chunks, embeddings);
      } catch (error) {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode:
            error instanceof IndexingError
              ? error.code
              : "embedding_failed",
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.persistDocumentChunks(document, chunks, embeddings);
      } catch {
        await this.runsRepository.markRunItemFailed(item.id, {
          errorCode: "persistence_failed",
        });
        failedCount += 1;
        continue;
      }

      await this.runsRepository.markRunItemProcessed(item.id, {
        chunkCount: chunks.length,
      });
      processedCount += 1;
    }

    await this.runsRepository.completeRun(runId, {
      selectedCount: documents.length,
      processedCount,
      failedCount,
      skippedCount,
    });
  }

  private async selectDocuments(
    documentId: string | null,
  ): Promise<Document[] | null> {
    if (documentId === null) {
      return this.documentsRepository.listProcessedForIndexing();
    }

    const document = await this.documentsRepository.findByIdForIndexing(documentId);
    return document ? [document] : null;
  }

  private assertEmbeddingShape(
    chunks: ChunkedText[],
    embeddings: number[][],
  ): void {
    if (embeddings.length !== chunks.length) {
      throw new IndexingError(
        "embedding_dimensions_mismatch",
        "Embedding count must match chunk count",
      );
    }

    for (const embedding of embeddings) {
      if (embedding.length !== this.embeddingDimensions) {
        throw new IndexingError(
          "embedding_dimensions_mismatch",
          "Embedding dimensions must match the active configuration",
        );
      }
    }
  }

  private async persistDocumentChunks(
    document: Document,
    chunks: ChunkedText[],
    embeddings: number[][],
  ): Promise<void> {
    await this.chunksRepository.replaceDocumentChunks({
      documentId: document.id,
      documentPipelineVersion: document.pipelineVersion,
      chunkingVersion: this.chunkingVersion,
      embeddingModel: this.embeddingModel,
      embeddingDimensions: this.embeddingDimensions,
      chunks: chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash: hashContent(chunk.content),
        estimatedTokens: chunk.estimatedTokens,
        embedding: embeddings[index] as number[],
      })),
    });
  }
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
