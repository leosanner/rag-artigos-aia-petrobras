# F-05 Block 02 - Persistence: Query-Run Traces and Audit Reads

## Goal

Add the governed storage layer for F-05: one persisted run per authorized,
schema-valid ask attempt, immutable source and related-term snapshots, and
repository-backed audit reads for recent runs and run detail.

## Scope

**In scope:**

- Drizzle schema additions for `rag_query_runs`, `rag_query_run_sources`, and
  `rag_query_run_related_terms`.
- Any supporting enum/check/index definitions needed by those tables.
- Transactional repository writes for one run plus its child snapshots.
- Repository read models for recent-run summaries and run detail.
- Real Postgres repository tests for write/read behavior.

**Out of scope:**

- Related-term extraction rules; Block 01 owns those.
- Provider usage/cost normalization and application orchestration.
- API routes, response schemas, and `/query`.
- Conversations, focused retrieval, streaming, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | Every authorized, schema-valid `POST /api/rag/ask` attempt persists one `rag_query_runs` record. | Repository writes one run row for each application-level audited ask attempt. |
| RN-05 | Persisted run status values are `answered`, `answered_no_evidence`, `generation_failed`, and `generation_unavailable`. | The schema stores only the safe status vocabulary. |
| RN-06 | Persisted traces store the applied `topK`, retrieval strategy, and `candidateTopK` actually used. | The run row includes applied retrieval settings, not just request intent. |
| RN-07 | Persisted source snapshots must match the source list used for answer generation or no-evidence handling for that run. | Source rows are immutable snapshots written with the run. |
| RN-10 | Each related term persists its rank, n-gram size, total frequency, and source-coverage count. | The related-term table stores the block-01 DTO shape directly. |
| RN-13 | Stored traces must never include raw prompt text, operator secrets, stack traces, or raw provider response bodies. | The schema and DTOs expose only safe governance fields. |
| INV-01 | Every persisted run must correspond to one authorized, schema-valid ask request. | Repository writes are application-triggered only after the request boundary. |
| INV-02 | Persisted traces must never store raw prompt text, secrets, stack traces, or raw provider bodies. | No such columns or DTO fields exist in this block. |
| INV-03 | A persisted source snapshot must match the selected sources for that run; it must not be recomputed later from live retrieval. | Read paths return stored snapshots, never a fresh retrieval query. |

## Functional Requirements

- [x] RF-B02-01: The database schema defines `rag_query_runs`,
  `rag_query_run_sources`, and `rag_query_run_related_terms`.
- [x] RF-B02-02: `rag_query_runs` stores question, nullable answer, safe
  status/error, applied retrieval settings, prompt/model versions, latency, and
  normalized usage/cost totals.
- [x] RF-B02-03: `rag_query_run_sources` stores an immutable snapshot of every
  selected source, including `sourceNumber`, document/chunk ids, document
  title, excerpt, score, version metadata, and `citedInAnswer`.
- [x] RF-B02-04: `rag_query_run_related_terms` stores up to 8 rows per run with
  `rank`, `term`, `ngramSize`, `frequency`, and `sourceCoverageCount`.
- [x] RF-B02-05: Child rows cannot exist without a parent run, and deleting a
  run cascades to its source and related-term snapshots.
- [x] RF-B02-06: `RagQueryRunsRepository.create(input)` writes one run plus its
  child snapshots in a single transaction.
- [x] RF-B02-07: `RagQueryRunsRepository.listRecent()` returns recent run
  summaries in reverse chronological order without loading full excerpts or
  related terms.
- [x] RF-B02-08: `RagQueryRunsRepository.getById(id)` returns one persisted run
  detail with sources and related terms, or `null` when the id does not exist.
- [x] RF-B02-09: Repository tests prove the read side returns stored source
  snapshots and related-term rows instead of recomputing live retrieval.
- [x] RF-B02-10: Repository tests prove reverse-chronological listing and safe
  persistence of both answered and failed run states.

## Module Contracts

```ts
export type PersistRagQueryRunInput = {
  question: string;
  answer: string | null;
  mode: "global";
  status: RagQueryRunStatus;
  errorCode: RagQueryRunErrorCode | null;
  topK: number;
  retrievalStrategy: "standard" | "explore";
  candidateTopK: number;
  promptVersion: string;
  generationModel: string;
  embeddingModel: string;
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

```ts
export type PersistedRagSourceSnapshot = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
  citedInAnswer: boolean;
};

export interface RagQueryRunsRepository {
  create(input: PersistRagQueryRunInput): Promise<{ id: string; createdAt: Date }>;
  listRecent(): Promise<RagRunSummary[]>;
  getById(id: string): Promise<RagRunDetail | null>;
}
```

## Key Modules

- `src/db/schema.ts`
- `src/repositories/rag-query-runs-repository.ts`
- `src/repositories/rag-query-runs-repository.test.ts`
- `drizzle/*`
- `src/test/db.ts`

## Tests First

- `src/repositories/rag-query-runs-repository.test.ts`

Repository tests must use real Postgres and explicitly prove transactional
create behavior, immutable source snapshots, related-term persistence, reverse
chronological listing, and `getById(id)` detail loading.

## Done When

- Repository tests pass against real Postgres.
- The trace schema stores only governed run/source/term data.
- Later application and interface blocks can write audited runs and read recent
  summaries/detail without recomputing retrieval state.
