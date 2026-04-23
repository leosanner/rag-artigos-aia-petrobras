export type ConversationMessageRole = "user" | "assistant";

export type ConversationMessageForContext = {
  role: ConversationMessageRole;
  content: string;
};

export type BuildConversationRetrievalContextInput = {
  latestUserMessage: string;
  previousStoredMessages: ConversationMessageForContext[];
};

export const CONVERSATION_ROLE_LABELS = Object.freeze({
  user: "User:",
  assistant: "Assistant:",
} as const) satisfies Record<ConversationMessageRole, string>;

export const CONVERSATION_CONTEXT_MAX_PREDECESSORS = 4;

const SEGMENT_SEPARATOR = "\n\n";

export function buildConversationRetrievalContext(
  input: BuildConversationRetrievalContextInput,
): string {
  const { latestUserMessage, previousStoredMessages } = input;

  const keptPredecessors = previousStoredMessages.slice(
    -CONVERSATION_CONTEXT_MAX_PREDECESSORS,
  );

  const segments = keptPredecessors.map(
    (message) => `${CONVERSATION_ROLE_LABELS[message.role]} ${message.content}`,
  );

  segments.push(`${CONVERSATION_ROLE_LABELS.user} ${latestUserMessage}`);

  return segments.join(SEGMENT_SEPARATOR);
}
