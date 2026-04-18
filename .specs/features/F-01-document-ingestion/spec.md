# F-01 - Document Ingestion

## Scope

**In scope:**
- Operator-facing `/ingestion` page in English to start a document ingestion run and monitor its progress.
- `POST /api/ingestion/sync` route that creates an ingestion run, enqueues asynchronous processing through Inngest, and returns immediately with a run id.
- `GET /api/ingestion/runs/:id` route that returns the run status and per-document processing results for polling by the page.
- `/api/inngest` route that hosts the Inngest function used to process ingestion runs.
- Google Drive Service Account integration against the fixed Drive folder defined by environment variables.
- Processing of at most 3 new PDF files per ingestion run.
- Governed document creation with Drive metadata, file hash, pipeline version, timestamps, and document status.
- PDF text extraction through the `unpdf`-backed `PdfExtractor` Strategy.
- Deterministic text refinement that produces `refined_text` without using an LLM.
- Failure isolation per document: one failed document must not stop the rest of the selected batch.
- Persistence of ingestion run state and run items so the operator can inspect progress after the start request returns.
- Tests for domain rules, application orchestration, persistence, API contracts, and the asynchronous ingestion flow with Drive mocked and Postgres real where persistence matters.

**Out of scope:**
- Reprocessing failed documents through a manual endpoint or UI action.
- Manual bibliographic metadata editing.
- Document listing outside the ingestion-run progress view.
- Chunking, embeddings, vector indexing, retrieval, generation, answers, XAI, observability, and agents.
- Automatic duplicate handling by content hash.
- Automatic DOI lookup or automatic inference of authors, publication year, affiliation, or other bibliographic fields.
- Manual PDF upload through the UI.
- Support for non-PDF formats.
- Google Drive webhooks, cron sync, or real-time Drive push notifications.
- Application-level maximum PDF size enforcement.
- Caching original PDFs outside Google Drive.

## Context & Motivation

M1 needs a governed ingestion foundation before any RAG feature can be built. A PDF placed in the fixed Google Drive folder must become a traceable Postgres record with extracted and refined text, ready for later chunking.

This contract replaces the deprecated historical spec at `.specs/features/F-0X-document-ingestion/spec.md` and follows the spec-first workflow from `.specs/project/STATE.md` `AD-007`. It implements the Phase 1 operational rules in `phase1_pipeline_rules.md`, the architecture in `.specs/project/ARCHITECTURE.md`, and the M1 roadmap entry in `.specs/project/ROADMAP.md`.

The operator benefits by getting an explicit ingestion control surface: start a run, leave the request path immediately, and inspect progress through `/ingestion` while Inngest performs the work in the background.

## Business Rules

- RN-01: Google Drive is the only document source in F-01.
- RN-02: Only files with MIME type `application/pdf` or a `.pdf` filename are eligible for ingestion.
- RN-03: A document's initial `title` is derived from the Google Drive file name at insertion time.
- RN-04: DOI, authors, publication year, notes, affiliation, and similar bibliographic fields are never inferred or looked up automatically.
- RN-05: Duplicate content is not blocked by file hash; two different Drive files with the same bytes may become two documents.
- RN-06: An existing document matched by `drive_file_id` is ignored by sync and must not be modified by F-01.
- RN-07: Each ingestion run selects at most 3 new PDF files that are not already present in `documents.drive_file_id`.
- RN-08: A document starts as `pending` and may transition only to `processed` or `failed` during F-01 processing.
- RN-09: A document may be marked `processed` only after both `raw_text` and `refined_text` are persisted and non-empty.
- RN-10: Extraction or refinement failures after document creation mark only that document as `failed` and persist `last_error`.
- RN-11: Failures before a governed document can be created, such as Drive listing or download failures before `file_hash` exists, are recorded on the ingestion run or run item instead of creating an incomplete document.
- RN-12: The original PDF remains in Google Drive; Postgres stores governance metadata, extracted text, refined text, and run state.
- RN-13: Text refinement is deterministic in F-01 and must not call an LLM or embedding provider.
- RN-14: Route handlers validate request and response boundaries with Zod and delegate business logic to application services.

## Functional Requirements

- [ ] RF-01: The `/ingestion` page allows the operator to start a new ingestion run and displays the returned run id and queued status.
- [ ] RF-02: The `/ingestion` page can poll run status through `GET /api/ingestion/runs/:id` and display aggregate counts plus per-item statuses.
- [ ] RF-03: `POST /api/ingestion/sync` creates one ingestion run with `status = queued`, `max_documents = 3`, and timestamps, then publishes an Inngest event.
- [ ] RF-04: If another run is already `queued` or `processing`, `POST /api/ingestion/sync` returns 409 with the active run id and does not enqueue another run.
- [ ] RF-05: The Inngest function marks the run `processing`, lists eligible Drive PDFs, filters out files whose `drive_file_id` already exists in `documents`, and selects at most 3 new files.
- [ ] RF-06: When no new eligible PDFs exist, the run completes with zero selected, processed, and failed items.
- [ ] RF-07: For each selected file, the pipeline downloads the PDF, computes `file_hash`, creates a `pending` document, extracts `raw_text`, refines it into `refined_text`, and marks the document `processed`.
- [ ] RF-08: If PDF extraction fails or returns empty usable text, the document is marked `failed`, `last_error` is persisted, and refinement is skipped.
- [ ] RF-09: If refinement fails or returns empty usable text, the document preserves `raw_text`, is marked `failed`, and persists `last_error`.
- [ ] RF-10: Failure on one selected file does not prevent processing the remaining selected files.
- [ ] RF-11: The run stores final aggregate counts for selected, processed, failed, and skipped-existing files.
- [ ] RF-12: All API responses are validated with Zod before serialization and contain no credentials, Drive private-key content, database URLs, or provider stack traces.

## System Flow

1. The operator opens `/ingestion`.
2. The page calls `POST /api/ingestion/sync` when the operator starts ingestion.
3. The route validates that there is no request body, calls `StartIngestionRun` in the application layer, and validates the response body with Zod.
4. `StartIngestionRun` asks the ingestion-run repository whether a `queued` or `processing` run exists.
5. If an active run exists, the application service returns a conflict result and the route responds 409 with `{ activeRunId }`.
6. If no active run exists, the service creates an `ingestion_runs` record with `status = queued`, `max_documents = 3`, and initial zero counts.
7. The service publishes Inngest event `ingestion/sync.requested` with `{ runId }`.
8. `POST /api/ingestion/sync` returns 202 with `{ runId, status: "queued", maxDocuments: 3 }`.
9. The `/ingestion` page polls `GET /api/ingestion/runs/:id`.
10. The Inngest function hosted at `/api/inngest` receives `ingestion/sync.requested` and calls `ProcessIngestionRun`.
11. `ProcessIngestionRun` marks the run `processing`, then asks the Drive adapter to list files in `GOOGLE_DRIVE_FOLDER_ID`.
12. The application service keeps PDF candidates only, counts candidates whose `drive_file_id` already exists in `documents` as skipped-existing, and selects the first 3 new candidates in Drive listing order.
13. For each selected file, the service creates an `ingestion_run_items` row with `status = processing`.
14. The Drive adapter downloads the PDF bytes. If download fails before a document can be created, the run item becomes `failed` with `last_error = "drive_download_failed"`.
15. The service computes `file_hash`, creates a `documents` row with `status = pending`, `origin = "google_drive"`, `pipeline_version`, Drive metadata, and nullable bibliographic fields left null.
16. The `PdfExtractor` Strategy extracts text from the PDF bytes. Empty usable text is classified as `raw_text_empty`.
17. On extraction failure, the document becomes `failed`, `last_error` is persisted, the run item becomes `failed`, and the next item is processed.
18. The deterministic `TextRefiner` normalizes extraction noise without semantic rewriting and returns `refined_text`. Empty usable refined text is classified as `refined_text_empty`.
19. On refinement failure, the already persisted `raw_text` is preserved, the document becomes `failed`, `last_error` is persisted, the run item becomes `failed`, and the next item is processed.
20. On success, the repository persists `raw_text`, `refined_text`, marks the document `processed`, and marks the run item `processed`.
21. After all selected items finish, the service updates aggregate counts and marks the run `completed`, even if some items failed.
22. If an unrecoverable run-level failure occurs before item isolation is possible, the run becomes `failed` with a generic `last_error`; API responses still hide raw provider errors.

## Invariants / Non-negotiables

- INV-01: F-01 never chunks, embeds, retrieves from, or generates answers from documents.
- INV-02: F-01 never uses `raw_text` as the source for future chunking readiness; only `processed` documents with `refined_text` are ready for Phase 2.
- INV-03: A document with `status = processed` must always have non-empty `raw_text` and non-empty `refined_text`.
- INV-04: A document with `status = failed` must remain inspectable in the database and must not be silently deleted by the pipeline.
- INV-05: Bibliographic fields are nullable/manual and must not be auto-filled from the PDF, Drive metadata, DOI services, LLMs, or heuristics.
- INV-06: Existing documents matched by `drive_file_id` must not be updated by sync, including title changes after Drive rename.
- INV-07: File hash is stored for governance only and must not be used to reject duplicate content in F-01.
- INV-08: The application must process no more than 3 new Drive PDFs per ingestion run.
- INV-09: No application-defined maximum PDF size is enforced in F-01.
- INV-10: Secrets and raw provider errors must never appear in API response bodies.
- INV-11: The base ingestion flow must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `documents` | `id`, `title`, `drive_file_id`, `origin`, `file_hash`, `pipeline_version`, `status`, `doi`, `authors`, `publication_year`, `notes`, `raw_text`, `refined_text`, `last_error`, `created_at`, `updated_at` | Existing governed document model in `src/db/schema.ts`; F-01 uses only `pending`, `processed`, and `failed`. |
| `ingestion_runs` | `id`, `status`, `max_documents`, `selected_count`, `processed_count`, `failed_count`, `skipped_existing_count`, `last_error`, `created_at`, `started_at`, `finished_at`, `updated_at` | New persistent run record for async status inspection. Status values: `queued`, `processing`, `completed`, `failed`. |
| `ingestion_run_items` | `id`, `run_id`, `drive_file_id`, `document_id`, `title`, `status`, `last_error`, `created_at`, `updated_at` | New per-selected-file run record. Status values: `processing`, `processed`, `failed`. `document_id` is nullable for failures before document creation. Existing documents are counted on the run as `skipped_existing_count` and do not require item rows. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/ingestion` | English operator page for starting an ingestion run and monitoring run progress. |
| `POST` | `/api/ingestion/sync` | Creates a queued ingestion run, publishes Inngest event `ingestion/sync.requested`, and returns 202. Returns 409 if another run is active. |
| `GET` | `/api/ingestion/runs/:id` | Returns validated run detail for polling, including aggregate counts and per-item statuses. |
| `GET/POST/PUT` | `/api/inngest` | Inngest serve endpoint that hosts the document-ingestion function. |
| Function | `StartIngestionRun.execute()` | Application service used by `POST /api/ingestion/sync`. |
| Function | `GetIngestionRun.execute(runId)` | Application service used by status polling. |
| Function | `ProcessIngestionRun.execute(runId)` | Application service called by the Inngest function. |
| Strategy | `PdfExtractor.extract(pdfBytes)` | Extracts `raw_text` from PDF bytes. Default implementation uses `unpdf`. |
| Strategy | `TextRefiner.refine(rawText)` | Deterministically produces `refined_text` from `raw_text`. |

### Key Modules

- `src/domain/documents/status.ts` - document status transition rules and typed transition errors.
- `src/domain/documents/errors.ts` - ingestion error codes safe for persistence and API responses.
- `src/domain/text/deterministic-refiner.ts` - deterministic text cleanup with no LLM calls.
- `src/application/ingestion/start-ingestion-run.ts` - create and enqueue an ingestion run.
- `src/application/ingestion/get-ingestion-run.ts` - read run detail for polling.
- `src/application/ingestion/process-ingestion-run.ts` - orchestrate Drive listing, filtering, extraction, refinement, persistence, and per-document failure isolation.
- `src/infrastructure/drive/google-drive-client.ts` - Google Drive Service Account adapter.
- `src/infrastructure/pdf/unpdf-extractor.ts` - `PdfExtractor` implementation backed by `unpdf`.
- `src/infrastructure/ingestion/inngest.ts` - Inngest client and ingestion function definitions.
- `src/repositories/documents-repository.ts` - persistence isolation for document lifecycle operations.
- `src/repositories/ingestion-runs-repository.ts` - persistence isolation for run and item lifecycle operations.
- `src/app/api/ingestion/sync/route.ts` - sync-start route.
- `src/app/api/ingestion/runs/[id]/route.ts` - run-status route.
- `src/app/api/inngest/route.ts` - Inngest serve route.
- `src/app/ingestion/page.tsx` - English operator page.

## Dependencies

- **Prerequisite features:** Health endpoint and existing `documents` schema baseline.
- **External packages added:** `inngest` - event workflow SDK for async Next.js/Vercel execution; `unpdf` - default PDF text extraction implementation.
- **External services:** Google Drive API, Inngest, Postgres/pgvector.
- **Environment variables:** `DATABASE_URL` - Postgres connection string; `GOOGLE_DRIVE_FOLDER_ID` - fixed source folder; `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service Account identity; `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service Account private key; `INNGEST_EVENT_KEY` - server-side key for sending Inngest events; `INNGEST_SIGNING_KEY` - key used by the Inngest serve endpoint to verify requests.

## Acceptance Criteria

1. A user can open `/ingestion`, start a run, receive a run id, and see status updates by polling the run endpoint.
2. `POST /api/ingestion/sync` returns 202 with a queued run when no run is active and returns 409 with the active run id when another run is `queued` or `processing`.
3. One run processes at most 3 new PDFs from the fixed Drive folder.
4. Files already present in `documents.drive_file_id` are not modified or reprocessed by F-01.
5. A successful selected PDF ends with one `documents` row in `status = processed`, with non-empty `raw_text`, non-empty `refined_text`, non-empty `file_hash`, `origin = "google_drive"`, and nullable bibliographic fields left null.
6. Extraction failure or empty extracted text marks only the affected document and run item as failed, persists a safe `last_error`, and does not run refinement for that item.
7. Refinement failure or empty refined text preserves `raw_text`, marks only the affected document and run item as failed, and persists a safe `last_error`.
8. A mixed run with one failing PDF and at least one valid PDF completes with accurate aggregate counts and does not stop after the failed item.
9. The deterministic refiner has unit tests proving whitespace normalization, dehyphenation across line breaks, control-character cleanup, and no semantic expansion.
10. API responses for success and failure pass their Zod schemas and do not contain database URLs, Service Account private-key content, raw Drive errors, raw Inngest errors, or stack traces.
11. Persistence tests cover document and ingestion-run lifecycle operations using a real Postgres database.
12. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Use Inngest for F-01 background processing | Synchronous API request, in-process background task, local CLI, worker-only DB polling, Trigger.dev, Upstash QStash | The operator should receive an immediate response while processing continues reliably outside the request path. Inngest fits Next.js/Vercel with event-driven functions and retries without introducing a broader task platform than needed. |
| Provide `/ingestion` as the operator surface in English | API-only status inspection, Portuguese route/text, API plus larger document-management UI | The user asked for an English operational page. A page avoids requiring SQL or manual API calls while keeping scope focused on ingestion status only. |
| Limit each run to 3 new documents | 1, 5, 10, or all documents | Three documents keep early tests and demos fast while still proving batch behavior and per-document failure isolation. |
| Do not enforce an application-level PDF size limit in F-01 | 20 MB, 50 MB, 100 MB | The user explicitly chose no limit for now. Runtime/provider failures are recorded as failed run items or failed documents depending on when the failure occurs. |
| Use deterministic text refinement | LLM-assisted cleanup, hybrid deterministic plus LLM fallback | Deterministic refinement is cheaper, faster, testable, and enough for M1. Later quality improvements can replace the Strategy without changing orchestration. |
| Keep reprocessing out of F-01 | Include failed-document reprocessing now | Reprocessing remains required by the architecture, but the first implementable contract should ship the start-to-processed ingestion path and async status surface first. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
