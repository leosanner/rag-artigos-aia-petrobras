# F-05 Block 05 - Integration and Review

## Goal

Close F-05 as an implemented vertical now that Blocks 01-04 have landed: verify
deterministic related terms, audited single-turn persistence, provider
usage/cost capture, audit read endpoints, `/query` inspection behavior, doc
sync, and the required independent-review handoff.

## Scope

**In scope:**

- Final closeout of F-05 as an implemented vertical: domain helpers, trace
  schema/repositories, audited ask orchestration, ask/audit routes, and
  `/query`.
- End-to-end verification using real Postgres for repository behavior and fake
  providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details shift
  during Blocks 01-04.
- Project-doc updates only if the F-05 contract changes materially during
  implementation.
- Review-packet preparation for the required independent review workflow.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- F-06 conversations, F-07 focused retrieval, streaming transport, or agentic
  workflows.
- Any new ask input controls beyond the F-04 request contract.

## Business Rules

- RN-B05-01: Block 05 uses the implemented code and tests as the source of
  truth for F-05. It does not add new product behavior.
- RN-B05-02: Verification must explicitly prove every authorized, schema-valid
  ask attempt persists exactly one governed run record.
- RN-B05-03: Verification must explicitly prove unauthorized and invalid ask
  requests are not persisted.
- RN-B05-04: Verification must explicitly prove related-term extraction is
  deterministic, capped at 8, and falls back to question-only input when no
  sources exist.
- RN-B05-05: Verification must explicitly prove successful ask responses expose
  `traceId`, `relatedTerms`, and audit metrics without requiring a second fetch
  for the current answer.
- RN-B05-06: Verification must explicitly prove safe technical failures remain
  sanitized externally while persisting internal failure traces.
- RN-B05-07: Verification must explicitly prove recent-run and run-detail reads
  are secret-protected and never expose raw prompts, secrets, stack traces, or
  raw provider payloads.
- RN-B05-08: The independent reviewer must receive a fresh thread with only the
  relevant F-05 diff, docs, and verification summary, not the implementation
  conversation history.

## Functional Requirements

- [x] RF-B05-01: Domain tests prove deterministic related-term extraction,
  stable ranking, cap-at-8 behavior, question-only fallback, and the closed
  safe status/error vocabulary.
- [x] RF-B05-02: Repository tests prove transactional run creation, immutable
  source snapshots, related-term persistence, reverse-chronological listing,
  and run-detail reads against real Postgres.
- [x] RF-B05-03: Application tests prove normalized provider usage/cost
  metadata, total-latency capture, success/no-evidence/failure persistence, and
  unchanged safe error mapping.
- [x] RF-B05-04: Ask-route tests prove the expanded success body includes
  `traceId`, `relatedTerms`, and `audit`, while invalid and unauthorized
  requests remain unpersisted.
- [x] RF-B05-05: Audit-route tests prove recent-run and detail reads require
  the bearer secret, validate ids, and return only sanitized bodies.
- [x] RF-B05-06: UI tests prove `/query` renders the current answer audit panel
  from the successful ask response and can inspect a persisted past run from the
  recent-runs list.
- [x] RF-B05-07: The parent `spec.md` and all F-05 block docs are synced to the
  implemented behavior before the feature is considered complete.
- [x] RF-B05-08: Project docs are updated only if the implementation materially
  changes the F-05 contract.
- [x] RF-B05-09: The closeout records the exact verification commands and any
  environment-specific caveats discovered during final checks.

## Verification Plan

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- F-02, F-03, and F-04 paths must remain green before F-05 is considered
  closed.

### Commands To Run During Closeout

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Verification Record

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- F-02, F-03, and F-04 paths must remain green as part of the full repository
  checks.

### Commands run on 2026-04-23

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Results

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed with local Postgres running. The suite finished with `54`
  passing test files and `364` passing tests.
- The project test script prepared `aia_insight_test` and applied migrations
  before running Vitest.
- Fresh independent reviews on new Codex threads identified four closeout
  issues during implementation closeout: missing sanitized `500` audit-read
  responses, stale persisted-history state after audit-read `401` responses in
  `/query`, a missing persisted-run path for retrieval/embedding failures after
  ask validation, and a stale Block 04 route contract. All four issues were
  fixed before the final verification run.
- No additional project-contract docs were updated because the implementation
  did not materially change the F-05 behavior. The only project-doc changes in
  this closeout are the F-05 bookkeeping updates in `STATE.md` and
  `CHANGELOG.md`.
- No `pnpm build` check was required for F-05 Block 05. The parent F-05
  contract closes on `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Reviewer Handoff Packet

Provide the reviewer with:

- The committed F-05 implementation diff from `git diff 48d9059..HEAD`.
- Any uncommitted closeout doc diff after spec-sync edits land.
- `.specs/features/F-05-answer-traceability/spec.md`
- `.specs/features/F-05-answer-traceability/01-domain-related-terms-and-trace-status.md`
- `.specs/features/F-05-answer-traceability/02-persistence-query-run-traces-and-audit-reads.md`
- `.specs/features/F-05-answer-traceability/03-application-audited-ask-flow-and-provider-metrics.md`
- `.specs/features/F-05-answer-traceability/04-interface-api-audit-endpoints-and-query-page.md`
- `.specs/features/F-05-answer-traceability/05-integration-and-review.md`
- A short verification summary listing the exact commands run and their
  results.

Suggested reviewer prompt:

> Review the current F-05 / Answer Traceability implementation against the
> attached implementation diff plus any closeout doc diff, together with
> `spec.md` and blocks 01-05 only. Prioritize the invariant that every
> authorized, schema-valid ask attempt persists exactly one governed run,
> deterministic related-term extraction, immutable source snapshots, normalized
> usage/cost capture, unchanged sanitized error behavior from F-03/F-04, and
> whether any F-06/F-07 scope leaked into F-05. Flag any mismatch between the
> implementation and the synced docs.

Run the review on a fresh independent thread with only the packet above in
context; do not reuse the implementation conversation history.

## Done When

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass during closeout.
- The F-05 overview and block docs match the implemented behavior.
- A fresh independent review packet is ready without implementation-thread
  contamination.
