# F-01 Block 05 - Integration and Review

## Scope

**In scope:**
- `ProcessIngestionRun` application service that orchestrates the full ingestion pipeline for a single run id: mark the run `processing`, list Drive files, partition existing-vs-new candidates by `drive_file_id`, cap selection at the run's persisted `max_documents`, and process each selected file end-to-end with per-item failure isolation.
- Per-item lifecycle owned by the service: create the `ingestion_run_items` row, download the PDF, hash the bytes, create the `pending` document, extract `raw_text`, persist it, refine into `refined_text`, mark the document `processed`, and mark the run item `processed`. On any failure after the document exists, mark only that document and run item as `failed`; on any failure before the document exists after the run item is created, mark only the run item as `failed`.
- Run-level finalization: aggregate `selectedCount`, `processedCount`, `failedCount`, `skippedExistingCount` and call `completeRun`. If the Drive listing itself fails before any item is created, call `failRun` with a safe error code and exit cleanly.
- New `FileHasher` port and `Sha256FileHasher` implementation backed by `node:crypto`.
- New `pipelineVersion` constant module exposing the value persisted in `documents.pipeline_version`.
- New `drive_listing_failed` value added to the domain error catalog so the run-level Drive listing failure can be recorded with a safe code.
- Replacing the placeholder `ProcessIngestionRunHandler` in `src/app/api/inngest/route.ts` with the real `ProcessIngestionRun` wired to the production adapters (`GoogleDriveFileSource`, `UnpdfPdfExtractor`, `Sha256FileHasher`, `refineText`, `DocumentsRepository`, `IngestionRunsRepository`).
- Tests: application-level unit tests with fakes covering every RF and failure branch; one integration test against real Postgres using a mocked Drive source and a fixture PDF; a smoke check that `/api/inngest` registers the real handler instead of the placeholder.
- Final verification of every acceptance criterion in `.specs/features/F-01-document-ingestion/spec.md` and update of the parent spec checkboxes.

**Out of scope:**
- `StartIngestionRun` and `GetIngestionRun` (delivered in Block 04, see `.specs/features/F-01-document-ingestion/04-interface-api-and-page.md`).
- Route handlers, Zod response schemas, the `/ingestion` page, and the bearer-secret auth path (Block 04).
- Reprocessing failed documents through a manual endpoint or UI action (parent `spec.md` §Out of scope).
- Manual bibliographic metadata editing, document listing beyond the run progress view, manual PDF upload, non-PDF formats (parent `spec.md` §Out of scope).
- Automatic duplicate handling by content hash (parent RN-05, INV-07): the file hash is persisted for governance only.
- Chunking, embeddings, retrieval, generation, XAI, observability, agents.
- A separate retry/backoff strategy for individual items: per-item failure isolation is the only resilience F-01 promises.

## Context & Motivation

Blocks 01-04 cover everything except the orchestration that turns a queued ingestion run into actual `processed` (or `failed`) documents in Postgres. Block 04 deliberately wired a placeholder handler in `/api/inngest` (`AD-009`) so the route + page could ship while the heavier orchestration remained for this block. Without Block 05, the operator can start a run and watch it sit in `queued` forever.

Block 05 closes that loop. It also produces the artifacts the spec-first workflow (`AD-007`) requires for independent review: a final commit-ready git diff plus an up-to-date contract (this file + the parent `spec.md` with checkboxes flipped). The user will hand both to Codex through `codex:rescue` after Block 05 is merged.

This block makes the ingestion pipeline the first end-to-end vertical of the project, validating the layered architecture defined in `.specs/project/ARCHITECTURE.md` (interface → application → domain → infrastructure) and the Phase 1 operational rules in `phase1_pipeline_rules.md`.

## Business Rules

Block-scoped rules. Inherited rules from `.specs/features/F-01-document-ingestion/spec.md` are referenced in parentheses.

- RN-B05-01: `ProcessIngestionRun.execute(runId)` must transition the run `queued -> processing` before any Drive call (inherits parent RF-05).
- RN-B05-02: Only files that pass `isPdfCandidate` (MIME `application/pdf` or `.pdf` filename) participate in selection (inherits RN-02).
- RN-B05-03: Candidates whose `drive_file_id` already exists in `documents` are counted toward `skippedExistingCount` and never trigger a download, document creation, or run-item row (inherits RN-06, INV-06).
- RN-B05-04: At most the run's persisted `max_documents` new candidates are selected per run, taken in the order returned by `DriveFileSource.listFiles()` (inherits RN-07, INV-08).
- RN-B05-05: When the partitioning yields zero new candidates, the run completes with `selectedCount = processedCount = failedCount = 0` and `skippedExistingCount` reflecting the count of existing candidates seen (inherits RF-06).
- RN-B05-06: For each selected candidate, `ingestion_run_items` is created with `status = processing` *before* the Drive download begins, so failures during download still leave a row with `last_error` for the operator (inherits RN-11).
- RN-B05-07: A Drive download failure for a selected candidate is classified as `drive_download_failed`, recorded only on the run item (no document row is created), and processing continues with the next candidate (inherits RN-11, RF-10).
- RN-B05-08: The file hash persisted in `documents.file_hash` is the SHA-256 of the downloaded bytes, encoded as lowercase hex. It is for governance only and never used to deduplicate (inherits RN-05, INV-07).
- RN-B05-09: After a successful download and hash, `DocumentsRepository.createPendingDocument` is called with the Drive file name as `title`, `origin = "google_drive"`, the computed `fileHash`, and the configured `pipelineVersion`. Bibliographic fields stay null (inherits RN-03, RN-04, INV-05).
- RN-B05-10: Extraction failures (any thrown `IngestionError` from `PdfExtractor.extract`) mark the existing document as `failed` with the error's code, mark the run item `failed` with the same code carrying the document id, and skip refinement for that item (inherits RN-10, RF-08).
- RN-B05-11: Refinement failures (any thrown `IngestionError` from `refineText`) preserve the already persisted `raw_text`, mark the document `failed` with the error's code, mark the run item `failed`, and continue with the next item (inherits RN-10, RF-09).
- RN-B05-12: A successful selected candidate ends with `documents.markProcessed(docId, refinedText)` and `runsRepository.markRunItemProcessed(itemId, docId)` in this order; only after both succeed does the iteration move on (inherits RN-09, INV-03).
- RN-B05-13: Once every selected item has finished (success or per-item failure), `completeRun(runId, counts)` is called with the final aggregate counts and the run transitions to `completed`. The run never stays in `processing` after `execute` returns successfully (inherits RF-11).
- RN-B05-14: A `DriveFileSource.listFiles()` failure that occurs before any item is created is classified as `drive_listing_failed`, recorded on the run via `failRun`, and `execute` returns without throwing (inherits RN-11). No selected items, processed documents, or partial counts are written.
- RN-B05-15: The `pipelineVersion` value is the constant exported from `src/domain/documents/pipeline-version.ts` (`"f01-1.0.0"` in this block). It is not read from `process.env` and not configurable per request.
- RN-B05-16: Unexpected (non-`IngestionError`) errors from infrastructure are normalized through `toSafeErrorCode` (`"unknown_error"`) before being persisted, so raw provider stack traces never reach `documents.last_error` or `ingestion_run_items.last_error` (inherits parent INV-10, RN-B04-05).

## Functional Requirements

Every RF below has at least one dedicated test. Prefix `RF-B05-` to distinguish from feature-level RFs in `spec.md`.

**Application service - `ProcessIngestionRun`:**

- [x] RF-B05-01: `execute(runId)` calls `runsRepository.markProcessing(runId)` before any Drive call.
- [x] RF-B05-02: `execute(runId)` calls `driveSource.listFiles()` and filters to PDF candidates only. Non-PDF entries are dropped before existing-vs-new partitioning.
- [x] RF-B05-03: For every PDF candidate, `documentsRepository.existsByDriveFileId(driveFileId)` is consulted and existing matches are bucketed into `skippedExistingCount`.
- [x] RF-B05-04: New (non-existing) candidates are selected in `listFiles()` order until the run's persisted `max_documents` is reached; remaining new candidates are dropped.
- [x] RF-B05-05: When zero new candidates remain after filtering, the service completes the run with `selectedCount = processedCount = failedCount = 0` and the correct `skippedExistingCount`, without calling Drive download, the extractor, or the refiner.
- [x] RF-B05-06: For each selected candidate, `runsRepository.createRunItem({ runId, driveFileId, title })` is invoked before `driveSource.downloadFile`.
- [x] RF-B05-07: A `driveSource.downloadFile` failure is caught; `runsRepository.markRunItemFailed(itemId, { errorCode: "drive_download_failed" })` is called with no `documentId`; iteration continues; no document row is created for that candidate.
- [x] RF-B05-08: After a successful download, `hasher.hash(bytes)` is called and the resulting hex string is passed as `fileHash` to `documentsRepository.createPendingDocument`.
- [x] RF-B05-09: `documentsRepository.createPendingDocument` is invoked with `title = candidate.name`, `driveFileId = candidate.driveFileId`, `fileHash`, and `pipelineVersion = deps.pipelineVersion`.
- [x] RF-B05-10: A `pdfExtractor.extract` failure marks the document `failed` (`documentsRepository.markFailed(docId, code)`) and the run item `failed` carrying `documentId = docId`; iteration continues; `refineText` is not called for this item.
- [x] RF-B05-11: After successful extraction, `documentsRepository.saveRawText(docId, rawText)` is called before `refineText`.
- [x] RF-B05-12: A `refineText` failure marks the document `failed` and the run item `failed` carrying `documentId = docId`; the previously persisted `raw_text` is *not* cleared (only the status changes).
- [x] RF-B05-13: On full success for one item, `documentsRepository.markProcessed(docId, refined)` is called first and then `runsRepository.markRunItemProcessed(itemId, docId)`. If either final transition throws, the run item is marked `failed` with a safe error code carrying `documentId = docId`.
- [x] RF-B05-14: After all selected items finish (success or per-item failure), `runsRepository.completeRun(runId, { selectedCount, processedCount, failedCount, skippedExistingCount })` is called exactly once.
- [x] RF-B05-15: A `driveSource.listFiles` failure that occurs before any item is created results in `runsRepository.failRun(runId, "drive_listing_failed")`, no run items, no document rows; `execute` returns normally.
- [x] RF-B05-16: A failure in `runsRepository.markProcessing` (e.g. the run was concurrently failed) propagates out of `execute` so Inngest can record the failure; no Drive call is made.

**Domain catalog:**

- [x] RF-B05-17: `IngestionErrorCode` includes `"drive_listing_failed"`. `toSafeErrorCode` continues to return `"unknown_error"` for non-`IngestionError` inputs.
- [x] RF-B05-18: `pipelineVersion` is exported from `src/domain/documents/pipeline-version.ts` as a `const` string.

**Infrastructure - `Sha256FileHasher`:**

- [x] RF-B05-19: `Sha256FileHasher.hash(bytes: Uint8Array): string` returns the SHA-256 of `bytes` as lowercase hex (64 chars, `/^[0-9a-f]{64}$/`).
- [x] RF-B05-20: Empty input bytes still produce a 64-char hex string (the SHA-256 of the empty buffer); the hasher does not throw.

**Inngest wiring:**

- [x] RF-B05-21: `src/app/api/inngest/route.ts` registers `createProcessIngestionRunFunction(processIngestionRun)` where `processIngestionRun` is a real `ProcessIngestionRun` instance built with `GoogleDriveFileSource`, `UnpdfPdfExtractor`, `refineText`, `Sha256FileHasher`, `DocumentsRepository`, and `IngestionRunsRepository`.
- [x] RF-B05-22: The placeholder handler that throws `IngestionError("unknown_error", ...)` is removed; no module references it after Block 05 lands.

**Integration:**

- [x] RF-B05-23: An end-to-end integration test runs `ProcessIngestionRun` against real Postgres with a mocked `DriveFileSource`, seeded with one existing document, returning five candidates (one duplicate, three valid PDFs from `assets/pdfs/art3.pdf`, one whose extraction is configured to fail). After execution: the `ingestion_runs` row is `completed`, `selectedCount = 3`, `processedCount = 2`, `failedCount = 1`, `skippedExistingCount = 1`; three `ingestion_run_items` rows exist with the correct statuses and `last_error`s; two new `documents` rows are `processed` with non-empty `raw_text` and `refined_text`; one new `documents` row is `failed` with the appropriate `last_error`; the pre-seeded existing document is unchanged.

## System Flow

1. `POST /api/ingestion/sync` (Block 04) creates a `queued` run and publishes `ingestion/sync.requested` with `{ runId }`.
2. Inngest delivers the event to `/api/inngest`, which is registered as a `serve` route in `src/app/api/inngest/route.ts`.
3. The serve route invokes the function returned by `createProcessIngestionRunFunction`, whose handler calls `ProcessIngestionRun.execute(runId)` (Block 05 wiring).
4. `ProcessIngestionRun.execute` calls `runsRepository.markProcessing(runId)` and uses the returned run's `max_documents` value for batch selection. If this throws (e.g. the run was concurrently failed), the error propagates to Inngest and `execute` returns without further work.
5. `execute` calls `driveSource.listFiles()`. If it throws, `runsRepository.failRun(runId, "drive_listing_failed")` is invoked and `execute` returns; no run items or documents are created.
6. The returned candidates are filtered to PDFs (`isPdfCandidate`).
7. For each PDF candidate, `documentsRepository.existsByDriveFileId(driveFileId)` decides whether the candidate is "existing" (incremented in `skippedExistingCount`) or "new" (added to a selection buffer up to `maxDocuments`).
8. If the selection buffer is empty after partitioning, `runsRepository.completeRun(runId, { selectedCount: 0, processedCount: 0, failedCount: 0, skippedExistingCount })` is called and `execute` returns.
9. For each selected candidate, in order:
   1. `runsRepository.createRunItem({ runId, driveFileId: candidate.driveFileId, title: candidate.name })` -> `item`.
   2. `driveSource.downloadFile(candidate.driveFileId)` -> `bytes`. On failure, `runsRepository.markRunItemFailed(item.id, { errorCode: "drive_download_failed" })` and `continue`.
   3. `hasher.hash(bytes)` -> `fileHash`. On failure, `runsRepository.markRunItemFailed(item.id, { errorCode: code })` and `continue`; the `code` comes from `toSafeErrorCode(err)`.
   4. `documentsRepository.createPendingDocument({ title: candidate.name, driveFileId: candidate.driveFileId, fileHash, pipelineVersion })` -> `document`. On failure, `runsRepository.markRunItemFailed(item.id, { errorCode: code })` and `continue`; no partial document is assumed.
   5. `pdfExtractor.extract(bytes)` -> `rawText`. On failure, `documentsRepository.markFailed(document.id, code)` and `runsRepository.markRunItemFailed(item.id, { errorCode: code, documentId: document.id })`, then `continue`. The `code` comes from `toSafeErrorCode(err)`.
   6. `documentsRepository.saveRawText(document.id, rawText)`. On failure, `documentsRepository.markFailed(document.id, code)` and `runsRepository.markRunItemFailed(item.id, { errorCode: code, documentId: document.id })`, then `continue`.
   7. `refineText(rawText)` -> `refined`. On failure, `documentsRepository.markFailed(document.id, code)` and `runsRepository.markRunItemFailed(item.id, { errorCode: code, documentId: document.id })`, then `continue`.
   8. `documentsRepository.markProcessed(document.id, refined)`. On failure, treat as a generic post-creation failure: `markFailed` is unsafe at this point (the document is no longer pending), so `runsRepository.markRunItemFailed(item.id, { errorCode: code, documentId: document.id })`, then `continue`.
   9. `runsRepository.markRunItemProcessed(item.id, document.id)`. On failure, `runsRepository.markRunItemFailed(item.id, { errorCode: code, documentId: document.id })`, then `continue`; otherwise increment `processedCount`.
10. After the loop, `runsRepository.completeRun(runId, { selectedCount, processedCount, failedCount, skippedExistingCount })` is called exactly once. The run is now `completed` even if some items failed.
11. The Inngest function returns. The `/ingestion` page (Block 04) sees the run state through `GET /api/ingestion/runs/:id` polling and stops polling.

## Invariants / Non-negotiables

- INV-B05-01: At most the run's persisted `max_documents` new documents are created per run, regardless of how many candidates Drive returns (inherits parent INV-08).
- INV-B05-02: A failure on one selected item never aborts processing of the remaining selected items (inherits parent acceptance criterion 9).
- INV-B05-03: Existing documents matched by `drive_file_id` are never read for mutation, never updated, and never reprocessed by F-01 (inherits parent INV-06).
- INV-B05-04: After `execute` returns successfully, `selectedCount = processedCount + failedCount` and `selectedCount <= maxDocuments` and `skippedExistingCount >= 0`.
- INV-B05-05: A document with `status = processed` always has non-empty `raw_text`, non-empty `refined_text`, non-empty `file_hash`, `origin = "google_drive"`, and null bibliographic fields (inherits parent INV-03, INV-05). Block 05 must not violate this even on partial failure paths.
- INV-B05-06: A document with `status = failed` after Block 05 keeps `raw_text` exactly as last persisted (NULL if extraction failed, the original raw text if refinement failed). Block 05 never deletes a document row (inherits parent INV-04).
- INV-B05-07: The selected order across the run matches the order returned by `DriveFileSource.listFiles()` after PDF filtering. No re-ordering by `createdTime`, `modifiedTime`, file size, or any other field.
- INV-B05-08: `documents.last_error` and `ingestion_run_items.last_error` only ever hold values from `IngestionErrorCode`. Raw `Error.message`, stack traces, Drive SDK errors, Postgres errors, or Inngest errors are never persisted to these columns (inherits parent INV-10, RN-B04-05).
- INV-B05-09: The `INGESTION_SYNC_SECRET`, Service Account private key content, and database URL never appear in any value passed to `markFailed`, `markRunItemFailed`, `failRun`, or `completeRun` (inherits parent INV-12).
- INV-B05-10: `ProcessIngestionRun` does not import `node:crypto`, `googleapis`, `unpdf`, or `inngest` directly. All side effects are routed through ports defined in `src/application/ingestion/ports.ts` (inherits architecture from `.specs/project/ARCHITECTURE.md`).
- INV-B05-11: `ProcessIngestionRun` does not depend on any agents framework (inherits parent INV-11).
- INV-B05-12: `pipelineVersion` is read from a single source of truth in `src/domain/documents/pipeline-version.ts` and not duplicated as a literal anywhere else in the codebase.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `ProcessIngestionRunDeps` | `driveSource`, `pdfExtractor`, `refiner`, `hasher`, `documentsRepository`, `runsRepository`, `pipelineVersion`, `maxDocuments?` | Constructor input for `ProcessIngestionRun`. `refiner` is `(rawText: string) => string`; `pipelineVersion` defaults to the imported constant; `maxDocuments` is a test/default fallback, while production selection uses the persisted run value returned by `markProcessing`. |
| `ProcessIngestionRunCounts` | `selectedCount`, `processedCount`, `failedCount`, `skippedExistingCount` | Internal accumulator passed to `runsRepository.completeRun` at the end of `execute`. |
| `FileHasher` (port) | `hash(bytes: Uint8Array): string` | Synchronous; returns lowercase hex. Implemented by `Sha256FileHasher` using `node:crypto.createHash`. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| Function | `ProcessIngestionRun.execute(runId: string): Promise<void>` | Implements `ProcessIngestionRunHandler` from `src/application/ingestion/ports.ts`. Called by the Inngest function registered in `src/app/api/inngest/route.ts`. |
| Function | `Sha256FileHasher.hash(bytes: Uint8Array): string` | Implements the new `FileHasher` port. Pure, synchronous, no I/O. |
| Function | `refineText(rawText: string): string` | Existing deterministic refiner from `src/domain/text/deterministic-refiner.ts`; reused unchanged. |
| Constant | `pipelineVersion: string` | New named export from `src/domain/documents/pipeline-version.ts`. |
| Function | `createProcessIngestionRunFunction(handler)` | Existing factory from `src/infrastructure/ingestion/inngest.ts`; reused unchanged. |
| Strategy | `PdfExtractor.extract(pdfBytes)` | Existing port; reused unchanged. |
| Strategy | `DriveFileSource.listFiles()` / `downloadFile(driveFileId)` | Existing port; reused unchanged. |

### Key Modules

- `src/application/ingestion/process-ingestion-run.ts` - `ProcessIngestionRun` class with constructor-injected dependencies and `execute(runId)` method implementing the System Flow.
- `src/application/ingestion/ports.ts` - extend with the `FileHasher` interface alongside the existing `DriveFileSource`, `PdfExtractor`, `IngestionEventPublisher`, and `ProcessIngestionRunHandler` types.
- `src/infrastructure/crypto/sha256-file-hasher.ts` - `Sha256FileHasher` implementing `FileHasher` via `node:crypto.createHash("sha256")`.
- `src/domain/documents/pipeline-version.ts` - new module exporting the `pipelineVersion` constant.
- `src/domain/documents/errors.ts` - extend `IngestionErrorCode` union with `"drive_listing_failed"`.
- `src/app/api/inngest/route.ts` - replace placeholder handler; instantiate `ProcessIngestionRun` with the production adapters and pass it to `createProcessIngestionRunFunction`.
- `src/application/ingestion/process-ingestion-run.test.ts` - unit tests with fakes covering every RF-B05-XX.
- `src/application/ingestion/process-ingestion-run.integration.test.ts` - integration test against real Postgres, mocked `DriveFileSource`, fixture PDF.
- `src/infrastructure/crypto/sha256-file-hasher.test.ts` - unit tests for the hasher (known-vector, empty input, large buffer).

## Dependencies

- **Prerequisite features:** F-01 Block 01 (domain status, errors, refiner), Block 02 (repositories), Block 03 (Drive adapter, PDF extractor, Inngest factory, env validation), Block 04 (`StartIngestionRun`, `GetIngestionRun`, route handlers, `/ingestion` page, placeholder Inngest wiring).
- **External packages added:** None. `inngest`, `unpdf`, `googleapis`, `drizzle-orm`, and `node:crypto` are all already in scope via prior blocks or the Node standard library.
- **External services:** None new. Reuses Postgres (via existing repositories), Google Drive (via existing adapter), Inngest (via existing client and factory).
- **Environment variables:** None new. `pipelineVersion` is a hard-coded domain constant by deliberate decision (see §Decisions).

## Acceptance Criteria

1. `ProcessIngestionRun.execute(runId)` orchestrates the System Flow above. A unit test demonstrates each branch (no-new, mixed success/failure, persisted batch cap, download-pre-document failure, hash failure, pending-document creation failure, raw-text persistence failure, extraction failure, refinement failure, final run-item transition failure, Drive-listing failure) using fakes.
2. `pnpm vitest run src/application/ingestion/process-ingestion-run.integration.test.ts` (real Postgres, mocked Drive) passes the scenario described in RF-B05-23 and finishes with the exact aggregate counts and per-row states asserted there.
3. `src/app/api/inngest/route.ts` exports `GET`, `POST`, `PUT` from `serve` and registers a `ProcessIngestionRun` instance built with the production adapters; the placeholder handler is gone and grep returns no remaining references to it.
4. `IngestionErrorCode` exports `"drive_listing_failed"`. A test serializes a fake `failed` run row and asserts the value round-trips through `toSafeErrorCode` without becoming `"unknown_error"`.
5. `pipelineVersion` is exported from `src/domain/documents/pipeline-version.ts`. A test asserts the value matches `"f01-1.0.0"` and that no other module hard-codes the same literal (grep check).
6. `Sha256FileHasher.hash` returns the lowercase hex SHA-256 for at least three known vectors (empty buffer, ASCII string, randomized bytes) and does not throw on empty input.
7. After Block 05 ships, every checkbox in `.specs/features/F-01-document-ingestion/spec.md` §Functional Requirements is marked done; any criterion that cannot be met without going beyond F-01's scope is listed under §Decisions with explicit user approval.
8. No value persisted to `documents.last_error`, `ingestion_run_items.last_error`, or `ingestion_runs.last_error` during Block 05 tests is anything other than a member of `IngestionErrorCode`.
9. `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
10. The git diff for Block 05 plus this file and the updated parent `spec.md` form a self-contained handoff that the Codex reviewer can read cold without prior session context.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Hard-code `pipelineVersion` as a domain constant in `src/domain/documents/pipeline-version.ts` | Read from `process.env.PIPELINE_VERSION`; derive from `package.json` version | The value is part of the *pipeline definition*, not a deployment knob. A constant in `src/domain` keeps it in version control alongside the code that produces the artifacts that earn that version. Env vars and `package.json` would let the value drift from the actual processing logic. |
| Introduce a `FileHasher` port plus `Sha256FileHasher` implementation rather than calling `node:crypto` inline in `ProcessIngestionRun` | Inline `crypto.createHash("sha256")` in the use case | Matches the Strategy pattern already used for `PdfExtractor` and `TextRefiner`, keeps the application layer pure (no `node:` imports), and lets the unit tests inject a deterministic fake hash to assert it's the value passed to `createPendingDocument`. |
| Select new candidates in the order returned by `DriveFileSource.listFiles()`, with no re-ordering | Sort by `createdTime ASC` (oldest first) or `modifiedTime DESC` (most recently changed first) | Parent `spec.md` System Flow §14 specifies "first 3 new candidates in Drive listing order". Re-ordering would be a hidden behavior change. The Drive adapter can later be configured to return a stable order if Drive's default proves unstable in practice. |
| Skipped-existing candidates do *not* create `ingestion_run_items` rows; only `skippedExistingCount` is incremented | Create a row per skipped file with `status = "skipped"` | Parent `spec.md` §Entities documents `ingestion_run_items` status as `processing | processed | failed` with no `skipped` value, and `ingestion_runs.skipped_existing_count` is the agreed surface. Adding `skipped` here would expand the run-item schema beyond the contract for a piece of information that's already aggregated. |
| A Drive listing failure before any item is created produces `failRun(runId, "drive_listing_failed")` and a normal `execute` return, instead of letting the error propagate to Inngest | Let the error propagate so Inngest retries; or use the existing `"unknown_error"` code | Failing the run cleanly keeps it inspectable through `GET /api/ingestion/runs/:id` (the operator sees what went wrong) and avoids automatic retries that would pile up identical failed events while the Drive folder is misconfigured. A dedicated code (not `unknown_error`) is needed so the operator can distinguish listing failures from generic ones. |
| Unexpected failures on `markProcessed` (e.g. concurrent state mutation) mark the run item failed with `"unknown_error"` rather than crashing the whole run | Re-throw the error, letting Inngest abort the run mid-batch | Per-item failure isolation is a hard rule (RN-B05-07, RF-B05-13). Aborting the rest of the batch over an exotic concurrent-edit case would surprise the operator more than recording a single unknown-error item. The condition is rare enough that reporting it on the item, not the run, is the right granularity. |
| Use `assets/pdfs/art3.pdf` (635 KB) as the integration-test fixture rather than the larger `art4.pdf` (24 MB) or generating an in-memory fixture | Generate a synthetic PDF with `pdf-lib`; use `art4.pdf` for higher realism; mock the extractor entirely | `art3.pdf` is small enough to keep the integration test fast (no perceptible CI overhead) while being a real PDF the production `UnpdfPdfExtractor` can parse. A synthetic fixture would diverge from real Drive content; mocking the extractor would defeat the point of an integration test that exercises the real domain refiner downstream. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
