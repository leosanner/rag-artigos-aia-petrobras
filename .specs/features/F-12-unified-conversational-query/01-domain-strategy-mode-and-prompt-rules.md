# F-12 Block 01 — Domain: Strategy/Mode Rules, Prompt History, Conversation Immutability

## Goal

Lock the pure domain rules that the rest of F-12 builds on: which strategies
are valid in which conversation mode, how `explore` turns participate (or do
not) in subsequent prompt assembly, and which conversation fields are
immutable for the lifetime of a conversation. No persistence, application
service, or UI work in this block.

## Scope

**In scope:**

- A pure validator `isStrategyAllowedForMode(mode, strategy)` (and inverse
  predicates) encoding RN-03: `focused → standard only`,
  `global → standard | explore | rerank`.
- A pure helper `filterPromptHistory(messages)` that drops assistant turns
  whose backing `query_run.strategy === "explore"` and their corresponding
  user prompts when assembling LLM context. Pure function over a list of
  message-with-trace projections.
- Constants module re-exporting (or re-asserting) the F-08 default values
  `RAG_RETRIEVAL_DEFAULT_TOP_K = 6` and `RAG_RERANK_DEFAULT_CANDIDATE_TOP_K = 24`,
  used as the canonical defaults for the F-12 composer and the application
  layer. No new value introduced.
- Domain-level invariant assertion helpers for conversation immutability:
  `assertConversationModeImmutable(prev, next)` and
  `assertConversationDocumentImmutable(prev, next)` that throw a typed
  error if `mode` or `documentId` would change between two conversation
  snapshots.

**Out of scope:**

- SQL constraints, FK cascade rules, migrations — Block 02.
- Application orchestration, request schemas, stream events — Block 03.
- Routes, page rewrite, UI components — Block 04.
- Any change to the `RagRetrievalStrategy` union itself (already complete in
  F-08).

## Applicable Parent Rules

| Rule | Statement | This block |
|------|-----------|------------|
| RN-02 | Strategy is per-turn. | Validator scoped per-turn input. |
| RN-03 | Focused conversations accept only `standard`. | `isStrategyAllowedForMode` enforces. |
| RN-04 | `mode` and `documentId` immutable per conversation. | Pure assertion helpers. |
| RN-06 | Explore turns excluded from prompt history. | Pure filter over message list. |
| INV-03, INV-04, INV-05 | Strategy/mode coherence, conversation immutability, explore non-generative. | Encoded as throws on violation in the helpers. |

## Tasks (TDD-first)

1. Write unit tests in `src/domain/rag/conversation-rules.test.ts` for
   `isStrategyAllowedForMode` covering every (mode, strategy) pair.
2. Implement `src/domain/rag/conversation-rules.ts`.
3. Write unit tests for `filterPromptHistory` over fixtures with mixed
   strategies (no explore, only explore, alternating, last-turn explore).
4. Implement the filter in the same module or a sibling
   `prompt-history.ts`.
5. Write unit tests for the immutability assertion helpers (happy path,
   mode change, documentId change null↔uuid, both change).
6. Implement the assertion helpers.

## Acceptance

- All new unit tests pass under `pnpm test`.
- No imports from `application`, `infrastructure`, or `app` directories.
- `pnpm typecheck` clean with `strict` settings.

## Out of band

If during this block the team discovers that an existing query path silently
mutates `conversation.mode` or `conversation.documentId`, **stop and surface
that** before continuing — INV-04 implies that path is already a defect.
