export const RAG_QUERY_RUN_STATUSES = Object.freeze([
  "answered",
  "answered_no_evidence",
  "generation_failed",
  "generation_unavailable",
  "reranking_failed",
  "reranking_unavailable",
] as const);

export type RagQueryRunStatus = (typeof RAG_QUERY_RUN_STATUSES)[number];

export const RAG_QUERY_RUN_ERROR_CODES = Object.freeze([
  "generation_failed",
  "generation_unavailable",
  "reranking_failed",
  "reranking_unavailable",
] as const);

export type RagQueryRunErrorCode = (typeof RAG_QUERY_RUN_ERROR_CODES)[number];

const FAILED_RUN_STATUS_SET = new Set<RagQueryRunStatus>(RAG_QUERY_RUN_ERROR_CODES);

export function isFailedRunStatus(status: RagQueryRunStatus): boolean {
  return FAILED_RUN_STATUS_SET.has(status);
}
