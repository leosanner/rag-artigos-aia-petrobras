import {
  buildConversationRetrievalContext,
  deriveConversationTitle,
  type FocusedDocumentRejectionReason,
} from "@/domain/rag";
import type { ConversationMessageRepository } from "@/repositories/conversation-message-repository";
import type { ConversationRepository } from "@/repositories/conversation-repository";

import type { AnswerQuestion, AnswerQuestionStreamCallbacks } from "./answer-question";
import type { ConversationMessageResponse } from "./conversation-types";
import { toConversationMessageResponse } from "./conversation-types";
import type { FocusedRagAskInput, GlobalRagAskInput } from "./schemas";
import type {
  StreamConversationMessageListener,
  StreamConversationErrorStatus,
} from "./stream-conversation-message-events";

type StreamConversationMessageInputBase = {
  conversationId: string;
  userMessageContent: string;
  retrievalSettings?: GlobalRagAskInput["retrieval"];
  requestTraceId?: string;
};

export type StreamConversationMessageInput =
  | (StreamConversationMessageInputBase & {
      mode?: "global";
    })
  | (StreamConversationMessageInputBase & {
      mode: "focused";
      documentId: FocusedRagAskInput["documentId"];
    });

export type StreamConversationMessageDeps = {
  conversations: Pick<
    ConversationRepository,
    "getDetail" | "touchLastMessageAt" | "updateTitleIfUnset"
  >;
  messages: Pick<ConversationMessageRepository, "append" | "listPreviousVisible">;
  answerQuestion: Pick<AnswerQuestion, "executeStream">;
};

export class StreamConversationMessage {
  private readonly conversations: Pick<
    ConversationRepository,
    "getDetail" | "touchLastMessageAt" | "updateTitleIfUnset"
  >;
  private readonly messages: Pick<
    ConversationMessageRepository,
    "append" | "listPreviousVisible"
  >;
  private readonly answerQuestion: Pick<AnswerQuestion, "executeStream">;

  constructor(deps: StreamConversationMessageDeps) {
    this.conversations = deps.conversations;
    this.messages = deps.messages;
    this.answerQuestion = deps.answerQuestion;
  }

  async execute(
    input: StreamConversationMessageInput,
    options: {
      onEvent: StreamConversationMessageListener;
    },
  ): Promise<"completed" | "not_found"> {
    const conversation = await this.conversations.getDetail(input.conversationId);

    if (!conversation) {
      return "not_found";
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

    await options.onEvent({
      type: "user_message_created",
      userMessage,
    });
    await options.onEvent({
      type: "phase",
      phase: "retrieving_sources",
    });

    const turnInput =
      input.mode === "focused"
        ? {
            question: input.userMessageContent,
            mode: "focused" as const,
            documentId: input.documentId,
            retrieval: input.retrievalSettings,
            conversationContext: {
              transcript: buildConversationRetrievalContext({
                latestUserMessage: input.userMessageContent,
                previousStoredMessages,
              }),
            },
            requestTraceId: input.requestTraceId,
          }
        : {
            question: input.userMessageContent,
            mode: "global" as const,
            retrieval: input.retrievalSettings,
            conversationContext: {
              transcript: buildConversationRetrievalContext({
                latestUserMessage: input.userMessageContent,
                previousStoredMessages,
              }),
            },
            requestTraceId: input.requestTraceId,
          };

    const callbacks: AnswerQuestionStreamCallbacks = {
      onSources: async (sources) => {
        for (const source of sources) {
          await options.onEvent({
            type: "source",
            source,
          });
        }
      },
      onGenerationStart: async () => {
        await options.onEvent({
          type: "phase",
          phase: "generating_answer",
        });
      },
      onAnswerDelta: async (textDelta) => {
        await options.onEvent({
          type: "answer_delta",
          textDelta,
        });
      },
    };

    const turnResult = await this.answerQuestion.executeStream(
      turnInput,
      callbacks,
    );

    if (turnResult.kind === "error") {
      if (
        turnResult.error !== "generation_failed" &&
        turnResult.error !== "generation_unavailable"
      ) {
        throw new Error("unsupported_conversation_stream_error_code");
      }

      await options.onEvent({
        type: "error",
        status: turnResult.error,
        errorCode: turnResult.error,
      });
      return "completed";
    }

    if (turnResult.kind === "focused_document_rejected") {
      const status = mapFocusedDocumentRejection(turnResult.reason);

      await options.onEvent({
        type: "error",
        status,
        errorCode: status,
      });
      return "completed";
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
      throw new Error("conversation_detail_unavailable_after_stream_append");
    }

    const hydratedAssistantMessage = updatedConversation.messages.find(
      (message) => message.id === createdAssistantMessage.id,
    );

    if (!hydratedAssistantMessage || hydratedAssistantMessage.role !== "assistant") {
      throw new Error("streamed_assistant_message_unavailable_after_append");
    }

    await options.onEvent({
      type: "done",
      status: turnResult.status,
      assistantMessage: toConversationMessageResponse(hydratedAssistantMessage),
    });

    return "completed";
  }
}

function mapFocusedDocumentRejection(
  reason: FocusedDocumentRejectionReason,
): StreamConversationErrorStatus {
  if (reason === "not_found") {
    return "document_not_found";
  }

  return "document_not_focusable";
}
