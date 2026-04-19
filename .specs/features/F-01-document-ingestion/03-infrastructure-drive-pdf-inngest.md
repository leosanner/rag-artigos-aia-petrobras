# F-01 Block 03 - Infrastructure: Drive, PDF, and Inngest

## Scope

**In scope:**
- Google Drive adapter for listing candidate files from the fixed Drive folder and downloading PDF bytes.
- `PdfExtractor` implementation backed by `unpdf`.
- Minimal ingestion ports used by later application services.
- Inngest client, event constants/schema, event publisher, and function factory for `ingestion/sync.requested`.
- Server environment validation for Google Drive, ingestion sync authorization, and dev-aware Inngest configuration.
- Unit tests for adapter normalization, extraction classification, event payloads, and env validation without real Drive or Inngest network calls.

**Out of scope:**
- `StartIngestionRun`, `GetIngestionRun`, or `ProcessIngestionRun` application orchestration.
- API route handlers, `/api/inngest` route registration, or the `/ingestion` page.
- Repository/schema changes or database migrations.
- Drive duplicate filtering by `documents.drive_file_id`.
- The max-3 document selection rule.
- Bibliographic metadata lookup or inference.
- Chunking, embeddings, retrieval, generation, XAI, observability, and agents.
- Real Google Drive or real Inngest calls in tests.

## Context & Motivation

Blocks 01 and 02 delivered pure domain rules and persistence for F-01. This block introduces the external adapters needed by the future orchestration block while preserving the architecture in `.specs/project/ARCHITECTURE.md`: application services depend on ports, infrastructure implements those ports, and provider details stay outside domain and repository modules.

The implementation follows AD-002, AD-006, and AD-008 in `.specs/project/STATE.md`: Google Drive is accessed through a Service Account and fixed folder, PDF extraction uses `unpdf`, and asynchronous ingestion is triggered through Inngest.

## Business Rules

- RN-B03-01: Google Drive is the only file source implemented by this block.
- RN-B03-02: The Drive adapter lists files from exactly the configured `GOOGLE_DRIVE_FOLDER_ID`.
- RN-B03-03: The Drive adapter returns provider metadata only; it must not decide which files become documents.
- RN-B03-04: The Drive adapter must expose Drive file id, name, MIME type, created time, and modified time to the application layer.
- RN-B03-05: PDF bytes are downloaded by Drive file id without storing the original PDF outside Google Drive.
- RN-B03-06: The PDF extractor returns raw extracted text only; it must not refine, summarize, infer metadata, or call an LLM.
- RN-B03-07: Empty or whitespace-only extracted text is classified as `raw_text_empty`.
- RN-B03-08: Provider extraction failures are classified as `extraction_failed`.
- RN-B03-09: Inngest events use the exact event name `ingestion/sync.requested` and payload `{ runId }`.
- RN-B03-10: Inngest credentials are required for production/cloud mode, but tests and local `INNGEST_DEV` mode may run without real Inngest secrets.

## Functional Requirements

- [ ] RF-B03-01: `src/application/ingestion/ports.ts` exports `DriveFileCandidate`, `DriveFileSource`, `PdfExtractor`, `IngestionEventPublisher`, and `ProcessIngestionRunHandler`.
- [ ] RF-B03-02: `GoogleDriveFileSource.listFiles()` calls Drive v3 `files.list` with a query scoped to the configured folder and excluding trashed files.
- [ ] RF-B03-03: `GoogleDriveFileSource.listFiles()` requests only `nextPageToken` and file fields required by `DriveFileCandidate`.
- [ ] RF-B03-04: `GoogleDriveFileSource.listFiles()` uses shared-drive-compatible options where supported by Drive v3.
- [ ] RF-B03-05: `GoogleDriveFileSource.listFiles()` orders provider results deterministically by Drive metadata.
- [ ] RF-B03-06: `GoogleDriveFileSource.listFiles()` normalizes complete provider rows into `DriveFileCandidate` values with nullable optional metadata.
- [ ] RF-B03-07: `GoogleDriveFileSource.listFiles()` rejects provider rows missing required `id` or `name` with `IngestionError("unknown_error")`.
- [ ] RF-B03-08: `GoogleDriveFileSource.downloadFile(driveFileId)` calls Drive v3 `files.get` with `alt = "media"` and returns a `Uint8Array`.
- [ ] RF-B03-09: `GoogleDriveFileSource.downloadFile(driveFileId)` converts provider download failures to `IngestionError("drive_download_failed")`.
- [ ] RF-B03-10: `UnpdfPdfExtractor.extract(pdfBytes)` uses `getDocumentProxy` and `extractText(..., { mergePages: true })`.
- [ ] RF-B03-11: `UnpdfPdfExtractor.extract(pdfBytes)` returns non-empty extracted text unchanged except for final emptiness validation.
- [ ] RF-B03-12: `UnpdfPdfExtractor.extract(pdfBytes)` throws `IngestionError("raw_text_empty")` when merged extracted text is empty or whitespace-only.
- [ ] RF-B03-13: `UnpdfPdfExtractor.extract(pdfBytes)` converts any non-empty extraction exception to `IngestionError("extraction_failed")`.
- [ ] RF-B03-14: `src/infrastructure/ingestion/inngest.ts` exports the event name, event data schema, Inngest client, publisher, and function factory.
- [ ] RF-B03-15: The Inngest publisher sends exactly `{ name: "ingestion/sync.requested", data: { runId } }`.
- [ ] RF-B03-16: The Inngest function factory validates event data with Zod before calling the injected `ProcessIngestionRunHandler`.
- [ ] RF-B03-17: Server env parsing validates Drive variables, normalizes escaped Google private-key newlines, requires `INGESTION_SYNC_SECRET` outside tests, and exposes optional Inngest variables.
- [ ] RF-B03-18: Server env parsing rejects missing `INNGEST_EVENT_KEY` or `INNGEST_SIGNING_KEY` outside `NODE_ENV = "test"` unless `INNGEST_DEV` is set.
- [ ] RF-B03-19: Unit tests do not call real Google Drive or real Inngest services.

## System Flow

1. A later application service receives an ingestion run id from the Inngest function.
2. The Inngest function created in this block receives event `ingestion/sync.requested`.
3. The function validates `event.data` with `ingestionSyncRequestedEventDataSchema`.
4. The function calls the injected `ProcessIngestionRunHandler.execute(runId)`.
5. A later `ProcessIngestionRun` service will call `DriveFileSource.listFiles()`.
6. `GoogleDriveFileSource` uses Service Account credentials and `GOOGLE_DRIVE_FOLDER_ID` from validated env to call Drive v3.
7. The adapter returns normalized Drive candidates without filtering existing documents or applying the max-3 batch limit.
8. The future service will call `DriveFileSource.downloadFile(driveFileId)` for each selected candidate.
9. The adapter downloads file bytes with `files.get(..., alt: "media")` and returns a `Uint8Array`.
10. The future service will call `PdfExtractor.extract(pdfBytes)`.
11. `UnpdfPdfExtractor` extracts merged raw text through `unpdf` and classifies empty/failure cases with safe ingestion error codes.

This block wires infrastructure only. It does not create runs, update documents, compute hashes, refine text, or complete/fail runs.

## Invariants / Non-negotiables

- INV-B03-01: Infrastructure adapters must not import repositories or mutate Postgres state.
- INV-B03-02: Infrastructure adapters must not import route handlers or UI modules.
- INV-B03-03: Drive adapters must not infer DOI, authors, publication year, notes, or any bibliographic metadata.
- INV-B03-04: Drive adapters must not skip existing documents, enforce the max-3 limit, or use file hashes for duplicate handling.
- INV-B03-05: PDF extraction must not perform deterministic refinement, semantic rewriting, summarization, chunking, embedding, retrieval, generation, or agent calls.
- INV-B03-06: Provider secrets and raw provider errors must never be returned from adapter public methods; callers only receive safe `IngestionError` codes.
- INV-B03-07: Unit tests for this block must use mocks/stubs for Drive, `unpdf`, and Inngest network boundaries.
- INV-B03-08: The base ingestion infrastructure must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `DriveFileCandidate` | `driveFileId`, `name`, `mimeType`, `createdTime`, `modifiedTime` | Normalized Drive metadata returned to application services. |
| `IngestionSyncRequestedEventData` | `runId` | Zod-validated Inngest event payload for background processing. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| Interface | `DriveFileSource.listFiles()` | Lists normalized Drive candidates from the configured folder. |
| Interface | `DriveFileSource.downloadFile(driveFileId)` | Downloads PDF bytes by Drive file id. |
| Interface | `PdfExtractor.extract(pdfBytes)` | Extracts raw text from PDF bytes. |
| Interface | `IngestionEventPublisher.publishSyncRequested(runId)` | Publishes the Inngest event used by the future start-run service. |
| Type | `ProcessIngestionRunHandler.execute(runId)` | Application-service shape injected into the Inngest function factory. |
| Function | `createGoogleDriveFileSourceFromEnv()` | Builds the Drive adapter using validated env. |
| Function | `createProcessIngestionRunFunction(handler)` | Builds the Inngest function for `ingestion/sync.requested`. |

### Key Modules

- `src/application/ingestion/ports.ts` - infrastructure-independent ports for later F-01 application services.
- `src/infrastructure/drive/google-drive-file-source.ts` - Google Drive Service Account adapter.
- `src/infrastructure/pdf/unpdf-pdf-extractor.ts` - `unpdf` implementation of the `PdfExtractor` Strategy.
- `src/infrastructure/ingestion/inngest.ts` - Inngest client, event schema, publisher, and function factory.
- `src/env/server.ts` - server env parser for database, Drive, and dev-aware Inngest configuration.

## Dependencies

- **Prerequisite features:** F-01 Block 01 domain errors and F-01 Block 02 persistence contracts.
- **External packages added:** `googleapis@171.4.0` for the official Drive v3 client; `unpdf@1.6.0` for PDF extraction; `inngest@4.2.4` for event publishing and function definitions.
- **External services:** Google Drive API and Inngest at runtime. Tests mock both.
- **Environment variables:** `DATABASE_URL`; `GOOGLE_DRIVE_FOLDER_ID`; `GOOGLE_SERVICE_ACCOUNT_EMAIL`; `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`; `INGESTION_SYNC_SECRET` required unless `NODE_ENV = "test"`; optional `INNGEST_DEV` for local dev; `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` required unless `NODE_ENV = "test"` or `INNGEST_DEV` is set.

## Acceptance Criteria

1. Block 03 contract is reviewer-ready and uses the same structure as blocks 01 and 02.
2. `googleapis`, `unpdf`, and `inngest` are runtime dependencies.
3. `src/application/ingestion/ports.ts` exports the minimal ports described in this contract.
4. Drive adapter tests prove folder query, requested fields, shared-drive-compatible options, deterministic ordering, normalization, incomplete-row failure, and download bytes.
5. PDF extractor tests prove successful extraction, empty extracted text classification, and extraction exception classification.
6. Inngest tests prove publisher payload shape and function handler wiring with Zod validation.
7. Env parser tests prove ingestion sync secret validation, dev-aware Inngest validation, and Google private-key newline normalization.
8. No block-03 tests call real Drive or real Inngest network services.
9. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Use `googleapis` for Drive access | Direct REST calls through `fetch` plus `google-auth-library`; manual OAuth; per-user OAuth | The official client keeps Service Account auth and Drive v3 method shapes close to provider docs while the adapter hides that dependency from application code. |
| Validate Inngest env in a dev-aware way | Require Inngest secrets in every environment; skip env validation entirely for Inngest | Production/cloud mode must fail fast when secrets are missing, but local `INNGEST_DEV` and tests should not require real secrets or fake credentials when the boundary is mocked. |
| Keep Drive candidate filtering outside the adapter | Have the adapter filter only PDFs, skip existing files, and apply max-3 | Filtering and selection depend on repositories and feature orchestration. Keeping the adapter metadata-only preserves testability and prevents infrastructure from owning business rules. |
| Represent PDF extraction as a `PdfExtractor` Strategy | Call `unpdf` directly from orchestration | The Strategy port is already part of the parent F-01 design and lets later extraction alternatives replace `unpdf` without changing application flow. |
| Build the Inngest function through a handler factory | Import a future `ProcessIngestionRun` service directly | The factory lets this block test event validation and wiring now without implementing application orchestration before block 05. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
