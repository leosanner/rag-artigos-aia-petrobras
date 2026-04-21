# F-02 Block 03 - Application, Embeddings, and Inngest

## Goal

Implement the indexing orchestration and provider boundaries: start/get/process
application services, OpenAI embeddings through the Vercel AI SDK, and the
Inngest event/function used for asynchronous processing.

## Scope

**In scope:**

- `StartIndexingRun` application service.
- `GetIndexingRun` application service.
- `ProcessIndexingRun` application service.
- Application ports for document selection, chunking, embeddings, event publishing, and processing handler shape.
- OpenAI embedding adapter using Vercel AI SDK `embedMany` and `@ai-sdk/openai`.
- Env validation for `OPENAI_API_KEY` and `RAG_EMBEDDING_MODEL`.
- Inngest event `rag/indexing.requested`, publisher, function factory, and `/api/inngest` registration.
- Unit tests with fakes plus an integration test with real repositories and fake embeddings.

**Out of scope:**

- HTTP route handlers and `/indexing` page (Block 04).
- Schema/repository implementation (Block 02), except using their public APIs.
- Retrieval, answer generation, citations, observability, cost tracking, and agents.
- Real OpenAI calls in automated tests.

## Business Rules

- RN-B03-01: `StartIndexingRun` creates exactly one queued run and publishes exactly one Inngest event.
- RN-B03-02: Active-run conflicts return a conflict result and publish no event.
- RN-B03-03: `ProcessIndexingRun` marks the run `processing` before selecting documents.
- RN-B03-04: Whole-corpus runs select only processed documents; targeted runs select exactly the requested document if it is indexable.
- RN-B03-05: Pending/failed/missing targeted documents fail safely; they are not chunked.
- RN-B03-06: Blank `refined_text` creates a failed item with `refined_text_empty`.
- RN-B03-07: With `force=false`, already-indexed documents increment `skippedCount` and create no item rows.
- RN-B03-08: With `force=true`, selected documents are rebuilt for the active config.
- RN-B03-09: One document failure must not stop later documents in the same run.
- RN-B03-10: Embedding count and dimensions must match chunks before persistence.
- RN-B03-11: Raw provider errors are normalized to safe indexing error codes.
- RN-B03-12: F-02 does not import or depend on Mastra or any agents framework.

## Functional Requirements

- [ ] RF-B03-01: `StartIndexingRun.execute(input)` creates a queued run with `{ documentId?, force }`.
- [ ] RF-B03-02: `StartIndexingRun.execute(input)` publishes `rag/indexing.requested` with `{ runId }`.
- [ ] RF-B03-03: `StartIndexingRun.execute(input)` returns `{ kind: "conflict", activeRunId }` when the repository reports an active run.
- [ ] RF-B03-04: `GetIndexingRun.execute(runId)` maps persisted runs/items to safe DTOs and normalizes unknown stored errors to `unknown_error`.
- [ ] RF-B03-05: `ProcessIndexingRun.execute(runId)` selects documents according to run scope and persisted `force`.
- [ ] RF-B03-06: The service calls the chunker with `refinedText` only.
- [ ] RF-B03-07: The service calls `EmbeddingProvider.embedMany(chunkContents)`.
- [ ] RF-B03-08: Dimension mismatch fails the item and does not persist chunks.
- [ ] RF-B03-09: Provider failures fail only the affected item.
- [ ] RF-B03-10: Successful documents persist chunks and mark item `processed` with `chunkCount`.
- [ ] RF-B03-11: Final run counts satisfy `selectedCount = processedCount + failedCount + skippedCount`.
- [ ] RF-B03-12: The OpenAI adapter uses `embedMany` with `openai.embedding(activeModel)`.
- [ ] RF-B03-13: Env parser requires `OPENAI_API_KEY` outside tests and defaults `RAG_EMBEDDING_MODEL` to `text-embedding-3-large`.
- [ ] RF-B03-14: Inngest publisher validates UUID run ids before sending.
- [ ] RF-B03-15: Inngest function validates event data before calling `ProcessIndexingRun.execute(runId)`.
- [ ] RF-B03-16: `/api/inngest` registers both F-01 ingestion and F-02 indexing functions.

## Key Modules

- `src/application/indexing/ports.ts`
- `src/application/indexing/start-indexing-run.ts`
- `src/application/indexing/get-indexing-run.ts`
- `src/application/indexing/process-indexing-run.ts`
- `src/application/indexing/schemas.ts`
- `src/infrastructure/ai/openai-embedding-provider.ts`
- `src/infrastructure/indexing/inngest.ts`
- `src/app/api/inngest/route.ts`
- `src/env/server.ts`

## Tests First

- `src/application/indexing/start-indexing-run.test.ts`
- `src/application/indexing/get-indexing-run.test.ts`
- `src/application/indexing/process-indexing-run.test.ts`
- `src/application/indexing/process-indexing-run.integration.test.ts`
- `src/infrastructure/ai/openai-embedding-provider.test.ts`
- `src/infrastructure/indexing/inngest.test.ts`
- `src/app/api/inngest/route.test.ts`
- Add env tests for OpenAI/RAG embedding variables.

## Done When

- Application and infrastructure tests pass without real OpenAI calls.
- Integration test proves real DB + fake embeddings end to end.
- `/api/inngest` still supports F-01 ingestion while adding F-02 indexing.
- No F-02 module imports Mastra or an agents package.
