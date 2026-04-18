# 05 - Integration and Review

## Goal

Prove the full F-01 flow end to end, then prepare the change for independent review.

## Scope

- Application orchestration for `StartIngestionRun`, `GetIngestionRun`, and `ProcessIngestionRun`.
- End-to-end integration with Drive mocked and Postgres real.
- Final verification against `spec.md`.
- Independent review handoff using the agreed spec-first workflow.

## Implementation Notes

- The integration test should use mocked Drive files and a small fixture PDF or extractor stub where appropriate.
- The test must prove the batch limit of 3 new documents.
- The test must prove existing `drive_file_id` values are skipped and not modified.
- The test must prove per-document failure isolation.
- The final run state must contain accurate selected, processed, failed, and skipped-existing counts.

## Tests First

- Application test for starting a run and enqueueing the Inngest event through a mocked event publisher.
- Application test for a no-new-documents run.
- Application test for mixed success/failure processing.
- Integration test with real Postgres for the full persistence path.

## Done When

- All F-01 acceptance criteria in `spec.md` are satisfied or explicitly marked deferred with user approval.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- The git diff plus `spec.md` are ready for independent review.
