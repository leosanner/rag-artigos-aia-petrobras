# 03 - Infrastructure: Drive, PDF, and Inngest

## Goal

Introduce the external adapters required by F-01 behind interfaces so application services remain testable.

## Scope

- Google Drive adapter for listing candidate PDF files and downloading PDF bytes.
- `unpdf` extractor implementation behind the `PdfExtractor` Strategy.
- Inngest client and function registration.
- Environment validation for Inngest credentials.

## Implementation Notes

- Add only adapter-level code in this block; do not embed orchestration decisions in route handlers.
- Drive listing must expose enough metadata for the application service: Drive file id, name, MIME type, and any available ordering field.
- The PDF extractor must convert known extraction failures into safe ingestion error codes.
- Inngest setup must publish and receive `ingestion/sync.requested` with `{ runId }`.
- Keep raw provider errors in logs only; persisted/API-visible errors must be safe codes or generic messages.

## Tests First

- Unit tests for Drive candidate normalization using mocked provider responses.
- Unit tests for PDF extractor success and empty-text classification.
- Unit tests for Inngest event payload shape and handler wiring where feasible without calling the external service.

## Done When

- External packages required by F-01 are added.
- Env validation covers Inngest variables.
- Adapter tests pass without real Drive or real Inngest network calls.
