# 04 - Interface: API and Page

## Goal

Expose the operator-facing entry points for starting ingestion and polling run progress.

## Scope

- `POST /api/ingestion/sync`.
- `GET /api/ingestion/runs/:id`.
- `/api/inngest` route handler.
- English `/ingestion` page.

## Implementation Notes

- Route handlers must validate request and response boundaries with Zod.
- `POST /api/ingestion/sync` must return 202 for a queued run and 409 when another run is active.
- `GET /api/ingestion/runs/:id` must return aggregate counts and per-item statuses without secrets or raw provider stack traces.
- The page must be in English, call the start endpoint, store/display the run id, and poll status until the run reaches `completed` or `failed`.
- The page is an operational surface only; broader document listing and metadata editing remain out of scope.

## Tests First

- API tests for 202 queued response.
- API tests for 409 active-run response.
- API tests for run status response schema and no-leak behavior.
- UI tests or component-level tests for start and polling behavior, using mocked fetch/application boundaries.

## Done When

- The operator can start a run from `/ingestion` and see status updates.
- API responses are schema-validated.
- `pnpm lint`, `pnpm typecheck`, and relevant tests pass.
