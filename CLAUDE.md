# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AIA Insight** — internal Petrobras DEMO/POC for a RAG platform over 31 scientific papers on ML/DL/remote sensing applied to Environmental Impact Assessment (EIA). Every answer must be **traceable, explainable, and governed**.

The project is in the specs-and-scaffolding stage. Current milestone is **M1 — Data Foundation and Ingestion** (Phase 1). Nothing in `src/` yet implements ingestion, retrieval, or generation.

## Common commands

Package manager is **pnpm 9.15.4**, Node **22+**. Path alias `@/*` → `./src/*`.

```bash
pnpm install
pnpm dev                  # start local Postgres, wait for readiness, migrate, then run Next.js
docker compose up -d      # optional: local Postgres 17 + pgvector on :5432 only
pnpm db:generate          # drizzle-kit generate (after schema changes)
pnpm db:migrate           # apply migrations in drizzle/

pnpm lint                 # eslint .
pnpm typecheck            # next typegen && tsc --noEmit
pnpm test                 # vitest run (CI mode)
pnpm test:watch           # vitest watch
pnpm build                # next build
```

Commit messages follow Conventional Commits and are enforced by Husky +
commitlint through the `commit-msg` hook.

Run a single test: `pnpm vitest run path/to/file.test.ts` (or `-t "name"` to filter by test name). Tests are discovered as `src/**/*.test.ts(x)`.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test on PRs and pushes to `main`. All four must pass locally before marking work complete.

## Architecture (big picture)

Canonical reference: [.specs/project/ARCHITECTURE.md](.specs/project/ARCHITECTURE.md). Phase-1 operational rules: [phase1_pipeline_rules.md](phase1_pipeline_rules.md). Decisions log: [.specs/project/STATE.md](.specs/project/STATE.md).

### Layered shape
- **Interface:** Next.js App Router (UI + API routes). Validate every request/response boundary with Zod.
- **Application:** use cases (sync, reprocess, retrieve, answer, inspect). Route handlers delegate here; they never embed business logic.
- **Domain:** document state-machine rules (`pending` → `processed` | `failed`), chunking/governance invariants.
- **Infrastructure:** Google Drive (Service Account), Postgres/pgvector via Drizzle, LLM/embedding providers via Vercel AI SDK.
- **Observability/XAI:** question/answer logs, tokens/cost/latency, retrieved chunks + scores per answer.

### Ingestion pipeline (Phase 1)
`Drive folder → governed record (status=pending) → extract raw_text → refine to refined_text → status=processed` (or `failed` on any critical step). Chunking in Phase 2 operates **only on `refined_text`**, never `raw_text`, and only on `processed` documents. Original PDF stays in Drive; Postgres holds governance + processed text.

Governance fields on every document: id, title (initially the Drive file name), drive_file_id, origin, file_hash, pipeline_version, status, created_at, updated_at. Bibliographic fields (`doi`, `authors`, `publication_year`, `notes`) are nullable and edited manually — **never auto-inferred**. See [src/db/schema.ts](src/db/schema.ts).

### Patterns to use (and only where they reduce real complexity)
Repository (persistence isolation), Strategy (swap extractor/refiner/chunker/embedding/generation implementations), State Machine (document status transitions), Adapter (Drive, LLM, DB), Application Service (workflow orchestration). The agents layer must **never** become a dependency of the base RAG flow — keep generation behind its own interface.

## Project-specific rules

- **TDD is mandatory** for business-logic modules: tests before implementation. Pure infrastructure glue may be covered by integration tests only. This is a hard requirement, not a preference.
- **Architectural decisions must be justifiable by a known pattern or a documented reason.** Over-engineering with patterns is rejected as strongly as unstructured code. Record non-trivial decisions as AD-### entries in [.specs/project/STATE.md](.specs/project/STATE.md) and update [.specs/project/CHANGELOG.md](.specs/project/CHANGELOG.md) when specs change.
- **No automatic duplicate handling, no DOI lookup, no bibliographic inference in v1.** Title comes from the Drive filename; everything else is manual. See [phase1_pipeline_rules.md](phase1_pipeline_rules.md) §4–7.
- **Failures are first-class states**, not invisible logs. `failed` documents must be reprocessable.
- **Chunking reads `refined_text` only**, and only from documents with status `processed`.
- TypeScript is `strict`. Validate env vars with Zod at boundaries ([src/env/server.ts](src/env/server.ts)) — don't read `process.env` directly elsewhere.
- **UI language is Portuguese** (PT-BR) by default. No i18n in v1. Feature specs may define a deliberate exception; `F-01 / Document Ingestion` uses English for `/ingestion`.
- **Milestone features follow the spec-first workflow.** For any feature listed in [.specs/project/ROADMAP.md](.specs/project/ROADMAP.md) (M1 ingestion, M2 RAG, M3 XAI/observability, M4 agents):
  1. **Discuss** the feature with the user to align scope, invariants, and open questions.
  2. **Spec** — invoke `/feature-spec` to produce the contract at `.specs/features/F-NN-<slug>/spec.md`. The agent may ask follow-up questions to ground each section; the spec is the authoritative input for implementation and review.
  3. **Implement** end-to-end (plan + code + tests) against that contract. Keep the spec in sync if scope shifts mid-implementation.
  4. **Review** — when the code is ready, delegate an independent review to Codex via `codex:rescue`, passing the git diff + the `F-NN` spec file as context. If the user prefers a different reviewer, ask before proceeding.
  Skip this workflow for bugfixes, config tweaks, and isolated refactors. This supersedes the previous `/feature-dev:feature-dev` workflow (AD-007).

## Open decisions (unresolved — do not lock in without discussion)

Chunking strategy; embedding and LLM models; definitive project name; agents framework final choice (deferred to M4). F-01 resolves the document-ingestion choices for PDF extraction (`unpdf`), text refinement (deterministic), trigger (`/ingestion` + `POST /api/ingestion/sync`), and background processing (Inngest). See [.specs/project/STATE.md](.specs/project/STATE.md) §Todos.
