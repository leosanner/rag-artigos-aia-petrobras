# F-07 - Focused RAG

## Scope

**In scope:**
- Extend the evolved RAG ask API to support questions scoped to one selected
  document.
- Add document selection to `/query` on top of the post-F-04/F-05/F-08/F-06
  shared page shell.
- Add a read endpoint for documents that are processed and indexed enough to be
  selectable.
- Apply a strict `documentId` filter during retrieval for focused mode.
- Reuse the existing global answer generation, retrieval controls, citation
  style, refusal behavior, and traceability/audit response model.
- Tests proving focused retrieval returns sources only from the selected
  document and does not regress global mode or the newer `/query` contracts.

**Out of scope:**
- New answer-generation prompts unrelated to focused retrieval.
- Multi-document subset filters, metadata filters, DOI/author/year filters, and
  cross-document comparison mode.
- Conversation-specific focused workflow beyond reusing the shared retrieval
  controls and conversation shell already introduced by F-06.
- Document preview/PDF viewer, metadata editing, and document reprocessing.
- Any agents framework or agentic workflows.

## Context & Motivation

F-03 makes global RAG available over the full indexed corpus. Since then, the
project has intentionally reprioritized `/query` so operator controls,
traceability, reranked retrieval, and conversation can land before focused
retrieval. F-07 remains the document-scoped extension of the same route, but it
now has to plug into a richer query shell instead of the original global-only
page assumptions.

Focused RAG should still be an extension of the base RAG flow, not a parallel
pipeline. The primary retrieval difference is the document filter; the shared
retrieval-controls and trace model stay intact.

## Implementation Blocks

This feature is implemented in the same small-block style used by F-01
through F-06. Read this overview first, then open only the block document
needed for the current task:

- [01 - Domain: Focused Mode and Selectable Document](01-domain-focused-mode-and-selectable-document.md):
  pure types and Zod schemas for the focused ask request, the
  `SelectableRagDocument` DTO, and the safe `FocusedDocumentRejectionReason`
  vocabulary; reuse of F-04/F-08 retrieval settings.
- [02 - Persistence: Selectable Documents and Document-Scoped Retrieval](02-persistence-document-scoped-retrieval.md):
  selector query for processed-and-indexed documents, classifier read for
  rejection reasons, and a strict `document_id` filter on the existing
  vector search.
- [03 - Application: ListRagDocuments and Focused AnswerQuestion](03-application-list-documents-and-focused-answer.md):
  selector use case and focused branch on `AnswerQuestion`, reusing the
  shared retrieval, rerank, generation, citation, related-term, and trace
  pipeline.
- [04 - Interface: Documents API, Ask Extension, and `/query` Page](04-interface-api-and-query-page.md):
  `GET /api/rag/documents` route, focused variant on `POST /api/rag/ask`
  with sanitized 404/422 mapping, and the `/query` mode toggle plus
  document picker on the shared shell.
- [05 - Integration and Review](05-integration-and-review.md):
  end-to-end verification across global / focused / conversation, doc sync,
  closeout commands, the required independent-review handoff packet, and
  the deferred focused-`rerank` follow-up once `F-08` lands.

## Business Rules

- RN-01: Focused RAG requires a valid `documentId`.
- RN-02: The selected document must be `processed` and have at least one
  retrieval-ready chunk.
- RN-03: Focused retrieval must return chunks only from the selected document.
- RN-04: Focused mode uses the same retrieval-controls model as global mode,
  including `topK` in the range `3..12` and strategies `"standard"`,
  `"explore"`, and any later shared retrieval extensions already ratified
  before focused implementation, including `rerank`.
- RN-05: The UI must not offer `pending`, `failed`, or unindexed documents as
  selectable focused targets.
- RN-06: If a requested `documentId` is unknown, not processed, or not indexed,
  the API returns a safe client error and does not call the generation
  provider.
- RN-07: F-07 must not duplicate the shared generation logic, the F-05
  traceability model, or the shared retrieval-strategy contract extended by
  F-08.
- RN-08: F-07 must not change the existing global request/response behavior.

## Functional Requirements

- [x] RF-01: `GET /api/rag/documents` returns a Zod-validated list of processed
  documents that have at least one retrieval-ready chunk. Verified by
  `src/repositories/documents-repository.test.ts`
  (`listSelectableForFocusedRag`) and integration scenario
  `GET /api/rag/documents lists only processed documents with chunks` in
  `src/app/api/rag/focused-rag.integration.test.ts`.
- [x] RF-02: Each selectable document includes `id`, `title`, optional
  bibliographic display fields, and chunk/indexing summary fields needed by the
  UI. Verified by `src/domain/rag/selectable-document.test.ts` and the same
  integration scenario asserting `chunkCount` for the seeded document.
- [x] RF-03: `POST /api/rag/ask` accepts
  `{ question, mode: "focused", documentId, retrieval? }`. Verified by
  `src/app/api/rag/ask/handler.test.ts` (focused acceptance test) and the
  integration scenario covering a valid focused request.
- [x] RF-04: Focused requests validate `documentId` as a UUID, validate the
  shared retrieval settings, and reject missing/invalid ids before retrieval.
  Verified by `src/domain/rag/focused-request.test.ts` and the ask handler
  payload-validation tests.
- [x] RF-05: Focused retrieval applies a strict `documentId` filter at the
  database query layer. Verified by `buildSearchWhere` in
  `src/repositories/document-chunks-repository.ts` and the integration
  scenario asserting all returned source rows match the selected documentId.
- [x] RF-06: A focused request for an unknown, non-processed, or unindexed
  document returns a safe 404 or 422 response and skips generation. Verified
  by `src/app/api/rag/ask/handler.test.ts` and integration scenarios for
  unknown / non-processed / unindexed ids (404 / 422) which assert zero
  embedding/generation calls and zero `rag_query_runs` rows persisted.
- [x] RF-07: Focused success responses return the same traceability fields as
  global mode, including `traceId`, related terms, and audit metrics, with
  `mode: "focused"` and `documentId` metadata. Verified by
  `src/application/rag/answer-question.test.ts` and the integration scenario
  inspecting the persisted `rag_query_runs` row.
- [x] RF-08: `/query` adds a mode selector and document selector alongside the
  shared retrieval controls and audit UI. Verified by
  `src/app/query/page.test.tsx` (mode toggle + lazy-loaded picker).
- [x] RF-09: `/query` disables focused submission until a selectable document is
  chosen. Verified by `src/app/query/page.test.tsx`
  (`requires a selected document in focused mode`).
- [x] RF-10: Existing global mode continues to work without requiring a
  document selection. Verified by the integration regression scenario and
  pre-existing global tests in `src/app/api/rag/ask/handler.test.ts`.
- [x] RF-11: Focused source lists contain only chunks from the selected
  document. Verified by the integration scenario asserting every returned
  source's `documentId` equals the selected document, with a multi-document
  seeded corpus.

## System Flow

1. The operator opens `/query`.
2. The page loads `GET /api/rag/documents` to populate the focused-mode
   document selector.
3. In global mode, the page behaves according to the latest shared `/query`
   contracts already delivered before focused retrieval lands.
4. In focused mode, the operator selects one document and submits a question.
5. The page uses the shared F-06 conversation transport and, in focused mode,
   submits turns through `POST /api/rag/conversations/:id/messages` with
   `{ content, mode: "focused", documentId, retrievalSettings? }`. The
   single-turn `POST /api/rag/ask` contract remains supported for direct API
   use and regression coverage.
6. The route validates the request and delegates to the same `AnswerQuestion`
   service introduced in F-03 and later extended by F-04/F-05/F-08.
7. `AnswerQuestion` verifies that the selected document exists, is processed,
   and has retrieval-ready chunks.
8. The retrieval service embeds the question, applies the shared retrieval
   controls, and calls the repository with a strict `documentId` filter.
9. The repository searches only chunks whose `document_id` matches the selected
   document.
10. If no chunks are returned for the selected document, the service returns
    the same insufficient-evidence behavior used by the shared global flow.
11. If chunks are returned, context assembly, generation, citation validation,
    related-term extraction, and trace persistence follow the shared flow
    unchanged.
12. The response includes the same cited answer, structured sources, related
    terms, and audit metrics, plus focused-mode metadata.

## Invariants / Non-negotiables

- INV-01: Focused mode must never return a chunk whose `document_id` differs
  from the requested `documentId`.
- INV-02: Focused mode must not make pending, failed, or unindexed documents
  selectable.
- INV-03: Focused mode must reuse the shared answer/generation and traceability
  contracts instead of creating a separate focused prompt or audit stack unless
  a later spec explicitly changes it.
- INV-04: Adding focused mode must not break global mode request or response
  compatibility.
- INV-05: Focused mode must not bypass or weaken the F-05 trace-persistence
  model once that model exists.
- INV-06: API responses must not leak database URLs, API keys, or raw provider
  errors.
- INV-07: F-07 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `documents` | `id`, `title`, `status`, optional `authors`, `publication_year`, `doi` | Used for selector and selected-document validation. |
| `document_chunks` | `document_id`, `chunk_index`, `embedding`, `content` | Queried with a strict `document_id` filter. |
| `SelectableRagDocument` | `id`, `title`, `authors`, `publicationYear`, `doi`, `chunkCount`, `updatedAt` | API/UI DTO for focused selector. |
| `FocusedRagRequest` | `question`, `mode`, `documentId`, optional `retrieval` | Extension of the shared ask request union after F-04 and F-08. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/api/rag/documents` | Returns processed and indexed documents available for focused RAG. |
| `POST` | `/api/rag/ask` | Extends the shared ask route with `{ question, mode: "focused", documentId, retrieval? }`. |
| `POST` | `/api/rag/conversations/:id/messages` | Extends the F-06 conversation transport so focused turns add `mode: "focused"` and `documentId` to the existing body. |
| `GET` | `/query` | Extends the evolved shared page with focused mode and a document picker, using the shared conversation transport already established by F-06. |
| Function | `ListRagDocuments.execute()` | Application service for selector data. |
| Function | `AnswerQuestion.execute(input)` | Existing shared application service extended with focused mode. |

### Key Modules

- `src/application/rag/*` - extends request schemas, answer service, and
  retrieval input with focused mode.
- `src/repositories/document-chunks-repository.ts` - adds document-filtered
  vector search and selectable-document queries.
- `src/app/api/rag/documents/*` - selectable document route handler.
- `src/app/api/rag/ask/*` - extends ask route tests and schema handling.
- `src/app/query/page.tsx` - adds focused mode UI on top of the shared
  controls/audit shell.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings; F-03 Global RAG;
  F-04 Query Controls and Explore; F-05 Answer Traceability;
  F-06 Conversational Query.
- **Follow-on dependency:** F-08 Reranked Retrieval is not a blocker for the
  current focused implementation closeout, but it must reopen the deferred
  focused-`rerank` verification sub-step recorded in Block 05 once
  `"rerank"` becomes part of the shared retrieval contract.
- **External packages added:** None.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  shared provider path.
- **Environment variables:** Same as the shared ask flow:
  `OPENAI_API_KEY`, `RAG_EMBEDDING_MODEL`, and `RAG_GENERATION_MODEL`.

## Acceptance Criteria

1. `GET /api/rag/documents` returns only processed documents with at least one
   retrieval-ready chunk. **(Done — integration test scenario 1.)**
2. `GET /api/rag/documents` excludes pending, failed, and processed-but-unindexed
   documents. **(Done — integration test scenario 1 explicitly asserts each
   excluded id is absent.)**
3. `POST /api/rag/ask` rejects focused requests with missing or invalid
   `documentId` using the legacy `400 invalid_request` shape. **(Done — ask
   handler payload-validation tests at
   `src/app/api/rag/ask/handler.test.ts`.)**
4. Focused vector search returns only chunks from the selected document while
   still honoring the shared retrieval settings. **(Done — integration test
   scenario 4 asserts every returned source's `documentId` equals the
   selected document, with multi-document seed data.)**
5. A focused request for a processed but unindexed document returns a safe
   client error and does not call generation. **(Done — integration test
   scenario 3.)**
6. A focused request with valid indexed chunks returns the same cited answer,
   related terms, and audit response shape as global mode. **(Done —
   integration test scenario 4 + handler tests verify shape parity.)**
7. `/query` allows switching between global and focused modes without losing the
   shared retrieval controls or audit UI. **(Done — `src/app/query/page.test.tsx`
   mode-switch test.)**
8. `/query` prevents focused submission until a document is selected. **(Done —
   `src/app/query/page.test.tsx` selection-required test.)**
9. Regression tests prove the existing global ask flow still works after
   focused mode is added. **(Done — integration regression scenario plus
   pre-existing global handler tests.)**
10. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.
    **(Done — see Block 05 verification.)**

> Independent reviewer sign-off (per CLAUDE.md): a fresh reviewer agent must
> still validate the implementation against this contract before this feature
> is marked reviewed. The implementer's confidence does not satisfy that
> requirement on its own.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Extend `/api/rag/ask` with `mode: "focused"` | Add `/api/rag/focused`; use server action only | Reusing one ask route keeps the public contract compact and follows the F-03 plan. |
| Add `GET /api/rag/documents` | Hard-code document options in UI; reuse ingestion run endpoint | Focused mode needs a clean selector endpoint for processed and indexed documents only. |
| Reuse the shared retrieval-controls and trace model | Build a focused-only request/response shape | Focused retrieval should be a filter on the same governed flow, not a new shell. |
| Exclude unindexed documents from selector | Show all processed documents and fail later | The UI should only offer actions that can produce retrieval. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
