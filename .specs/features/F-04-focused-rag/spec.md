# F-04 - Focused RAG

## Scope

**In scope:**
- Extend the F-03 RAG API to support questions scoped to one selected document.
- Add document selection to `/consulta`.
- Add a read endpoint for documents that are processed and indexed enough to be selectable.
- Apply a `documentId` filter during retrieval for focused mode.
- Reuse F-03 answer generation, context assembly, citation style, refusal behavior, and response metadata.
- Tests proving focused retrieval returns sources only from the selected document and does not regress global mode.

**Out of scope:**
- New answer-generation prompts unrelated to focused retrieval.
- Multi-document subset filters, metadata filters, DOI/author/year filters, and cross-document comparison mode.
- Persisting questions, answers, or observability traces.
- Document preview/PDF viewer, metadata editing, and document reprocessing.
- Any agents framework or agentic workflows.

## Context & Motivation

F-03 makes global RAG available over the full indexed corpus. F-04 completes the M2 roadmap by letting the operator ask about one document at a time. This supports close reading, fact validation, and document-specific exploration while preserving the same citation and source contract.

Focused RAG should be an extension of the base RAG flow, not a parallel pipeline. The only retrieval difference is the document filter.

## Business Rules

- RN-01: Focused RAG requires a valid `documentId`.
- RN-02: The selected document must be `processed` and have at least one retrieval-ready chunk.
- RN-03: Focused retrieval must return chunks only from the selected document.
- RN-04: Focused mode uses the same top-k `6`, cosine score, citation style, answer language, and insufficient-evidence behavior as global mode.
- RN-05: The UI must not offer `pending`, `failed`, or unindexed documents as selectable focused targets.
- RN-06: If a requested `documentId` is unknown, not processed, or not indexed, the API returns a safe client error and does not call the generation provider.
- RN-07: F-04 must not duplicate F-03 generation logic.
- RN-08: F-04 must not change the F-03 global request/response behavior.

## Functional Requirements

- [ ] RF-01: `GET /api/rag/documents` returns a Zod-validated list of processed documents that have at least one retrieval-ready chunk.
- [ ] RF-02: Each selectable document includes `id`, `title`, optional bibliographic display fields, and chunk/indexing summary fields needed by the UI.
- [ ] RF-03: `POST /api/rag/ask` accepts `{ question, mode: "focused", documentId }`.
- [ ] RF-04: Focused requests validate `documentId` as a UUID and reject missing/invalid ids before retrieval.
- [ ] RF-05: Focused retrieval applies a strict `documentId` filter at the database query layer.
- [ ] RF-06: A focused request for an unknown, non-processed, or unindexed document returns a safe 404 or 422 response and skips generation.
- [ ] RF-07: Focused responses return the same response shape as F-03, with `mode: "focused"` and `documentId` metadata.
- [ ] RF-08: `/consulta` adds a mode selector and document selector in Portuguese.
- [ ] RF-09: `/consulta` disables focused submission until a selectable document is chosen.
- [ ] RF-10: Existing global mode continues to work without requiring a document selection.
- [ ] RF-11: Focused source lists contain only chunks from the selected document.

## System Flow

1. The operator opens `/consulta`.
2. The page loads `GET /api/rag/documents` to populate the focused-mode document selector.
3. In global mode, the page behaves as implemented by F-03.
4. In focused mode, the operator selects one document and submits a question.
5. The page calls `POST /api/rag/ask` with `{ question, mode: "focused", documentId }`.
6. The route validates the request and delegates to the same `AnswerQuestion` service introduced in F-03.
7. `AnswerQuestion` verifies that the selected document exists, is processed, and has retrieval-ready chunks.
8. The retrieval service embeds the question and calls the repository with a strict `documentId` filter.
9. The repository searches only chunks whose `document_id` matches the selected document.
10. If no chunks are returned for the selected document, the service returns the same insufficient-evidence behavior used in F-03.
11. If chunks are returned, context assembly and generation follow the F-03 flow unchanged.
12. The response includes the same cited answer and structured sources, plus focused-mode metadata.

## Invariants / Non-negotiables

- INV-01: Focused mode must never return a chunk whose `document_id` differs from the requested `documentId`.
- INV-02: Focused mode must not make pending, failed, or unindexed documents selectable.
- INV-03: Focused mode must reuse the F-03 answer/generation contract instead of creating a separate focused prompt stack unless a later spec explicitly changes it.
- INV-04: Adding focused mode must not break global mode request or response compatibility.
- INV-05: F-04 must not persist questions or answers in M2.
- INV-06: API responses must not leak database URLs, API keys, or raw provider errors.
- INV-07: F-04 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `documents` | `id`, `title`, `status`, optional `authors`, `publication_year`, `doi` | Used for selector and selected-document validation. |
| `document_chunks` | `document_id`, `chunk_index`, `embedding`, `content` | Queried with a strict `document_id` filter. |
| `SelectableRagDocument` | `id`, `title`, `authors`, `publicationYear`, `doi`, `chunkCount`, `updatedAt` | API/UI DTO for focused selector. |
| `FocusedRagRequest` | `question`, `mode`, `documentId` | Extension of the F-03 ask request union. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/api/rag/documents` | Returns processed and indexed documents available for focused RAG. |
| `POST` | `/api/rag/ask` | Extends F-03 route with `{ question, mode: "focused", documentId }`. |
| `GET` | `/consulta` | Extends the F-03 page with global/focused mode selection and a document picker. |
| Function | `ListRagDocuments.execute()` | Application service for selector data. |
| Function | `AnswerQuestion.execute(input)` | Existing F-03 application service extended with focused mode. |

### Key Modules

- `src/application/rag/*` - extends request schemas, answer service, and retrieval input with focused mode.
- `src/repositories/document-chunks-repository.ts` - adds document-filtered vector search and selectable-document queries.
- `src/app/api/rag/documents/*` - selectable document route handler.
- `src/app/api/rag/ask/*` - extends ask route tests and schema handling.
- `src/app/consulta/page.tsx` - adds focused mode UI.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings; F-03 Global RAG.
- **External packages added:** None.
- **External services:** Postgres/pgvector, OpenAI API through existing F-03 provider path.
- **Environment variables:** Same as F-03: `OPENAI_API_KEY` and `RAG_GENERATION_MODEL`.

## Acceptance Criteria

1. `GET /api/rag/documents` returns only processed documents with at least one retrieval-ready chunk.
2. `GET /api/rag/documents` excludes pending, failed, and processed-but-unindexed documents.
3. `POST /api/rag/ask` rejects focused requests with missing or invalid `documentId`.
4. Focused vector search returns only chunks from the selected document.
5. A focused request for a processed but unindexed document returns a safe client error and does not call generation.
6. A focused request with valid indexed chunks returns the same cited answer response shape as global mode.
7. `/consulta` allows switching between global and focused modes without losing the global workflow.
8. `/consulta` prevents focused submission until a document is selected.
9. Regression tests prove F-03 global requests still work after focused mode is added.
10. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Extend `/api/rag/ask` with `mode: "focused"` | Add `/api/rag/focused`; use server action only | Reusing one ask route keeps the public contract compact and follows the F-03 plan. |
| Add `GET /api/rag/documents` | Hard-code document options in UI; reuse ingestion run endpoint | Focused mode needs a clean selector endpoint for processed and indexed documents only. |
| Same prompt and citation contract as global mode | Separate focused prompt; no citation changes | The retrieval filter is the feature; generation behavior should stay stable. |
| Exclude unindexed documents from selector | Show all processed documents and fail later | The UI should only offer actions that can produce retrieval. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
