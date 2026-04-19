# State

**Last Updated:** 2026-04-19
**Current Work:** `F-01 / Document Ingestion` is implementation-complete and ready for independent review

---

## Recent Decisions

### AD-010: F-01 Block 05 completes processing orchestration with per-item isolation (2026-04-19)

**Decision:** `ProcessIngestionRun` is the production application service for F-01 background processing. It is wired into `/api/inngest` with the Google Drive source, `UnpdfPdfExtractor`, deterministic `refineText`, `Sha256FileHasher`, `DocumentsRepository`, and `IngestionRunsRepository`. The pipeline uses the persisted run `max_documents` value returned by `markProcessing`, persists `pipelineVersion = "f01-1.0.0"` from a domain constant, records Drive listing failures as `drive_listing_failed`, and isolates item-level failures after run-item creation so one bad file does not stop the selected batch.
**Reason:** Block 05 closes the queued-run loop left by AD-009 and makes F-01 an end-to-end ingestion vertical: operator start, async processing, governed document records, safe failure states, and inspectable aggregate counts. Keeping hashing behind a `FileHasher` port follows the existing Strategy/Adapter boundary and keeps the application layer free of `node:crypto`.
**Trade-off:** Failures after a run item exists but before or during document creation are recorded on the item with a safe error code, often `unknown_error`, rather than propagating to Inngest for automatic retry. This favors operator-visible partial progress and batch completion over retrying the whole run for one problematic candidate.
**Impact:** `.specs/features/F-01-document-ingestion/spec.md` functional requirements are marked complete. `.specs/features/F-01-document-ingestion/05-integration-and-review.md` is the final block contract and records the implementation decisions. The full local verification path is now `pnpm lint`, `pnpm typecheck`, and `pnpm test`; the latest run passed with 167 Vitest tests.

### AD-009: F-01 Block 04 owns Start/Get services; operator secret lives in sessionStorage (2026-04-18)

**Decision:** `StartIngestionRun` and `GetIngestionRun` application services are implemented in F-01 Block 04 alongside the route handlers and `/ingestion` page; Block 05 keeps ownership of `ProcessIngestionRun` and end-to-end integration. The page captures the operator secret through a password input and persists it only in `sessionStorage`, forwarding it exclusively in the `Authorization: Bearer <secret>` header of `POST /api/ingestion/sync`. `GET /api/ingestion/runs/:id` is a read-only polling endpoint and does not require the secret.
**Reason:** The routes have no useful shape without these thin services (both are compositions of the existing `IngestionRunsRepository` and the existing `InngestIngestionEventPublisher`), so shipping them inside Block 04 keeps that block self-contained and lets Block 05 focus on the heavier `ProcessIngestionRun` plus the integration proofs. Keeping the secret out of `localStorage`, out of cookies, and out of any `NEXT_PUBLIC_*` env avoids persistent exposure while still saving the operator from retyping it across polling cycles in the same tab.
**Trade-off:** The secret is still typed manually by the operator at least once per browser session; refreshing after closing the tab requires retyping. Block 04 is slightly larger than originally planned, but Block 05 becomes correspondingly smaller and easier to isolate for independent review.
**Impact:** `.specs/features/F-01-document-ingestion/04-interface-api-and-page.md` expands to the canonical feature-spec format and owns the new services. `.specs/features/F-01-document-ingestion/05-integration-and-review.md` narrows its scope to `ProcessIngestionRun` + integration. No new environment variables; the existing `INGESTION_SYNC_SECRET` continues to be the server-side source of truth.

### AD-008: Document ingestion runs asynchronously via Inngest (2026-04-18)

**Decision:** The first implementable document-ingestion contract (`F-01`) uses Inngest as the external workflow runner. The operator starts ingestion from an English `/ingestion` page, `POST /api/ingestion/sync` creates a queued run and publishes an Inngest event, and `/api/inngest` hosts the background function. Each run processes at most 3 new Drive PDFs and is inspectable through persisted ingestion-run state.
**Reason:** Ingestion can take longer than a request/response interaction, especially once real PDFs and Drive downloads are involved. Inngest gives the project a Vercel-friendly async execution model with retries and event-driven functions while keeping the route handler thin and the application service testable.
**Trade-off:** Adds an external service and new environment variables earlier than a synchronous MVP would. Local and CI tests must mock Drive/Inngest at the application boundary while persistence tests cover run state directly.
**Impact:** The deprecated `.specs/features/F-0X-document-ingestion/spec.md` is replaced by `.specs/features/F-01-document-ingestion/spec.md` as the implementation contract. F-01 fixes deterministic text refinement, no application-level PDF size limit, a batch limit of 3 documents per run, and leaves reprocessing/metadata editing for later feature specs.

### AD-007: Spec-first workflow for milestone features (2026-04-18)

**Decision:** Milestone features follow a four-step workflow — Discuss → `/feature-spec` → Implement → Codex review via `codex:rescue`. The spec file (`.specs/features/F-NN-<slug>/spec.md`) is the contract consumed by both implementer and reviewer. Replaces the previous `/feature-dev:feature-dev` rule.
**Reason:** The prior workflow bundled specification, planning, and implementation under a single skill whose artifacts were heavy and duplicated architecture docs. The new flow separates concerns: `/feature-spec` produces a compact contract (scope, business rules, functional requirements, system flow, invariants, acceptance criteria) sized to be the cold-start input for a review agent. Delegating review to Codex gives an independent read using `git diff` + the spec as context, without the implementer reviewing its own work.
**Trade-off:** Two artifacts (spec + code) instead of one guided skill run. Requires discipline to keep the spec in sync if scope shifts mid-implementation.
**Impact:** Update `CLAUDE.md` §Project-specific rules. All new milestone features start by invoking `/feature-spec`. Codex review step is the default; the user may opt for another reviewer when asked.

### AD-001: Core stack — Next.js + TS + Drizzle + Vitest + Zod (2026-04-17)

**Decision:** Next.js 15 (App Router) + TypeScript strict, Drizzle ORM, Vitest for tests, Zod for validation. Deployed on Vercel + Neon (Postgres + pgvector).
**Reason:** A cohesive TypeScript-first stack that matches the target deployment. Drizzle has idiomatic pgvector support; Prisma would require raw queries. Vitest is faster and more direct than Jest for TDD in TS/ESM.
**Trade-off:** Drizzle has a smaller ecosystem than Prisma. The Vercel AI SDK ties us to Vercel (acceptable — it is already the target provider).
**Impact:** All DB schemas go through Drizzle; all boundaries (request bodies, env vars, external responses) are validated with Zod; tests are written before the implementation.

### AD-002: Google Drive via Service Account + fixed folder (2026-04-17)

**Decision:** Ingestion consumes a shared Google Drive folder authenticated via a Service Account. No per-user OAuth.
**Reason:** The project is an internal DEMO with no end-user authentication. A Service Account drastically simplifies the flow.
**Trade-off:** Does not support multi-tenancy or multiple Drives. Acceptable while the scope is DEMO.
**Impact:** Secrets: one Service Account JSON + the folder ID. No Drive login flow in the frontend.

### AD-003: Agents framework left open — preference narrowed (2026-04-17)

**Decision:** The final choice is deferred until milestone M4, but the candidate list is narrowed to two: **Mastra (primary preference)** and **Vercel AI SDK used directly (fallback)**. LangChain.js and LlamaIndex.TS are no longer first-class candidates.
**Reason:**
- **Mastra is built on top of the Vercel AI SDK** — adopting it does not invalidate AD-001 (Vercel AI SDK as provider abstraction). It adds agent primitives, deterministic workflows, evals, and native observability (OTEL/Sentry/Langfuse exporters) without forcing a different provider layer.
- **Vercel AI SDK alone may be sufficient** if the M4 pilot task fits within `generateText` + tools + `maxSteps` without needing workflows or evals. In that case the extra Mastra layer is not justified.
- **LangChain.js** is rejected as primary because its strongest observability path is LangSmith (paid + vendor lock-in), its abstractions are heavy and churn often, and its own provider layer would compete with AD-001.
- **LlamaIndex.TS** is rejected because its index/query-engine features duplicate the RAG pipeline we are building manually in M1–M3.
**Trade-off:** Mastra has a smaller community and is a younger framework. Using Vercel AI SDK alone means writing more orchestration ourselves.
**Impact:** Base RAG code must still not assume any agent-framework-specific API; the generation layer stays behind its own interface so either option can plug in at M4. The PoC at M4 compares Mastra vs. Vercel AI SDK alone against the selected pilot task from `starter.md` §3.6, judged on Next.js integration, observability out of the box, and maintenance cost.

### AD-006: PDF extraction via `unpdf` (2026-04-17)

**Decision:** Use [`unpdf`](https://github.com/unjs/unpdf) as the default `PdfExtractor` implementation.
**Reason:** TypeScript-first, ESM, works in Node and serverless/Edge runtimes (compatible with Vercel). `pdf-parse` is CJS-only, effectively unmaintained, and has the well-known "tries to read a test PDF at import time" bug. `pdfjs-dist` is browser-oriented, heavy, and exposes a low-level API that is overkill for extracting text from 31 papers.
**Trade-off:** `unpdf` is younger than `pdfjs-dist` (from which it derives) and has a smaller ecosystem. Acceptable because the corpus is small and the extractor is kept behind the `PdfExtractor` Strategy interface (AD-001 + architectural patterns), so it can be swapped without touching business logic.
**Impact:** Phase 1 ingestion implements `PdfExtractor` with `unpdf`. `pdf-parse` and `pdfjs-dist` are no longer candidates in open decisions. Protected PDFs and empty-extraction cases are classified as failures in the document state machine.

### AD-004: No automatic duplicate handling in v1 (2026-04-17)

**Decision:** Control over duplicate files is the user's manual responsibility; the system does not block ingestion when hashes match.
**Reason:** Made explicit in `phase1_pipeline_rules.md` §4 — reduces initial complexity.
**Trade-off:** The corpus may contain real duplicates if the user is careless.
**Impact:** The file `hash` is stored for governance / future dedup, but is not required as a UNIQUE constraint.

### AD-005: DOI and bibliographic metadata are manual (2026-04-17)

**Decision:** Do not look up DOI, nor infer authors/year automatically. Initial title = file name in Drive; remaining fields are optional and filled in by the user later.
**Reason:** Made explicit in `phase1_pipeline_rules.md` §5–7.
**Trade-off:** Less rich metadata out of the box.
**Impact:** Schema must allow NULLs in `doi`, `authors`, `publication_year`; a metadata-edit endpoint is required.

---

## Active Blockers

_None for now._

---

## Lessons Learned

_To be filled in as the project evolves._

---

## Quick Tasks Completed

_None for now._

---

## Deferred Ideas

- [ ] Automated answer-quality evaluation (ragas/evals) — Captured during: initial roadmap
- [ ] Streaming answers in the frontend — Captured during: initial roadmap
- [ ] Pipeline-versioned batch reprocessing — Captured during: initial roadmap
- [ ] Integration with external sources (Scielo, arXiv) — Captured during: initial roadmap

---

## Todos

- [x] ~~Decide PDF-extraction library~~ — resolved by AD-006 (`unpdf`)
- [x] ~~Define concrete text-refinement strategy~~ — resolved in `F-01` as deterministic refinement without LLM calls
- [x] ~~Break `F-01 / Document Ingestion` into small implementation blocks and execute with TDD~~ — completed by AD-010
- [ ] Choose a definitive project name (current placeholder: "AIA Insight")
- [ ] M4 PoC: compare **Mastra** vs **Vercel AI SDK alone** on one pilot task from `starter.md` §3.6 — criteria: Next.js integration, observability out of the box, maintenance cost (AD-003)

---

## Preferences

**Model Guidance Shown:** never
