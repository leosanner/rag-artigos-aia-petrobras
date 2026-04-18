# F-01 Block 02 - Persistence, Runs, and Documents

## Scope

**In scope:**
- Drizzle schema additions for ingestion runs and ingestion run items.
- Drizzle migration for the new enums, tables, constraints, indexes, and foreign keys.
- Repository APIs for document lifecycle persistence required by F-01.
- Repository APIs for ingestion-run and run-item lifecycle persistence required by F-01.
- Real Postgres repository tests that prove schema constraints and repository behavior.

**Out of scope:**
- Google Drive listing or download logic.
- PDF extraction, text refinement implementation, or Inngest wiring.
- Application orchestration for `StartIngestionRun`, `GetIngestionRun`, or `ProcessIngestionRun`.
- API route handlers, Zod API response schemas, and the `/ingestion` page.
- Reprocessing failed documents through UI or API.
- Chunking, embeddings, retrieval, generation, XAI, observability, and agents.

## Context & Motivation

F-01 needs durable state before asynchronous processing can be introduced. The operator start request returns immediately, while later blocks will process the run in the background and poll persisted progress.

This block implements the persistence slice of `.specs/features/F-01-document-ingestion/spec.md`. It follows `.specs/project/ARCHITECTURE.md` by isolating database access behind repositories, respects the Phase 1 rules in `phase1_pipeline_rules.md`, and supports AD-008 in `.specs/project/STATE.md` by making ingestion runs inspectable after the request path exits.

## Business Rules

- RN-B02-01: An ingestion run represents one operator-triggered sync attempt.
- RN-B02-02: At most one ingestion run may be active at a time; active means `queued` or `processing`.
- RN-B02-03: Active-run exclusivity must be enforced by Postgres, not only by application code.
- RN-B02-04: Existing Drive files skipped because their `drive_file_id` already exists in `documents` are counted on the run as `skipped_existing_count`.
- RN-B02-05: Skipped existing Drive files do not require `ingestion_run_items` rows.
- RN-B02-06: A run item represents one selected new Drive file being processed by F-01.
- RN-B02-07: A run item may reference a document only after a governed document row exists.
- RN-B02-08: A run item may fail without a document id when failure occurs before document creation.
- RN-B02-09: Repository-created documents always start with `status = pending`.
- RN-B02-10: Repository-created documents keep bibliographic fields nullable/manual and never infer DOI, authors, publication year, or notes.
- RN-B02-11: A document may become `processed` only from `pending`, and only when `raw_text` and `refined_text` are both non-empty.
- RN-B02-12: A document may become `failed` only from `pending`; failure preserves any already persisted text.
- RN-B02-13: Persisted `last_error` values must be safe `IngestionErrorCode` values from `src/domain/documents/errors.ts`.

## Functional Requirements

- [ ] RF-B02-01: The schema defines `ingestion_run_status` with values `queued`, `processing`, `completed`, and `failed`.
- [ ] RF-B02-02: The schema defines `ingestion_run_item_status` with values `processing`, `processed`, and `failed`.
- [ ] RF-B02-03: The schema defines `ingestion_runs` with id, status, max document limit, aggregate counts, safe last error, and timestamps.
- [ ] RF-B02-04: The schema defines `ingestion_run_items` linked to `ingestion_runs` and optionally linked to `documents`.
- [ ] RF-B02-05: The schema enforces non-negative aggregate counts and `max_documents > 0`.
- [ ] RF-B02-06: The schema enforces at most one active run through a partial unique index over `queued` and `processing`.
- [ ] RF-B02-07: `IngestionRunsRepository.findActiveRun()` returns the active run when any run is `queued` or `processing`, and returns `null` otherwise.
- [ ] RF-B02-08: `IngestionRunsRepository.createQueuedRun()` creates a queued run with zero counts and `max_documents` set by the caller.
- [ ] RF-B02-09: `IngestionRunsRepository.createQueuedRun()` surfaces a typed active-run conflict if the database active-run constraint is violated.
- [ ] RF-B02-10: `IngestionRunsRepository.markProcessing()` changes a queued run to `processing` and sets `started_at`.
- [ ] RF-B02-11: `IngestionRunsRepository.completeRun()` changes a run to `completed`, persists aggregate counts, clears run-level `last_error`, and sets `finished_at`.
- [ ] RF-B02-12: `IngestionRunsRepository.failRun()` changes a run to `failed`, persists a safe `last_error`, and sets `finished_at`.
- [ ] RF-B02-13: `IngestionRunsRepository.createRunItem()` creates an item with `status = processing`, Drive file id, and title.
- [ ] RF-B02-14: `IngestionRunsRepository.markRunItemProcessed()` changes an item to `processed` and links the created document id.
- [ ] RF-B02-15: `IngestionRunsRepository.markRunItemFailed()` changes an item to `failed`, persists a safe `last_error`, and may link a document id when one exists.
- [ ] RF-B02-16: `IngestionRunsRepository.getRunWithItems()` returns a run and its items ordered by item creation time.
- [ ] RF-B02-17: `DocumentsRepository.existsByDriveFileId()` reports whether a document already exists for a Drive file id.
- [ ] RF-B02-18: `DocumentsRepository.createPendingDocument()` inserts a governed document with `status = pending`, `origin = google_drive`, provided hash/version metadata, and null bibliographic fields.
- [ ] RF-B02-19: `DocumentsRepository.saveRawText()` persists non-empty `raw_text` only for pending documents.
- [ ] RF-B02-20: `DocumentsRepository.markProcessed()` persists non-empty `refined_text`, changes status to `processed`, and requires existing non-empty `raw_text`.
- [ ] RF-B02-21: `DocumentsRepository.markFailed()` changes a pending document to `failed`, persists safe `last_error`, and preserves existing text fields.
- [ ] RF-B02-22: Repositories accept an injected Drizzle client or transaction so later application services can compose operations transactionally.

## System Flow

1. A later block calls `StartIngestionRun` from an API route.
2. The application service asks `IngestionRunsRepository.findActiveRun()` whether any active run exists.
3. If no active run exists, the service calls `createQueuedRun({ maxDocuments: 3 })`.
4. Postgres also enforces active-run exclusivity through a partial unique index, preventing concurrent requests from creating two active runs.
5. A later Inngest function calls `ProcessIngestionRun`.
6. The application service calls `markProcessing(runId)` when background processing begins.
7. For each selected new Drive file, the service calls `createRunItem({ runId, driveFileId, title })`.
8. After file hash calculation, the service calls `DocumentsRepository.createPendingDocument(...)`.
9. After extraction, the service calls `saveRawText(documentId, rawText)`.
10. After refinement succeeds, the service calls `markProcessed(documentId, refinedText)` and `markRunItemProcessed(itemId, documentId)`.
11. If processing fails after document creation, the service calls `markFailed(documentId, errorCode)` and `markRunItemFailed(itemId, { errorCode, documentId })`.
12. If processing fails before document creation, the service calls `markRunItemFailed(itemId, { errorCode })`.
13. After all selected files finish, the service calls `completeRun(runId, counts)`.
14. If a run-level unrecoverable failure occurs before item isolation is possible, the service calls `failRun(runId, errorCode)`.

This block implements only the persistence methods used in those steps. It does not implement the application services that sequence them.

## Invariants / Non-negotiables

- INV-B02-01: No more than one `queued` or `processing` ingestion run may exist in Postgres at the same time.
- INV-B02-02: Repository-created documents must never populate DOI, authors, publication year, or notes automatically.
- INV-B02-03: A `processed` document must always have non-empty `raw_text` and non-empty `refined_text`.
- INV-B02-04: A failed document must remain persisted and inspectable; repository failure methods must not delete documents.
- INV-B02-05: Failed document and run-item `last_error` values must be safe error codes, never raw provider messages or stack traces.
- INV-B02-06: Existing documents matched by `drive_file_id` must not be modified by repository methods used for skipped-existing detection.
- INV-B02-07: `file_hash` is stored for governance only and must not become a uniqueness constraint in this block.
- INV-B02-08: Repositories must not import or call Drive, PDF, Inngest, API route, UI, LLM, embedding, retrieval, or agents code.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `documents` | `id`, `title`, `drive_file_id`, `origin`, `file_hash`, `pipeline_version`, `status`, nullable bibliographic fields, `raw_text`, `refined_text`, `last_error`, timestamps | Existing governed document table. This block adds repository methods but keeps the status enum unchanged. |
| `ingestion_runs` | `id`, `status`, `max_documents`, `selected_count`, `processed_count`, `failed_count`, `skipped_existing_count`, `last_error`, `created_at`, `started_at`, `finished_at`, `updated_at` | New async run table. Active statuses are `queued` and `processing`; terminal statuses are `completed` and `failed`. |
| `ingestion_run_items` | `id`, `run_id`, `drive_file_id`, `document_id`, `title`, `status`, `last_error`, `created_at`, `updated_at` | New per-selected-file table. `document_id` is nullable for pre-document failures. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| Class | `new DocumentsRepository(client)` | Creates a document repository over an injected Drizzle client or transaction. |
| Function | `DocumentsRepository.existsByDriveFileId(driveFileId)` | Checks whether sync should skip a Drive file. |
| Function | `DocumentsRepository.createPendingDocument(input)` | Inserts the governed pending document record. |
| Function | `DocumentsRepository.saveRawText(documentId, rawText)` | Persists extracted text for a pending document. |
| Function | `DocumentsRepository.markProcessed(documentId, refinedText)` | Persists refined text and marks the pending document processed. |
| Function | `DocumentsRepository.markFailed(documentId, errorCode)` | Marks the pending document failed with a safe error code. |
| Class | `new IngestionRunsRepository(client)` | Creates an ingestion-run repository over an injected Drizzle client or transaction. |
| Function | `IngestionRunsRepository.findActiveRun()` | Finds a queued or processing run. |
| Function | `IngestionRunsRepository.createQueuedRun(input)` | Creates a queued run or raises an active-run conflict. |
| Function | `IngestionRunsRepository.markProcessing(runId)` | Marks a queued run processing and sets `started_at`. |
| Function | `IngestionRunsRepository.completeRun(runId, counts)` | Marks a run completed with final aggregate counts. |
| Function | `IngestionRunsRepository.failRun(runId, errorCode)` | Marks a run failed with a safe error code. |
| Function | `IngestionRunsRepository.createRunItem(input)` | Creates a processing item for a selected Drive file. |
| Function | `IngestionRunsRepository.markRunItemProcessed(itemId, documentId)` | Marks an item processed and links its document. |
| Function | `IngestionRunsRepository.markRunItemFailed(itemId, input)` | Marks an item failed with optional document linkage. |
| Function | `IngestionRunsRepository.getRunWithItems(runId)` | Reads one run with all run items ordered by creation time. |

### Key Modules

- `src/db/schema.ts` - Drizzle schema for documents, ingestion runs, ingestion run items, enums, indexes, and constraints.
- `src/repositories/documents-repository.ts` - persistence isolation for F-01 document lifecycle updates.
- `src/repositories/ingestion-runs-repository.ts` - persistence isolation for F-01 run and item lifecycle updates.
- `src/test/db.ts` - real Postgres test helper that builds a Drizzle client without requiring Google Drive env vars and refuses destructive resets against non-test database names.
- `.github/workflows/ci.yml` - CI Postgres service and migration step before tests.

## Dependencies

- **Prerequisite features:** F-00 health endpoint and F-01 Block 01 domain state/error modules.
- **External packages added:** N/A - Drizzle, Postgres driver, Zod, and Vitest already exist.
- **External services:** Postgres/pgvector for repository tests and runtime persistence.
- **Environment variables:** `DATABASE_URL` - runtime/migration Postgres connection string; `TEST_DATABASE_URL` - repository-test Postgres connection string, required to target a database whose name includes `test` as a segment.

## Acceptance Criteria

1. `src/db/schema.ts` exports typed Drizzle definitions for `ingestionRuns` and `ingestionRunItems`, plus their status enums.
2. A Drizzle migration exists for all block-02 schema changes.
3. Postgres rejects creation of a second active ingestion run while another run is `queued` or `processing`.
4. Repository tests prove active-run detection for both `queued` and `processing`.
5. Repository tests prove queued, processing, completed, and failed run lifecycle updates.
6. Repository tests prove run aggregate counts are persisted exactly.
7. Repository tests prove run items can move from `processing` to `processed` with a document id.
8. Repository tests prove run items can move from `processing` to `failed` with safe `last_error`, with or without a document id.
9. Repository tests prove pending document creation leaves DOI, authors, publication year, and notes null.
10. Repository tests prove `raw_text`, `refined_text`, `processed`, and `failed` document lifecycle operations.
11. Repository tests run against real Postgres in CI after Drizzle migrations are applied.
12. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Enforce one active run with a Postgres partial unique index | Repository-only preflight check; defer concurrency handling | A repository-only check can race under concurrent requests. The database constraint makes the invariant true even when two API calls arrive together. |
| Run repository tests against real Postgres in CI | Mock Drizzle; SQLite/in-memory database; local-only opt-in tests; Testcontainers | This block must prove Postgres enums, foreign keys, check constraints, partial unique indexes, migrations, and transaction-compatible repository behavior. A CI Postgres service gives that coverage with minimal new dependencies. |
| Inject the Drizzle client or transaction into repositories | Import global `db` directly; expose repository-owned transaction helpers; defer transaction support | Later application services need to compose document, run, and item updates atomically. Client injection keeps repositories simple and transaction-ready without coupling them to a global runtime client. |
| Keep skipped existing files as run aggregate counts only | Create an item row for every skipped Drive file | The parent F-01 contract states skipped existing files are counted as `skipped_existing_count`; item rows are reserved for selected new files that undergo processing. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
