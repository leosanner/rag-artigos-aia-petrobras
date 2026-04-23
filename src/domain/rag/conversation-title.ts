export const CONVERSATION_TITLE_MAX_LENGTH = 80;

export function deriveConversationTitle(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, CONVERSATION_TITLE_MAX_LENGTH);
}
