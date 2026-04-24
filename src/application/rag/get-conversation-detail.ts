import type { ConversationRepository } from "@/repositories/conversation-repository";

import {
  type ConversationDetailResponse,
  toConversationDetailResponse,
} from "./conversation-types";

export type GetConversationDetailInput = {
  id: string;
};

export type GetConversationDetailOutput =
  | {
      status: "found";
      conversation: ConversationDetailResponse;
    }
  | {
      status: "not_found";
    };

export type GetConversationDetailDeps = {
  conversations: Pick<ConversationRepository, "getDetail">;
};

export class GetConversationDetail {
  private readonly conversations: Pick<ConversationRepository, "getDetail">;

  constructor(deps: GetConversationDetailDeps) {
    this.conversations = deps.conversations;
  }

  async execute(
    input: GetConversationDetailInput,
  ): Promise<GetConversationDetailOutput> {
    const detail = await this.conversations.getDetail(input.id);

    if (!detail) {
      return {
        status: "not_found",
      };
    }

    return {
      status: "found",
      conversation: toConversationDetailResponse(detail),
    };
  }
}
