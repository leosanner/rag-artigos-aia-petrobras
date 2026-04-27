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

- [ ] RF-01: `GET /api/rag/documents` returns a Zod-validated list of processed
  documents that have at least one retrieval-ready chunk.
- [ ] RF-02: Each selectable document includes `id`, `title`, optional
  bibliographic display fields, and chunk/indexing summary fields needed by the
  UI.
- [ ] RF-03: `POST /api/rag/ask` accepts
  `{ question, mode: "focused", documentId, retrieval? }`.
- [ ] RF-04: Focused requests validate `documentId` as a UUID, validate the
  shared retrieval settings, and reject missing/invalid ids before retrieval.
- [ ] RF-05: Focused retrieval applies a strict `documentId` filter at the
  database query layer.
- [ ] RF-06: A focused request for an unknown, non-processed, or unindexed
  document returns a safe 404 or 422 response and skips generation.
- [ ] RF-07: Focused success responses return the same traceability fields as
  global mode, including `traceId`, related terms, and audit metrics, with
  `mode: "focused"` and `documentId` metadata.
- [ ] RF-08: `/query` adds a mode selector and document selector alongside the
  shared retrieval controls and audit UI.
- [ ] RF-09: `/query` disables focused submission until a selectable document is
  chosen.
- [ ] RF-10: Existing global mode continues to work without requiring a
  document selection.
- [ ] RF-11: Focused source lists contain only chunks from the selected
  document.

## System Flow

1. The operator opens `/query`.
2. The page loads `GET /api/rag/documents` to populate the focused-mode
   document selector.
3. In global mode, the page behaves according to the latest shared `/query`
   contracts already delivered before focused retrieval lands.
4. In focused mode, the operator selects one document and submits a question.
5. The page calls `POST /api/rag/ask` with
   `{ question, mode: "focused", documentId, retrieval? }`.
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
| `GET` | `/query` | Extends the evolved shared page with focused mode and a document picker. |
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
  F-08 Reranked Retrieval; F-06 Conversational Query.
- **External packages added:** None.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  shared provider path.
- **Environment variables:** Same as the shared ask flow:
  `OPENAI_API_KEY`, `RAG_EMBEDDING_MODEL`, and `RAG_GENERATION_MODEL`.

## Acceptance Criteria

1. `GET /api/rag/documents` returns only processed documents with at least one
   retrieval-ready chunk.
2. `GET /api/rag/documents` excludes pending, failed, and processed-but-unindexed
   documents.
3. `POST /api/rag/ask` rejects focused requests with missing or invalid
   `documentId`.
4. Focused vector search returns only chunks from the selected document while
   still honoring the shared retrieval settings.
5. A focused request for a processed but unindexed document returns a safe
   client error and does not call generation.
6. A focused request with valid indexed chunks returns the same cited answer,
   related terms, and audit response shape as global mode.
7. `/query` allows switching between global and focused modes without losing the
   shared retrieval controls or audit UI.
8. `/query` prevents focused submission until a document is selected.
9. Regression tests prove the existing global ask flow still works after
   focused mode is added.
10. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

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
