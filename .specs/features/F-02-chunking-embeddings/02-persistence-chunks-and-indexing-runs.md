# F-02 Block 02 - Persistence: Chunks and Indexing Runs

## Goal

Create the durable Postgres/pgvector foundation for F-02: retrieval-ready chunks,
indexing runs, indexing run items, and repositories that isolate Drizzle access.

## Scope

**In scope:**

- Drizzle schema and migration for `document_chunks`.
- Drizzle schema and migration for `rag_indexing_runs`.
- Drizzle schema and migration for `rag_indexing_run_items`.
- Repository APIs for chunk persistence, skip detection, force replacement, run
  lifecycle, and item lifecycle.
- Repository additions needed to select/read documents for indexing.
- Real Postgres repository tests, including pgvector persistence.

**Out of scope:**

- Chunking algorithm implementation (Block 01).
- OpenAI/Vercel AI SDK provider adapter (Block 03).
- Application orchestration, Inngest event processing, API routes, and UI.
- Retrieval queries, similarity search, generation, citations, observability, and agents.

## Business Rules

- RN-B02-01: `document_chunks.embedding` stores exactly `vector(3072)`.
- RN-B02-02: Each persisted chunk belongs to one document and one active chunking/embedding config.
- RN-B02-03: `(document_id, chunking_version, embedding_model, chunk_index)` is unique.
- RN-B02-04: Chunk content must be non-empty and `estimated_tokens` must be positive.
- RN-B02-05: `embedding_dimensions` is persisted and constrained to `3072`.
- RN-B02-06: At most one indexing run may be active (`queued` or `processing`) at a time, enforced by Postgres.
- RN-B02-07: Run item success status is `processed`; run success status is `completed`.
- RN-B02-08: Documents skipped because chunks already exist with `force=false` are represented only by `skipped_count`, not item rows.
- RN-B02-09: Repository methods must not mutate source `documents` rows during indexing.
- RN-B02-10: Force replacement must not leave partial retrieval-ready chunks for a document if insertion fails.

## Functional Requirements

- [ ] RF-B02-01: Schema exports `documentChunks` with governance metadata and `vector(3072)`.
- [ ] RF-B02-02: Schema exports `ragIndexingRuns` with statuses `queued`, `processing`, `completed`, `failed`.
- [ ] RF-B02-03: Schema exports `ragIndexingRunItems` with statuses `processing`, `processed`, `failed`.
- [ ] RF-B02-04: Migration creates enums, tables, constraints, indexes, and foreign keys.
- [ ] RF-B02-05: `DocumentChunksRepository.hasChunksForConfig(documentId, config)` returns whether a document is already indexed for the active config.
- [ ] RF-B02-06: `DocumentChunksRepository.replaceDocumentChunks(input)` atomically replaces chunks for one document/config.
- [ ] RF-B02-07: Replacement rollback preserves previous chunks if inserting new chunks fails.
- [ ] RF-B02-08: `DocumentChunksRepository.deleteDocumentChunksForConfig(documentId, config)` removes only the selected document/config.
- [ ] RF-B02-09: `RagIndexingRunsRepository.createQueuedRun(input)` persists `documentId`, `force`, zero counts, and `queued` status.
- [ ] RF-B02-10: `RagIndexingRunsRepository.createQueuedRun(input)` raises typed conflict on active-run unique violation.
- [ ] RF-B02-11: Run lifecycle methods mark processing, completed, and failed with safe counts/errors.
- [ ] RF-B02-12: Item lifecycle methods create processing items and mark them `processed` or `failed`.
- [ ] RF-B02-13: `getRunWithItems(runId)` returns a run plus ordered items.
- [ ] RF-B02-14: `DocumentsRepository.listProcessedForIndexing()` returns only `processed` documents in deterministic order.
- [ ] RF-B02-15: `DocumentsRepository.findByIdForIndexing(documentId)` returns the target document or null without mutating it.

## Key Modules

- `src/db/schema.ts`
- `drizzle/*.sql`
- `src/repositories/document-chunks-repository.ts`
- `src/repositories/rag-indexing-runs-repository.ts`
- `src/repositories/documents-repository.ts`
- `src/test/db.ts`

## Tests First

- `src/repositories/document-chunks-repository.test.ts`
- `src/repositories/rag-indexing-runs-repository.test.ts`
- Targeted additions to `src/repositories/documents-repository.test.ts`

Repository tests must use real Postgres and must not mock pgvector behavior.

## Done When

- New migration applies to both local and test databases.
- Repository tests pass against real Postgres.
- `resetTestDatabase` truncates F-02 tables safely.
- Existing F-01 repository tests still pass.
