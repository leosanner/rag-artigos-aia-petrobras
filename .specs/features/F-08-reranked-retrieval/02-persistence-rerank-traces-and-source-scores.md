# F-08 Block 02 - Persistence: Rerank Traces and Source Scores

## Goal

Extend the governed trace schema and repository contract so reranked asks can
persist source-level first-pass versus second-pass score evidence, normalized
reranker metadata or audit, and dedicated reranking failure states without
breaking the existing standard or explore read paths.

## Scope

**In scope:**

- Drizzle enum updates for rerank-aware `rag_query_run_status`,
  `rag_query_run_error_code`, and `retrieval_strategy` validation.
- A migration that renames `rag_query_run_sources.score` to
  `retrieval_score` and adds nullable `rerank_score`.
- Nullable reranking metadata and audit columns on `rag_query_runs`.
- Repository write and read contract changes for rerank-aware run rows and
  source snapshots.
- Real Postgres repository tests covering standard, explore, rerank success,
  rerank no-evidence, and rerank-failure rows.

**Out of scope:**

- Provider orchestration or rerank result validation; Block 03 owns those.
- Ask/query-run handlers and `/query` rendering; Block 04 owns those.
- Conversation transcript tables, focused selectors, streaming, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-11 | Successful reranked answers and persisted runs must record `candidateTopK`, `rerankerProvider`, `rerankerModel`, reranking audit metrics, and source-level retrieval/rerank evidence. | Adds nullable reranking metadata and audit columns plus split source-score columns. |
| RN-12 | Source audit data must expose `retrievalScore` and nullable `rerankScore`. | Renames the source snapshot column and adds the second-stage score column. |
| RN-13 | `retrievalScore` remains required for every selected source; `rerankScore` exists only for `rerank`. | Makes `retrieval_score` non-null and `rerank_score` nullable. |
| RN-14 | Safe reranking failures persist a governed trace. | Extends the safe run status and error code enums for failed rerank attempts. |
| RN-15 | Reranking audit data must be normalized and must not expose raw provider bodies. | Stores only safe numeric and configured-model fields. |
| INV-05 | A reranking failure must never fall through to generation. | Failed rerank rows can store null generation metrics exactly like other pre-generation failures. |
| INV-06 | Source audit data must never collapse first-pass and rerank evidence into one score field. | Removes `score` from the persistence contract entirely. |
| INV-07 | F-08 must not expose raw reranker payloads, secrets, or stack traces through persisted traces. | The schema stores only safe fields. |

## Functional Requirements

- [ ] RF-B02-01: `rag_query_run_status` adds
  `"reranking_failed"` and `"reranking_unavailable"`.
- [ ] RF-B02-02: `rag_query_run_error_code` adds the same two reranking safe
  failure codes.
- [ ] RF-B02-03: The `rag_query_runs.retrieval_strategy` check expands to
  accept `"rerank"` in addition to `"standard"` and `"explore"`.
- [ ] RF-B02-04: The migration renames
  `rag_query_run_sources.score -> retrieval_score`, copies existing data in
  place, and adds nullable `rerank_score`.
- [ ] RF-B02-05: `rag_query_runs` adds nullable
  `reranker_provider`, `reranker_model`, `reranking_latency_ms`,
  `reranking_candidates_evaluated`, `reranking_input_tokens`, and
  `reranking_cost_usd`.
- [ ] RF-B02-06: A run-level check enforces reranking metadata and audit fields
  as all-null or all-present, so standard, explore, rerank no-evidence, and
  rerank-failure rows stay distinct from rerank-success rows.
- [ ] RF-B02-07: `PersistedRagSourceSnapshot` replaces `score` with required
  `retrievalScore` and nullable `rerankScore`.
- [ ] RF-B02-08: `PersistRagQueryRunInput` adds nullable reranking metadata and
  audit fields while preserving existing generation metrics and total cost
  fields.
- [ ] RF-B02-09: `RagQueryRunsRepository.create(input)` writes rerank-aware
  run/source rows transactionally for all safe statuses, including rerank
  failures.
- [ ] RF-B02-10: `RagQueryRunsRepository.getById(id)` returns rerank-aware
  source snapshots and a nullable reranking audit object without recomputing
  live retrieval.
- [ ] RF-B02-11: Repository tests prove legacy rows written before F-08 read
  back as `retrievalScore = old score` and `rerankScore = null`.

## Module Contracts

```ts
export type PersistedRagSourceSnapshot = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  retrievalScore: number;
  rerankScore: number | null;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
  citedInAnswer: boolean;
};
```

```ts
export type PersistRagQueryRunInput = {
  question: string;
  answer: string | null;
  mode: "global" | "focused";
  documentId: string | null;
  status: RagQueryRunStatus;
  errorCode: RagQueryRunErrorCode | null;
  topK: number;
  retrievalStrategy: RagRetrievalStrategy;
  candidateTopK: number;
  promptVersion: string;
  generationModel: string;
  embeddingModel: string;
  rerankerProvider: string | null;
  rerankerModel: string | null;
  rerankingLatencyMs: number | null;
  rerankingCandidatesEvaluated: number | null;
  rerankingInputTokens: number | null;
  rerankingCostUsd: number | null;
  latencyMs: number;
  embeddingInputTokens: number;
  embeddingCostUsd: number;
  generationInputTokens: number | null;
  generationOutputTokens: number | null;
  generationTotalTokens: number | null;
  generationCostUsd: number | null;
  totalCostUsd: number;
  sources: PersistedRagSourceSnapshot[];
  relatedTerms: RelatedTerm[];
};
```

## Key Modules

- `src/db/schema.ts`
- `drizzle/*`
- `src/repositories/rag-query-runs-repository.ts`
- `src/repositories/rag-query-runs-repository.test.ts`
- `src/test/db.ts`

## Tests First

- `src/repositories/rag-query-runs-repository.test.ts`

Repository tests must run against real Postgres and explicitly cover:
standard and explore rows with `rerankScore = null`, rerank success rows with
non-null `reranker*` and reranking audit fields, rerank no-evidence rows with
null reranking metadata, rerank failures with safe status or error codes, and
legacy-source-score preservation after the column rename.

## Done When

- The trace schema can represent standard, explore, rerank success, rerank
  no-evidence, and rerank failure rows without ambiguity.
- The source snapshot contract exposes explicit first-pass and second-pass
  score evidence.
- Repository reads stay immutable and never recompute reranking state from live
  retrieval.
