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
- persistent audit/governance data for each answer;
- a conversational operator experience that keeps the same traceability model.

Because of that, the assumption that F-04 is the immediate next extension of
`/query` is now superseded.

## Delivery Sequence

1. **F-05 - Query Controls and Explore**
   Adds adjustable retrieval parameters to `POST /api/rag/ask` and to `/query`,
   plus an explicit explore strategy for broad questions.
2. **F-06 - Answer Traceability**
   Persists query runs, related terms, source snapshots, token usage, latency,
   and estimated costs. Adds audit inspection for the current answer and
   persisted runs.
3. **F-07 - Conversational Query**
   Keeps `/query` as the single operator surface and adds conversations and
   messages on top of the same audited turn engine.
4. **F-04 - Focused RAG**
   Remains planned, but it must plug into the evolved retrieval-controls and
   traceability model instead of the old global-only page shell.

## Shared Product Decisions

- `/query` remains the single operator surface for question answering; there is
  no separate chat page.
- `POST /api/rag/ask` remains the base single-turn endpoint.
- The ask request grows with
  `retrieval?: { topK?: number; strategy?: "standard" | "explore" }`.
- Omitting `retrieval` must preserve F-03 behavior:
  `topK = 6`, `strategy = "standard"`.
- Allowed `topK` values are `3..12`.
- `strategy = "explore"` is always an explicit user choice; there is no hidden
  broad-question classifier in this sequence.
- Explore mode retrieves `candidateTopK = min(24, topK * 3)` candidates, then
  diversifies the selected context before generation.
- From F-06 onward, successful single-turn answers expose a stable `traceId`.
- From F-06 onward, "top related tokens" means deterministic related
  terms/themes derived from the question plus retrieved excerpts, not raw model
  token attribution.
- From F-07 onward, every assistant chat turn reuses the same audited turn
  engine instead of introducing a second generation pipeline.

## Shared Invariants

- UI copy remains PT-BR by default.
- Specs and project docs remain in English.
- No raw prompts, secrets, stack traces, provider payloads, or hidden internal
  chain-of-thought data are exposed through UI or API responses.
- Provider-specific model calls stay behind the existing embedding and
  generation interfaces.
- The agents layer must not become a dependency of the base `/query` flow.
- Focused retrieval must later integrate with the new retrieval-controls and
  trace model rather than restoring the earlier global-only shell assumptions.

## Cross-Feature Interface Notes

- F-05 owns retrieval controls and the explicit explore strategy.
- F-06 owns trace persistence, related terms, usage/cost capture, and audit
  inspection endpoints.
- F-07 owns conversations, messages, and transcript reload while reusing the
  F-05/F-06 turn contract.
- F-04 must later extend the evolved request/response model instead of
  replacing it.
