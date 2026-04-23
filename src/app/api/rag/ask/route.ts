import { AnswerQuestion } from "@/application/rag/answer-question";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { createOpenAiEmbeddingProviderFromEnv } from "@/infrastructure/ai/openai-embedding-provider";
import { createOpenAiGenerationProviderFromEnv } from "@/infrastructure/ai/openai-generation-provider";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagAskHandler } from "./handler";

export const dynamic = "force-dynamic";

const chunksRepository = new DocumentChunksRepository(db);
const runsRepository = new RagQueryRunsRepository(db);
const questionEmbeddingProvider = createOpenAiEmbeddingProviderFromEnv(env);
const generationProvider = createOpenAiGenerationProviderFromEnv(env);

const retrieveChunks = new RetrieveChunks({
  questionEmbeddingProvider,
  chunksRepository,
  embeddingModel: env.RAG_EMBEDDING_MODEL,
});

const answerQuestion = new AnswerQuestion({
  retrieveChunks,
  generationProvider,
  runsRepository,
  generationModel: env.RAG_GENERATION_MODEL,
});

export const POST = createRagAskHandler({
  answerQuestion,
  secret: env.RAG_QUERY_SECRET ?? "",
});
