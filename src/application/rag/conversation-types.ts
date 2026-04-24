import type { ConversationMessageRole } from "@/domain/rag";
import type { RagRunDetail } from "@/repositories/rag-query-runs-repository";
import type {
  ConversationDetail,
  ConversationDetailMessage,
} from "@/repositories/conversation-repository";

export type ConversationMessageResponse = {
  id: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: Date;
  trace: RagRunDetail | null;
};

export type ConversationDetailResponse = {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  messages: ConversationMessageResponse[];
};

export function toConversationMessageResponse(
  message: ConversationDetailMessage,
): ConversationMessageResponse {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    trace: message.trace,
  };
}

export function toConversationDetailResponse(
  detail: ConversationDetail,
): ConversationDetailResponse {
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    lastMessageAt: detail.lastMessageAt,
    messages: detail.messages.map(toConversationMessageResponse),
  };
}
