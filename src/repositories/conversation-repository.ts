import { and, asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { ragConversationMessages, ragConversations } from "@/db/schema";
import type { ConversationMessageRole } from "@/domain/rag";

import type {
  RagQueryRunsRepository,
  RagRunDetail,
} from "./rag-query-runs-repository";

type DatabaseClient = NodePgDatabase<typeof schema>;

export type ConversationDetailMessage = {
  id: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: Date;
  trace: RagRunDetail | null;
};

export type ConversationDetail = {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  messages: ConversationDetailMessage[];
};

export class ConversationRepository {
  constructor(
    private readonly db: DatabaseClient,
    private readonly runs: Pick<RagQueryRunsRepository, "getById">,
  ) {}

  async create(): Promise<{ id: string; createdAt: Date; updatedAt: Date }> {
    const [row] = await this.db
      .insert(ragConversations)
      .values({})
      .returning({
        id: ragConversations.id,
        createdAt: ragConversations.createdAt,
        updatedAt: ragConversations.updatedAt,
      });

    return row;
  }

  async updateTitleIfUnset(id: string, title: string): Promise<void> {
    await this.db
      .update(ragConversations)
      .set({ title, updatedAt: new Date() })
      .where(
        and(eq(ragConversations.id, id), isNull(ragConversations.title)),
      );
  }

  async touchLastMessageAt(id: string, date: Date): Promise<void> {
    await this.db
      .update(ragConversations)
      .set({ lastMessageAt: date, updatedAt: date })
      .where(eq(ragConversations.id, id));
  }

  async getDetail(id: string): Promise<ConversationDetail | null> {
    const [conversation] = await this.db
      .select()
      .from(ragConversations)
      .where(eq(ragConversations.id, id))
      .limit(1);

    if (!conversation) {
      return null;
    }

    const messageRows = await this.db
      .select()
      .from(ragConversationMessages)
      .where(eq(ragConversationMessages.conversationId, id))
      .orderBy(
        asc(ragConversationMessages.createdAt),
        asc(ragConversationMessages.id),
      );

    const traces = await Promise.all(
      messageRows.map((row) =>
        row.role === "assistant" && row.traceId !== null
          ? this.runs.getById(row.traceId)
          : Promise.resolve(null),
      ),
    );

    const messages: ConversationDetailMessage[] = messageRows.map(
      (row, index) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
        trace: traces[index],
      }),
    );

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messages,
    };
  }
}
