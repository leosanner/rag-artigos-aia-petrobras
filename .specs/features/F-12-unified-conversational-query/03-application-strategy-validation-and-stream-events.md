# F-12 Block 03 — Application: Strategy Validation, Prompt Assembly, Stream Event Vocabulary

## Goal

Wire the F-12 domain rules through the application layer: tighten the
conversation message request schema to reject `(focused, explore | rerank)`,
filter `explore` turns out of prompt history before LLM generation, route
explore turns to the deterministic related-terms producer instead of LLM
generation, and extend `ragConversationStreamEventSchema` with explicit
phase events for reranked turns.

## Scope

**In scope:**

- Tighten `appendConversationMessageRequestSchema` (or its equivalent in
  `src/application/rag/schemas.ts`) so that submitting a conversation in
  `focused` mode with `strategy ∈ { explore, rerank }` returns a typed
  `invalid_request` error matching the existing failure shape. The
  conversation's `mode` is read from persistence, not the request.
- In the conversation turn orchestrator, call
  `filterPromptHistory(...)` (Block 01) before assembling the LLM prompt
  for `standard` and `rerank` turns. Add a unit test fixture exercising a
  three-turn sequence with an explore turn in the middle.
- Route `strategy === "explore"` turns through the existing F-04 explore
  producer. Persist the related-terms artifact as the assistant message
  content payload and the `query_run.related_terms` field. Skip LLM
  generation entirely; do not consume generation tokens.
- Extend `ragConversationStreamEventSchema` with rerank-phase events. Two
  acceptable shapes:
  - **(a)** Two new event types `rerank_started` and `rerank_completed`,
    each with timestamps and a payload identifying the reranker provider.
  - **(b)** A single discriminated event `phase` with values
    `retrieval_started | retrieval_completed | rerank_started | rerank_completed | generation_started`.
  Block 03 chooses (a) for incremental compatibility (existing clients
  ignore unknown events). Document the choice inline.
- Emit a `related_terms` event for explore turns containing the artifact
  payload, followed by `message_completed`. No token deltas.

**Out of scope:**

- Domain validators (Block 01) and persistence shapes (Block 02).
- UI rendering (Block 04).

## Applicable Parent Rules

| Rule | Statement | This block |
|------|-----------|------------|
| RN-03 / RF-13 | Focused rejects non-standard strategies. | Schema tightening + integration test. |
| RN-05 / INV-05 | Explore is non-generative; excluded from prompt history. | Orchestrator branch + filter call. |
| RN-07 / INV-06 | Default `topK = 6`, `candidateTopK = 24`. | Application uses Block-01 constants for fallbacks. |
| RF-06 | Stream event vocabulary surfaces rerank phase. | Schema extension. |

## Tasks (TDD-first)

1. Write a schema test covering the four invalid `(focused, strategy)`
   pairs and the valid pair. Implement the tightening.
2. Write an orchestrator integration test (mocked retrieval/generation
   ports) confirming explore turns skip LLM generation, persist the
   artifact, and do not appear in the prompt for the next turn.
3. Write a streaming integration test for a `rerank` turn, asserting the
   ordered emission of `message_started → rerank_started → rerank_completed → token deltas → message_completed`.
4. Write a streaming integration test for an `explore` turn, asserting
   `message_started → related_terms → message_completed` and zero token
   deltas.
5. Implement the schema and orchestrator changes to make the tests pass.

## Acceptance

- All tests pass under `pnpm test`.
- No regression in `src/app/api/rag/streaming-query.integration.test.ts`
  (existing F-10 coverage).
- Stream-event schema change is additive; old clients still parse the
  stream successfully.

## Out of band

If the existing orchestrator already invokes the explore producer for
`strategy === "explore"` (likely, since F-04 + F-06 already shipped), the
Block-03 work for explore reduces to: confirm the artifact is persisted as
content and verify prompt-history filtering in follow-ups. Do not duplicate
existing wiring.
