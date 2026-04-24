import type { ConversationRepository } from "@/repositories/conversation-repository";

export type CreateConversationOutput = {
  id: string;
  title: null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: null;
};

export type CreateConversationDeps = {
  conversations: Pick<ConversationRepository, "create">;
};

export class CreateConversation {
  private readonly conversations: Pick<ConversationRepository, "create">;

  constructor(deps: CreateConversationDeps) {
    this.conversations = deps.conversations;
  }

  async execute(): Promise<CreateConversationOutput> {
    const created = await this.conversations.create();

    return {
      id: created.id,
      title: null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      lastMessageAt: null,
    };
  }
}
