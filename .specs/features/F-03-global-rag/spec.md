# F-03 - Global RAG

## Scope

**In scope:**
- A global question-answering API over all retrieval-ready chunks created by F-02.
- Retrieval through pgvector using cosine similarity and top-k `6`.
- Retrieval only from the active indexing configuration: active `chunking_version` plus active `embedding_model`.
- Context assembly with source numbering and enough metadata for citations.
- Backend validation of inline citation markers before success responses are serialized.
- Answer generation through a framework-neutral generation provider interface backed by the Vercel AI SDK/OpenAI provider.
- Portuguese answers by default, with inline citation markers like `[1]` and a structured source list.
- Clear refusal when retrieved context does not contain enough evidence to answer.
- Safe sanitized `400`, `502`, and `503` API responses for invalid requests and generation failures.
- A Portuguese `/query` page for global questions and cited answers.
- Tests for retrieval, context assembly, citation validation, generation prompt behavior, API validation, and UI behavior using fake providers where possible.

**Out of scope:**
- Focused single-document retrieval and document selector UI; those are F-04.
- Persisting questions, answers, token usage, costs, latency, or full traces; those belong to M3.
- Conversational memory, streaming responses, feedback/evaluation, reranking, and agents.
- Automatic answer-quality evaluation.
- Manual document metadata editing.
- Reindexing or embedding generation; those are F-02.

## Context & Motivation

F-03 delivers the first user-visible RAG capability in M2: a DEMO operator can
ask a question about the entire indexed corpus and receive a grounded answer
with passage citations. It depends on F-02 for retrieval-ready chunks and
embeddings.

The architecture requires generated answers to remain traceable and auditable.
F-03 therefore returns both a human-facing answer and machine-readable source
metadata. It intentionally avoids M3-level persistence and observability so the
first RAG slice remains small enough to validate quickly.

Later `/query` evolution is tracked in
`.specs/project/query-experience-evolution.md` and the F-05/F-06/F-07 feature
contracts; F-03 remains the baseline global single-turn slice for that shared
surface.

## Implementation Blocks

The feature should be implemented in the same small-block style used by F-01
and F-02. Read this overview first, then open only the block document needed
for the current task:

- [01 - Domain: Context, Citations, and Answer Rules](01-domain-context-citations-and-answer-rules.md): pure logic for source numbering, prompt context assembly, citation parsing/validation, insufficient-evidence answers, and safe generation failure classification.
- [02 - Persistence: Global Retrieval](02-persistence-global-retrieval.md): repository/query additions for active-config pgvector search and traceable retrieval metadata.
- [03 - Application: Retrieval and Generation](03-application-retrieval-and-generation.md): `AnswerQuestion`, query embedding, retrieval orchestration, prompt versioning, OpenAI/Vercel AI SDK generation adapter, and env validation.
- [04 - Interface: API and Page](04-interface-api-and-page.md): `POST /api/rag/ask`, Zod request/response schemas, safe HTTP status mapping, and the Portuguese `/query` page.
- [05 - Integration and Review](05-integration-and-review.md): end-to-end verification, spec sync, changelog sync, and independent-review handoff.

## Business Rules

- RN-01: Global RAG retrieves only from chunks that are retrieval-ready under
  F-02 and match the active `chunking_version` plus active `embedding_model`.
- RN-02: Retrieval searches the whole indexed corpus and does not apply a
  document filter in F-03.
- RN-03: The default retrieval count is top-k `6`.
- RN-04: Retrieval uses cosine similarity; exposed source `score` is
  `1 - cosine_distance`, where higher is better.
- RN-05: Answers are generated in Portuguese regardless of the source language.
- RN-06: Successful generated answers with retrieved sources must cite those
  sources with inline markers like `[1]`, `[2]`.
- RN-07: Citation markers are validated in the backend before a success
  response is serialized; every cited marker must map to an existing
  item in `sources` with the same `sourceNumber`.
- RN-08: The source list in the response must use the same numbering as the
  inline citation markers; retrieved but uncited sources may still remain in
  the successful response.
- RN-09: The model may use only retrieved context as factual support; it must
  not fabricate citations.
- RN-10: If no chunks are retrieved, the API returns a clear insufficient-
  evidence answer with an empty source list without calling the generation
  provider.
- RN-11: If chunks are retrieved but do not support the question, the
  generation provider may return a clear insufficient-evidence answer and the
  successful response still exposes the retrieved sources.
- RN-12: If generation returns output with missing, malformed, or out-of-range
  citation markers after retrieval, the request fails with safe
  `generation_failed`.
- RN-13: Technical generation failures are normalized to safe
  `generation_failed` or `generation_unavailable` responses.
- RN-14: Technical error responses do not include `sources`.
- RN-15: F-03 does not persist questions or answers.
- RN-16: Provider-specific APIs must stay behind generation and query-embedding
  interfaces. Query embedding reuses the same active embedding model/dimension
  contract used by F-02.
- RN-17: F-03 must not depend on any agents framework.

## Functional Requirements

- [ ] RF-01: `POST /api/rag/ask` accepts a Zod-validated request body
  `{ question, mode: "global" }`.
- [ ] RF-02: The route delegates to an application service and does not embed
  retrieval or generation business logic.
- [ ] RF-03: The retrieval service embeds the question with the same active
  embedding model/dimension contract used by F-02.
- [ ] RF-04: The retrieval repository returns the top 6 chunks across the full
  corpus, filtered to the active indexing configuration and ordered by
  descending score.
- [ ] RF-05: Each retrieved source includes document id, document title, chunk
  id, chunk index, full chunk text in `excerpt`, score, document pipeline
  version, chunking version, and embedding model.
- [ ] RF-06: The context assembler produces numbered source blocks and a prompt
  input that preserves source numbering.
- [ ] RF-07: The generation provider receives the assembled context, question,
  prompt version, and configured generation model.
- [ ] RF-08: The generated answer is returned in Portuguese with inline
  citation markers whenever retrieved sources exist.
- [ ] RF-09: Citation markers are validated before serialization, and missing,
  malformed, or out-of-range markers fail with `generation_failed`.
- [ ] RF-10: When no chunks are available, the API returns an
  insufficient-evidence answer with an empty source list and does not call the
  generation provider.
- [ ] RF-11: When the generation provider indicates insufficient evidence, the
  API returns that answer with the retrieved source list.
- [ ] RF-12: Success responses include `answer`, `mode`, `sources`, and
  `metadata` fields and are validated before serialization.
- [ ] RF-13: Error responses are limited to sanitized `invalid_request`,
  `generation_failed`, and `generation_unavailable` shapes and never include
  `sources`.
- [ ] RF-14: `/query` lets the operator submit a global question and
  displays the answer plus cited source list in Portuguese.
- [ ] RF-15: `/query` truncates excerpts visually in the UI only; the API
  contract still returns the full chunk text in `sources[].excerpt`.
- [ ] RF-16: API responses never include API keys, database URLs, raw provider
  stack traces, or hidden prompt internals beyond stable prompt/model version
  metadata.

## System Flow

1. The operator opens `/query`.
2. The page displays a Portuguese question form in global mode.
3. The page submits `POST /api/rag/ask` with `{ question, mode: "global" }`.
4. The route validates the request body and delegates to `AnswerQuestion`.
5. `AnswerQuestion` validates that the mode is global and calls the retrieval
   flow.
6. The retrieval flow embeds the question through the query-embedding port,
   using the same active embedding model contract as F-02.
7. The retrieval repository performs a pgvector cosine search across
   `document_chunks`, joins document metadata, filters to the active
   `chunking_version` and active `embedding_model`, computes
   `score = 1 - cosine_distance`, and returns the top 6 chunks.
8. If no chunks are returned, `AnswerQuestion` returns a Portuguese
   insufficient-evidence answer with empty `sources` and skips generation.
9. If chunks are returned, the context assembler assigns source numbers in
   retrieval order and creates source blocks for the generation prompt.
10. The generation provider calls the configured model from
    `RAG_GENERATION_MODEL` through the Vercel AI SDK/OpenAI provider.
11. The prompt instructs the model to answer in Portuguese, cite only numbered
    sources, and clearly state when the context is insufficient.
12. After generation returns, the backend validates the citation markers
    against the numbered `sources`.
13. If citation validation fails, `AnswerQuestion` returns safe
    `generation_failed`.
14. If generation fails for a technical reason, `AnswerQuestion` returns safe
    `generation_failed` or `generation_unavailable`.
15. On success, `AnswerQuestion` returns a Zod-validated response with the
    answer, source list, and metadata.
16. `/query` renders the answer and the numbered sources, truncating
    excerpts only in the component view.

## Invariants / Non-negotiables

- INV-01: F-03 must never retrieve from `documents.raw_text`.
- INV-02: F-03 must never retrieve from non-indexed documents, chunks without
  embeddings, or chunks outside the active indexing configuration.
- INV-03: A successful answer must never cite a source number that is absent
  from the response `sources[].sourceNumber` set.
- INV-04: When retrieved sources exist, a successful generated answer must
  contain at least one valid citation marker.
- INV-05: Successful business responses must include the sources used for
  generation; technical error responses must not include `sources`.
- INV-06: F-03 must not persist questions or answers in M2.
- INV-07: F-03 must not expose raw prompts, provider stack traces,
  `OPENAI_API_KEY`, or `DATABASE_URL` in responses.
- INV-08: Generation must stay behind an interface and must not couple base
  RAG to an agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `document_chunks` | `id`, `document_id`, `chunk_index`, `content`, `embedding`, `chunking_version`, `embedding_model` | Read-only retrieval source created by F-02. |
| `documents` | `id`, `title`, `pipeline_version`, `status`, optional bibliographic fields | Joined for source metadata and filtered to retrieval-ready rows. |
| `GlobalRagAskRequest` | `question`, `mode` | Request DTO for F-03. |
| `RagSource` | `sourceNumber`, `documentId`, `documentTitle`, `chunkId`, `chunkIndex`, `excerpt`, `score`, `documentPipelineVersion`, `chunkingVersion`, `embeddingModel` | Success-response/source metadata type. `excerpt` is the full chunk text. |
| `RagAnswerMetadata` | `mode`, `topK`, `promptVersion`, `generationModel`, `embeddingModel` | Stable metadata returned without full observability logs. |
| `RagErrorResponse` | `error` | Safe error body for `invalid_request`, `generation_failed`, or `generation_unavailable`. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/query` | Portuguese global RAG baseline page. Later query-evolution features extend the same route; focused mode remains F-04. |
| `POST` | `/api/rag/ask` | Accepts `{ question, mode: "global" }`; returns `200` success, `400 invalid_request`, `502 generation_failed`, or `503 generation_unavailable`. |
| Function | `AnswerQuestion.execute(input)` | Application service orchestrating retrieval, context assembly, citation validation, and generation. |
| Function | `RetrieveChunks.search(input)` | Retrieval service for question embedding plus active-config vector search. |
| Strategy | `QuestionEmbeddingProvider.embedQuestion(question)` | Query-embedding port using the same active embedding contract as F-02. |
| Strategy | `GenerationProvider.generateAnswer(input)` | Provider port for answer generation. |

### Key Modules

- `src/domain/rag/*` - context assembly, citation-marker validation, and
  answer-rule helpers.
- `src/application/rag/*` - answer orchestration, retrieval ports, prompt
  constants, and response schemas.
- `src/repositories/document-chunks-repository.ts` - extends F-02 repository
  with active-config global vector search.
- `src/infrastructure/ai/openai-generation-provider.ts` - Vercel AI SDK/OpenAI
  generation adapter.
- `src/app/api/rag/ask/*` - route handler factory and Next.js route.
- `src/app/query/page.tsx` - Portuguese global query UI.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings.
- **External packages added:** None if F-02 already added `ai` and
  `@ai-sdk/openai`.
- **External services:** Postgres/pgvector, OpenAI API.
- **Environment variables:** `OPENAI_API_KEY` - provider key required outside
  tests; `RAG_EMBEDDING_MODEL` - inherited active embedding model used for
  query embedding under the F-02 contract; `RAG_GENERATION_MODEL` - required
  outside tests and used by the generation adapter.

## Acceptance Criteria

1. `POST /api/rag/ask` rejects an empty question with
   `{ error: "invalid_request" }`.
2. `POST /api/rag/ask` with `{ mode: "global" }` retrieves at most 6 chunks
   across multiple documents and only from the active indexing configuration.
3. Retrieval orders sources by descending score and includes document/chunk
   metadata plus full chunk text in `excerpt`.
4. When no indexed chunks exist for the active configuration, the API returns a
   Portuguese insufficient-evidence answer, an empty source list, and does not
   call the generation provider.
5. With fake retrieved chunks and a fake generation provider, the API returns
   an answer containing valid citation markers and a matching source list.
6. If generation returns missing, malformed, or out-of-range citation markers,
   the API returns `502` with `{ error: "generation_failed" }`.
7. If the generation provider is unavailable, the API returns `503` with
   `{ error: "generation_unavailable" }` and no `sources`.
8. The `/query` page can submit a question, render an answer, render
   numbered sources, and visually truncate excerpts without changing the API
   payload.
9. Responses contain no `OPENAI_API_KEY`, `DATABASE_URL`, raw stack traces,
   raw prompt text, or raw provider error bodies.
10. Unit tests cover context assembly, source numbering, citation validation,
    no-chunk behavior, and generation-provider orchestration.
11. Repository tests cover active-config global pgvector search against real
    test Postgres.
12. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| One `/api/rag/ask` route with `mode` | Separate `/global` and `/focused` routes; server action only | One route keeps the API contract stable when F-04 adds focused mode. |
| `/query` as the single RAG page | Separate pages; API-first only | A single Portuguese operator surface is better for the DEMO and can grow from global to focused mode. |
| Split F-03 into 5 implementation blocks | Keep one large spec only; split into more than 5 blocks | Matching the F-02 execution style keeps the implementation and review slices small without scattering the contract. |
| Top-k 6 | 4 or 10 chunks | Six chunks balances coverage and context size for article-level questions. |
| Active-config retrieval only | Search every indexed chunk; filter only by embedding model | Mixing old and current indexing configurations would make answers harder to audit and regress during reindexing. |
| Portuguese answers | Answer in source language; answer in question language; English-only | The DEMO UI defaults to PT-BR and the Petrobras audience is Portuguese-speaking. |
| Inline markers plus source list with backend validation | Prompt-only citation discipline; render citations only in UI | Inline markers make the answer immediately auditable, and backend validation prevents shipping non-traceable output. |
| Safe `502`/`503` generation failures | Return `200` fallback answers; return generic `500` | Sanitized typed failures keep the API predictable without pretending that a technical failure is a grounded business answer. |
| API-only answer persistence in M2 | Persist answer rows now; persist full trace now | Persistence belongs to M3 observability; M2 still returns traceable sources in the response. |
| Clear insufficient-evidence answer | Cautious speculative answer; API error | Refusal preserves governance while keeping the UX understandable. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
