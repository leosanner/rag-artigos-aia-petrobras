import { AppendConversationMessage } from "@/application/rag/append-conversation-message";
import { AnswerQuestion } from "@/application/rag/answer-question";
import { RetrieveChunks } from "@/application/rag/retrieve-chunks";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { createOpenAiEmbeddingProviderFromEnv } from "@/infrastructure/ai/openai-embedding-provider";
import { createOpenAiGenerationProviderFromEnv } from "@/infrastructure/ai/openai-generation-provider";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { DocumentChunksRepository } from "@/repositories/document-chunks-repository";
import { DocumentsRepository } from "@/repositories/documents-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagConversationMessagesHandler } from "./handler";

export const dynamic = "force-dynamic";

const chunksRepository = new DocumentChunksRepository(db);
const documentsRepository = new DocumentsRepository(db);
const runsRepository = new RagQueryRunsRepository(db);
const conversationsRepository = new ConversationRepository(db, runsRepository);
const messagesRepository = new ConversationMessageRepository(db);
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
  focusedDocumentClassifier: documentsRepository,
  generationModel: env.RAG_GENERATION_MODEL,
});

const appendMessage = new AppendConversationMessage({
  conversations: conversationsRepository,
  messages: messagesRepository,
  answerQuestion,
});

export const POST = createRagConversationMessagesHandler({
  appendMessage,
  secret: env.RAG_QUERY_SECRET ?? "",
});
