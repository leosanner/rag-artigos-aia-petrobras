import type { RagRunDetail } from "@/repositories/rag-query-runs-repository";

export type RunWithConversationStatus = RagRunDetail & {
  conversationArchived: boolean;
};

export function projectRunWithConversationStatus(
  run: RagRunDetail,
  opts: { conversationExists: boolean },
): RunWithConversationStatus {
  return { ...run, conversationArchived: !opts.conversationExists };
}
