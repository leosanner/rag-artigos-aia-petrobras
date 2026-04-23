# F-04 Block 05 - Integration and Review

## Goal

Close F-04 as an implemented vertical after Blocks 01-04 land: verify request
validation, strategy-aware retrieval, deterministic explore diversification,
prompt branching, API/UI behavior, doc sync, and the required independent
review handoff.

## Scope

**In scope:**

- Final closeout of F-04 as an implemented vertical: domain helpers,
  repository retrieval, application orchestration, ask route, and `/query`.
- End-to-end verification using real Postgres for repository retrieval and fake
  providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details shift
  during Blocks 01-04.
- Project-doc updates only if the F-04 contract changes materially during
  implementation.
- Review-packet preparation for the required independent review workflow.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- F-05 trace persistence, F-06 conversations, F-07 focused retrieval, or any
  observability-table work.
- Streaming, agentic planning, or changes to the base ask endpoint shape beyond
  the F-04 contract.

## Business Rules

- RN-B05-01: Block 05 uses the implemented code and tests as the source of
  truth for F-04. It does not add new product behavior.
- RN-B05-02: Verification must explicitly prove omitted retrieval settings
  preserve the F-03 defaults of `topK = 6` and `strategy = "standard"`.
- RN-B05-03: Verification must explicitly prove invalid retrieval input
  returns sanitized `invalid_request` responses.
- RN-B05-04: Verification must explicitly prove explore mode retrieves
  `candidateTopK = min(24, topK * 3)` candidates, then applies deterministic
  diversified downselection before generation.
- RN-B05-05: Verification must explicitly prove explore prompting requests
  `2..4` cited perspectives without weakening F-03 citation validation.
- RN-B05-06: Verification must explicitly prove `/query` keeps the secret in
  the current tab so the same question can be rerun in explore mode without
  retyping.
- RN-B05-07: The independent reviewer must receive a fresh thread with only the
  current diff, the F-04 docs, and the verification summary, not the
  implementation conversation history.

## Functional Requirements

- [x] RF-B05-01: Schema and route tests prove omitted retrieval settings remain
  backward-compatible with existing `{ question, mode: "global" }` clients.
- [x] RF-B05-02: Schema and route tests prove `topK < 3`, `topK > 12`,
  non-integer `topK`, and unknown retrieval fields fail with
  `invalid_request`.
- [x] RF-B05-03: Domain tests prove candidate-top-k bounds, deterministic
  diversification, two-chunks-per-document capping, and score-ordered
  backfill.
- [x] RF-B05-04: Repository and application tests prove standard mode skips
  diversification and explore mode fetches candidates before downselection.
- [x] RF-B05-05: Application tests prove the generation provider receives
  explore prompt branching that requests `2..4` cited perspectives.
- [x] RF-B05-06: Success-path tests prove response metadata includes applied
  `topK`, `retrievalStrategy`, and `candidateTopK`.
- [x] RF-B05-07: UI tests prove `/query` renders `topK` controls, exposes
  distinct standard and explore actions, and reruns with the stored secret.
- [x] RF-B05-08: The parent `spec.md` and all F-04 block docs are synced to the
  implemented behavior before the feature is considered complete.
- [x] RF-B05-09: Project docs are updated only if the implementation materially
  changes the F-04 contract.
- [x] RF-B05-10: The closeout records the exact verification commands and any
  environment-specific caveats discovered during final checks.

## Verification Plan

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- F-02 and F-03 code paths must remain green before F-04 is considered closed.

### Commands To Run During Closeout

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Verification Record

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- F-02 and F-03 paths must remain green as part of the full repository checks.

### Commands run on 2026-04-23

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### Results

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed with local Postgres running. The suite finished with `47`
  passing test files and `333` passing tests.
- The project test script prepared `aia_insight_test` and applied migrations
  before running Vitest.
- No additional project-contract docs were updated because the implementation
  did not materially change the F-04 behavior. The only project-doc changes in
  this closeout are the F-04 bookkeeping updates in `STATE.md` and
  `CHANGELOG.md`.
- No `pnpm build` check was required for F-04 Block 05. The parent F-04
  contract closes on `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Reviewer Handoff Packet

Provide the reviewer with:

- The committed F-04 implementation diff from `git diff 3a353b5..HEAD`.
- The uncommitted Block 05 closeout diff after the doc-sync edits land.
- `.specs/features/F-04-query-controls-and-explore/spec.md`
- `.specs/features/F-04-query-controls-and-explore/01-domain-retrieval-settings-and-diversification.md`
- `.specs/features/F-04-query-controls-and-explore/02-persistence-strategy-aware-retrieval.md`
- `.specs/features/F-04-query-controls-and-explore/03-application-retrieval-controls-and-prompting.md`
- `.specs/features/F-04-query-controls-and-explore/04-interface-api-and-query-page.md`
- `.specs/features/F-04-query-controls-and-explore/05-integration-and-review.md`
- A short verification summary listing the exact commands run and their
  results.

Suggested reviewer prompt:

> Review the current F-04 / Query Controls and Explore implementation against
> the attached implementation diff plus any closeout doc diff, together with
> `spec.md` and blocks 01-05 only. Prioritize
> invariant compliance for backward-compatible retrieval defaults, explicit
> explore activation, `candidateTopK <= 24`, deterministic diversification,
> unchanged safe citation/error behavior from F-03, and whether any F-05/F-06/
> F-07 scope leaked into F-04. Flag any mismatch between the implementation and
> the synced docs.

The review remains pending until a fresh independent reviewer confirms the
feature on a new thread with only the packet above in context.
