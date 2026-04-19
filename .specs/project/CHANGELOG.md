# Changelog

This changelog summarizes the project history commit by commit. Entries are listed from newest to oldest.

## (unreleased) - feat(ingestion): add F-01 interface layer (routes + page + start/get services)

Date: 2026-04-18

Changed:

- Expanded F-01 block 04 into a canonical feature-spec contract (scope, business rules, functional requirements, system flow, invariants, technical design, dependencies, acceptance criteria, decisions, reviewer checklist).
- Narrowed F-01 block 05 scope to `ProcessIngestionRun` + integration proofs; `StartIngestionRun` and `GetIngestionRun` now live in block 04.
- Added `StartIngestionRun` and `GetIngestionRun` application services composing the existing ingestion-runs repository and Inngest publisher.
- Added Zod response schemas for queued, conflict, unauthorized, and run-detail responses with no-leak regression tests.
- Added `POST /api/ingestion/sync` and `GET /api/ingestion/runs/:id` route handlers using a factory/handler split for dependency-injected unit tests.
- Added the `/api/inngest` serve endpoint with a placeholder `ProcessIngestionRunHandler` that throws `IngestionError("unknown_error")` until block 05 replaces it.
- Added the English `/ingestion` operator page that collects the operator secret in `sessionStorage`, starts runs, polls run detail, and stops polling on terminal statuses.
- Added component tests for the page using `@testing-library/react` + `jsdom` scoped to `.test.tsx` files via vitest `environmentMatchGlobs`.
- Added `AD-009` documenting the 04/05 split and the sessionStorage operator-secret UX.

Files:

- `.specs/features/F-01-document-ingestion/04-interface-api-and-page.md`
- `.specs/features/F-01-document-ingestion/05-integration-and-review.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`
- `src/application/ingestion/start-ingestion-run.ts`
- `src/application/ingestion/get-ingestion-run.ts`
- `src/application/ingestion/schemas.ts`
- `src/app/api/ingestion/sync/handler.ts`
- `src/app/api/ingestion/sync/route.ts`
- `src/app/api/ingestion/runs/[id]/handler.ts`
- `src/app/api/ingestion/runs/[id]/route.ts`
- `src/app/api/inngest/route.ts`
- `src/app/ingestion/page.tsx`
- `src/test/setup-dom.ts`
- `vitest.config.ts`
- `package.json`

## (unreleased) - security(ingestion): require operator secret for sync start

Date: 2026-04-18

Changed:

- Added a shared-secret barrier for `POST /api/ingestion/sync` using `Authorization: Bearer <secret>` matched against `INGESTION_SYNC_SECRET`.
- Updated the F-01 and block-04 contracts so unauthorized sync-start requests return 401 before run creation or Inngest publishing.
- Added a reusable constant-time authorization helper for the future sync route.
- Extended server env validation and examples for `INGESTION_SYNC_SECRET`.

Files:

- `.specs/features/F-01-document-ingestion/spec.md`
- `.specs/features/F-01-document-ingestion/03-infrastructure-drive-pdf-inngest.md`
- `.specs/features/F-01-document-ingestion/04-interface-api-and-page.md`
- `src/application/ingestion/authorize-ingestion-sync.ts`
- `src/env/server.ts`
- `.specs/project/CHANGELOG.md`

## (unreleased) - feat(ingestion): add F-01 infrastructure adapters

Date: 2026-04-18

Changed:

- Expanded F-01 block 03 into a reviewer-ready contract for Google Drive, PDF extraction, Inngest event wiring, env validation, and adapter tests.
- Added infrastructure ports for Drive files, PDF extraction, ingestion event publishing, and the future process-run handler.
- Added Google Drive, `unpdf`, and Inngest infrastructure implementations with mocked unit coverage.
- Added dev-aware Inngest env validation and test defaults for server-side env imports.

Files:

- `.specs/features/F-01-document-ingestion/03-infrastructure-drive-pdf-inngest.md`
- `src/application/ingestion/ports.ts`
- `src/infrastructure/drive/google-drive-file-source.ts`
- `src/infrastructure/pdf/unpdf-pdf-extractor.ts`
- `src/infrastructure/ingestion/inngest.ts`
- `src/env/server.ts`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(features): expand F-01 persistence block contract

Date: 2026-04-18

Changed:

- Expanded F-01 block 02 into a feature-spec-style contract for persistence, ingestion runs, run items, and document repositories.
- Locked in Postgres-level active-run exclusivity for `queued` and `processing` ingestion runs.
- Defined repository interfaces, real Postgres test expectations, and CI migration requirements for the persistence block.
- Documented the `TEST_DATABASE_URL` safety guard for destructive repository tests.

Files:

- `.specs/features/F-01-document-ingestion/02-persistence-runs-and-documents.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(assets): add local PDF fixture

Date: 2026-04-18

Changed:

- Added `assets/pdfs/article-example.pdf` as a local sample PDF for extraction, refinement, integration, and model experiments.
- Documented the asset as a development fixture, not as part of the governed production corpus.
- Updated the F-01 integration block to reference the fixture path.
- Refreshed the README status and flow wording to match the current F-01 ingestion decisions.

Files:

- `assets/pdfs/article-example.pdf`
- `README.md`
- `.specs/features/F-01-document-ingestion/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(features): split F-01 into implementation blocks

Date: 2026-04-18

Changed:

- Added execution block files under `.specs/features/F-01-document-ingestion/` so implementation can proceed in small TDD slices.
- Updated `README.md` to point to the active F-01 contract, the execution blocks, and the deprecated historical ingestion spec.

Files:

- `.specs/features/F-01-document-ingestion/01-domain-state-and-refinement.md`
- `.specs/features/F-01-document-ingestion/02-persistence-runs-and-documents.md`
- `.specs/features/F-01-document-ingestion/03-infrastructure-drive-pdf-inngest.md`
- `.specs/features/F-01-document-ingestion/04-interface-api-and-page.md`
- `.specs/features/F-01-document-ingestion/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`
- `README.md`

## (unreleased) - docs(features): replace legacy ingestion spec with F-01 contract

Date: 2026-04-18

Changed:

- Standardized feature specs into folder-based paths, including `.specs/features/F-00-health-endpoint/spec.md`.
- Marked `.specs/features/F-0X-document-ingestion/spec.md` as deprecated historical context.
- Added `.specs/features/F-01-document-ingestion/spec.md` as the active implementation contract for M1 document ingestion under the folder-based feature-spec workflow.
- Added `AD-008`: document ingestion runs asynchronously through Inngest, started from an English `/ingestion` page and tracked through persisted ingestion-run state.
- Fixed the F-01 scope to P1 MVP only: 3 new PDFs per run, `unpdf` extraction, deterministic text refinement, no application-level PDF size limit, and no reprocessing or metadata editing in this contract.
- Updated agent guidance to use `.specs/features/F-NN-<slug>/spec.md` and to allow feature-specific UI language exceptions.
- Updated `STATE.md` todos to close the text-refinement decision and add the next implementation-breakdown task.

Files:

- `.specs/features/F-0X-document-ingestion/spec.md`
- `.specs/features/F-00-health-endpoint/spec.md`
- `.specs/features/F-01-document-ingestion/spec.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`
- `CLAUDE.md`

## (unreleased) - docs(project): adopt spec-first workflow for milestone features

Date: 2026-04-18

Changed:

- Added `AD-007`: milestone features now follow a four-step workflow — Discuss → `/feature-spec` → Implement → Codex review via `codex:rescue`. The `.specs/features/F-NN-<slug>/spec.md` contract is the cold-start input for reviewers.
- Updated `CLAUDE.md` §Project-specific rules: replaced the `/feature-dev:feature-dev` guidance with the new spec-first flow. Bugfixes, config tweaks, and isolated refactors remain out of scope for this workflow.

Files:

- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`
- `CLAUDE.md`

## (unreleased) - docs(project): lock in PDF extractor and narrow agents framework

Date: 2026-04-17

Changed:

- Added `AD-006`: use `unpdf` as the default `PdfExtractor` implementation, replacing the open three-way choice between `unpdf`, `pdf-parse`, and `pdfjs-dist`. Rationale: TypeScript/ESM-first, serverless-friendly, swappable behind a Strategy interface.
- Updated `AD-003`: kept deferred to M4 but narrowed the agents-framework candidates to Mastra (primary preference, built on top of the Vercel AI SDK with native observability and deterministic workflows) and Vercel AI SDK used directly (fallback). LangChain.js and LlamaIndex.TS are no longer first-class candidates.
- Updated `ARCHITECTURE.md`: removed PDF extraction library from the open runtime decisions; clarified `Text Extractor` implementation; narrowed the agents-framework wording in Phase 7 and in Section 13 (Open Decisions).
- Updated `STATE.md` Todos: closed the PDF-library todo; added an M4 PoC todo to compare Mastra vs Vercel AI SDK alone on a pilot task from `starter.md` §3.6.

Files:

- `.specs/project/STATE.md`
- `.specs/project/ARCHITECTURE.md`
- `.specs/project/CHANGELOG.md`

## 338ae04 - docs(project): consolidate scope in architecture spec

Date: 2026-04-17

Changed:

- Added `ARCHITECTURE.md` as the canonical project scope and architecture reference.
- Moved the project vision, goals, v1 scope, out-of-scope items, constraints, and runtime stack into the architecture document.
- Expanded the architecture draft with layers, runtime topology, phased data flow, components, governance model, patterns, testing strategy, open decisions, and design guardrails.
- Simplified `PROJECT.md` into a lightweight entry point that points to `ARCHITECTURE.md`, `ROADMAP.md`, `STATE.md`, and `CHANGELOG.md`.
- Added a project-spec maintenance rule: when specs change, update `CHANGELOG.md` with what changed and why.

Files:

- `.specs/project/ARCHITECTURE.md`
- `.specs/project/PROJECT.md`

## 380d825 - docs: translate project documentation to English

Date: 2026-04-17

Changed:

- Translated the main project documentation from Portuguese to English.
- Renamed the Phase 1 operational-rules document from `regras_operacionais_pipeline_fase1 (1).md` to `phase1_pipeline_rules.md`.
- Renamed the document-ingestion feature spec path from `.specs/features/ingestao-documental/spec.md` to `.specs/features/document-ingestion/spec.md`.
- Updated internal references to point to the English file names.
- Polished wording in the translated specs, project state, roadmap, and starter document.

Files:

- `starter.md`
- `phase1_pipeline_rules.md`
- `.specs/project/PROJECT.md`
- `.specs/project/ROADMAP.md`
- `.specs/project/STATE.md`
- `.specs/features/document-ingestion/spec.md`

## c3b4665 - docs(specs): adiciona spec da Fase 1 - Ingestao Documental

Date: 2026-04-17

Added:

- Added the first feature specification for Phase 1 document ingestion.
- Defined the Google Drive to governed Postgres ingestion flow.
- Specified the transition from extracted `raw_text` to generated `refined_text` and final `processed` status.
- Added five prioritized user stories: two P1, two P2, and one P3.
- Added ten traceable requirements (`INGEST-01` through `INGEST-10`) using WHEN/THEN/SHALL acceptance criteria.
- Documented edge cases such as PDFs without extractable text, protected PDFs, oversized PDFs, download failures, duplicate content, file renames, file deletion, and concurrent sync execution.
- Captured open design questions for PDF extraction, refinement strategy, sync trigger, pipeline execution model, PDF size limit, and original PDF storage.

Files:

- `.specs/features/ingestao-documental/spec.md`

## c07e030 - docs(project): adiciona STATE.md com decisoes arquiteturais iniciais

Date: 2026-04-17

Added:

- Added project state tracking under `.specs/project/STATE.md`.
- Recorded initial architecture decisions AD-001 through AD-005.
- Captured the core stack decision: Next.js, TypeScript, Drizzle, Vitest, and Zod.
- Captured the Google Drive Service Account and fixed-folder ingestion decision.
- Deferred the agents framework choice until milestone M4.
- Documented the v1 decision to avoid automatic duplicate handling.
- Documented the decision to keep DOI and bibliographic metadata manual.
- Added active blockers, lessons learned, deferred ideas, todos, and preferences sections.

Files:

- `.specs/project/STATE.md`

## 3118b68 - docs(project): adiciona ROADMAP.md com milestones M1..M4

Date: 2026-04-17

Added:

- Added a project roadmap with four milestones.
- M1 defines data foundation and document ingestion.
- M2 defines base RAG capabilities: chunking, embeddings, global RAG, and focused RAG.
- M3 defines minimal explainability and basic observability.
- M4 defines the agents proof milestone, including framework evaluation and a pilot agent.
- Added future considerations to keep later ideas visible without expanding the current scope.

Files:

- `.specs/project/ROADMAP.md`

## d18c4af - docs(project): adiciona PROJECT.md com visao, stack e escopo da v1

Date: 2026-04-17

Added:

- Added the project definition document for AIA Insight.
- Described the product vision as an internal Petrobras DEMO/POC for RAG over 31 scientific papers.
- Defined the target users as technical analysts and managers.
- Documented goals G1 through G4 for the functional demo, traceability, TDD quality, and pattern-driven extensibility.
- Defined the core tech stack: Next.js, React, TypeScript, PostgreSQL with pgvector, Drizzle, Vercel, Neon, Zod, Vitest, Vercel AI SDK, Google Drive, and a pending PDF extraction decision.
- Defined v1 scope and explicit out-of-scope items.
- Added project constraints around timeline, TDD, design patterns, governance, and target deployment.

Files:

- `.specs/project/PROJECT.md`

## 88e8a2d - docs: adiciona seeds iniciais (visao e regras operacionais da Fase 1)

Date: 2026-04-17

Added:

- Added the initial project summary in `starter.md`.
- Described the high-level platform goal: RAG plus agents, XAI, and governance.
- Captured platform capabilities, conceptual architecture, simplified flow, usage modes, system guidelines, differentiators, and expected evolution.
- Added the first Phase 1 operational-rules document.
- Defined the initial ingestion pipeline rules, including document origin, duplicate handling, initial title rule, manual optional metadata, DOI policy, governance fields, document flow, valid states, status transitions, chunking readiness, refinement failure behavior, reprocessing, and the summary flow diagram.

Files:

- `starter.md`
- `regras_operacionais_pipeline_fase1 (1).md`
