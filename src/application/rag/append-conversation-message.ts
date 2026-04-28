import {
  buildConversationRetrievalContext,
  deriveConversationTitle,
  type RagQueryRunErrorCode,
} from "@/domain/rag";
import type { ConversationRepository } from "@/repositories/conversation-repository";
import type { ConversationMessageRepository } from "@/repositories/conversation-message-repository";

import type { AnswerQuestion } from "./answer-question";
import type { GlobalRagAskInput } from "./schemas";
import type { ConversationMessageResponse } from "./conversation-types";
import { toConversationMessageResponse } from "./conversation-types";

export type AppendConversationMessageInput = {
  conversationId: string;
  userMessageContent: string;
  retrievalSettings?: GlobalRagAskInput["retrieval"];
  requestTraceId?: string;
};

export type AppendConversationMessageOutput =
  | {
      status: "not_found";
    }
  | {
      status: "answered" | "answered_no_evidence";
      userMessage: ConversationMessageResponse;
      assistantMessage: ConversationMessageResponse;
    }
  | {
      status: RagQueryRunErrorCode;
      userMessage: ConversationMessageResponse;
      errorCode: RagQueryRunErrorCode;
    };

type AppendConversationDeps = {
  conversations: Pick<
    ConversationRepository,
    "getDetail" | "touchLastMessageAt" | "updateTitleIfUnset"
  >;
  messages: Pick<ConversationMessageRepository, "append" | "listPreviousVisible">;
  answerQuestion: Pick<AnswerQuestion, "execute">;
};

export class AppendConversationMessage {
  private readonly conversations: Pick<
    ConversationRepository,
    "getDetail" | "touchLastMessageAt" | "updateTitleIfUnset"
  >;
  private readonly messages: Pick<
    ConversationMessageRepository,
    "append" | "listPreviousVisible"
  >;
  private readonly answerQuestion: Pick<AnswerQuestion, "execute">;

  constructor(deps: AppendConversationDeps) {
    this.conversations = deps.conversations;
    this.messages = deps.messages;
    this.answerQuestion = deps.answerQuestion;
  }

  async execute(
    input: AppendConversationMessageInput,
  ): Promise<AppendConversationMessageOutput> {
    const conversation = await this.conversations.getDetail(input.conversationId);

    if (!conversation) {
      return {
        status: "not_found",
      };
    }

    const previousStoredMessages = await this.messages.listPreviousVisible(
      input.conversationId,
      4,
    );

    const createdUserMessage = await this.messages.append({
      conversationId: input.conversationId,
      role: "user",
      content: input.userMessageContent,
      traceId: null,
    });

    await this.conversations.touchLastMessageAt(
      input.conversationId,
      createdUserMessage.createdAt,
    );

    if (conversation.messages.length === 0) {
      const title = deriveConversationTitle(input.userMessageContent);

      if (title !== null) {
        await this.conversations.updateTitleIfUnset(input.conversationId, title);
      }
    }

    const userMessage: ConversationMessageResponse = {
      id: createdUserMessage.id,
      role: "user",
      content: input.userMessageContent,
      createdAt: createdUserMessage.createdAt,
      trace: null,
    };

    const turnResult = await this.answerQuestion.execute({
      question: input.userMessageContent,
      mode: "global",
      retrieval: input.retrievalSettings,
      conversationContext: {
        transcript: buildConversationRetrievalContext({
          latestUserMessage: input.userMessageContent,
          previousStoredMessages,
        }),
      },
      requestTraceId: input.requestTraceId,
    });

    if (turnResult.kind === "error") {
      return {
        status: turnResult.error,
        userMessage,
        errorCode: turnResult.error,
      };
    }

    if (turnResult.kind === "focused_document_rejected") {
      throw new Error("unexpected_focused_rejection_in_global_conversation");
    }

    const createdAssistantMessage = await this.messages.append({
      conversationId: input.conversationId,
      role: "assistant",
      content: turnResult.answer,
      traceId: turnResult.traceId,
    });

    await this.conversations.touchLastMessageAt(
      input.conversationId,
      createdAssistantMessage.createdAt,
    );

    const updatedConversation = await this.conversations.getDetail(
      input.conversationId,
    );

    if (!updatedConversation) {
      throw new Error("conversation_detail_unavailable_after_assistant_append");
    }

    const hydratedAssistantMessage = updatedConversation.messages.find(
      (message) => message.id === createdAssistantMessage.id,
    );

    if (!hydratedAssistantMessage || hydratedAssistantMessage.role !== "assistant") {
      throw new Error("assistant_message_unavailable_after_append");
    }

    return {
      status: turnResult.status,
      userMessage,
      assistantMessage: toConversationMessageResponse(hydratedAssistantMessage),
    };
  }
}
