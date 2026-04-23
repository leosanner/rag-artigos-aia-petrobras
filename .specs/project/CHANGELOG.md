# Changelog

This changelog summarizes the project history commit by commit. Entries are listed from newest to oldest.

## (unreleased) - docs(specs): split F-05 into implementation blocks

Date: 2026-04-23

Changed:

- Expanded `F-05 / Answer Traceability` into the same 5-block implementation
  structure already used by the earlier features so development can progress in
  smaller, reviewable slices.
- Added an `Implementation Blocks` section to the parent `F-05` contract,
  linking domain, persistence, application, interface, and integration/review
  child docs.
- Added detailed block contracts for deterministic related terms and trace
  status, query-run persistence and audit reads, the audited ask flow with
  provider metrics, audit API/UI surfaces on `/query`, and final closeout plus
  reviewer handoff.

Files:

- `.specs/features/F-05-answer-traceability/spec.md`
- `.specs/features/F-05-answer-traceability/01-domain-related-terms-and-trace-status.md`
- `.specs/features/F-05-answer-traceability/02-persistence-query-run-traces-and-audit-reads.md`
- `.specs/features/F-05-answer-traceability/03-application-audited-ask-flow-and-provider-metrics.md`
- `.specs/features/F-05-answer-traceability/04-interface-api-audit-endpoints-and-query-page.md`
- `.specs/features/F-05-answer-traceability/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): close F-04 verification and spec sync

Date: 2026-04-23

Changed:

- Marked the F-04 parent spec complete now that retrieval controls, explore
  diversification, prompt branching, API validation, and `/query` behavior are
  all implemented and covered by the existing tests.
- Synced F-04 Block 01 from planned requirements to implemented requirements
  by flipping the domain RF checklist for retrieval normalization and
  diversification.
- Expanded F-04 Block 05 into the final closeout record with the exact local
  verification commands and results, the review-packet diff basis, and the note
  that no contract-changing project-doc updates were needed beyond bookkeeping.
- Updated `.specs/project/STATE.md` to mark F-04 complete and move the current
  `/query` work forward to F-05.

Files:

- `.specs/features/F-04-query-controls-and-explore/spec.md`
- `.specs/features/F-04-query-controls-and-explore/01-domain-retrieval-settings-and-diversification.md`
- `.specs/features/F-04-query-controls-and-explore/05-integration-and-review.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(query): renumber `/query` contracts to keep the sequence contiguous

Date: 2026-04-22

Changed:

- Renumbered the shared `/query` contracts so the planned implementation order
  is now `F-04 / Query Controls and Explore`, `F-05 / Answer Traceability`,
  `F-06 / Conversational Query`, and `F-07 / Focused RAG`.
- Renamed the feature folders accordingly and synced the current project docs,
  root guidance docs, and the affected F-02/F-03/F-07 references to the new
  numbering.
- Recorded `AD-014` so future readers understand why focused retrieval is now
  `F-07` instead of staying `F-04`.

Files:

- `CLAUDE.md`
- `README.md`
- `.specs/project/query-experience-evolution.md`
- `.specs/project/ROADMAP.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`
- `.specs/features/F-02-chunking-embeddings/spec.md`
- `.specs/features/F-02-chunking-embeddings/05-integration-and-review.md`
- `.specs/features/F-03-global-rag/02-persistence-global-retrieval.md`
- `.specs/features/F-03-global-rag/03-application-retrieval-and-generation.md`
- `.specs/features/F-03-global-rag/04-interface-api-and-page.md`
- `.specs/features/F-03-global-rag/05-integration-and-review.md`
- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-04-query-controls-and-explore/spec.md`
- `.specs/features/F-05-answer-traceability/spec.md`
- `.specs/features/F-06-conversational-query/spec.md`
- `.specs/features/F-07-focused-rag/spec.md`

## (unreleased) - docs(query): define `/query` evolution contracts and defer focused RAG

Date: 2026-04-22

Changed:

- Added `.specs/project/query-experience-evolution.md` as the umbrella document
  for the shared `/query` surface, locking the sequence, shared interfaces, and
  invariants for controls, traceability, conversation, and later focused
  retrieval.
- Added `F-05 / Query Controls and Explore`, `F-06 / Answer Traceability`, and
  `F-07 / Conversational Query` as new feature contracts.
- Recorded `AD-013` to re-sequence `/query` work through controls,
  traceability, and chat before rebasing `F-04 / Focused RAG`.
- Updated `ROADMAP`, `STATE`, and the existing F-03/F-04 specs so the repo no
  longer assumes the next `/query` change is the old global-only-to-focused jump.

Files:

- `.specs/project/query-experience-evolution.md`
- `.specs/features/F-05-query-controls-and-explore/spec.md`
- `.specs/features/F-06-answer-traceability/spec.md`
- `.specs/features/F-07-conversational-query/spec.md`
- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-03-global-rag/04-interface-api-and-page.md`
- `.specs/features/F-04-focused-rag/spec.md`
- `.specs/project/ROADMAP.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): rename consulta page route to query

Date: 2026-04-21

Changed:

- Renamed the public Global/Focused RAG page route from `/consulta` to
  `/query`, while keeping the page copy in PT-BR.
- Synced the current `F-03` and `F-04` feature contracts so future work on the
  shared RAG page targets the English route segment.

Files:

- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-03-global-rag/01-domain-context-citations-and-answer-rules.md`
- `.specs/features/F-03-global-rag/02-persistence-global-retrieval.md`
- `.specs/features/F-03-global-rag/03-application-retrieval-and-generation.md`
- `.specs/features/F-03-global-rag/04-interface-api-and-page.md`
- `.specs/features/F-03-global-rag/05-integration-and-review.md`
- `.specs/features/F-04-focused-rag/spec.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): split F-03 into implementation blocks

Date: 2026-04-21

Changed:

- Added F-03 block documents mirroring the F-02 execution style: pure domain
  rules for context/citations, repository retrieval behavior, application and
  provider boundaries, interface/API/page behavior, and closeout/review.
- Updated the parent `F-03 / Global RAG` spec to link to the new block
  documents as the implementation map.
- Tightened the F-03 contract around active-config retrieval, backend citation
  validation, sanitized `400`/`502`/`503` responses, and the rule that
  `sources[].excerpt` carries the full chunk text while `/query` truncates
  visually only.

Files:

- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-03-global-rag/01-domain-context-citations-and-answer-rules.md`
- `.specs/features/F-03-global-rag/02-persistence-global-retrieval.md`
- `.specs/features/F-03-global-rag/03-application-retrieval-and-generation.md`
- `.specs/features/F-03-global-rag/04-interface-api-and-page.md`
- `.specs/features/F-03-global-rag/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): close F-02 verification and spec sync

Date: 2026-04-21

Changed:

- Expanded `F-02` Block 05 into the final closeout contract, including block-scoped rules, integration/verification acceptance criteria, the verification record, and the independent review handoff.
- Synced the parent `F-02 / Chunking and Embeddings` spec to the implemented behavior: run-item status now explicitly uses `processing | processed | failed`, the system flow matches the real skip/force and targeted-document behavior, and all feature RF checkboxes are marked complete.
- Synced `F-02` Block 03 from a planned contract to an implemented contract by marking its RFs complete and updating the stale env-test note.
- Recorded the current build-verification prerequisite that non-test builds require a non-empty `OPENAI_API_KEY`, and noted that plain `pnpm build` still fails with the workspace's current `.env.local` configuration, which omits that key.

Files:

- `.specs/features/F-02-chunking-embeddings/spec.md`
- `.specs/features/F-02-chunking-embeddings/03-application-embedding-and-inngest.md`
- `.specs/features/F-02-chunking-embeddings/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): split F-02 into implementation blocks

Date: 2026-04-20

Changed:

- Added F-02 block documents mirroring the F-01 implementation style: domain chunking/errors, persistence, application/embeddings/Inngest, interface/API/page, and integration/review.
- Updated the F-02 parent spec to link to the new block documents as the implementation map.
- Replaced the earlier generic F-02 checkpoint note with decision-complete block contracts for smaller follow-up implementation work.

Files:

- `.specs/features/F-02-chunking-embeddings/spec.md`
- `.specs/features/F-02-chunking-embeddings/01-domain-chunking-and-errors.md`
- `.specs/features/F-02-chunking-embeddings/02-persistence-chunks-and-indexing-runs.md`
- `.specs/features/F-02-chunking-embeddings/03-application-embedding-and-inngest.md`
- `.specs/features/F-02-chunking-embeddings/04-interface-api-and-page.md`
- `.specs/features/F-02-chunking-embeddings/05-integration-and-review.md`
- `.specs/project/CHANGELOG.md`

## (unreleased) - docs(rag): add M2 feature contracts

Date: 2026-04-20

Changed:

- Added `F-02 / Chunking and Embeddings` as the contract for manual async indexing, hybrid chunking, OpenAI embeddings through the Vercel AI SDK, and pgvector persistence.
- Added `F-03 / Global RAG` as the contract for corpus-wide `POST /api/rag/ask`, top-k retrieval, Portuguese generated answers, inline citations, and structured source metadata.
- Added `F-04 / Focused RAG` as the contract for document-scoped retrieval, selectable indexed documents, and `/consulta` focused mode.
- Recorded `AD-011` to close the M2 planning decisions: 3-spec split, manual Inngest indexing, 900/150 chunking, `text-embedding-3-large`, top-k 6, API-only answer persistence for M2, and focused RAG as an extension of the global flow.
- Updated architecture/guidance docs so chunking and embedding choices are no longer listed as open decisions for M2.

Files:

- `.specs/features/F-02-chunking-embeddings/spec.md`
- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-04-focused-rag/spec.md`
- `.specs/project/STATE.md`
- `.specs/project/ARCHITECTURE.md`
- `.specs/project/CHANGELOG.md`
- `CLAUDE.md`
- `README.md`

## (unreleased) - feat(ingestion): complete F-01 processing orchestration

Date: 2026-04-19

Changed:

- Expanded F-01 block 05 into the final integration contract and marked its block-scoped functional requirements complete.
- Added `ProcessIngestionRun` to orchestrate Drive listing, PDF filtering, existing-file skipping, batch capping, per-item download/hash/document/extract/refine/persist work, failure isolation, and final run counts.
- Wired `/api/inngest` to a real `ProcessIngestionRun` built from production adapters, replacing the Block 04 placeholder handler.
- Added `Sha256FileHasher`, the `FileHasher` port, and the `pipelineVersion` domain constant used for governed document creation.
- Added `drive_listing_failed` to the safe ingestion error catalog and response schemas.
- Strengthened item isolation for hashing, pending-document creation, and `raw_text` persistence failures so later selected files continue processing and persisted errors stay safe.
- Used the persisted run `max_documents` value for selection and isolated failures in the final run-item processed transition.
- Added unit and integration coverage for the full Block 05 flow, including real Postgres persistence with mocked Drive and a real PDF fixture.
- Marked the parent F-01 functional requirements complete and added `AD-010` for the completed processing-orchestration decision.

Files:

- `.specs/features/F-01-document-ingestion/spec.md`
- `.specs/features/F-01-document-ingestion/05-integration-and-review.md`
- `.specs/project/STATE.md`
- `.specs/project/CHANGELOG.md`
- `src/application/ingestion/process-ingestion-run.ts`
- `src/application/ingestion/process-ingestion-run.test.ts`
- `src/application/ingestion/process-ingestion-run.integration.test.ts`
- `src/application/ingestion/ports.ts`
- `src/application/ingestion/get-ingestion-run.ts`
- `src/application/ingestion/get-ingestion-run.test.ts`
- `src/application/ingestion/schemas.ts`
- `src/app/api/inngest/route.ts`
- `src/app/api/inngest/route.test.ts`
- `src/domain/documents/errors.ts`
- `src/domain/documents/errors.test.ts`
- `src/domain/documents/pipeline-version.ts`
- `src/domain/documents/pipeline-version.test.ts`
- `src/infrastructure/crypto/sha256-file-hasher.ts`
- `src/infrastructure/crypto/sha256-file-hasher.test.ts`

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
