import { CreateConversation } from "@/application/rag/create-conversation";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagConversationsHandler } from "./handler";

export const dynamic = "force-dynamic";

const runsRepository = new RagQueryRunsRepository(db);
const conversationsRepository = new ConversationRepository(db, runsRepository);
const createConversation = new CreateConversation({
  conversations: conversationsRepository,
});

export const POST = createRagConversationsHandler({
  createConversation,
  secret: env.RAG_QUERY_SECRET ?? "",
});
