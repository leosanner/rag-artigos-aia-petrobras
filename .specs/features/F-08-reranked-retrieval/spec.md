# F-08 - Reranked Retrieval

## Scope

**In scope:**
- Extend the shared retrieval request shape to accept
  `strategy?: "standard" | "explore" | "rerank"`.
- Keep `standard` and `explore` intact while adding `rerank` as an explicit
  operator-facing strategy on `POST /api/rag/ask` and `/query`.
- Reuse the existing first-pass global vector search with
  `candidateTopK = min(24, topK * 3)` and add a second-pass reranking stage for
  `rerank`.
- Keep reranking behind a new provider interface so the concrete vendor/model
  remains swappable.
- Expand success metadata, persisted traces, and source audit data for reranked
  runs.
- Add dedicated safe failure codes for the reranking stage.
- Scope this feature to global single-turn querying only; later `/query`
  features must reuse the contract defined here.

**Out of scope:**
- Replacing, removing, or silently changing the behavior of `standard` or
  `explore`.
- Automatic strategy selection, broad-question detection, or hidden reranking.
- Conversation-specific reranking flow; that remains F-06 after it rebases on
  the evolved retrieval contract.
- Focused/document-scoped reranking; that remains F-07 after it rebases on the
  evolved retrieval contract.
- Locking a concrete reranker vendor, SDK, or model in this documentation pass.
- Learned diversification, agent planning, or multi-hop retrieval.

## Context & Motivation

F-04 introduced adjustable retrieval controls and an explicit `explore`
strategy, but it intentionally left "reranking with a second model" out of
scope. F-05 then added the audit/tracing layer needed to govern additional
retrieval stages.

The current user need is a new strategy that starts with a larger candidate set
and then chooses the most relevant chunks for the query before generation. That
behavior is similar to `explore` in its widened first pass, but it is not the
same product intent: `explore` is still the explicit broad-question path with
deterministic diversification, while `rerank` is the explicit precision path
with a second-pass relevance scorer.

This feature updates the shared `/query` retrieval contract before F-06 and
F-07 continue, so future conversation and focused-retrieval work builds on the
same governed strategy vocabulary, trace model, and source audit fields.

## Business Rules

- RN-01: The shared retrieval request shape becomes
  `{ topK?: number; strategy?: "standard" | "explore" | "rerank" }`.
- RN-02: Omitting `retrieval` remains equivalent to
  `{ topK: 6, strategy: "standard" }`.
- RN-03: `topK` remains an integer in the inclusive range `3..12`.
- RN-04: `rerank` is always an explicit operator choice; the system must never
  auto-switch from `standard` or `explore` into reranking.
- RN-05: `rerank` uses the same first-pass candidate policy as `explore`:
  `candidateTopK = min(24, topK * 3)`.
- RN-06: The first-pass candidate set for `rerank` is the existing global
  score-ordered vector search result over the active indexing configuration.
- RN-07: The reranking stage may only reorder or downselect the first-pass
  candidates; it must never invent a chunk that was absent from the first-pass
  result.
- RN-08: If the first-pass candidate count is greater than or equal to `topK`,
  the final reranked selection must contain exactly `topK` chunks. If the
  candidate count is smaller than `topK`, the final selection may contain only
  the available candidates.
- RN-09: `rerank` uses the standard answer-generation path and must not reuse
  the `explore` multi-perspective prompt behavior.
- RN-10: `explore` remains unchanged: same candidate expansion, deterministic
  diversification, and multi-perspective answer behavior.
- RN-11: Successful reranked answers and persisted runs must record the applied
  `candidateTopK`, `rerankerProvider`, `rerankerModel`, reranking audit
  metrics, and source-level retrieval/rerank evidence.
- RN-12: Source audit data must expose the first-pass vector score as
  `retrievalScore` and the second-pass rerank score as nullable `rerankScore`.
- RN-13: `retrievalScore` remains required for every selected source across all
  strategies; `rerankScore` is present only when the applied strategy is
  `rerank`.
- RN-14: Safe reranking failures are represented as `reranking_failed` or
  `reranking_unavailable`, persist a governed trace, return sanitized API
  errors, and skip generation.
- RN-15: Reranking audit data must be normalized at the provider boundary and
  must not expose raw provider request/response bodies.
- RN-16: F-08 stays global single-turn only and must not introduce
  conversation-specific or focused-retrieval-only behavior.

## Functional Requirements

- [ ] RF-01: Request validation accepts
  `strategy: "rerank"` alongside `standard` and `explore`.
- [ ] RF-02: Omitted retrieval settings remain backward-compatible with the
  F-04 default `{ topK: 6, strategy: "standard" }`.
- [ ] RF-03: `RetrieveChunks` (or its shared successor) fetches
  `candidateTopK = min(24, topK * 3)` first-pass candidates when
  `strategy = "rerank"`.
- [ ] RF-04: A new `RerankingProvider` interface receives the normalized query,
  first-pass candidates, `topK`, and `candidateTopK`, and returns reranked
  matches plus normalized audit metadata.
- [ ] RF-05: The reranking provider is called exactly once per reranked ask
  attempt after first-pass retrieval succeeds and before context assembly.
- [ ] RF-06: The final reranked selection preserves chunk identity from the
  first-pass candidate set and returns exactly `topK` matches whenever enough
  candidates were retrieved.
- [ ] RF-07: `explore` continues to use deterministic diversification and is
  never silently replaced by reranking.
- [ ] RF-08: Reranked success responses expose `candidateTopK`,
  `rerankerProvider`, `rerankerModel`, and reranking audit data in stable
  metadata/audit fields.
- [ ] RF-09: Source DTOs used by success responses and persisted traces expose
  `retrievalScore` plus nullable `rerankScore` instead of a single ambiguous
  score field.
- [ ] RF-10: `rag_query_runs` (and any derived detail DTOs) persist reranking
  metadata and audit metrics for reranked runs.
- [ ] RF-11: `rag_query_run_sources` persists the selected source snapshots
  with both `retrievalScore` and nullable `rerankScore`.
- [ ] RF-12: Safe reranking failures persist a failed run with
  `reranking_failed` or `reranking_unavailable`, skip generation, and return a
  sanitized API error body.
- [ ] RF-13: `/query` exposes an explicit rerank action/control distinct from
  the existing standard and explore actions.
- [ ] RF-14: `/query` can inspect reranked current answers and persisted runs
  with reranking metadata and score evidence.
- [ ] RF-15: F-08 response bodies, traces, and UI never expose raw prompts,
  secrets, stack traces, or raw reranker payloads.

## System Flow

1. The operator opens `/query`.
2. The page renders the existing global single-turn experience plus an explicit
   rerank action/control alongside the current standard and explore paths.
3. For a reranked ask, the page submits
   `{ question, mode: "global", retrieval: { topK, strategy: "rerank" } }` to
   `POST /api/rag/ask`.
4. The route validates the request body, normalizes omitted retrieval settings,
   and delegates to the shared answer application service.
5. The retrieval service embeds the question using the active embedding-model
   contract already defined by F-02/F-03.
6. The retrieval service performs the first-pass global vector search with
   `candidateTopK = min(24, topK * 3)` over the active indexing configuration.
7. If first-pass retrieval fails technically, the service persists a safe
   failure exactly as the governed single-turn flow already requires.
8. If zero candidates are returned, the service returns the same no-evidence
   answer path used by the existing global flow and does not call the reranker
   or generation provider.
9. If candidates are returned, the application calls `RerankingProvider.rerank`
   with the normalized question, ordered candidates, `topK`, and
   `candidateTopK`.
10. The reranking provider returns a reordered/downselected list of candidate
    matches plus normalized audit metadata (`rerankerProvider`,
    `rerankerModel`, and reranking metrics).
11. If the reranking stage fails technically or returns an invalid result, the
    service persists `reranking_failed` or `reranking_unavailable`, returns the
    matching sanitized API error, and does not call generation.
12. If reranking succeeds, the context assembler builds the prompt context from
    the final reranked matches, preserving `retrievalScore` and `rerankScore`
    in the selected-source metadata.
13. The generation provider receives the standard global synthesis prompt
    branch, not the explore multi-perspective prompt branch.
14. Citation validation runs exactly as in the existing governed single-turn
    flow.
15. On success, the system returns the cited answer, selected sources,
    reranking metadata, and reranking audit data, and persists the full trace
    snapshot for later inspection on `/query`.

## Invariants / Non-negotiables

- INV-01: F-08 must never activate reranking automatically.
- INV-02: The reranking stage must never return a chunk that was absent from
  the first-pass candidate set.
- INV-03: `explore` behavior must remain deterministic and unchanged by the
  introduction of `rerank`.
- INV-04: `rerank` must use the standard answer-generation prompt path, not the
  explore prompt branch.
- INV-05: A reranking failure must never fall through to generation.
- INV-06: Source audit data must never collapse first-pass and rerank evidence
  into one ambiguous score field once F-08 lands.
- INV-07: F-08 must not expose raw reranker payloads, secrets, or stack traces
  through API responses, persisted traces, or `/query`.
- INV-08: F-08 must stay behind a reranking provider interface and must not
  make the base RAG flow depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `RagRetrievalStrategy` | `"standard" \| "explore" \| "rerank"` | Extends the shared retrieval strategy vocabulary. |
| `RagRetrievalSettings` | `topK`, `strategy` | The normalized retrieval settings remain the single source of truth for ask execution. |
| `RerankedChunkMatch` | existing chunk/source metadata, `retrievalScore`, nullable `rerankScore` | Final candidate DTO used for context assembly and audit; reranking never invents new chunk ids. |
| `RagRerankingAudit` | `latencyMs`, `candidatesEvaluated`, `inputTokens`, `estimatedCostUsd` | Normalized reranking-stage audit shape. `inputTokens` may be `0` only when the concrete adapter genuinely has no tokenized billing. |
| `RagAnswerMetadata` | existing retrieval metadata plus `rerankerProvider`, `rerankerModel` | `reranker*` fields are nullable for `standard`/`explore` and required for `rerank`. |
| `RagAnswerAudit` | existing audit fields plus nullable `reranking` object | The reranking audit object is present only for reranked runs. |
| `rag_query_runs` | existing trace columns plus nullable `reranker_provider`, nullable `reranker_model`, nullable reranking audit columns | Persists the reranking-stage metadata/audit needed for governed inspection. |
| `rag_query_run_sources` | existing snapshot fields plus `retrieval_score`, nullable `rerank_score` | Stores source-level evidence for both first-pass retrieval and second-pass reranking. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/rag/ask` | Accepts the evolved retrieval shape including `strategy: "rerank"` and returns reranking metadata/audit for reranked successes. |
| `GET` | `/query` | Exposes an explicit rerank action/control on the shared global single-turn surface. |
| Function | `RetrieveChunks.search(input)` | Fetches first-pass candidates for `standard`, `explore`, and `rerank`; only `rerank` invokes the reranking provider. |
| Strategy | `RerankingProvider.rerank(input)` | Receives `{ question, matches, topK, candidateTopK }` and returns reranked matches plus normalized reranking metadata/audit. |
| Repository | `RagQueryRunsRepository.create(input)` | Persists reranking metadata/audit and source-level `retrievalScore`/`rerankScore` evidence. |

### Key Modules

- `src/domain/rag/*` - retrieval-strategy vocabulary, score DTOs, reranking
  audit types, and safe reranking failure vocabulary.
- `src/application/rag/*` - request/response schemas, retrieval orchestration,
  reranking-provider boundary, trace-persistence input, and sanitized error
  mapping.
- `src/repositories/*` - persisted run and source snapshot structures for
  reranking metadata and score evidence.
- `src/infrastructure/ai/*` - concrete reranking adapter once a provider/model
  is selected.
- `src/app/api/rag/ask/*` - request validation, sanitized reranking error
  responses, and stable success serialization.
- `src/app/api/rag/query-runs/*` - run-summary and run-detail DTOs that expose
  reranking metadata when present.
- `src/app/query/page.tsx` - explicit rerank UI control and audit rendering for
  reranked answers/runs.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings; F-03 Global RAG;
  F-04 Query Controls and Explore; F-05 Answer Traceability.
- **External packages added:** N/A - the concrete reranker SDK/package remains
  intentionally open in this documentation pass.
- **External services:** Postgres/pgvector; the existing embedding/generation
  providers; one concrete reranking provider behind the new adapter boundary.
- **Environment variables:** `RAG_RERANKER_PROVIDER` - configured reranker
  adapter id; `RAG_RERANKER_MODEL` - configured reranker model name. Any
  provider-specific credential variables remain intentionally undefined until a
  concrete implementation is selected.

## Acceptance Criteria

1. Request validation accepts `strategy: "rerank"` without regressing the
   existing `standard` and `explore` request shapes.
2. `rerank` retrieves `candidateTopK = min(24, topK * 3)` first-pass
   candidates and calls the reranking provider exactly once before context
   assembly.
3. If first-pass retrieval returns at least `topK` candidates, the final
   reranked selection contains exactly `topK` chunks in reranked order.
4. `explore` continues to use deterministic diversification and is not silently
   replaced by reranking.
5. Successful reranked answers and persisted traces expose `candidateTopK`,
   `rerankerProvider`, `rerankerModel`, reranking audit data,
   `retrievalScore`, and nullable `rerankScore`.
6. Reranking failures persist `reranking_failed` or
   `reranking_unavailable`, skip generation, and return sanitized API errors.
7. `/query` exposes an explicit rerank control for global single-turn
   questions and can inspect reranked current answers and persisted runs.
8. API responses, persisted traces, and `/query` audit views remain free of
   secrets, raw prompts, stack traces, and raw reranker/provider payloads.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Keep `standard`, `explore`, and `rerank` as three explicit strategies | Replace `explore`; hide reranking behind `explore`; auto-pick strategies | Each strategy serves a distinct operator intent and stays explainable/auditable. |
| Reuse `candidateTopK = min(24, topK * 3)` for reranking | Fixed candidate count; operator-controlled `candidateTopK`; unbounded candidate fetch | The existing policy already balances retrieval breadth with bounded cost and fits the new strategy without adding another operator control. |
| Add a dedicated `RerankingProvider` boundary | Hard-code one reranker into the application layer; piggyback on the generation provider interface | The concrete vendor/model is intentionally still open, so the contract must isolate that decision behind an adapter. |
| Expose `retrievalScore` plus nullable `rerankScore` | Keep one ambiguous `score`; expose only rerank score | The audit layer needs to preserve both retrieval stages explicitly. |
| Add dedicated reranking failure vocabulary | Reuse `generation_failed`/`generation_unavailable`; collapse rerank failures into generic technical errors | The reranking stage is now a first-class governed step and needs its own safe operational signals. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
