# F-10 Block 05 - Integration and Review

## Goal

Close F-10 as an implemented vertical after Blocks 01-04 land: prove the new
SSE transport works end to end, prove the final transcript reload still depends
only on persisted rows and traces, sync the feature/project docs, and prepare
the fresh-reviewer handoff required by the repo workflow.

## Scope

**In scope:**

- Final closeout of F-10 as an implemented vertical: streamed application
  events, OpenAI streaming adapter, SSE conversation route, and `/query`
  streaming UX.
- End-to-end verification using real Postgres for transcript/run persistence
  and fake providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details shifted
  during Blocks 01-04.
- Project-doc updates required by the new streaming contract.
- Review-packet preparation for the required independent-review workflow.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- Streaming on `POST /api/rag/ask`, reconnect/resume semantics, partial
  persistence, or inline citation clicks.
- Any unrelated milestone reprioritization outside the F-10 contract.

## Business Rules

- RN-B05-01: Block 05 uses the implemented code and tests as the source of
  truth for F-10; it does not add new product behavior.
- RN-B05-02: Verification must explicitly prove that SSE success ordering is
  `user_message_created -> phase -> source* -> phase? -> answer_delta* -> done`
  depending on whether sources/generation exist.
- RN-B05-03: Verification must explicitly prove that failed streamed turns
  persist the governed failed run but do not create an assistant transcript
  row.
- RN-B05-04: Verification must explicitly prove that JSON fallback on
  `POST /api/rag/conversations/:id/messages` remains intact for non-stream
  clients.
- RN-B05-05: Verification must explicitly prove that `/query` renders live
  source progress and live answer deltas without a second success fetch.
- RN-B05-06: The independent reviewer must receive a fresh thread with only the
  F-10 docs, the relevant diff, and the verification summary.

## Functional Requirements

- [x] RF-B05-01: Application tests prove streamed event ordering, no-evidence
  completion without deltas, citation validation after final accumulation, safe
  focused rejection, and safe generation-failure persistence.
- [x] RF-B05-02: Provider tests prove streamed delta forwarding, final answer
  accumulation, normalized usage/cost output, empty-answer rejection, and safe
  streamed failure classification.
- [x] RF-B05-03: Route tests prove content negotiation, SSE headers, pre-stream
  `401`/`400`/`404` behavior, JSON fallback preservation, and mid-stream safe
  `error` event mapping.
- [x] RF-B05-04: `/query` tests prove immediate user append, live source
  progress, token-by-token answer rendering, final trace hydration, and safe
  streamed failure UX.
- [x] RF-B05-05: One integration test proves a successful streamed conversation
  turn completes and reloads as a persisted assistant transcript row with its
  governed trace.
- [x] RF-B05-06: One integration test proves a failed streamed conversation
  turn persists the failed run while leaving the conversation transcript with
  only the persisted user row.
- [x] RF-B05-07: The parent `spec.md`, all five F-10 block docs, and the
  required project docs are synced to the implemented behavior.
- [ ] RF-B05-08: An independent review is opened with a fresh reviewer thread,
  using only the F-10 docs, the implementation diff, and the verification
  summary. This remains pending until the user runs that separate reviewer
  handoff.

## Verification Plan

### Commands To Run During Closeout

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Verification Record

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- The existing conversation, focused, and query-history paths must remain green
  as part of the full repository checks.

### Commands run on 2026-04-28

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Results

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed with `73` passing test files and `520` passing tests.
- Focused streaming coverage is carried by
  `src/application/rag/stream-conversation-message.test.ts`,
  `src/app/api/rag/conversations/[id]/messages/handler.test.ts`,
  `src/app/query/page.test.tsx`, and
  `src/app/api/rag/streaming-query.integration.test.ts`, which together prove
  event ordering, safe error mapping, live UX, and persisted reload behavior.
- The new SSE integration test uses real Postgres plus real route wiring and
  confirms both the success reload path and the failed-run-without-assistant
  invariant.
- `POST /api/rag/ask` remained untouched by the streaming transport change and
  continues to use its JSON contract.

## Reviewer Handoff Packet

- Follow-up note after F-08: the streaming conversation transport still
  inherits the public conversation retrieval contract from F-06, so
  `POST /api/rag/conversations/:id/messages` does not yet expose
  `retrievalSettings.strategy = "rerank"`. Enabling rerank on the SSE path
  remains a dedicated follow-up that must widen the request DTOs, preserve the
  current event guarantees, and rerun the F-10 closeout verification.

Provide the reviewer with:

- The committed F-10 implementation diff against the branch base.
- Any uncommitted closeout doc diff after the final spec-sync edits land.
- `.specs/features/F-10-streaming-query-ux/spec.md`
- `.specs/features/F-10-streaming-query-ux/01-application-streamed-turn-and-events.md`
- `.specs/features/F-10-streaming-query-ux/02-infrastructure-openai-streaming.md`
- `.specs/features/F-10-streaming-query-ux/03-interface-sse-conversation-route.md`
- `.specs/features/F-10-streaming-query-ux/04-interface-streaming-query-page.md`
- `.specs/features/F-10-streaming-query-ux/05-integration-and-review.md`
- A short verification summary listing the exact closeout commands and results.

Suggested reviewer prompt:

> Review the current F-10 / Streaming Query UX implementation against the
> attached implementation diff plus any closeout doc diff, together with
> `spec.md` and blocks 01-05 only. Prioritize the invariants that the streamed
> path reuses the existing audited turn engine, that only final selected
> sources are shown live, that no assistant transcript row is persisted before
> final trace persistence/citation validation, that mid-stream failures stay
> safe under HTTP 200 SSE `error` events, and that `/query` renders live
> progress without weakening the persisted reload model. Flag any mismatch
> between implementation and synced docs.

Run the review on a fresh independent thread with only the packet above in
context; do not reuse the implementation conversation history.

## Done When

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass during closeout.
- The F-10 overview and block docs match the implemented behavior.
- The required project docs are updated for the new streaming contract.
- A fresh independent review packet is ready without implementation-thread
  contamination.
