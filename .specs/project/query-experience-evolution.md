# Query Experience Evolution

## Purpose

This document defines how the shared `/query` operator surface evolves after the
F-03 global-RAG baseline. It locks the delivery sequence, shared interfaces,
and non-negotiables so later feature contracts do not compete with each other.

## Why This Exists

F-03 delivered a minimal global question page with cited answers, but the next
user needs are broader than focused retrieval alone:

- adjustable retrieval controls for operator-guided exploration;
- explicit handling for broad questions that should surface varied answers;
- explicit handling for precision-oriented questions that benefit from a
  second-pass reranking stage;
- persistent audit/governance data for each answer;
- a conversational operator experience that keeps the same traceability model.

Because of that, the assumption that focused retrieval should be the immediate
next extension of
`/query` is now superseded.

## Delivery Sequence

1. **F-04 - Query Controls and Explore**
   Adds adjustable retrieval parameters to `POST /api/rag/ask` and to `/query`,
   plus an explicit explore strategy for broad questions.
2. **F-05 - Answer Traceability**
   Persists query runs, related terms, source snapshots, token usage, latency,
   and estimated costs. Adds audit inspection for the current answer and
   persisted runs.
3. **F-08 - Reranked Retrieval**
   Adds an explicit `rerank` strategy to the shared retrieval contract, reuses
   the bounded candidate-expansion policy, and inserts an auditable second-pass
   reranking stage before generation.
4. **F-06 - Conversational Query**
   Keeps `/query` as the single operator surface and adds conversations and
   messages on top of the same audited turn engine and evolved retrieval
   contract.
5. **F-07 - Focused RAG**
   Remains planned, but it must plug into the evolved retrieval-controls and
   traceability model instead of the old global-only page shell.

## Shared Product Decisions

- `/query` remains the single operator surface for question answering; there is
  no separate chat page.
- `POST /api/rag/ask` remains the base single-turn endpoint.
- The ask request grows with
  `retrieval?: { topK?: number; strategy?: "standard" | "explore" | "rerank" }`.
- Omitting `retrieval` must preserve F-03 behavior:
  `topK = 6`, `strategy = "standard"`.
- Allowed `topK` values are `3..12`.
- `strategy = "explore"` is always an explicit user choice; there is no hidden
  broad-question classifier in this sequence.
- Explore mode retrieves `candidateTopK = min(24, topK * 3)` candidates, then
  diversifies the selected context before generation.
- `strategy = "rerank"` is always an explicit user choice; there is no hidden
  reranking switch or automatic strategy promotion.
- Rerank mode retrieves `candidateTopK = min(24, topK * 3)` candidates, then
  applies a second-pass reranking stage and keeps the standard answer-synthesis
  prompt path.
- Explore mode remains the explicit varied/multi-perspective path; rerank
  remains the explicit precision-oriented path.
- From F-05 onward, successful single-turn answers expose a stable `traceId`.
- From F-05 onward, "top related tokens" means deterministic related
  terms/themes derived from the question plus retrieved excerpts, not raw model
  token attribution.
- From F-08 onward, reranked answers and persisted runs expose
  `rerankerProvider`, `rerankerModel`, reranking audit metrics, and source-
  level `retrievalScore` plus nullable `rerankScore`.
- From F-06 onward, every assistant chat turn reuses the same audited turn
  engine instead of introducing a second generation pipeline.

## Shared Invariants

- UI copy remains PT-BR by default.
- Specs and project docs remain in English.
- No raw prompts, secrets, stack traces, provider payloads, or hidden internal
  chain-of-thought data are exposed through UI or API responses.
- Provider-specific model calls stay behind the embedding, generation, and
  reranking interfaces.
- The agents layer must not become a dependency of the base `/query` flow.
- Later `/query` features must reuse the evolved retrieval-controls, reranking,
  and trace model rather than restoring earlier pre-rerank assumptions.

## Cross-Feature Interface Notes

- F-04 owns retrieval controls and the explicit explore strategy.
- F-05 owns trace persistence, related terms, usage/cost capture, and audit
  inspection endpoints.
- F-08 owns the explicit rerank strategy, reranking-provider boundary,
  reranking failure vocabulary, and the additional audit/source metadata needed
  to govern second-pass selection.
- F-06 owns conversations, messages, and transcript reload while reusing the
  F-04/F-05/F-08 turn contract.
- F-07 must later extend the evolved request/response model instead of
  replacing it.
