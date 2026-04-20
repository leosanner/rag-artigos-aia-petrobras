# F-03 - Global RAG

## Scope

**In scope:**
- A global question-answering API over all retrieval-ready chunks created by F-02.
- Retrieval through pgvector using cosine similarity and top-k `6`.
- Context assembly with source numbering and enough metadata for citations.
- Answer generation through a framework-neutral generation provider interface backed by the Vercel AI SDK/OpenAI provider.
- Portuguese answers by default, with inline citation markers like `[1]` and a structured source list.
- Clear refusal when retrieved context does not contain enough evidence to answer.
- A Portuguese `/consulta` page for global questions and cited answers.
- Tests for retrieval, context assembly, generation prompt behavior, API validation, and UI behavior using fake providers where possible.

**Out of scope:**
- Focused single-document retrieval and document selector UI; those are F-04.
- Persisting questions, answers, token usage, costs, latency, or full traces; those belong to M3.
- Conversational memory, streaming responses, feedback/evaluation, reranking, and agents.
- Automatic answer-quality evaluation.
- Manual document metadata editing.
- Reindexing or embedding generation; those are F-02.

## Context & Motivation

F-03 delivers the first user-visible RAG capability in M2: a DEMO operator can ask a question about the entire indexed corpus and receive a grounded answer with passage citations. It depends on F-02 for retrieval-ready chunks and embeddings.

The architecture requires generated answers to remain traceable and auditable. F-03 therefore returns both a human-facing answer and machine-readable source metadata. It intentionally avoids M3-level persistence and observability so the first RAG slice remains small enough to validate quickly.

## Business Rules

- RN-01: Global RAG retrieves only from chunks that are retrieval-ready under F-02.
- RN-02: Retrieval searches the whole indexed corpus and does not apply a document filter in F-03.
- RN-03: The default retrieval count is top-k `6`.
- RN-04: Retrieval uses cosine similarity; exposed source `score` is `1 - cosine_distance`, where higher is better.
- RN-05: Answers are generated in Portuguese regardless of the source language.
- RN-06: The generated answer must cite retrieved sources with inline markers like `[1]`, `[2]`.
- RN-07: The source list in the response must use the same numbering as the inline citation markers.
- RN-08: The model may use only retrieved context as factual support; it must not fabricate citations.
- RN-09: If no chunks are retrieved, the API returns a clear insufficient-evidence answer without calling the generation provider.
- RN-10: If chunks are retrieved but do not support the question, the generation provider must return a clear insufficient-evidence answer and still expose the retrieved sources.
- RN-11: F-03 does not persist questions or answers.
- RN-12: Provider-specific APIs must stay behind a generation provider interface.
- RN-13: F-03 must not depend on any agents framework.

## Functional Requirements

- [ ] RF-01: `POST /api/rag/ask` accepts a Zod-validated request body `{ question, mode: "global" }`.
- [ ] RF-02: The route delegates to an application service and does not embed retrieval or generation business logic.
- [ ] RF-03: The retrieval service embeds the question with the same embedding model/dimension contract used by F-02.
- [ ] RF-04: The retrieval repository returns the top 6 chunks across the full corpus ordered by descending score.
- [ ] RF-05: Each retrieved source includes document id, document title, chunk id, chunk index, excerpt/content, score, document pipeline version, chunking version, and embedding model.
- [ ] RF-06: The context assembler produces numbered source blocks and a prompt input that preserves source numbering.
- [ ] RF-07: The generation provider receives the assembled context, question, prompt version, and configured generation model.
- [ ] RF-08: The generated answer is returned in Portuguese with inline citation markers.
- [ ] RF-09: When no chunks are available, the API returns an insufficient-evidence answer with an empty source list and does not call the generation provider.
- [ ] RF-10: When the generation provider indicates insufficient evidence, the API returns that answer with the retrieved source list.
- [ ] RF-11: The response body includes `answer`, `mode`, `sources`, and `metadata` fields and is validated before serialization.
- [ ] RF-12: `/consulta` lets the operator submit a global question and displays the answer plus cited source list in Portuguese.
- [ ] RF-13: API responses never include API keys, database URLs, raw provider stack traces, or hidden prompt internals beyond stable prompt/model version metadata.

## System Flow

1. The operator opens `/consulta`.
2. The page displays a Portuguese question form in global mode.
3. The page submits `POST /api/rag/ask` with `{ question, mode: "global" }`.
4. The route validates the request body and delegates to `AnswerQuestion`.
5. `AnswerQuestion` validates that the mode is global and calls the retrieval service.
6. The retrieval service embeds the question through the embedding provider port, using the same active embedding model contract as F-02.
7. The retrieval repository performs a pgvector cosine search across all `document_chunks`, joins document metadata, computes `score = 1 - cosine_distance`, and returns the top 6 chunks.
8. If no chunks are returned, `AnswerQuestion` returns a Portuguese insufficient-evidence answer and skips generation.
9. If chunks are returned, the context assembler assigns source numbers in retrieval order and creates source blocks for the generation prompt.
10. The generation provider calls the configured model from `RAG_GENERATION_MODEL` through the Vercel AI SDK/OpenAI provider.
11. The prompt instructs the model to answer in Portuguese, cite only numbered sources, and clearly state when the context is insufficient.
12. `AnswerQuestion` returns a Zod-validated response with the answer, source list, and metadata.
13. `/consulta` renders the answer and the numbered sources.

## Invariants / Non-negotiables

- INV-01: F-03 must never retrieve from `documents.raw_text`.
- INV-02: F-03 must never retrieve from non-indexed documents or chunks without embeddings.
- INV-03: The answer must not cite a source number that is absent from the response `sources` array.
- INV-04: The response must always include the sources used for generation, even when the answer says evidence is insufficient.
- INV-05: F-03 must not persist questions or answers in M2.
- INV-06: F-03 must not expose raw prompts, provider stack traces, `OPENAI_API_KEY`, or `DATABASE_URL` in responses.
- INV-07: Generation must stay behind an interface and must not couple base RAG to an agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `document_chunks` | `id`, `document_id`, `chunk_index`, `content`, `embedding`, `chunking_version`, `embedding_model` | Read-only retrieval source created by F-02. |
| `documents` | `id`, `title`, `pipeline_version`, optional bibliographic fields | Joined for source metadata. |
| `RagSource` | `sourceNumber`, `documentId`, `documentTitle`, `chunkId`, `chunkIndex`, `excerpt`, `score`, `documentPipelineVersion`, `chunkingVersion`, `embeddingModel` | API response/source metadata type. |
| `RagAnswerMetadata` | `mode`, `topK`, `promptVersion`, `generationModel`, `embeddingModel` | Stable metadata returned without full observability logs. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/consulta` | Portuguese global RAG page. F-04 later extends it with focused mode. |
| `POST` | `/api/rag/ask` | Accepts `{ question, mode: "global" }` and returns a cited answer. |
| Function | `AnswerQuestion.execute(input)` | Application service orchestrating retrieval, context assembly, and generation. |
| Function | `RetrieveChunks.search(input)` | Retrieval service for vector search. |
| Strategy | `GenerationProvider.generateAnswer(input)` | Provider port for answer generation. |

### Key Modules

- `src/application/rag/*` - answer orchestration, retrieval ports, context assembly, prompt constants, and schemas.
- `src/repositories/document-chunks-repository.ts` - extends F-02 repository with global vector search.
- `src/infrastructure/ai/openai-generation-provider.ts` - Vercel AI SDK/OpenAI generation adapter.
- `src/app/api/rag/ask/*` - route handler factory and Next.js route.
- `src/app/consulta/page.tsx` - Portuguese global query UI.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings.
- **External packages added:** None if F-02 already added `ai` and `@ai-sdk/openai`.
- **External services:** Postgres/pgvector, OpenAI API.
- **Environment variables:** `OPENAI_API_KEY`; `RAG_GENERATION_MODEL` - required outside tests and used by the generation adapter.

## Acceptance Criteria

1. `POST /api/rag/ask` rejects an empty question with a Zod validation error.
2. `POST /api/rag/ask` with `{ mode: "global" }` retrieves at most 6 chunks across multiple documents.
3. Retrieval orders sources by descending score and includes document/chunk metadata in the response.
4. When no indexed chunks exist, the API returns a Portuguese insufficient-evidence answer, an empty source list, and does not call the generation provider.
5. With fake retrieved chunks and a fake generation provider, the API returns an answer containing valid citation markers and a matching source list.
6. The `/consulta` page can submit a question, render an answer, and render numbered sources.
7. Responses contain no `OPENAI_API_KEY`, `DATABASE_URL`, raw stack traces, or provider error bodies.
8. Unit tests cover context assembly, source numbering, no-chunk behavior, and generation-provider orchestration.
9. Repository tests cover global pgvector search against real test Postgres.
10. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| One `/api/rag/ask` route with `mode` | Separate `/global` and `/focused` routes; server action only | One route keeps the API contract stable when F-04 adds focused mode. |
| `/consulta` as the single RAG page | Separate pages; API-first only | A single Portuguese operator surface is better for the DEMO and can grow from global to focused mode. |
| Top-k 6 | 4 or 10 chunks | Six chunks balances coverage and context size for article-level questions. |
| Portuguese answers | Answer in source language; answer in question language; English-only | The DEMO UI defaults to PT-BR and the Petrobras audience is Portuguese-speaking. |
| Inline markers plus source list | Sources only below answer; sources only in API payload | Inline markers make the answer immediately auditable while the structured list supports UI/XAI later. |
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
