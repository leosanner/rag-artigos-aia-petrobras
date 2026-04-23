export type RagRetrievalStrategy = "standard" | "explore";

export type RagRetrievalSettings = {
  topK: number;
  strategy: RagRetrievalStrategy;
};

export type RagRetrievalInput = Partial<RagRetrievalSettings>;

export const RAG_RETRIEVAL_MIN_TOP_K = 3;
export const RAG_RETRIEVAL_MAX_TOP_K = 12;
export const RAG_RETRIEVAL_DEFAULT_TOP_K = 6;
export const RAG_RETRIEVAL_DEFAULT_STRATEGY = "standard";
export const EXPLORE_RETRIEVAL_MAX_CANDIDATES = 24;

export const DEFAULT_RAG_RETRIEVAL_SETTINGS = Object.freeze({
  topK: RAG_RETRIEVAL_DEFAULT_TOP_K,
  strategy: RAG_RETRIEVAL_DEFAULT_STRATEGY,
} satisfies RagRetrievalSettings);

export function normalizeRetrievalSettings(
  input: RagRetrievalInput = {},
): RagRetrievalSettings {
  return {
    topK: input.topK ?? DEFAULT_RAG_RETRIEVAL_SETTINGS.topK,
    strategy: input.strategy ?? DEFAULT_RAG_RETRIEVAL_SETTINGS.strategy,
  };
}

export function getCandidateTopK(settings: RagRetrievalSettings): number {
  if (settings.strategy === "standard") {
    return settings.topK;
  }

  return Math.min(
    EXPLORE_RETRIEVAL_MAX_CANDIDATES,
    settings.topK * 3,
  );
}
