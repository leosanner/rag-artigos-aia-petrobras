import { GetConversationDetail } from "@/application/rag/get-conversation-detail";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { ConversationRepository } from "@/repositories/conversation-repository";
import { RagQueryRunsRepository } from "@/repositories/rag-query-runs-repository";

import { createRagConversationDetailHandler } from "./handler";

export const dynamic = "force-dynamic";

const runsRepository = new RagQueryRunsRepository(db);
const conversationsRepository = new ConversationRepository(db, runsRepository);
const getConversation = new GetConversationDetail({
  conversations: conversationsRepository,
});

export const GET = createRagConversationDetailHandler({
  getConversation,
  secret: env.RAG_QUERY_SECRET ?? "",
});
