# Deprecated Specification

This document is retained as historical context only. It belongs to the
previous feature-spec structure and must not be used as the implementation
contract for M1 document ingestion.

The active contract is now
[`../F-01-document-ingestion/spec.md`](../F-01-document-ingestion/spec.md),
created under the `F-NN-<slug>/spec.md` spec-first workflow defined by `AD-007` in
[`../../project/STATE.md`](../../project/STATE.md).

---

# Document Ingestion (Phase 1) — Specification

## Problem Statement

For RAG to work with traceability, every PDF must become a **governed record** in Postgres with its extracted text, refined text, and consolidated governance metadata — before any chunking, embedding, or retrieval operation. Today no pipeline exists: the preparation and governance layer that underpins every later phase has to be built.

This spec implements **Phase 1 — Data Structuring** as described in `phase1_pipeline_rules.md`.

---

## Goals

- [ ] The operator drops a PDF into a fixed Google Drive folder and, after triggering the sync, finds a record with status `processed` in the database, containing `raw_text` and `refined_text`.
- [ ] 100% of records have the minimum governance fields filled automatically (internal id, hash, origin, Drive reference, logical version, timestamps, status).
- [ ] Extraction or refinement failures mark the document as `failed` without corrupting state, and the document can be reprocessed without manual database intervention.
- [ ] The pipeline is covered by TDD tests: unit tests for each component (extractor, refiner, state machine, repository) and at least one end-to-end integration test with a small real PDF, using a real Postgres instance (not a mock) with pgvector.

---

## Out of Scope

Explicitly excluded from this phase. Documented to prevent scope creep.

| Feature                                                                   | Reason                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Automatic duplicate detection by hash                                     | Decision AD-004: manual control by the user in v1                                                 |
| Automatic DOI lookup                                                      | Decision AD-005 / rules §7                                                                        |
| Automatic extraction of authors, publication year, affiliation            | Decision AD-005 / rules §6 — bibliographic metadata is manual input                               |
| Chunking, embeddings, vector store                                        | Scope of Phase 2                                                                                  |
| RAG, answers, agents                                                      | Scope of Phases 3+                                                                                |
| Per-user OAuth, multi-tenancy, end-user login                             | Decision AD-002 — DEMO uses a Service Account                                                     |
| Manual PDF upload via UI                                                  | Drive is the only source in v1                                                                    |
| Support for non-PDF formats                                               | Initial corpus is 100% PDF                                                                        |
| Google Drive webhooks (push notifications) or real-time processing        | Sync is triggered explicitly (endpoint/CLI) — simplicity for DEMO                                 |
| Batch reprocessing pipeline                                               | v1 allows reprocessing one document at a time; batch is deferred to future iterations             |

---

## User Stories

### P1: Happy-path end-to-end ingestion ⭐ MVP

**User Story**: As the DEMO operator, I want to drop a PDF into a fixed Google Drive folder and trigger the sync so that the document shows up in the system with `raw_text`, `refined_text`, governance metadata, and status `processed`, ready for chunking.

**Why P1**: It is the minimum flow that proves the data governance layer works. Without it, no later phase can exist.

**Acceptance Criteria**:

1. WHEN the operator triggers the sync AND there are PDFs in the fixed Drive folder that do not yet exist in the database (matched by `drive_file_id`) THEN the system SHALL create one record per new PDF, with `status = pending`, `title` derived from the file name, `drive_file_id`, `origin = 'google_drive'`, computed `file_hash`, current `pipeline_version`, and `created_at` / `updated_at` populated.
2. WHEN a document enters with status `pending` THEN the system SHALL attempt to extract the PDF text and persist the result in the `raw_text` field, updating `updated_at`.
3. WHEN `raw_text` has been persisted successfully THEN the system SHALL run the refinement step, persist the result in `refined_text`, update `updated_at`, and mark the record as `status = processed`.
4. WHEN all three steps (creation, extraction, refinement) complete without error for a document THEN the final record SHALL have `raw_text != NULL`, `refined_text != NULL`, and `status = 'processed'`, satisfying the chunking-readiness criterion defined in rules §12.
5. WHEN the operator triggers the sync and there are no new PDFs in Drive THEN the system SHALL complete without creating new records or modifying existing ones, returning a report "0 new / 0 updated".

**Independent Test**: Put a known PDF into a test Drive folder, call `POST /api/ingestion/sync` (or equivalent command), query the database, and verify that there is exactly 1 row in the `documents` table with `status = 'processed'` and both text fields populated. An integration test with a small fixture PDF can run the entire pipeline with Drive mocked and real Postgres.

---

### P1: Failure-resilient status transitions ⭐ MVP

**User Story**: As the operator, I want failures in extraction or refinement to be reflected clearly in the document status (`failed`) without leaving the system in an inconsistent state, so that I can identify and reprocess problematic documents.

**Why P1**: Without reliable failure handling, the pipeline becomes a black box. Rules §10, §11, and §13 make this explicit.

**Acceptance Criteria**:

1. WHEN `raw_text` extraction fails for a document THEN the system SHALL mark the record as `status = failed`, persist `last_error` with a readable reason, update `updated_at`, and NOT advance to the refinement step.
2. WHEN extraction succeeds but refinement fails THEN the system SHALL preserve the already-persisted `raw_text`, mark the record as `status = failed`, persist `last_error`, and update `updated_at`.
3. WHEN any invalid transition is attempted (e.g., `processed` → `pending` without an explicit action) THEN the state machine SHALL reject the transition, throw a typed error, and leave the record unchanged.
4. WHEN the pipeline processes multiple documents in one cycle and one of them fails THEN the remaining documents SHALL keep being processed; the final report SHALL summarize `processed` / `failed` per document.

**Independent Test**: Simulate a corrupted PDF (or mock the extractor to throw) and verify that (a) the record ends with `status = failed` and `last_error` populated, (b) other PDFs in the same cycle reach `processed`, (c) the database state is consistent.

---

### P2: Reprocessing failed documents

**User Story**: As the operator, I want to reprocess a document with `status = failed` without having to remove and re-add it to Drive, so that I can recover from transient errors or pipeline adjustments.

**Why P2**: Necessary for real operation, but the DEMO can exist for an initial live presentation as long as we have clean input data. Rules §14 requires this architectural possibility.

**Acceptance Criteria**:

1. WHEN the operator calls `POST /api/ingestion/reprocess/:documentId` on a document with `status = failed` THEN the system SHALL reset the status to `pending`, clear `last_error`, rerun the pipeline, and reach `processed` or `failed` at the end.
2. WHEN the operator triggers reprocessing on a document with `status = processed` THEN the system SHALL respond with a 409 and NOT change the record (conservative decision for v1; reprocessing `processed` documents is a Deferred Idea).
3. WHEN reprocessing is in progress THEN it SHALL be clear in the record that active processing is underway (via `status = pending`), and concurrent reprocess requests on the same document SHALL be rejected with a 409.

**Independent Test**: Force a document to `failed`, fix the failure condition (e.g., adjust the extractor mock), trigger reprocessing, and verify that the record reaches `processed` with both text fields populated.

---

### P2: Manual bibliographic metadata editing

**User Story**: As the operator, I want to edit `title`, `doi`, `authors`, `publication_year`, and `notes` of an already-ingested document, so that I can enrich metadata that was not inferred automatically.

**Why P2**: Rules §5 and §6 require the possibility. It does not block the initial ingestion DEMO, but governance expects it.

**Acceptance Criteria**:

1. WHEN the operator sends `PATCH /api/documents/:id` with valid fields (validated by Zod) THEN the system SHALL update only the bibliographic fields and `updated_at`, preserving governance and text fields.
2. WHEN the operator tries to change immutable fields (`id`, `file_hash`, `drive_file_id`, `origin`, `pipeline_version`, `raw_text`, `refined_text`, `status`) through this endpoint THEN the system SHALL reject with 400 listing the invalid fields.
3. WHEN `publication_year` receives a value outside a reasonable range (e.g., < 1900 or > current year + 1) THEN the Zod schema SHALL reject with a clear message.

**Independent Test**: Create a document, send a PATCH with `{ doi, authors, publication_year, notes }`, query the record, and confirm that those fields were updated and nothing else was touched.

---

### P3: Basic listing of ingested documents

**User Story**: As the operator, I want to see a list of the documents already ingested with their statuses and main metadata, so that I can quickly know the state of the corpus.

**Why P3**: Useful for the DEMO, but not a prerequisite for the subsequent phases — the operator can inspect via SQL while this does not exist.

**Acceptance Criteria**:

1. WHEN the operator calls `GET /api/documents` THEN the system SHALL return a paginated list of documents with: `id`, `title`, `status`, `doi`, `authors`, `publication_year`, `created_at`, `updated_at`, `last_error` (if present).
2. WHEN the query param `?status=failed` is provided THEN only documents with that status SHALL be returned.

---

## Edge Cases

- **PDF with no extractable text (images only):** WHEN extraction returns empty text or below a configurable minimum threshold THEN the system SHALL mark the document as `failed` with `last_error = 'raw_text_empty'` — OCR is a Deferred Idea.
- **Encrypted or password-protected PDF:** WHEN extraction throws a protection error THEN the system SHALL mark as `failed` with `last_error = 'pdf_protected'`.
- **PDF too large (above a configurable limit):** WHEN the file size exceeds the limit THEN the system SHALL mark as `failed` with `last_error = 'pdf_too_large'` — avoids OOM on a Vercel function.
- **File renamed in Drive:** WHEN a file already ingested (matched by `drive_file_id`) is renamed in Drive AND the sync is triggered THEN the system SHALL ignore the name change — `title` was set at insertion time and can be edited manually (see P2).
- **File deleted in Drive:** WHEN a file that has a record in the database no longer exists in Drive THEN the system SHALL preserve the record and its content — deletions are out of scope for v1 (Deferred Idea: tombstone policy).
- **Two files with identical content (same hash) but different `drive_file_id`:** WHEN both are synced THEN two distinct records SHALL be created — decision AD-004 (no automatic dedup).
- **Network failure while downloading the PDF from Drive:** WHEN the download fails THEN the system SHALL mark as `failed` with `last_error = 'drive_download_failed'` and allow reprocessing.
- **Concurrent execution of the sync:** WHEN two sync runs happen in parallel THEN the second one SHALL be rejected (simple lock) or wait, to avoid duplicate record creation.

---

## Requirement Traceability

| Requirement ID | Story                                        | Phase  | Status  |
| -------------- | -------------------------------------------- | ------ | ------- |
| INGEST-01      | P1: E2E pipeline                             | Design | Pending |
| INGEST-02      | P1: E2E pipeline — governance                | Design | Pending |
| INGEST-03      | P1: E2E pipeline — happy-path transitions    | Design | Pending |
| INGEST-04      | P1: Resilient transitions                    | Design | Pending |
| INGEST-05      | P1: State machine rejects invalid ones       | Design | Pending |
| INGEST-06      | P1: Per-document failure isolation           | Design | Pending |
| INGEST-07      | P2: Reprocessing `failed` documents          | -      | Pending |
| INGEST-08      | P2: Manual metadata editing                  | -      | Pending |
| INGEST-09      | P2: Immutability of core fields              | -      | Pending |
| INGEST-10      | P3: Document listing                         | -      | Pending |

**ID format:** `INGEST-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 10 total, 0 mapped to tasks, 10 unmapped ⚠️ (expected — the Tasks phase has not run yet)

---

## Success Criteria

How we know Phase 1 is well done:

- [ ] A small (fixture) PDF dropped into the test folder is in `status = processed` with both text fields populated within < 30s of triggering the local sync.
- [ ] Unit + integration test suite runs in < 60s locally and in CI, with >80% coverage on the core modules (extractor, refiner, state machine, repository).
- [ ] No document ends up in an inconsistent state after injected failures: every row is always in one of the three valid states (`pending`, `processed`, `failed`) and satisfies the invariants (`processed` ⇒ `raw_text != NULL AND refined_text != NULL`).
- [ ] Governance fields (`id`, `file_hash`, `drive_file_id`, `origin`, `pipeline_version`, `created_at`, `updated_at`, `status`) are populated in 100% of records created by the pipeline.
- [ ] The operator can reprocess a `failed` document without touching the database manually.

---

## Open Questions (to resolve before `design.md`)

The decisions below are Phase 1 gray areas and will be handled in `.specs/features/document-ingestion/context.md` (via the discuss phase) or answered directly by the user:

1. **PDF extraction strategy:** `unpdf` / `pdf-parse` / `pdfjs-dist`? Run a benchmark against 3 representative PDFs from the real corpus before deciding?
2. **Refinement strategy:** deterministic cleanup (regex / whitespace normalization / joining hyphenated words / removing header-footer) **vs** LLM-assisted refinement (prompt to clean the text) **vs** hybrid (deterministic first, LLM for tough cases)?
3. **Sync trigger:** manual HTTP endpoint, local CLI, daily Vercel Cron, or a combination?
4. **Pipeline execution:** synchronous inside the request (simple, but timeout risk on Vercel) **vs** queued (background job via Inngest / Trigger.dev / QStash) **vs** calling a long Node runtime locally and only scheduling in production?
5. **Max PDF size limit:** what default? 20MB? 50MB?
6. **Storage of the original PDF:** re-download from Drive every time, or cache in object storage (Vercel Blob / S3)?
