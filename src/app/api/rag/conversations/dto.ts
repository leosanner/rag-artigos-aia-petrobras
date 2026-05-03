import type { CreateConversationOutput } from "@/application/rag/create-conversation";
import type {
  ConversationDetailResponse as ApplicationConversationDetail,
  ConversationMessageResponse as ApplicationConversationMessage,
} from "@/application/rag/conversation-types";
import {
  appendConversationMessageResponseSchema,
  conversationDetailResponseSchema,
  conversationMessageResponseSchema,
  createConversationResponseSchema,
  ragConversationStreamEventSchema,
  ragQueryRunDetailResponseSchema,
  type AppendConversationMessageResponse,
  type ConversationDetailResponse,
  type ConversationMessageResponse,
  type CreateConversationResponse,
  type RagConversationStreamEvent,
} from "@/application/rag/schemas";
import type { AppendConversationMessageOutput } from "@/application/rag/append-conversation-message";
import type { StreamConversationMessageEvent } from "@/application/rag/stream-conversation-message-events";
import type { RagRunDetail } from "@/repositories/rag-query-runs-repository";

export function toCreateConversationHttpResponse(
  conversation: CreateConversationOutput,
): CreateConversationResponse {
  return createConversationResponseSchema.parse({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: null,
  });
}

export function toConversationDetailHttpResponse(
  conversation: ApplicationConversationDetail,
): ConversationDetailResponse {
  return conversationDetailResponseSchema.parse({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    messages: conversation.messages.map(toConversationMessageHttpResponse),
  });
}

export function toConversationMessageHttpResponse(
  message: ApplicationConversationMessage,
): ConversationMessageResponse {
  return conversationMessageResponseSchema.parse({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    trace: message.trace ? toRagRunDetailHttpResponse(message.trace) : null,
  });
}

export function toAppendConversationMessageHttpResponse(
  result: Exclude<AppendConversationMessageOutput, { status: "not_found" }>,
): AppendConversationMessageResponse {
  if (result.status === "answered" || result.status === "answered_no_evidence") {
    return appendConversationMessageResponseSchema.parse({
      status: result.status,
      userMessage: toConversationMessageHttpResponse(result.userMessage),
      assistantMessage: toConversationMessageHttpResponse(result.assistantMessage),
    });
  }

  if (result.status === "invalid_request") {
    return appendConversationMessageResponseSchema.parse({
      status: result.status,
      errorCode: result.errorCode,
    });
  }

  if ("errorCode" in result) {
    return appendConversationMessageResponseSchema.parse({
      status: result.status,
      userMessage: toConversationMessageHttpResponse(result.userMessage),
      errorCode: result.errorCode,
    });
  }

  throw new Error("unsupported_append_conversation_message_result");
}

export function toConversationStreamEventHttpResponse(
  event: StreamConversationMessageEvent,
): RagConversationStreamEvent {
  switch (event.type) {
    case "user_message_created":
      return ragConversationStreamEventSchema.parse({
        type: event.type,
        userMessage: toConversationMessageHttpResponse(event.userMessage),
      });
    case "phase":
      return ragConversationStreamEventSchema.parse(event);
    case "source":
      return ragConversationStreamEventSchema.parse(event);
    case "answer_delta":
      return ragConversationStreamEventSchema.parse(event);
    case "done":
      return ragConversationStreamEventSchema.parse({
        type: event.type,
        status: event.status,
        assistantMessage: toConversationMessageHttpResponse(
          event.assistantMessage,
        ),
      });
    case "error":
      return ragConversationStreamEventSchema.parse(event);
  }
}

function toRagRunDetailHttpResponse(trace: RagRunDetail) {
  return ragQueryRunDetailResponseSchema.parse({
    id: trace.id,
    question: trace.question,
    answer: trace.answer,
    mode: trace.mode,
    documentId: trace.documentId,
    status: trace.status,
    errorCode: trace.errorCode,
    sources: trace.sources,
    relatedTerms: trace.relatedTerms,
    metadata: trace.metadata,
    audit: trace.audit,
    createdAt: trace.createdAt.toISOString(),
  });
}
