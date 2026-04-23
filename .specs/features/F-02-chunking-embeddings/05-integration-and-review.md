# F-02 Block 05 - Integration and Review

## Scope

**In scope:**

- Final closeout of F-02 as an implemented vertical: chunking, embeddings,
  run orchestration, Inngest, API routes, and `/indexing`.
- End-to-end integration evidence using real Postgres and fake embeddings.
- Migration validation against the local and test databases.
- Final verification using `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `OPENAI_API_KEY=<non-empty> pnpm build`.
- Parent `spec.md` sync, including functional checkbox completion and the
  run-item status clarification.
- Block-doc sync for the implemented Block 03 contract.
- Project changelog updates for the closeout/spec-sync work.
- Review-packet preparation for the required independent review workflow.

**Out of scope:**

- Retrieval/similarity search endpoints; those start in F-03.
- Answer generation, citations, source lists, question UI, or focused RAG.
- Full M3 observability for token/cost/latency.
- Any new product-scope behavior change for F-02 beyond what the code and tests
  already implement.
- Mastra or any agents framework.

## Context & Motivation

Blocks 01-04 already delivered the implementation for F-02: deterministic
chunking, pgvector persistence, indexing services, OpenAI/Vercel AI SDK
embedding boundaries, Inngest wiring, protected API routes, and the Portuguese
operator page. Block 05 closes the feature in the same way F-01 Block 05 closed
ingestion: by turning the implementation into a documented, verified, and
review-ready vertical.

This closeout treats the implemented code and tests as the source of truth.
The goal is not to add more feature scope; it is to prove the current behavior,
sync the docs to that behavior, record the verification prerequisites and
results, and prepare the independent review handoff required by the repo
workflow in `CLAUDE.md` and `.specs/project/STATE.md`.

## Business Rules

Block-scoped rules. Inherited feature rules from
`.specs/features/F-02-chunking-embeddings/spec.md` are referenced in
parentheses.

- RN-B05-01: Block 05 uses the implemented code and existing tests as the
  source of truth for F-02. It does not introduce new product behavior.
- RN-B05-02: Whole-corpus indexing continues to select only documents whose
  persisted `status` is `processed` (inherits RN-01, INV-02).
- RN-B05-03: Chunking continues to read only `documents.refined_text`; blank
  `refined_text` fails the item with `refined_text_empty` after item creation
  rather than being prefiltered out (inherits RN-02, RN-03, INV-01).
- RN-B05-04: With `force = false`, already-indexed documents increment
  `skippedCount` only and create no `rag_indexing_run_items` rows (inherits
  RN-07).
- RN-B05-05: With `force = true`, selected documents are rebuilt through the
  same repository replacement path, and previous chunks remain intact if the
  replacement insertion fails (inherits RN-08, RN-11).
- RN-B05-06: A successful run item ends with `status = processed`; a successful
  run ends with `status = completed`. Run items never use `completed` as a
  status (inherits RF-02).
- RN-B05-07: Provider failures, dimension mismatches, chunking failures, blank
  `refined_text`, and persistence failures are recorded with safe indexing error
  codes and do not stop later selected documents (inherits RN-11, RN-12,
  INV-07).
- RN-B05-08: `/indexing`, `POST /api/rag/indexing/runs`,
  `GET /api/rag/indexing/runs/:id`, and `/api/inngest` remain within F-02 scope
  only. They must not drift into retrieval, answer generation, citations, or
  focused RAG (inherits parent Out of scope).
- RN-B05-09: The verification record must state the operational prerequisites:
  local Postgres on `127.0.0.1:5432` and a non-empty `OPENAI_API_KEY` for
  non-test build validation.
- RN-B05-10: The independent reviewer must receive a fresh thread with only the
  current diff, F-02 docs, and the verification summary, not the implementation
  conversation history (inherits repo workflow).

## Functional Requirements

Every RF below is satisfied by the current code and the recorded verification in
this block.

- [x] RF-B05-01: The integration test in
  `src/application/indexing/process-indexing-run.integration.test.ts` proves a
  mixed run end to end with one skipped indexed document, one successfully
  indexed document, one blank-`refined_text` failure, one embedding failure,
  and one ignored `pending` document against real Postgres and fake embeddings.
- [x] RF-B05-02: Unit tests in
  `src/application/indexing/process-indexing-run.test.ts` prove whole-corpus
  selection ignores `pending`/`failed` documents, missing targeted documents
  fail safely at the run level, and targeted non-indexable documents create
  failed items.
- [x] RF-B05-03: Unit tests in
  `src/application/indexing/process-indexing-run.test.ts` prove `force=false`
  skips already indexed documents via `skippedCount` only and `force=true`
  rebuilds the selected scope.
- [x] RF-B05-04: Repository tests in
  `src/repositories/document-chunks-repository.test.ts` prove pgvector
  persistence, config-scoped replacement, config-scoped deletion, and rollback
  safety when replacement insertion fails.
- [x] RF-B05-05: Route and UI tests in
  `src/app/api/rag/indexing/runs/handler.test.ts`,
  `src/app/api/rag/indexing/runs/[id]/handler.test.ts`, and
  `src/app/indexing/page.test.tsx` prove the manual workflow uses the same
  persisted run model and safe response contracts.
- [x] RF-B05-06: `/api/inngest` wiring is proven by
  `src/app/api/inngest/route.test.ts`, which asserts that the production route
  registers both F-01 ingestion and F-02 indexing handlers built from the real
  adapter composition.
- [x] RF-B05-07: Parent `spec.md` is synced to the implemented behavior,
  including the `rag_indexing_run_items` status clarification and completed
  feature RF checkboxes.
- [x] RF-B05-08: Block 03 is synced from a planned contract to an implemented
  contract by flipping its completed RFs and removing stale future-tense test
  notes.
- [x] RF-B05-09: `.specs/project/CHANGELOG.md` records the F-02 closeout and
  spec-sync work as a new unreleased entry.
- [x] RF-B05-10: The verification record captures both environment
  prerequisites and the exact command results used to close the feature.
- [x] RF-B05-11: The verification record explicitly states that
  `OPENAI_API_KEY=<non-empty> pnpm build` passes, while plain `pnpm build`
  currently fails with the workspace's current `.env.local` configuration,
  which omits `OPENAI_API_KEY`.
- [x] RF-B05-12: The review handoff defines the required context packet and a
  reviewer prompt focused on invariants, skip/force semantics, transaction
  safety, non-leak responses, and F-02 scope boundaries.

## System Flow

1. Blocks 01-04 provide the implementation surface for F-02: the hybrid
   chunker, indexing error catalog, repositories, indexing services, OpenAI
   embedding adapter, Inngest publisher/function, API routes, and `/indexing`.
2. The operator starts a run from `/indexing`, or the automated tests invoke the
   same services and route handlers directly.
3. `POST /api/rag/indexing/runs` validates the bearer secret and request body,
   calls `StartIndexingRun`, persists a queued run, and publishes
   `rag/indexing.requested`.
4. `/api/inngest` receives the indexing event and calls
   `ProcessIndexingRun.execute(runId)` using the production adapter wiring.
5. `ProcessIndexingRun` marks the run `processing`, loads the persisted
   `documentId` and `force` options, and selects either all processed documents
   in deterministic order or the targeted document.
6. If `force=false`, documents that already have chunks for the active
   chunking/embedding config increment `skippedCount` and create no run-item
   rows. If `force=true`, the selected documents continue through the rebuild
   path.
7. For each non-skipped selected document, the service creates a
   `rag_indexing_run_items` row with `status = processing`, validates that
   `refined_text` is non-empty, chunks it, requests embeddings, validates the
   embedding shape, and persists chunks atomically for that document/config.
8. On success, the run item becomes `processed` with `chunkCount`. On any
   per-item failure, the item becomes `failed` with a safe error code and the
   loop continues to later selected documents.
9. `GET /api/rag/indexing/runs/:id` and `/indexing` poll the persisted run plus
   item rows through the safe DTO returned by `GetIndexingRun`.
10. Block 05 reruns the verification commands, records the exact prerequisites
    and results, syncs the docs to the implemented behavior, updates the
    changelog, and prepares the independent review handoff.

## Invariants / Non-negotiables

- INV-B05-01: Block 05 must not redefine F-02 behavior to match stale docs. The
  docs must move toward the implementation, not the opposite.
- INV-B05-02: The closeout must preserve the core F-02 invariants already
  implemented: processed-only selection, refined-text-only chunking, one
  embedding per chunk, safe error normalization, and no answer-generation or
  agents dependency.
- INV-B05-03: `rag_indexing_run_items.status` must be documented everywhere in
  F-02 as `processing | processed | failed`; `completed` is reserved for the
  run row.
- INV-B05-04: The verification record must use exact commands and must not hide
  prerequisites or workspace-specific caveats such as the missing
  `OPENAI_API_KEY` in `.env.local`.
- INV-B05-05: The review packet must be sufficient for a fresh reviewer thread
  to inspect the feature without implementation-session context.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `ProcessIndexingRun` mixed-run proof | `runId`, `documentId`, `force`, `selectedCount`, `processedCount`, `failedCount`, `skippedCount` | Proven by unit coverage plus the real-Postgres integration test. |
| `rag_indexing_run_items` | `id`, `run_id`, `document_id`, `status`, `chunk_count`, `last_error` | `status` is `processing`, `processed`, or `failed`. Skipped documents create no item rows. |
| `document_chunks` replacement proof | `document_id`, `chunking_version`, `embedding_model`, `chunk_index`, `embedding` | Repository tests prove config-scoped replacement and rollback safety. |
| `IndexingRunDetailDto` | `id`, `status`, `documentId`, `force`, `selectedCount`, `processedCount`, `failedCount`, `skippedCount`, `lastError`, `items[]` | Shared safe DTO used by the detail route and `/indexing` polling. |
| `VerificationRecord` | `prerequisites`, `commands`, `results` | Documented below as the closeout evidence for this block. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/rag/indexing/runs` | Creates the queued indexing run used by both the operator page and route tests. |
| `GET` | `/api/rag/indexing/runs/:id` | Returns the safe polling DTO backed by persisted run/item rows. |
| `GET/POST/PUT` | `/api/inngest` | Registers both ingestion and indexing background functions in production wiring. |
| Function | `ProcessIndexingRun.execute(runId)` | Owns the per-run selection, skip/force, chunking, embedding, persistence, and aggregate-count flow. |
| Function | `DocumentChunksRepository.replaceDocumentChunks(input)` | Owns atomic per-document replacement and rollback safety. |

### Key Modules

- `src/application/indexing/process-indexing-run.ts` - core indexing orchestration whose behavior this block re-proves.
- `src/application/indexing/process-indexing-run.integration.test.ts` - real Postgres mixed-run proof with fake embeddings.
- `src/repositories/document-chunks-repository.test.ts` - pgvector persistence and rollback-safety proof.
- `src/app/api/rag/indexing/runs/handler.test.ts` - protected start route proof.
- `src/app/api/rag/indexing/runs/[id]/handler.test.ts` - safe detail-route proof.
- `src/app/indexing/page.test.tsx` - manual workflow/polling proof for the Portuguese operator page.
- `src/app/api/inngest/route.test.ts` - production wiring proof for ingestion plus indexing.
- `.specs/features/F-02-chunking-embeddings/spec.md` - parent contract synced in this closeout.

## Dependencies

- **Prerequisite features:** F-01 Document Ingestion plus F-02 Blocks 01-04.
- **External packages added:** None in Block 05. Closeout reuses the packages already introduced by prior F-02 blocks.
- **External services:** Local Postgres/pgvector for migration and repository/integration verification; OpenAI API env validation during non-test builds; Inngest wiring through the existing app route.
- **Environment variables:** `DATABASE_URL` for local migration validation, `INGESTION_SYNC_SECRET` for protected start-route coverage, and `OPENAI_API_KEY` for non-test build validation.

## Acceptance Criteria

1. The F-02 parent spec and block docs match the implemented behavior with no stale status names or planned-only wording left in Blocks 03 and 05.
2. The documentation explicitly records that run-item status is `processed`, not `completed`, and that skipped documents are represented only by `skippedCount`.
3. The closeout records the exact verification prerequisites and the outcomes of `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `OPENAI_API_KEY=<non-empty> pnpm build`.
4. The closeout records that plain `pnpm build` still fails with the current
   workspace `.env.local` configuration, while
   `OPENAI_API_KEY=<non-empty> pnpm build` passes, so the environment caveat is
   visible to the reviewer.
5. The review handoff is explicit enough for a fresh reviewer thread to inspect F-02 without needing the implementation conversation history.

## Verification Record

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- Non-test builds require a non-empty `OPENAI_API_KEY`.

### Commands run on 2026-04-21

```bash
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
OPENAI_API_KEY=test-openai-api-key pnpm build
```

### Results

- `pnpm db:migrate` passed against the local database.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed with local Postgres running. The suite finished with `37`
  passing test files and `242` passing tests. The project test script also
  prepared `aia_insight_test` and applied migrations before Vitest.
- `OPENAI_API_KEY=test-openai-api-key pnpm build` passed.
- Plain `pnpm build` currently fails with the workspace's current `.env.local`
  configuration, which omits `OPENAI_API_KEY`. The same build passes when a
  non-empty key is supplied explicitly. This is an environment-validation
  prerequisite, not an F-02 feature regression.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Use the implemented code/tests as the source of truth for Block 05 | Preserve the earlier planned wording and force the code/docs to meet it retroactively | The feature is already implemented; the closeout should eliminate stale documentation, not invent a second contract. |
| Record the `OPENAI_API_KEY` build prerequisite explicitly instead of weakening env validation | Relax `env/server.ts`; hide the caveat from the closeout | The missing key is a workspace setup issue, not an F-02 design problem. Making the prerequisite explicit is more honest and keeps env validation aligned with the production contract. |
| Keep Block 05 focused on verification, spec sync, and review prep | Add new F-02 behavior during closeout | The repo workflow requires a closeout/review step after implementation. Mixing new feature work into Block 05 would blur the contract and weaken the review handoff. |
| Prepare the review packet for a fresh reviewer thread with only the diff and F-02 docs | Reuse the implementation thread or omit block docs from the packet | The repo workflow explicitly requires an unbiased reviewer context. The reviewer needs the final docs and diff, not the implementation conversation. |

## Review Handoff

Prepare the independent review context from:

- Current git diff.
- `.specs/features/F-02-chunking-embeddings/spec.md`.
- `.specs/features/F-02-chunking-embeddings/01-domain-chunking-and-errors.md`.
- `.specs/features/F-02-chunking-embeddings/02-persistence-chunks-and-indexing-runs.md`.
- `.specs/features/F-02-chunking-embeddings/03-application-embedding-and-inngest.md`.
- `.specs/features/F-02-chunking-embeddings/04-interface-api-and-page.md`.
- `.specs/features/F-02-chunking-embeddings/05-integration-and-review.md`.
- The verification summary in this block.

Use a fresh reviewer thread and a prompt equivalent to:

```text
Review the current F-02 / Chunking and Embeddings implementation against the attached git diff plus spec.md and blocks 01-05 only. Prioritize invariant compliance (processed-only selection, refined_text-only chunking, no partial chunks), skip vs force semantics, transaction safety around chunk replacement, safe error hygiene / non-leak responses, and whether any F-03/F-07 scope leaked into F-02. Flag any mismatch between the implementation and the synced docs.
```

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
