# Changelog

This changelog summarizes the project history commit by commit. Entries are listed from newest to oldest.

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
