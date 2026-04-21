import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";

import * as schema from "@/db/schema";
import { documentChunks, documents, type DocumentChunk } from "@/db/schema";
import type { RetrievedChunkMatch } from "@/domain/rag";

type DatabaseClient = NodePgDatabase<typeof schema>;

export type ChunkConfiguration = {
  chunkingVersion: string;
  embeddingModel: string;
};

export type ReplaceDocumentChunk = {
  chunkIndex: number;
  content: string;
  contentHash: string;
  estimatedTokens: number;
  embedding: number[];
};

export type ReplaceDocumentChunksInput = ChunkConfiguration & {
  documentId: string;
  documentPipelineVersion: string;
  embeddingDimensions: number;
  chunks: ReplaceDocumentChunk[];
};

export type SearchGlobalChunksInput = ChunkConfiguration & {
  queryEmbedding: number[];
  topK: number;
};

export class DocumentChunksRepository {
  constructor(private readonly db: DatabaseClient) {}

  async hasChunksForConfig(
    documentId: string,
    config: ChunkConfiguration,
  ): Promise<boolean> {
    const [chunk] = await this.db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(configWhere(documentId, config))
      .limit(1);

    return chunk !== undefined;
  }

  async listByDocument(documentId: string): Promise<DocumentChunk[]> {
    return this.db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.chunkIndex));
  }

  async searchGlobal(
    input: SearchGlobalChunksInput,
  ): Promise<RetrievedChunkMatch[]> {
    const distance = cosineDistance(
      documentChunks.embedding,
      input.queryEmbedding,
    );

    return this.db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        documentTitle: documents.title,
        chunkIndex: documentChunks.chunkIndex,
        excerpt: documentChunks.content,
        score: sql<number>`1 - (${distance})`,
        documentPipelineVersion: documents.pipelineVersion,
        chunkingVersion: documentChunks.chunkingVersion,
        embeddingModel: documentChunks.embeddingModel,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          eq(documents.status, "processed"),
          eq(documentChunks.chunkingVersion, input.chunkingVersion),
          eq(documentChunks.embeddingModel, input.embeddingModel),
        ),
      )
      .orderBy(
        distance,
        asc(documentChunks.documentId),
        asc(documentChunks.chunkIndex),
      )
      .limit(input.topK);
  }

  async deleteDocumentChunksForConfig(
    documentId: string,
    config: ChunkConfiguration,
  ): Promise<void> {
    await this.db.delete(documentChunks).where(configWhere(documentId, config));
  }

  async replaceDocumentChunks(input: ReplaceDocumentChunksInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(documentChunks)
        .where(
          configWhere(input.documentId, {
            chunkingVersion: input.chunkingVersion,
            embeddingModel: input.embeddingModel,
          }),
        );

      if (input.chunks.length === 0) {
        return;
      }

      await tx.insert(documentChunks).values(
        input.chunks.map((chunk) => ({
          documentId: input.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: chunk.contentHash,
          estimatedTokens: chunk.estimatedTokens,
          documentPipelineVersion: input.documentPipelineVersion,
          chunkingVersion: input.chunkingVersion,
          embeddingModel: input.embeddingModel,
          embeddingDimensions: input.embeddingDimensions,
          embedding: chunk.embedding,
        })),
      );
    });
  }
}

function configWhere(documentId: string, config: ChunkConfiguration) {
  return and(
    eq(documentChunks.documentId, documentId),
    eq(documentChunks.chunkingVersion, config.chunkingVersion),
    eq(documentChunks.embeddingModel, config.embeddingModel),
  );
}
