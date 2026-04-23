# Roadmap — AIA Insight

**Current Milestone:** M2 — Base RAG and Query Experience Evolution
**Status:** Active reprioritization

> Each phase of `starter.md` becomes a milestone. Features inside a milestone are demo-able increments. The first three milestones deliver the minimum functional DEMO.

> Execution note (2026-04-22): the shared `/query` surface no longer moves
> straight from F-03 Global RAG to Focused RAG. The current preferred
> sequence is F-04 Query Controls and Explore -> F-05 Answer Traceability ->
> F-06 Conversational Query -> then F-07 Focused RAG rebased on that richer
> shell. F-05 intentionally pulls selected M3 explainability/observability work
> forward onto `/query`.

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

**Query Controls + Explore (Phase 3A)** — PLANNED

- Adjustable retrieval parameters on `/query`, especially top-k
- Explicit explore mode for broad questions
- Diversified multi-document retrieval without a second endpoint

**Focused RAG (Phase 4)** — DEFERRED

- Filter by specific document during retrieval
- UI for selecting the target document
- Must plug into the post-F-04/F-05 `/query` shell instead of the old
  global-only page assumptions

---

## M3 — Explainability and Observability

**Goal:** Every answer is inspectable and the system has minimal telemetry to evaluate usage and cost.

### Features

**Answer Traceability (Phases 5 + 6)** — PLANNED

- Persisted query traces for question, answer, sources, and safe failures
- Related terms/themes derived from the question plus retrieved evidence
- Metrics: input tokens, output tokens, estimated cost, latency
- Model and prompt version recorded per request
- UI for inspecting the current answer and persisted query runs

**Conversational Query (Phase 6A)** — PLANNED

- Chat on the shared `/query` surface
- Persisted conversations and messages
- Per-turn citations, related terms, usage, and cost
- Transcript reload without losing governance visibility

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

- More sophisticated interactive UI beyond F-06 (for example streaming turns)
- Integration with external bases (e.g., Scielo, arXiv) beyond the fixed corpus
- Automation of recurring analyses
- Expansion to domains beyond EIA
- Automated answer-quality evaluation (ragas/evals)
- Batch reprocessing with pipeline versioning
