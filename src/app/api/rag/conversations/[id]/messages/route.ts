import { AppendConversationMessage } from "@/application/rag/append-conversation-message";
import { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import { StreamConversationMessage } from "@/application/rag/stream-conversation-message";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import { ConversationRepository } from "@/repositories/conversation-repository";

import { createRagConversationMessagesHandler } from "./handler";
import { answerQuestion, runsRepository } from "../../../runtime";

export const dynamic = "force-dynamic";

const conversationsRepository = new ConversationRepository(db, runsRepository);
const messagesRepository = new ConversationMessageRepository(db);

const appendMessage = new AppendConversationMessage({
  conversations: conversationsRepository,
  messages: messagesRepository,
  answerQuestion,
});
const getConversationDetail = new GetConversationDetail({
  conversations: conversationsRepository,
});
const streamMessage = new StreamConversationMessage({
  conversations: conversationsRepository,
  messages: messagesRepository,
  answerQuestion,
});

export const POST = createRagConversationMessagesHandler({
  appendMessage,
  getConversationDetail,
  streamMessage,
  secret: env.RAG_QUERY_SECRET ?? "",
});
