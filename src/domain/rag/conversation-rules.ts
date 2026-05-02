import type { RagRetrievalStrategy } from "./retrieval-settings";

export type ConversationMode = "global" | "focused";

export type ConversationImmutableSnapshot = {
  mode: ConversationMode;
  documentId: string | null;
};

export const CONVERSATION_RULE_VIOLATION_CODES = Object.freeze([
  "strategy_not_allowed_for_mode",
  "conversation_mode_immutable",
  "conversation_document_immutable",
] as const);

export type ConversationRuleViolationCode =
  (typeof CONVERSATION_RULE_VIOLATION_CODES)[number];

export class ConversationRuleViolation extends Error {
  readonly code: ConversationRuleViolationCode;

  constructor(code: ConversationRuleViolationCode, message: string) {
    super(message);
    this.name = "ConversationRuleViolation";
    this.code = code;
  }
}

export function isStrategyAllowedForMode(
  mode: ConversationMode,
  strategy: RagRetrievalStrategy,
): boolean {
  if (mode === "focused") {
    return strategy === "standard";
  }

  return (
    strategy === "standard" ||
    strategy === "explore" ||
    strategy === "rerank"
  );
}

export function assertConversationModeImmutable(
  prev: ConversationImmutableSnapshot,
  next: ConversationImmutableSnapshot,
): void {
  if (prev.mode !== next.mode) {
    throw new ConversationRuleViolation(
      "conversation_mode_immutable",
      `Conversation mode is immutable: cannot change from "${prev.mode}" to "${next.mode}".`,
    );
  }
}

export function assertConversationDocumentImmutable(
  prev: ConversationImmutableSnapshot,
  next: ConversationImmutableSnapshot,
): void {
  if (prev.documentId !== next.documentId) {
    throw new ConversationRuleViolation(
      "conversation_document_immutable",
      `Conversation documentId is immutable: cannot change from "${prev.documentId ?? "null"}" to "${next.documentId ?? "null"}".`,
    );
  }
}
