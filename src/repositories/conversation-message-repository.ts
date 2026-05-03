import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { ragConversationMessages, ragQueryRuns } from "@/db/schema";
import type {
  ConversationMessageRole,
  PromptHistoryMessage,
  RagRetrievalStrategy,
} from "@/domain/rag";

type DatabaseClient = NodePgDatabase<typeof schema>;

export type PersistConversationMessageInput = {
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  traceId: string | null;
};

export const CONVERSATION_PREVIOUS_VISIBLE_DEFAULT_LIMIT = 4;

export class ConversationMessageRepository {
  constructor(private readonly db: DatabaseClient) {}

  async append(
    input: PersistConversationMessageInput,
  ): Promise<{ id: string; createdAt: Date }> {
    const [row] = await this.db
      .insert(ragConversationMessages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        traceId: input.traceId,
      })
      .returning({
        id: ragConversationMessages.id,
        createdAt: ragConversationMessages.createdAt,
      });

    return row;
  }

  async listPreviousVisible(
    conversationId: string,
    limit: number = CONVERSATION_PREVIOUS_VISIBLE_DEFAULT_LIMIT,
  ): Promise<PromptHistoryMessage[]> {
    const rows = await this.db
      .select({
        role: ragConversationMessages.role,
        content: ragConversationMessages.content,
        retrievalStrategy: ragQueryRuns.retrievalStrategy,
      })
      .from(ragConversationMessages)
      .leftJoin(
        ragQueryRuns,
        eq(ragConversationMessages.traceId, ragQueryRuns.id),
      )
      .where(eq(ragConversationMessages.conversationId, conversationId))
      .orderBy(
        desc(ragConversationMessages.createdAt),
        desc(ragConversationMessages.id),
      )
      .limit(limit);

    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
      trace:
        row.retrievalStrategy === null
          ? null
          : { strategy: row.retrievalStrategy as RagRetrievalStrategy },
    }));
  }
}

