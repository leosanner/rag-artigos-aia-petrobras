# 02 - Persistence, Runs, and Documents

## Goal

Add the database structures and repositories required to persist ingestion runs, run items, and document lifecycle updates.

## Scope

- Drizzle schema additions for `ingestion_runs` and `ingestion_run_items`.
- Migration generation for the new tables.
- Document repository methods needed by F-01.
- Ingestion-run repository methods needed by F-01.

## Implementation Notes

- Extend `src/db/schema.ts` with:
  - `ingestionRunStatus` enum: `queued`, `processing`, `completed`, `failed`.
  - `ingestionRunItemStatus` enum: `processing`, `processed`, `failed`.
  - `ingestionRuns` table with aggregate counts and timestamps from `spec.md`.
  - `ingestionRunItems` table linked to `ingestionRuns` and optionally to `documents`.
- Keep document status enum unchanged: `pending`, `processed`, `failed`.
- Add repository APIs that hide Drizzle details from application services.
- Existing Drive files are counted on the run as `skipped_existing_count`; they do not need item rows.

## Tests First

- Repository tests with real Postgres for creating and reading runs.
- Repository tests for active-run detection when status is `queued` or `processing`.
- Repository tests for run state updates and aggregate counts.
- Repository tests for document lifecycle updates: create `pending`, persist `raw_text`, persist `refined_text`, mark `processed`, mark `failed`.

## Done When

- Migration files are generated and committed.
- Repository tests pass against real Postgres.
- No application orchestration is implemented in this block beyond repository behavior.
