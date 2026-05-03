import type { RagSource } from "@/domain/rag";

import type { ConversationMessageResponse } from "./conversation-types";

export const STREAM_CONVERSATION_PHASES = Object.freeze([
  "retrieving_sources",
  "generating_answer",
] as const);

export type StreamConversationPhase =
  (typeof STREAM_CONVERSATION_PHASES)[number];

export const STREAM_CONVERSATION_ERROR_STATUSES = Object.freeze([
  "generation_failed",
  "generation_unavailable",
  "document_not_found",
  "document_not_focusable",
  "strategy_not_allowed_for_focused_conversation",
] as const);

export type StreamConversationErrorStatus =
  (typeof STREAM_CONVERSATION_ERROR_STATUSES)[number];

export type StreamConversationMessageEvent =
  | {
      type: "user_message_created";
      userMessage: ConversationMessageResponse;
    }
  | {
      type: "phase";
      phase: StreamConversationPhase;
    }
  | {
      type: "source";
      source: RagSource;
    }
  | {
      type: "answer_delta";
      textDelta: string;
    }
  | {
      type: "done";
      status: "answered" | "answered_no_evidence";
      assistantMessage: ConversationMessageResponse;
    }
  | {
      type: "error";
      status: StreamConversationErrorStatus;
      errorCode: StreamConversationErrorStatus;
    };

export type StreamConversationMessageListener = (
  event: StreamConversationMessageEvent,
) => Promise<void> | void;
