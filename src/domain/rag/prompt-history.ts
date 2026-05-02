import type { ConversationMessageRole } from "./conversation-context";
import type { RagRetrievalStrategy } from "./retrieval-settings";

export type PromptHistoryMessage = {
  role: ConversationMessageRole;
  content: string;
  trace: { strategy: RagRetrievalStrategy } | null;
};

export function filterPromptHistory<T extends PromptHistoryMessage>(
  messages: readonly T[],
): T[] {
  const dropped = new Set<number>();

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    if (message.trace?.strategy !== "explore") continue;

    dropped.add(i);

    const prev = messages[i - 1];
    if (prev?.role === "user") {
      dropped.add(i - 1);
    }
  }

  if (dropped.size === 0) {
    return [...messages];
  }

  return messages.filter((_, index) => !dropped.has(index));
}
