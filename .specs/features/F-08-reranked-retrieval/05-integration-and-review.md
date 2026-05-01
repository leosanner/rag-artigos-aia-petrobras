# F-08 Block 05 - Integration and Review

## Goal

Close F-08 as an implemented vertical after Blocks 01-04 land: verify the
global single-turn rerank path end to end, confirm standard and explore remain
stable, sync the F-08 docs, record the required follow-up hooks for adjacent
`/query` features, and prepare the fresh-reviewer packet required by the repo
workflow.

## Scope

**In scope:**

- Final closeout of the F-08 contract: domain, persistence, application,
  ask/query-run interface, and the global single-turn rerank controls on
  `/query`.
- End-to-end verification with real Postgres for trace persistence and fake
  providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details shift
  during Blocks 01-04.
- Follow-up bookkeeping for F-06, F-07, and F-10 after the shared rerank
  contract lands.
- Review-packet preparation for the required independent-review workflow.

**Out of scope:**

- Conversation-route rerank support, focused rerank support, or streaming rerank
  transport as product behavior in this block.
- Choosing or benchmarking reranker vendors.
- Any unrelated roadmap reprioritization outside the F-08 contract.

## Business Rules

- RN-B05-01: Block 05 uses the implemented code and tests as the source of
  truth for F-08; it does not add new product behavior.
- RN-B05-02: Verification must explicitly cover rerank success, rerank
  no-evidence short-circuit, `reranking_failed`, `reranking_unavailable`, and
  regression of `standard` and `explore`.
- RN-B05-03: Verification must prove reranking failures persist governed failed
  runs and never call the generation provider.
- RN-B05-04: Verification must prove persisted sources now expose
  `retrievalScore` plus nullable `rerankScore`, not the old ambiguous `score`
  field.
- RN-B05-05: Block 05 must reopen the deferred focused-rerank verification hook
  recorded in F-07 Block 05 once F-08 lands.
- RN-B05-06: Block 05 must record that F-06 and F-10 need later spec-sync or
  verification updates when rerank is enabled on conversation and streaming
  surfaces.
- RN-B05-07: The independent reviewer must receive a fresh thread with only the
  F-08 docs, the relevant diff, and the verification summary.

## Functional Requirements

- [x] RF-B05-01: The parent `spec.md` remains the authoritative contract and
  reflects the closeout refinements discovered during implementation,
  including the concrete Cohere runtime, env contract, and acceptance-criteria
  evidence pointers. Synced on 2026-04-30.
- [x] RF-B05-02: End-to-end verification exercises one successful global rerank
  ask that persists reranker metadata, reranking audit, `retrievalScore`, and
  `rerankScore`. Covered by
  `src/app/api/rag/reranked-retrieval.integration.test.ts` scenario 1.
- [x] RF-B05-03: End-to-end verification exercises one rerank ask whose
  first-pass retrieval returns zero candidates and proves the reranker is not
  called. Covered by
  `src/app/api/rag/reranked-retrieval.integration.test.ts` scenario 2.
- [x] RF-B05-04: End-to-end verification exercises one rerank ask that returns
  safe `reranking_failed` and proves generation is skipped. Covered by
  `src/app/api/rag/reranked-retrieval.integration.test.ts` scenario 3.
- [x] RF-B05-05: End-to-end verification exercises one rerank ask that returns
  safe `reranking_unavailable` and proves generation is skipped. Covered by
  `src/app/api/rag/reranked-retrieval.integration.test.ts` scenario 4.
- [x] RF-B05-06: Regression verification proves existing `standard` and
  `explore` ask paths, query-run reads, and `/query` controls still behave as
  documented. Covered by
  `src/app/api/rag/reranked-retrieval.integration.test.ts` scenario 5 plus
  the pre-existing `/query` and query-run handler tests.
- [x] RF-B05-07: The acceptance-criteria checklist from `spec.md`
  `## Acceptance Criteria` is mapped 1-to-1 to verification evidence inline in
  the parent spec.
- [x] RF-B05-08: `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass. Recorded
  below in `## Verification Record`.
- [x] RF-B05-09: The F-07 Block 05 deferred focused-rerank sub-step is reopened
  with a concrete note pointing back to the F-08 landing proof while keeping
  focused rerank as explicit follow-up scope.
- [x] RF-B05-10: A follow-up note is recorded for F-06 and F-10 stating that
  conversation and streaming surfaces still need dedicated rerank adoption and
  verification beyond the global single-turn path.
- [x] RF-B05-11: A fresh independent review handoff is prepared using
  `spec.md`, Blocks 01-05, the implementation diff, and the verification
  summary only. The packet is ready below; the actual fresh-thread review is
  still pending.

## Rule Traceability

| Spec item | Owning block | Verification artifact |
|---|---|---|
| RN-01, RN-02, RN-03 | Block 01 + Block 04 | Domain retrieval-settings tests plus ask-handler validation tests |
| RN-04 | Block 01 + Block 04 | Page control tests and ask-request regression tests |
| RN-05, RN-06, RN-07, RN-08 | Block 01 + Block 03 | Retrieve-chunks and reranking domain or application tests |
| RN-09, RN-10 | Block 03 | Answer-question and generation-provider tests |
| RN-11, RN-12, RN-13 | Block 02 + Block 03 + Block 04 | Repository tests plus DTO-serialization tests |
| RN-14, RN-15 | Block 01 + Block 03 + Block 04 | Answer-question failure tests plus ask-handler status mapping tests |
| RN-16 | Block 04 + Block 05 | `/query` page tests and follow-up notes for F-06/F-07/F-10 |
| RF-01, RF-02 | Block 01 + Block 04 | Retrieval-settings tests and ask-handler validation tests |
| RF-03, RF-04, RF-05, RF-06, RF-07 | Block 03 | Retrieve-chunks and answer-question tests |
| RF-08, RF-09, RF-10, RF-11 | Block 02 + Block 03 + Block 04 | Repository tests, application tests, query-run DTO tests |
| RF-12 | Block 03 + Block 04 | Answer-question failure persistence tests plus ask-handler safe status mapping tests |
| RF-13, RF-14 | Block 04 | `/query` page tests and query-run handler tests |
| RF-15 | Block 04 | DTO validation and UI safe-rendering tests |
| INV-01, INV-03 | Block 01 + Block 04 | Domain or page tests proving rerank is explicit and explore remains unchanged |
| INV-02 | Block 01 + Block 03 | Rerank invariant tests plus invalid-output application tests |
| INV-04 | Block 03 | Generation-provider prompt-branch tests |
| INV-05 | Block 03 + Block 05 | Answer-question failure tests and end-to-end rerank-failure proof |
| INV-06 | Block 01 + Block 02 + Block 04 | Domain type tests, repository readback tests, DTO-schema tests |
| INV-07 | Block 02 + Block 04 | Repository-column audit tests plus handler or page safe-rendering tests |
| INV-08 | Block 03 | Port-boundary inspection and adapter tests |

## Verification Steps

1. Run the domain tests for retrieval settings, rerank invariants, and
   expanded safe status or error vocabulary.
2. Run repository tests proving the renamed source-score column, rerank-aware
   run rows, and legacy readback behavior against real Postgres.
3. Run application tests proving zero-candidate short-circuit, one-call
   reranker success, invalid rerank output handling, and rerank failure
   generation gating.
4. Run ask/query-run handler tests plus `/query` page tests for rerank-aware
   DTOs and global single-turn controls.
5. Run one composed integration probe with real Postgres plus fake providers:
   rerank success, rerank no-evidence, reranking failure, reranking
   unavailable, and standard/explore regression.
6. Run `pnpm lint`.
7. Run `pnpm typecheck`.
8. Run `pnpm test`.
9. Reopen the deferred F-07 focused-rerank verification note and record the
   follow-up hooks for F-06 and F-10.
10. Bundle the review packet and hand it off on a fresh independent thread.

## Verification Record

### Commands run on 2026-04-30

```bash
pnpm vitest run src/infrastructure/ai/cohere-reranking-provider.test.ts src/env/server.test.ts src/application/rag/retrieve-chunks.test.ts src/application/rag/answer-question.test.ts src/app/api/rag/ask/handler.test.ts src/app/query/page.test.tsx src/app/api/rag/reranked-retrieval.integration.test.ts
pnpm lint
pnpm typecheck
pnpm test
```

### Results

- The targeted rerank closeout suite passed with `7` passing test files and
  `119` passing tests.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed with `78` passing test files and `578` passing tests.
- The new real-Postgres integration probe proves rerank success, zero-candidate
  short-circuit, safe `reranking_failed`, safe `reranking_unavailable`, and
  `standard`/`explore` regression through the public ask and query-run detail
  handlers.
- `/query` rerank controls and safe audit rendering remain covered by the
  existing page suite; focused and conversation request schemas still reject
  rerank by design and are now called out explicitly as follow-up scope.

## Reviewer Handoff Packet

Provide the reviewer with:

- The committed F-08 implementation diff against the branch base.
- Any uncommitted closeout doc diff after the final spec-sync edits land.
- `.specs/features/F-08-reranked-retrieval/spec.md`
- `.specs/features/F-08-reranked-retrieval/01-domain-rerank-contract-and-failures.md`
- `.specs/features/F-08-reranked-retrieval/02-persistence-rerank-traces-and-source-scores.md`
- `.specs/features/F-08-reranked-retrieval/03-application-rerank-orchestration-and-provider-boundary.md`
- `.specs/features/F-08-reranked-retrieval/04-interface-ask-query-runs-and-query-page.md`
- `.specs/features/F-08-reranked-retrieval/05-integration-and-review.md`
- A short verification summary listing the exact closeout commands and results.

Suggested reviewer prompt:

> Review the current F-08 / Reranked Retrieval implementation against the
> attached implementation diff plus any closeout doc diff, together with
> `spec.md` and Blocks 01-05 only. Prioritize the invariants that rerank is
> always explicit, the reranker can only reorder or downselect first-pass
> candidates, generation never runs after rerank failure, source evidence is
> split into `retrievalScore` and nullable `rerankScore`, and conversation or
> streaming surfaces were not widened accidentally. Flag any mismatch between
> implementation and synced docs.

Run the review on a fresh independent thread with only the packet above in
context; do not reuse the implementation conversation history.

## Done When

- All verification steps pass.
- The F-08 parent and block docs match the implemented behavior.
- The follow-up hooks for F-06, F-07, and F-10 are recorded instead of being
  silently skipped.
- A fresh independent review packet is ready without implementation-thread
  contamination.
