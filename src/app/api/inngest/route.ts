import { serve } from "inngest/next";

import { ProcessIngestionRun } from "@/application/ingestion/process-ingestion-run";
import { ProcessIndexingRun } from "@/application/indexing/process-indexing-run";
import { db } from "@/db/client";
import { HybridTextChunker } from "@/domain/chunking/hybrid-text-chunker";
import { refineText } from "@/domain/text/deterministic-refiner";
import { createGoogleDriveFileSourceFromEnv } from "@/infrastructure/drive/google-drive-file-source";
import { Sha256FileHasher } from "@/infrastructure/crypto/sha256-file-hasher";
import { createOpenAiEmbeddingProviderFromEnv } from "@/infrastructure/ai/openai-embedding-provider";
import {
  createProcessIngestionRunFunction,
  inngest,
} from "@/infrastructure/ingestion/inngest";
import { createProcessIndexingRunFunction } from "@/infrastructure/indexing/inngest";
import { UnpdfPdfExtractor } from "@/infrastructure/pdf/unpdf-pdf-extractor";
import { env } from "@/env/server";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { IngestionRunsRepository } from "@/repositories/ingestion-runs-repository";
import { RagIndexingRunsRepository } from "@/repositories/rag-indexing-runs-repository";

const processIngestionRunHandler = new ProcessIngestionRun({
  driveSource: createGoogleDriveFileSourceFromEnv(),
  pdfExtractor: new UnpdfPdfExtractor(),
  refiner: refineText,
  hasher: new Sha256FileHasher(),
  documentsRepository: new DocumentsRepository(db),
  runsRepository: new IngestionRunsRepository(db),
});

const processIngestionRun = createProcessIngestionRunFunction(
  processIngestionRunHandler,
);

const processIndexingRunHandler = new ProcessIndexingRun({
  documentsRepository: new DocumentsRepository(db),
  runsRepository: new RagIndexingRunsRepository(db),
  chunksRepository: new DocumentChunksRepository(db),
  chunker: new HybridTextChunker(),
  embeddingProvider: createOpenAiEmbeddingProviderFromEnv(env),
  embeddingModel: env.RAG_EMBEDDING_MODEL,
});

const processIndexingRun = createProcessIndexingRunFunction(
  processIndexingRunHandler,
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processIngestionRun as Parameters<typeof serve>[0]["functions"][number],
    processIndexingRun as Parameters<typeof serve>[0]["functions"][number],
  ],
});
