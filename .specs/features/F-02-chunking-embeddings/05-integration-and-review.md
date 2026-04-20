# F-02 Block 05 - Integration and Review

## Goal

Close F-02 as a coherent vertical: schema, chunking, embeddings, run
orchestration, Inngest, API, and `/indexacao` all work together, and the feature
is ready for independent review.

## Scope

**In scope:**

- End-to-end-ish integration tests with real Postgres and fake embeddings.
- Migration validation against local/test databases.
- Final full-suite verification.
- Parent `spec.md` sync, including the run-item success status clarification.
- Project changelog updates for spec/doc changes.
- Independent review handoff according to the repo workflow.

**Out of scope:**

- Retrieval/similarity search endpoints; those start in F-03.
- Answer generation, citations, source lists, question UI, or focused RAG.
- Full M3 observability for token/cost/latency.
- Mastra or any agents framework.

## Business Rules To Re-Prove

- RN-B05-01: Pending and failed documents are never indexed.
- RN-B05-02: Chunking uses `refined_text` only.
- RN-B05-03: Already-indexed documents are skipped with `force=false`.
- RN-B05-04: `force=true` replaces selected document chunks for the active config.
- RN-B05-05: Dimension mismatch leaves no partial retrieval-ready chunks.
- RN-B05-06: One failed document does not stop other documents.
- RN-B05-07: API responses never leak secrets or raw provider errors.
- RN-B05-08: `/indexacao` lets the operator complete the manual workflow without SQL/API tooling.

## Integration Scenarios

- [ ] S01: One processed document with non-empty `refined_text` becomes non-empty chunks with 3072-dimension embeddings.
- [ ] S02: Pending and failed documents are ignored in whole-corpus indexing.
- [ ] S03: A processed document with blank `refined_text` creates a failed item and no chunks.
- [ ] S04: Running the same scope twice with `force=false` increments `skippedCount` and creates no duplicate chunks.
- [ ] S05: Running with `force=true` replaces chunks for the selected document/config.
- [ ] S06: A mixed run with one provider failure and one valid document completes with accurate processed/failed/skipped counts.
- [ ] S07: Embedding dimension mismatch fails only the affected item and leaves no partial chunks.
- [ ] S08: API start/detail and UI polling work against the same persisted run records.

## Final Verification

Run, in this order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If any command fails because the local test database is missing or stopped,
start Postgres through the project workflow and rerun the failed command. Do not
mark F-02 complete until the full verification path passes.

## Spec Sync Checklist

- [ ] Parent `spec.md` links to all F-02 block documents.
- [ ] Parent `spec.md` clarifies that run items use `processed`, not `completed`.
- [ ] Parent `spec.md` functional checkboxes reflect the implemented state only after verification.
- [ ] `.specs/project/CHANGELOG.md` records documentation/spec changes.
- [ ] New AD is added only if implementation introduces a decision not already covered by AD-011.

## Review Handoff

When all checks pass, prepare the independent review context:

- Current git diff.
- `.specs/features/F-02-chunking-embeddings/spec.md`.
- These block documents.
- Verification output summary.

The reviewer should prioritize invariant violations, skipped/force semantics,
transaction safety around chunk replacement, provider error hygiene, and whether
F-02 accidentally drifts into F-03/F-04 scope.

## Done When

- All F-02 acceptance criteria in `spec.md` are satisfied.
- Full verification passes.
- The spec and block docs match the implemented behavior.
- F-02 is ready for the configured independent review step.
