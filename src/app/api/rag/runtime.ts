import { AnswerQuestion } from "@/application/rag/answer-question";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { createOpenAiEmbeddingProviderFromEnv } from "@/infrastructure/ai/openai-embedding-provider";
import { createOpenAiGenerationProviderFromEnv } from "@/infrastructure/ai/openai-generation-provider";
import { createRerankingProviderFromEnv } from "@/infrastructure/ai/cohere-reranking-provider";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

export const chunksRepository = new DocumentChunksRepository(db);
export const documentsRepository = new DocumentsRepository(db);
export const runsRepository = new RagQueryRunsRepository(db);
export const questionEmbeddingProvider = createOpenAiEmbeddingProviderFromEnv(env);
export const generationProvider = createOpenAiGenerationProviderFromEnv(env);
export const rerankingProvider = createRerankingProviderFromEnv(env);

export const retrieveChunks = new RetrieveChunks({
  questionEmbeddingProvider,
  chunksRepository,
  rerankingProvider,
  embeddingModel: env.RAG_EMBEDDING_MODEL,
});

export const answerQuestion = new AnswerQuestion({
  retrieveChunks,
  generationProvider,
  runsRepository,
  focusedDocumentClassifier: documentsRepository,
  generationModel: env.RAG_GENERATION_MODEL,
});
