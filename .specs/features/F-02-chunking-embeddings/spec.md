# F-02 - Chunking and Embeddings

## Scope

**In scope:**
- Manual operator-triggered indexing of documents that are already `processed` by F-01.
- Hybrid chunking over `documents.refined_text` only, with stable chunk indexes and document governance metadata.
- Embedding generation through the Vercel AI SDK and OpenAI provider, using `text-embedding-3-large` as the M2 default.
- Persistence of chunks and 3072-dimension embeddings in Postgres/pgvector.
- Idempotent indexing: skip already indexed documents by default, and rebuild selected documents when `force = true`.
- Async indexing orchestration through Inngest, with persisted indexing-run and per-document item state.
- A Portuguese operator page at `/indexing` to start an indexing run and inspect progress.
- Tests for chunking rules, repositories, embedding adapter boundaries, indexing orchestration, API contracts, and pgvector persistence.

**Out of scope:**
- Retrieval, answer generation, citations, question UI, and RAG response contracts; those start in F-03.
- Focused single-document question behavior; that is F-04.
- Automatic indexing immediately after ingestion.
- Full observability for tokens, cost, latency, and answer logs; that belongs to M3.
- Reprocessing or changing F-01 ingestion behavior.
- Automatic DOI lookup, bibliographic inference, duplicate-content blocking, or metadata editing.
- Supporting multiple embedding dimensions in the same vector table.

## Context & Motivation

M2 starts from the governed document foundation delivered by F-01. F-01 produces `processed` documents with non-empty `refined_text`; F-02 turns those documents into retrieval-ready chunks with embeddings stored in pgvector.

This feature implements the roadmap item "Chunking + Embeddings (Phase 2)" in `.specs/project/ROADMAP.md` and follows the architecture guardrails in `.specs/project/ARCHITECTURE.md`: chunking must read `refined_text`, retrieval metadata must remain traceable, provider-specific APIs must stay behind interfaces, and agents must not become a dependency of the base RAG flow.

During M2 planning, four local PDF assets in `assets/pdfs/` were extracted with `unpdf` to estimate embedding cost. The sample contained about 74,602 estimated tokens; extrapolating to 31 articles gave about 578,166 tokens, or roughly US$0.075 with `text-embedding-3-large` at the official price of US$0.13 per 1M tokens. The low absolute cost supports prioritizing retrieval quality for the DEMO.

## Implementation Blocks

The feature should be implemented in the same small-block style used by F-01.
Read this overview first, then open only the block document needed for the
current task:

- [01 - Domain: Chunking and Safe Errors](01-domain-chunking-and-errors.md): deterministic hybrid chunking, token estimation, and safe indexing error codes.
- [02 - Persistence: Chunks and Indexing Runs](02-persistence-chunks-and-indexing-runs.md): pgvector schema, indexing-run schema, repositories, migrations, and real Postgres tests.
- [03 - Application, Embeddings, and Inngest](03-application-embedding-and-inngest.md): start/get/process services, OpenAI embedding adapter through the Vercel AI SDK, env validation, and Inngest wiring.
- [04 - Interface: API and Page](04-interface-api-and-page.md): indexing API routes, Zod request/response schemas, bearer auth, and Portuguese `/indexing` page.
- [05 - Integration and Review](05-integration-and-review.md): end-to-end validation, full verification, spec sync, and review handoff.

## Business Rules

- RN-01: F-02 indexes only documents with `status = "processed"`.
- RN-02: Chunking reads only `documents.refined_text`; it never reads `raw_text`.
- RN-03: A processed document with empty or missing `refined_text` is invalid input and must be skipped or failed safely, not chunked.
- RN-04: Chunks must retain `document_id`, `chunk_index`, document `pipeline_version`, chunking version, embedding model, and embedding dimensions.
- RN-05: `chunk_index` is stable for the same document text, chunking version, and chunking configuration.
- RN-06: The default chunking strategy is hybrid paragraph-aware chunking with an estimated max chunk size of 900 tokens and an estimated overlap of 150 tokens.
- RN-07: Indexing skips documents that already have chunks for the active chunking version and embedding model unless `force = true`.
- RN-08: When `force = true`, existing chunks for the selected document scope and active chunking/embedding configuration are deleted and recreated in the same run.
- RN-09: F-02 stores one embedding per chunk; a chunk without an embedding is not retrieval-ready.
- RN-10: The M2 embedding default is `text-embedding-3-large` with 3072 dimensions.
- RN-11: If an embedding provider returns a vector with a dimension other than 3072, the affected document item fails and no partial retrieval-ready chunks are left for that document.
- RN-12: One failed document must not stop indexing of other selected documents.
- RN-13: Manual indexing runs asynchronously through Inngest and are inspectable after the start request returns.
- RN-14: Only one indexing run may be `queued` or `processing` at a time.
- RN-15: Starting an indexing run requires the existing operator bearer secret pattern; F-02 reuses `INGESTION_SYNC_SECRET` for the manual start action rather than introducing a second shared secret.

## Functional Requirements

- [x] RF-01: The database schema defines persistent chunks with pgvector embeddings and the metadata required for traceable retrieval.
- [x] RF-02: The database schema defines indexing runs with `queued | processing | completed | failed` state and indexing run items with `processing | processed | failed` state.
- [x] RF-03: The hybrid chunker produces stable, non-empty chunks from `refined_text`, preserving paragraph boundaries when possible and applying 900/150 estimated token limits.
- [x] RF-04: The chunker preserves deterministic `chunk_index` ordering for the same input.
- [x] RF-05: The embedding provider port can embed multiple chunk texts and validate 3072-dimension vectors.
- [x] RF-06: The OpenAI embedding adapter uses the Vercel AI SDK provider boundary and reads `OPENAI_API_KEY` plus the active embedding model from server env/config.
- [x] RF-07: `POST /api/rag/indexing/runs` creates a queued indexing run when no active run exists and returns immediately with run metadata.
- [x] RF-08: `POST /api/rag/indexing/runs` returns 401 without creating a run when the bearer secret is missing or wrong.
- [x] RF-09: `POST /api/rag/indexing/runs` returns 409 with the active run id when another indexing run is queued or processing.
- [x] RF-10: The Inngest indexing function selects processed documents in deterministic order and skips documents already indexed for the active chunking/embedding configuration unless `force = true`.
- [x] RF-11: The indexing service can index all eligible processed documents or a single requested `documentId`.
- [x] RF-12: If `force = true`, the indexing service rebuilds existing chunks for the selected scope.
- [x] RF-13: Per-document extraction from `refined_text`, chunking, embedding, and persistence failures are recorded on the indexing item and do not stop the run.
- [x] RF-14: `GET /api/rag/indexing/runs/:id` returns aggregate counts and item-level statuses for polling.
- [x] RF-15: `/indexing` lets the operator enter the shared secret, start an indexing run, optionally enable force rebuild, and poll run progress in Portuguese.
- [x] RF-16: API responses are validated with Zod and never include provider stack traces, API keys, database URLs, or raw embedding-provider errors.

## System Flow

1. The operator opens `/indexing`.
2. The page lets the operator provide the existing shared operator secret, choose default skip mode or `force = true`, and optionally target one document.
3. The page calls `POST /api/rag/indexing/runs` with `Authorization: Bearer <secret>` and body `{ documentId?: string, force?: boolean }`.
4. The route validates the request body, validates the bearer secret against `INGESTION_SYNC_SECRET`, and delegates to `StartIndexingRun`.
5. `StartIndexingRun` checks for an active indexing run. If one exists, it returns a conflict result with the active run id.
6. If no active run exists, `StartIndexingRun` creates a queued indexing run and publishes Inngest event `rag/indexing.requested` with `{ runId }`.
7. The route returns 202 with `{ runId, status: "queued", force, documentId }`.
8. The `/indexing` page polls `GET /api/rag/indexing/runs/:id`.
9. The Inngest function receives `rag/indexing.requested` and calls `ProcessIndexingRun`.
10. `ProcessIndexingRun` marks the run `processing`, loads the persisted run options, and selects processed documents in deterministic order. Blank `refined_text` is not prefiltered; it is handled as a per-item failure.
11. If `documentId` is set, the selected scope is exactly that document when it exists. A missing document fails the run with `document_not_indexable`; a targeted `pending` or `failed` document creates a failed item and the run still completes safely.
12. If `force = false`, documents already indexed for the active chunking version and embedding model are counted only in `skippedCount` and do not create run-item rows.
13. If `force = true`, selected documents are rebuilt through the same per-document replacement path used for first-time indexing.
14. For each non-skipped selected document, the service creates an indexing-run item, validates that `refined_text` is non-empty, and chunks `refined_text` with the hybrid chunker.
15. The embedding provider embeds the chunk texts behind an `EmbeddingProvider` interface and validates the returned embedding count and dimensions before persistence.
16. The chunk repository persists chunk rows and embeddings atomically per document so a provider or database failure does not leave partial retrieval-ready chunks for that document.
17. On per-document success, the run item is marked `processed`; on failure, it is marked `failed` with a safe error code.
18. After all selected documents finish, the run stores aggregate counts and becomes `completed`, with `selectedCount = processedCount + failedCount + skippedCount`.
19. If an unrecoverable run-level failure occurs before the per-item loop can finish, the run becomes `failed` with a safe `last_error`.

## Invariants / Non-negotiables

- INV-01: F-02 must never create chunks from `raw_text`.
- INV-02: F-02 must never index `pending` or `failed` documents.
- INV-03: A retrieval-ready chunk must always have non-empty content and exactly one 3072-dimension embedding.
- INV-04: Chunk metadata must preserve document id, chunk index, document pipeline version, chunking version, embedding model, and embedding dimensions.
- INV-05: Provider-specific OpenAI or Vercel AI SDK calls must remain outside domain and application business rules.
- INV-06: A failed indexing item must not silently delete or mutate the source document.
- INV-07: API responses must not leak `OPENAI_API_KEY`, `DATABASE_URL`, `INGESTION_SYNC_SECRET`, or raw provider stack traces.
- INV-08: F-02 must not call an answer-generation LLM.
- INV-09: F-02 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `document_chunks` | `id`, `document_id`, `chunk_index`, `content`, `content_hash`, `estimated_tokens`, `document_pipeline_version`, `chunking_version`, `embedding_model`, `embedding_dimensions`, `embedding`, `created_at`, `updated_at` | New retrieval-ready chunk table. `embedding` is pgvector with 3072 dimensions. |
| `rag_indexing_runs` | `id`, `status`, `document_id`, `force`, `selected_count`, `processed_count`, `failed_count`, `skipped_count`, `last_error`, `created_at`, `started_at`, `finished_at`, `updated_at` | New async indexing-run table. `document_id` is nullable for whole-corpus indexing. |
| `rag_indexing_run_items` | `id`, `run_id`, `document_id`, `status`, `chunk_count`, `last_error`, `created_at`, `updated_at` | Per-document result rows for operator inspection. `status` is `processing`, `processed`, or `failed`. |
| `documents` | existing `id`, `title`, `pipeline_version`, `status`, `refined_text` | Read-only source table for F-02, except no source document fields are mutated. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/indexing` | Portuguese operator page for manual indexing and run polling. |
| `POST` | `/api/rag/indexing/runs` | Requires bearer secret, creates a queued indexing run, and publishes `rag/indexing.requested`. |
| `GET` | `/api/rag/indexing/runs/:id` | Returns indexing-run detail with aggregate counts and per-document items. |
| `GET/POST/PUT` | `/api/inngest` | Existing Inngest serve route extended with the indexing function. |
| Function | `StartIndexingRun.execute(input)` | Application service used by the start route. |
| Function | `GetIndexingRun.execute(runId)` | Application service used by polling. |
| Function | `ProcessIndexingRun.execute(runId)` | Application service called by Inngest. |
| Strategy | `TextChunker.chunk(input)` | Domain chunker that returns stable chunk objects from refined text. |
| Strategy | `EmbeddingProvider.embedMany(texts)` | Provider port that returns validated embeddings for chunk text. |

### Key Modules

- `src/domain/chunking/*` - chunking constants, hybrid chunker, and chunk validation.
- `src/application/indexing/*` - start/get/process indexing application services, ports, and Zod schemas.
- `src/repositories/document-chunks-repository.ts` - chunk and vector persistence, skip/force checks, and document-scoped deletion.
- `src/repositories/rag-indexing-runs-repository.ts` - indexing run and item lifecycle persistence.
- `src/infrastructure/ai/openai-embedding-provider.ts` - Vercel AI SDK/OpenAI embedding adapter.
- `src/app/api/rag/indexing/runs/*` - indexing start and polling API route handlers.
- `src/app/ingestion/page.tsx` - unchanged; ingestion remains separate from indexing.
- `src/app/indexing/page.tsx` - Portuguese operator indexing page.

## Dependencies

- **Prerequisite features:** F-01 Document Ingestion.
- **External packages added:** `ai` - Vercel AI SDK core; `@ai-sdk/openai` - OpenAI provider for embeddings and later generation.
- **External services:** Postgres/pgvector, Inngest, OpenAI API.
- **Environment variables:** `OPENAI_API_KEY` - server-side provider key; `RAG_EMBEDDING_MODEL` - optional server-side override, default `text-embedding-3-large`; `INGESTION_SYNC_SECRET` - reused operator secret for starting manual indexing.

## Acceptance Criteria

1. A processed document with non-empty `refined_text` can be indexed into non-empty chunks with 3072-dimension embeddings.
2. A pending or failed document is not selected for indexing.
3. A processed document with null or blank `refined_text` is not chunked and is reported through a safe failed item.
4. Running indexing twice with `force = false` skips documents already indexed for the active chunking version and embedding model.
5. Running indexing with `force = true` replaces the selected document's chunks for the active configuration.
6. A mixed run with one provider failure and one valid document completes with accurate processed/failed/skipped counts.
7. `POST /api/rag/indexing/runs` returns 401 when the bearer secret is missing or wrong and does not create or enqueue a run.
8. `POST /api/rag/indexing/runs` returns 409 when another indexing run is queued or processing.
9. `GET /api/rag/indexing/runs/:id` returns a Zod-validated response with no credentials or raw provider errors.
10. `/indexing` can start a run and display terminal status without requiring SQL or API tooling.
11. Repository tests verify pgvector persistence using a real test Postgres database.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `OPENAI_API_KEY=<non-empty> pnpm build` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Split M2 into F-02/F-03/F-04 | One M2 spec; two specs combining global and focused RAG | Separate contracts keep TDD, review, and delivery incremental. |
| Manual indexing first | Automatic after ingestion; cron/job-only indexing | Manual control is clearer for a POC and avoids coupling F-01 completion to provider spend. |
| Inngest async indexing | Synchronous request; CLI-only indexing | Reuses the F-01 async pattern and avoids request timeouts on large PDFs or provider latency. |
| Hybrid paragraph-aware chunking at 900/150 estimated tokens | Fixed-size chunking; semantic section parser | Hybrid chunking is testable and respects article paragraphs without overbuilding a scientific-section parser. |
| `text-embedding-3-large` default with 3072 dimensions | `text-embedding-3-small`; env-only model | Local corpus cost simulation showed a low absolute cost for `3-large`, so retrieval quality is prioritized. |
| Skip existing by default, rebuild with `force` | Always rebuild; never rebuild | The default is idempotent and cheap, while `force` supports chunking/model changes during development. |
| Reuse `INGESTION_SYNC_SECRET` for indexing start | Add `RAG_INDEXING_SECRET`; leave indexing unprotected | Reusing the existing operator secret avoids config churn while still protecting a cost-incurring action. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
