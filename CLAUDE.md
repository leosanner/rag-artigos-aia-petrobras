# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AIA Insight** — internal Petrobras DEMO/POC for a RAG platform over 31 scientific papers on ML/DL/remote sensing applied to Environmental Impact Assessment (EIA). Every answer must be **traceable, explainable, and governed**.

The project is in the specs-and-scaffolding stage. Current milestone is **M1 — Data Foundation and Ingestion** (Phase 1). Nothing in `src/` yet implements ingestion, retrieval, or generation.

## Common commands

Package manager is **pnpm 9.15.4**, Node **22+**. Path alias `@/*` → `./src/*`.

```bash
pnpm install
docker compose up -d      # local Postgres 17 + pgvector on :5432
pnpm db:generate          # drizzle-kit generate (after schema changes)
pnpm db:migrate           # apply migrations in drizzle/
pnpm dev                  # Next.js dev server

pnpm lint                 # eslint .
pnpm typecheck            # next typegen && tsc --noEmit
pnpm test                 # vitest run (CI mode)
pnpm test:watch           # vitest watch
pnpm build                # next build
```

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
- **UI language is Portuguese** (PT-BR). No i18n in v1.
- **Milestone features go through `/feature-dev:feature-dev`.** When building a feature listed in [.specs/project/ROADMAP.md](.specs/project/ROADMAP.md) (M1 ingestion, M2 RAG, M3 XAI/observability, M4 agents), drive the work through the `feature-dev:feature-dev` skill and version the resulting documentation with the feature. Downstream review agents (`feature-dev:code-reviewer`, `feature-dev:code-explorer`) rely on this artifact for cold-start context. Skip the skill for bugfixes, config tweaks, and isolated refactors.

## Open decisions (unresolved — do not lock in without discussion)

PDF extraction library (`unpdf` vs `pdf-parse` vs `pdfjs-dist`); text-refinement strategy (deterministic vs LLM-assisted vs hybrid); chunking strategy; embedding and LLM models; ingestion trigger (API / CLI / cron / queue); background-job provider; agents framework (deferred to M4). See [.specs/project/STATE.md](.specs/project/STATE.md) §Todos.
