# 05 - Integration and Review

## Goal

Prove the full F-01 flow end to end, then prepare the change for independent review.

## Scope

- Application orchestration for `ProcessIngestionRun` (Drive listing, filtering by existing `drive_file_id`, selection capped at `max_documents`, per-item extraction/refinement/persistence with failure isolation, final run completion).
- Wiring the real `ProcessIngestionRun` into the `/api/inngest` serve route, replacing the Block 04 placeholder handler.
- End-to-end integration with Drive mocked and Postgres real.
- Final verification against `spec.md`.
- Independent review handoff using the agreed spec-first workflow.

**Out of scope:** `StartIngestionRun` and `GetIngestionRun` (already delivered by Block 04), route handlers, Zod response schemas, the `/ingestion` page.

## Implementation Notes

- The integration test should use mocked Drive files and `assets/pdfs/article-example.pdf` as the controlled local fixture PDF, or an extractor stub where appropriate.
- The test must prove the batch limit of 3 new documents.
- The test must prove existing `drive_file_id` values are skipped and not modified.
- The test must prove per-document failure isolation.
- The final run state must contain accurate selected, processed, failed, and skipped-existing counts.

## Tests First

- Application test for a no-new-documents run.
- Application test for mixed success/failure processing through `ProcessIngestionRun`.
- Integration test with real Postgres for the full persistence path, starting from `ingestion/sync.requested` and ending at a completed run row plus the expected document rows.

## Done When

- All F-01 acceptance criteria in `spec.md` are satisfied or explicitly marked deferred with user approval.
- `/api/inngest` registers the real `ProcessIngestionRun` instead of the Block 04 placeholder.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- The git diff plus `spec.md` are ready for independent review.
