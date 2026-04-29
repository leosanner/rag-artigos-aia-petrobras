# F-08 Block 01 - Domain: Rerank Contract and Failures

## Goal

Close the pure domain vocabulary for F-08: extend the shared retrieval
strategy union with `rerank`, replace the ambiguous single-source score field
with explicit first-pass and second-pass score evidence, normalize reranking
audit types, and lock the safe reranking failure vocabulary before any
repository or provider work begins.

## Scope

**In scope:**

- `RagRetrievalStrategy` and `RagRetrievalStrategySchema` expand from
  `"standard" | "explore"` to `"standard" | "explore" | "rerank"`.
- `normalizeRetrievalSettings(...)` and `getCandidateTopK(...)` keep the
  existing defaults/range and apply the same bounded candidate-expansion rule
  to both `explore` and `rerank`.
- Domain types and Zod schemas for source score evidence:
  required `retrievalScore` and nullable `rerankScore`.
- Domain types for reranking metadata and normalized reranking audit.
- Safe reranking failure vocabulary:
  `reranking_failed` and `reranking_unavailable`.
- Pure validation helpers proving a reranked result is only a subset or
  reordering of the first-pass candidate set and never exceeds the final
  allowed size.

**Out of scope:**

- Repository SQL, migrations, and trace-row persistence; Block 02 owns those.
- Provider adapters and network-specific failure inspection; Block 03 owns the
  provider boundary.
- API routes, UI schemas, `/query`, conversations, focused mode, streaming, or
  any agent workflow.
- Choosing a concrete reranker vendor, SDK, or model.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | The shared retrieval request shape becomes `{ topK?: number; strategy?: "standard" \| "explore" \| "rerank" }`. | Extends the domain retrieval union and schema. |
| RN-02 | Omitting `retrieval` remains equivalent to `{ topK: 6, strategy: "standard" }`. | Preserves the existing normalization defaults. |
| RN-03 | `topK` remains an integer in the inclusive range `3..12`. | Reuses the existing bounded retrieval settings contract unchanged. |
| RN-05 | `rerank` uses `candidateTopK = min(24, topK * 3)`. | Makes `getCandidateTopK(...)` treat `rerank` the same as `explore`. |
| RN-07 | The reranking stage may only reorder or downselect first-pass candidates. | Adds a pure rerank-selection invariant helper. |
| RN-08 | The final reranked selection contains exactly `topK` matches when enough candidates exist. | Encodes the final-size rule in the domain validator. |
| RN-12 | Source audit data must expose `retrievalScore` and nullable `rerankScore`. | Replaces the ambiguous `score` field at the domain boundary. |
| RN-13 | `retrievalScore` is always present; `rerankScore` exists only for `rerank`. | Locks the source-score contract for all later layers. |
| RN-14 | Safe reranking failures are `reranking_failed` or `reranking_unavailable`. | Extends the safe status/error vocabulary in the domain. |
| RN-15 | Reranking audit data must be normalized at the provider boundary. | Defines provider-agnostic metadata and audit shapes. |
| INV-02 | The reranking stage must never return a chunk absent from the first-pass candidates. | Validation helper rejects unknown or duplicated chunk ids. |
| INV-03 | `explore` behavior must remain deterministic and unchanged. | `explore` keeps using deterministic diversified selection and never receives rerank-only fields. |
| INV-06 | Source audit data must never collapse both retrieval stages into one score field. | Removes the ambiguous domain `score` contract. |

## Functional Requirements

- [ ] RF-B01-01: `RagRetrievalStrategySchema` accepts
  `"standard" | "explore" | "rerank"` and rejects any other value.
- [ ] RF-B01-02: `normalizeRetrievalSettings(...)` preserves the existing
  default `{ topK: 6, strategy: "standard" }` when retrieval settings are
  omitted.
- [ ] RF-B01-03: `getCandidateTopK(...)` returns `topK` for `standard` and
  `min(24, topK * 3)` for both `explore` and `rerank`.
- [ ] RF-B01-04: Domain source types replace the old `score: number` field
  with `retrievalScore: number` and `rerankScore: number | null`.
- [ ] RF-B01-05: A pure `assertValidRerankedSelection(...)` helper rejects any
  reranked output that contains duplicate chunk ids, unknown chunk ids, or
  more than `min(candidateCount, topK)` matches.
- [ ] RF-B01-06: The validated reranked selection preserves the provider's
  explicit order, as long as the candidate-subset and size invariants hold.
- [ ] RF-B01-07: The domain status and safe error vocabulary add
  `reranking_failed` and `reranking_unavailable` without removing existing
  `generation_failed` and `generation_unavailable`.
- [ ] RF-B01-08: `RagRerankingAudit` is normalized to
  `{ latencyMs, candidatesEvaluated, inputTokens, estimatedCostUsd }`, where
  `inputTokens = 0` is allowed only as a deliberate provider-normalized value.
- [ ] RF-B01-09: Zero first-pass matches remain representable as a valid
  retrieval outcome with `reranking = null`; reranking is never required when
  the candidate list is empty.

## Module Contracts

```ts
export type RagRetrievalStrategy = "standard" | "explore" | "rerank";

export type RagSourceScore = {
  retrievalScore: number;
  rerankScore: number | null;
};

export type FirstPassChunkMatch = Omit<RetrievedChunkMatch, "score"> & {
  retrievalScore: number;
  rerankScore: null;
};

export type RerankedChunkMatch = Omit<FirstPassChunkMatch, "rerankScore"> & {
  rerankScore: number | null;
};

export type RagRerankingMetadata = {
  rerankerProvider: string;
  rerankerModel: string;
};

export type RagRerankingAudit = {
  latencyMs: number;
  candidatesEvaluated: number;
  inputTokens: number;
  estimatedCostUsd: number;
};
```

```ts
export const RAG_QUERY_RUN_STATUSES = [
  "answered",
  "answered_no_evidence",
  "generation_failed",
  "generation_unavailable",
  "reranking_failed",
  "reranking_unavailable",
] as const;

export const RAG_QUERY_RUN_ERROR_CODES = [
  "generation_failed",
  "generation_unavailable",
  "reranking_failed",
  "reranking_unavailable",
] as const;

export function assertValidRerankedSelection(input: {
  candidateChunkIds: string[];
  selectedChunkIds: string[];
  topK: number;
}): void;
```

## Key Modules

- `src/domain/rag/retrieval-settings.ts`
- `src/domain/rag/query-run-status.ts`
- `src/domain/rag/reranking.ts` (new)
- `src/domain/rag/index.ts`

## Tests First

- `src/domain/rag/retrieval-settings.test.ts`
- `src/domain/rag/query-run-status.test.ts`
- `src/domain/rag/reranking.test.ts` (new)

Tests must stay pure: no database, no network, and no provider adapters.

## Done When

- The domain layer fully describes `rerank` without naming a concrete vendor.
- The retrieval settings, score evidence, rerank audit, and safe failure codes
  are stable enough for Blocks 02-04 to consume without guessing.
- Pure tests prove candidate expansion, subset-or-reorder validation, and the
  expanded status/error vocabulary.
