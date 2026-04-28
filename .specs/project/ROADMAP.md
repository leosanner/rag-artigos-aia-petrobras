# Roadmap — AIA Insight

**Current Milestone:** M2/M3 — Shared `/query` Evolution
**Status:** Active reprioritization (`F-08` remains open; F-06/F-07/F-09/F-10 have already landed around it)

> Each phase of `starter.md` becomes a milestone. Features inside a milestone are demo-able increments. The first three milestones deliver the minimum functional DEMO.

> Execution note (2026-04-26): the shared `/query` surface no longer moves
> straight from F-03 Global RAG to Focused RAG. The current preferred
> sequence is F-04 Query Controls and Explore -> F-05 Answer Traceability ->
> F-08 Reranked Retrieval -> F-06 Conversational Query -> then F-07 Focused
> RAG rebased on that richer shell. F-05 intentionally pulls selected M3
> explainability/observability work forward onto `/query`, and F-08 becomes
> the next retrieval-evolution prerequisite before conversation and focused
> retrieval continue.
>
> Execution note (2026-04-28): post-F-06 `/query` UX now also includes
> `F-09 / Source Card Focused Handoff` and `F-10 / Streaming Query UX`.
> Streaming lands first on `POST /api/rag/conversations/:id/messages`
> through SSE negotiation, while `POST /api/rag/ask` remains JSON-only.

---

## M1 — Data Foundation and Ingestion

**Goal:** A PDF placed into a Google Drive folder ends up persisted in Postgres with `raw_text`, `refined_text`, governance metadata, and status `processed`, ready for chunking. The entire flow is covered by tests (TDD).
**Target:** First demonstrable delivery of the project.

### Features

**Initial repository and infrastructure setup** — COMPLETED

- Next.js 15 + TypeScript strict + ESLint + Prettier
- Drizzle + migrations + connection to Neon / local Postgres with pgvector
- Vitest + test structure (unit / integration)
- Environment variables and secrets (Service Account, DB URL)
- Minimum CI (lint + typecheck + tests on PR)

**Document Ingestion (Phase 1)** — COMPLETED

- Google Drive integration via Service Account, fixed folder
- Relational schema with governance fields (id, hash, origin, version, timestamps, status)
- `raw_text` extraction from the PDF
- Text refinement producing `refined_text`
- Simple state machine: `pending` → `processed` | `failed`
- Reprocessing of documents in `failed`
- Initial title derived from the file name; optional fields (DOI, authors, year) editable manually

---

## M2 — Base RAG (Global + Focused)

**Goal:** The user can ask questions about the entire corpus OR about a specific document and receive answers with passage citations.

### Features

**Chunking + Embeddings (Phase 2)** — COMPLETED

- Chunking strategy over `refined_text`
- Embedding generation and storage in pgvector
- Vector indexing with metadata (doc_id, chunk_index, version)

**Global RAG (Phase 3)** — COMPLETED BASELINE

- Multi-document question endpoint
- Top-k retrieval + context assembly + generation
- Answer with source list

**Query Controls + Explore (Phase 3A)** — COMPLETED

- Adjustable retrieval parameters on `/query`, especially top-k
- Explicit explore mode for broad questions
- Diversified multi-document retrieval without a second endpoint

**Reranked Retrieval (Phase 3B)** — PLANNED

- Explicit `rerank` strategy on the shared `POST /api/rag/ask` and `/query`
  retrieval contract
- Larger first-pass candidate set followed by second-pass reranking before
  generation
- Auditable reranking metadata, reranking failure states, and source-level
  retrieval/rerank score evidence
- Becomes the retrieval-contract prerequisite for later F-06 conversation work
  and the eventual F-07 focused flow

**Focused RAG (Phase 4)** — COMPLETED BASELINE

- Filter by specific document during retrieval
- UI for selecting the target document
- Plugged into the post-F-04/F-05/F-06 `/query` shell instead of the old
  global-only page assumptions
- Review closeout still needs the future F-08 rerank verification sub-step
  before the focused + rerank contract can be treated as fully covered

---

## M3 — Explainability and Observability

**Goal:** Every answer is inspectable and the system has minimal telemetry to evaluate usage and cost.

### Features

**Answer Traceability (Phases 5 + 6)** — COMPLETED EARLY

- Persisted query traces for question, answer, sources, and safe failures
- Related terms/themes derived from the question plus retrieved evidence
- Metrics: input tokens, output tokens, estimated cost, latency
- Model and prompt version recorded per request
- UI for inspecting the current answer and persisted query runs

**Conversational Query (Phase 6A)** — COMPLETED BASELINE

- Chat on the shared `/query` surface
- Persisted conversations and messages
- Per-turn citations, related terms, usage, and cost
- Transcript reload without losing governance visibility
- Reuses the existing audited turn engine and focused-aware conversation
  transport already landed on `/query`

**Streaming Query UX (Phase 6B)** — COMPLETED ON THE CONVERSATION PATH

- SSE negotiation on `POST /api/rag/conversations/:id/messages`
- Live `Consultando fontes...` source reveal before answer generation
- Token-by-token answer rendering inside the active transcript bubble
- Final persisted assistant trace hydration after `done`
- `POST /api/rag/ask` remains JSON-only in this first streaming cut

---

## M4 — Agents (Architectural Proof)

**Goal:** Demonstrate the agents layer running a task more complex than simple RAG.

### Features

**Agents framework decision** — PLANNED

- Short PoC comparing 2–3 options (Vercel AI SDK, Mastra, LangChain.js, LlamaIndex.TS)
- Criteria: Next.js integration, observability, maintenance cost
- Decision recorded in `.specs/project/STATE.md`

**Pilot agent** — PLANNED

- Pick one of the tasks from `starter.md` §3.6 (summarization / comparison / theme extraction / report)
- Implement end-to-end with explainability and governance

---

## Future Considerations

- Stream reconnect/resume semantics beyond the first-cut SSE transport
- Inline clickable citation markers beyond the source-card handoff
- Integration with external bases (e.g., Scielo, arXiv) beyond the fixed corpus
- Automation of recurring analyses
- Expansion to domains beyond EIA
- Automated answer-quality evaluation (ragas/evals)
- Batch reprocessing with pipeline versioning
