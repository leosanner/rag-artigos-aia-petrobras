# F-05 - Answer Traceability

## Scope

**In scope:**
- Persist one trace record for every authorized, schema-valid single-turn
  `POST /api/rag/ask` attempt, including technical failures after validation.
- Add persistent trace tables:
  `rag_query_runs`, `rag_query_run_sources`, and `rag_query_run_related_terms`.
- Store question, answer, safe status/error, applied retrieval settings, source
  snapshot, scores, model versions, prompt version, usage, latency, and cost.
- Extend the embedding and generation provider ports so the application layer
  receives normalized usage and estimated-cost metadata.
- Add deterministic related-term extraction for the top 8 auditable
  terms/themes derived from the question plus retrieved excerpts.
- Add a stable `traceId` to successful ask responses.
- Add audit read endpoints for recent runs and run detail.
- Add `/query` audit UI for the current answer and persisted run inspection.
- Keep technical error responses sanitized even when the failed run is
  persisted.

**Out of scope:**
- Conversation management and transcript UX; those belong to F-06.
- Focused document retrieval; that remains F-07.
- Raw model-token attribution or chain-of-thought capture.
- Streaming transport, user feedback, evaluations, or agent workflows.
- Persisting unauthorized or malformed JSON requests that never pass the ask
  validation boundary.

## Context & Motivation

F-03 gives the operator citations and source excerpts, but the user now wants a
full audit trail on `/query`: question, related terms, input/output tokens,
latency, and cost. The architecture already reserved this work for later
explainability and observability, and this contract intentionally pulls that
governance layer forward onto the query surface.

This feature builds on the operator controls from F-04 and defines the audited
turn model that later chat and focused retrieval must reuse.

## Implementation Blocks

This feature is implemented in the same small-block style used by F-01 through
F-04. Read this overview first, then open only the block document needed for
the current task:

- [01 - Domain: Related Terms and Trace Status](01-domain-related-terms-and-trace-status.md): pure logic for deterministic related-term extraction, ranking, fallback behavior, and safe trace status/error vocabulary.
- [02 - Persistence: Query-Run Traces and Audit Reads](02-persistence-query-run-traces-and-audit-reads.md): schema, repositories, immutable source/term snapshots, and recent/detail audit reads.
- [03 - Application: Audited Ask Flow and Provider Metrics](03-application-audited-ask-flow-and-provider-metrics.md): provider-port expansion, latency/cost accounting, audited single-turn orchestration, and route-agnostic audit read services.
- [04 - Interface: API Audit Endpoints and Query Page](04-interface-api-audit-endpoints-and-query-page.md): `POST /api/rag/ask` response expansion, audit read routes, Zod schemas, and `/query` audit UI.
- [05 - Integration and Review](05-integration-and-review.md): end-to-end verification, doc sync, closeout commands, and independent-review handoff.

## Business Rules

- RN-01: Every authorized, schema-valid `POST /api/rag/ask` attempt persists
  one `rag_query_runs` record, even when generation later fails safely.
- RN-02: Unauthorized requests and malformed/invalid request bodies are not
  persisted because they never produce a trusted ask input.
- RN-03: Successful ask responses include a stable `traceId`.
- RN-04: Failed ask responses remain sanitized and do not expose trace storage
  internals, raw provider bodies, raw prompts, or secrets.
- RN-05: Persisted run status values are:
  `answered`, `answered_no_evidence`, `generation_failed`, and
  `generation_unavailable`.
- RN-06: Persisted traces store the applied `topK`, retrieval strategy, and
  candidateTopK actually used for the request.
- RN-07: Persisted source snapshots must match the source list used for answer
  generation or no-evidence handling for that run.
- RN-08: "Top related tokens" are represented as deterministic related
  terms/themes, not raw provider token attribution.
- RN-09: Related terms are extracted from the normalized question text plus
  retrieved source excerpts, ranked deterministically, and capped at 8 results.
- RN-10: Each related term persists its rank, n-gram size, total frequency, and
  source-coverage count.
- RN-11: Embedding and generation adapters must return normalized numeric usage
  and estimated-cost metadata to the application layer.
- RN-12: Audit read endpoints require the same operator bearer secret pattern
  already used by `/api/rag/ask`.
- RN-13: Stored traces must never include raw prompt text, operator secrets,
  stack traces, or raw provider response bodies.
- RN-14: F-05 stays single-turn; it does not introduce conversations or chat
  transcript state.

## Functional Requirements

- [x] RF-01: The database schema defines `rag_query_runs`,
  `rag_query_run_sources`, and `rag_query_run_related_terms`.
- [x] RF-02: `rag_query_runs` stores question, nullable answer, safe
  status/error, applied retrieval settings, prompt/model versions, latency, and
  usage/cost metrics.
- [x] RF-03: `rag_query_run_sources` stores a snapshot of every selected source,
  including source number, document/chunk ids, document title, excerpt, score,
  and version metadata.
- [x] RF-04: `rag_query_run_related_terms` stores up to 8 deterministic related
  terms with rank, n-gram size, frequency, and source-coverage count.
- [x] RF-05: The question-embedding provider returns both the embedding vector
  and normalized embedding usage/cost metadata.
- [x] RF-06: The generation provider returns the answer plus normalized
  generation usage/cost metadata.
- [x] RF-07: The ask application service measures total request latency and
  persists one run record before serializing the response.
- [x] RF-08: Successful ask responses include `traceId`, `relatedTerms`, and an
  `audit` payload with latency and usage/cost breakdown.
- [x] RF-09: Technical failures after request validation persist a failed run
  with the safe error code and any source snapshot already available.
- [x] RF-10: `GET /api/rag/query-runs` returns recent run summaries in reverse
  chronological order.
- [x] RF-11: `GET /api/rag/query-runs/:id` returns the persisted run detail with
  related terms, sources, and audit metrics.
- [x] RF-12: `/query` renders the current-answer audit panel without requiring a
  second fetch after a successful ask response.
- [x] RF-13: `/query` can load a persisted run from the recent-runs list and
  inspect its sources, related terms, usage, latency, and cost.
- [x] RF-14: Audit responses remain sanitized and contain no secrets, raw
  prompts, stack traces, or provider internals.

## System Flow

1. The operator submits an authorized, schema-valid ask request on `/query`.
2. The route normalizes retrieval settings and delegates to the application
   service.
3. The application service starts total-latency timing for the run.
4. The embedding provider embeds the question and returns the vector plus
   normalized embedding usage/cost metadata.
5. Retrieval runs exactly as defined by F-04/F-03 and returns the selected
   sources for the current request.
6. The related-term extractor derives up to 8 deterministic related terms from
   the normalized question plus the selected source excerpts. If no sources are
   selected, the extractor works from the normalized question text alone.
7. If no sources are selected, the service builds the no-evidence answer,
   records status `answered_no_evidence`, and skips generation.
8. If sources are selected, the generation provider returns the answer plus
   normalized generation usage/cost metadata.
9. Citation validation runs exactly as defined by F-03.
10. The application service computes total latency and total estimated cost,
    then persists the run row plus related sources and related terms.
11. On success, the route returns the answer payload with `traceId`,
    `relatedTerms`, and the audit metrics already attached.
12. On a technical generation failure after validation, the service persists a
    failed run with the safe error code and the route returns the same sanitized
    error shape as before.
13. `/query` uses the success payload for the current audit panel and can call
    `GET /api/rag/query-runs` plus `GET /api/rag/query-runs/:id` for persisted
    run inspection.

## Invariants / Non-negotiables

- INV-01: Every persisted run must correspond to one authorized, schema-valid
  ask request.
- INV-02: Persisted traces must never store raw prompt text, secrets, stack
  traces, or raw provider bodies.
- INV-03: A persisted source snapshot must match the selected sources for that
  run; it must not be recomputed later from live retrieval.
- INV-04: Related terms must come from deterministic extraction over the
  question plus retrieved excerpts, not from model output.
- INV-05: Technical error responses must remain sanitized even when the failed
  run is persisted internally.
- INV-06: F-05 must not introduce chat conversations or a second turn engine.
- INV-07: F-05 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `rag_query_runs` | `id`, `question`, nullable `answer`, `mode`, `status`, nullable `errorCode`, `topK`, `retrievalStrategy`, `candidateTopK`, `promptVersion`, `generationModel`, `embeddingModel`, `latencyMs`, embedding/generation usage fields, embedding/generation cost fields, `totalCostUsd`, `createdAt` | One persisted trace per authorized, schema-valid ask attempt. |
| `rag_query_run_sources` | `runId`, `sourceNumber`, `chunkId`, `documentId`, `documentTitle`, `chunkIndex`, `excerpt`, `score`, `documentPipelineVersion`, `chunkingVersion`, `embeddingModel`, `citedInAnswer` | Immutable source snapshot for the run. |
| `rag_query_run_related_terms` | `runId`, `rank`, `term`, `ngramSize`, `frequency`, `sourceCoverageCount` | Deterministic audit terms capped at 8 per run. |
| `RagRunSummary` | `id`, `question`, `status`, `topK`, `retrievalStrategy`, `latencyMs`, `totalCostUsd`, `createdAt` | Lightweight recent-runs DTO. |
| `RagRunDetail` | current-answer fields plus `question`, `status`, `createdAt` | Detailed persisted trace DTO for UI inspection. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/rag/ask` | Persists one run per authorized, schema-valid ask and returns `traceId` on success. |
| `GET` | `/api/rag/query-runs` | Returns recent run summaries in reverse chronological order. |
| `GET` | `/api/rag/query-runs/:id` | Returns one persisted run with sources, related terms, and audit metrics. |
| `GET` | `/query` | Renders the current-answer audit panel and recent-run inspection UI. |
| Strategy | `QuestionEmbeddingProvider.embedQuestion(question)` | Returns `{ embedding, usage }` instead of only the embedding vector. |
| Strategy | `GenerationProvider.generateAnswer(input)` | Returns `{ answer, usage }` instead of only the answer string. |

### Key Modules

- `src/db/schema.ts` - trace tables and any supporting enums/checks.
- `src/application/rag/*` - trace persistence orchestration, response-shape
  extensions, and audit read services.
- `src/domain/rag/*` - deterministic related-term extraction and ranking.
- `src/repositories/*` - persistence for query runs, source snapshots, and
  related terms.
- `src/infrastructure/ai/*` - normalized usage/cost metadata from embedding and
  generation adapters.
- `src/app/api/rag/ask/*` - success-response trace data and unchanged sanitized
  error mapping.
- `src/app/api/rag/query-runs/*` - recent-run and run-detail routes.
- `src/app/query/page.tsx` - current-answer audit panel and persisted-run
  inspection UI.

## Dependencies

- **Prerequisite features:** F-04 Query Controls and Explore; F-03 Global RAG;
  F-02 Chunking and Embeddings.
- **External packages added:** None unless implementation chooses a small
  numeric helper; prefer none.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  provider boundary.
- **Environment variables:** Same runtime env as F-04/F-03. No new env vars are
  required by the contract.

## Acceptance Criteria

1. A successful ask response includes `traceId`, related terms, and audit data
   for latency plus embedding/generation usage and cost.
2. A no-evidence success persists a run with status `answered_no_evidence`.
3. A generation failure after request validation persists a failed run and still
   returns the existing sanitized HTTP error shape.
4. Recent-run summaries can be listed in reverse chronological order without
   exposing prompts, secrets, or provider internals.
5. Run detail returns the persisted question, answer or safe failure status,
   source snapshot, related terms, usage, latency, and total cost.
6. Related-term extraction is deterministic and capped at 8 persisted terms per
   run.
7. `/query` can inspect both the current answer and a persisted past run.
8. Persisted data contains no raw prompts, secrets, stack traces, or raw
   provider bodies.
9. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Persist one run for every authorized, schema-valid ask attempt | Persist only successful answers; persist all HTTP requests including invalid ones | This captures the governed query flow without storing unauthenticated or malformed junk input. |
| Model "top related tokens" as deterministic related terms/themes | Raw provider token attribution; LLM-generated keywords | The user asked for an auditable view, and deterministic terms are explainable and testable. |
| Add dedicated recent-run and run-detail endpoints | Reconstruct history only from browser state; overload the ask route | Audit history must survive page reloads and be inspectable independently from the current response. |
| Normalize usage/cost in provider adapters | Leave usage optional and compute it ad hoc in the UI | Governance data belongs on the server-side turn record, not in the browser. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
