# F-01 Block 04 - Interface: API and Page

## Scope

**In scope:**
- `StartIngestionRun` application service that creates a queued ingestion run and publishes the Inngest event, or reports a conflict when another run is active.
- `GetIngestionRun` application service that returns a run detail DTO suitable for polling without leaking internal columns.
- `POST /api/ingestion/sync` route handler: validates bearer authorization, delegates to `StartIngestionRun`, returns 202 (queued), 401 (unauthorized) or 409 (active run).
- `GET /api/ingestion/runs/:id` route handler: validates the id, delegates to `GetIngestionRun`, returns 200 (detail), 400 (invalid id) or 404 (not found).
- `/api/inngest` route handler that exposes the ingestion function through `inngest/next` `serve`. The `ProcessIngestionRunHandler` wired here is a safe placeholder until Block 05 replaces it with the real orchestration.
- English operator page at `/ingestion` that collects the operator secret (sessionStorage), calls the start endpoint, displays the run id, and polls run status until it reaches `completed` or `failed`.
- Zod schemas for every API response body, plus handler and page tests.
- Dev-only test infrastructure to run `.test.tsx` files under `jsdom` with `@testing-library/react`.

**Out of scope:**
- `ProcessIngestionRun` orchestration (Drive listing, filtering, extraction, refinement, persistence per item). Block 05 owns it.
- End-to-end integration tests against real Postgres for the ingestion pipeline (Block 05).
- Reprocessing failed documents through a manual endpoint or UI action (parent `spec.md` §Out of scope).
- Manual PDF upload, bibliographic metadata editing, document listing beyond the run progress view (parent `spec.md` §Out of scope).
- Portuguese translations, authentication beyond the bearer secret, rate limiting.
- Chunking, embeddings, retrieval, generation, XAI, observability, agents.

## Context & Motivation

Blocks 01 (domain), 02 (persistence), and 03 (infrastructure adapters) are already merged. They give F-01 a pure domain core, Drizzle-backed repositories, a Drive adapter, an `unpdf`-backed PDF extractor, and an Inngest publisher + function factory. What is missing is the only surface a human operator touches: the HTTP routes, the `/ingestion` page, and the thin application services that the routes delegate to.

This block implements those surfaces under the architecture in `.specs/project/ARCHITECTURE.md`: route handlers validate request and response boundaries with Zod (RN-14) and never hold business logic, application services compose repositories and infrastructure ports, and neither layer exposes provider stack traces or secrets.

Two pieces of the parent `spec.md` §Technical Design live here by natural fit - `StartIngestionRun` and `GetIngestionRun` - even though `05-integration-and-review.md` originally listed the full orchestration trio. Keeping them here lets Block 04 ship working routes without waiting for Block 05 and keeps the heavier `ProcessIngestionRun` alongside the end-to-end integration proofs where it belongs. Block 05 will replace the placeholder Inngest handler with the real orchestration.

## Business Rules

- RN-B04-01: `POST /api/ingestion/sync` requires `Authorization: Bearer <secret>` matching `INGESTION_SYNC_SECRET`; unauthorized requests return 401 before any run is created or event is published (inherits RN-15, RF-13).
- RN-B04-02: `POST /api/ingestion/sync` returns 202 with the new run id and queued status when no run is active (inherits RF-03).
- RN-B04-03: `POST /api/ingestion/sync` returns 409 with the active run id when another run is `queued` or `processing`, and does not enqueue a new one (inherits RF-04).
- RN-B04-04: `GET /api/ingestion/runs/:id` is a read-only polling endpoint and does not require the operator secret.
- RN-B04-05: `GET /api/ingestion/runs/:id` returns aggregate counts and per-item statuses, with no secrets, database URLs, Drive private keys, or raw provider traces (inherits RF-12).
- RN-B04-06: The id path parameter of `GET /api/ingestion/runs/:id` must be a UUID; otherwise the response is 400 without touching the repository.
- RN-B04-07: `GET /api/ingestion/runs/:id` returns 404 when no run with the given id exists.
- RN-B04-08: The `/ingestion` page must be in English (parent `spec.md` In scope).
- RN-B04-09: The `/ingestion` page must not embed the operator secret in code, in `NEXT_PUBLIC_*` env, or in static rendering; the operator provides it at runtime and the client only forwards it in the `Authorization` header.
- RN-B04-10: All operational responses (`POST /api/ingestion/sync`, `GET /api/ingestion/runs/:id`) must send `Cache-Control: no-store`.
- RN-B04-11: Route handlers must validate every response body with Zod before calling `NextResponse.json` (RN-14).

## Functional Requirements

Every RF below has at least one dedicated test. Prefix `RF-B04-` to distinguish from feature-level RFs in `spec.md`.

**Application services**:

- [ ] RF-B04-01: `StartIngestionRun.execute()` calls `IngestionRunsRepository.createQueuedRun({ maxDocuments: 3 })`, publishes `ingestion/sync.requested` through the injected `IngestionEventPublisher`, and returns `{ kind: "queued", runId, maxDocuments: 3 }`.
- [ ] RF-B04-02: `StartIngestionRun.execute()` catches `ActiveIngestionRunConflictError` from the repository and returns `{ kind: "conflict", activeRunId }` without publishing an event.
- [ ] RF-B04-03: `StartIngestionRun.execute()` does not swallow unexpected repository or publisher errors; they propagate for the route-level error boundary.
- [ ] RF-B04-04: `GetIngestionRun.execute(runId)` returns `null` when the repository finds no run.
- [ ] RF-B04-05: `GetIngestionRun.execute(runId)` maps `IngestionRunWithItems` into the response DTO shape: run aggregate counts and per-item `{ id, driveFileId, title, status, lastError, documentId }` only, dropping internal timestamps that are not needed for polling.

**Zod schemas**:

- [ ] RF-B04-06: `ingestionSyncQueuedResponseSchema` validates `{ runId: uuid, status: "queued", maxDocuments: positive integer }`.
- [ ] RF-B04-07: `ingestionSyncConflictResponseSchema` validates `{ activeRunId: uuid | null }`.
- [ ] RF-B04-08: `ingestionSyncUnauthorizedResponseSchema` validates `{ error: "unauthorized" }` and carries no additional fields.
- [ ] RF-B04-09: `ingestionRunDetailResponseSchema` validates `{ id: uuid, status: IngestionRunStatus, maxDocuments, selectedCount, processedCount, failedCount, skippedExistingCount, lastError: IngestionErrorCode | null, items: ingestionRunItemResponseSchema[] }`.
- [ ] RF-B04-10: `ingestionRunItemResponseSchema` validates `{ id: uuid, driveFileId, title, status: IngestionRunItemStatus, lastError: IngestionErrorCode | null, documentId: uuid | null }`.
- [ ] RF-B04-11: A no-leak regression test serializes parsed fixtures for every response schema and asserts the output does not contain `postgres://`, `INGESTION_SYNC_SECRET`, `BEGIN PRIVATE KEY`, or stack-trace markers.

**Route handlers**:

- [ ] RF-B04-12: `POST /api/ingestion/sync` returns 401 with `{ error: "unauthorized" }` when the `Authorization` header is missing, not a bearer token, or the secret does not match, and never calls `StartIngestionRun.execute`.
- [ ] RF-B04-13: `POST /api/ingestion/sync` returns 202 with the queued-response body when the service returns `kind: "queued"`.
- [ ] RF-B04-14: `POST /api/ingestion/sync` returns 409 with the conflict-response body when the service returns `kind: "conflict"`.
- [ ] RF-B04-15: `POST /api/ingestion/sync` responses always send `Cache-Control: no-store`.
- [ ] RF-B04-16: `GET /api/ingestion/runs/:id` returns 400 when the id is not a UUID, without calling `GetIngestionRun.execute`.
- [ ] RF-B04-17: `GET /api/ingestion/runs/:id` returns 404 when the service returns `null`.
- [ ] RF-B04-18: `GET /api/ingestion/runs/:id` returns 200 with the run detail body when the service returns a run, and sends `Cache-Control: no-store`.
- [ ] RF-B04-19: The `/api/inngest` route exports GET/POST/PUT handlers via `serve` from `inngest/next`, registering the `createProcessIngestionRunFunction` with a safe placeholder handler that throws `IngestionError("unknown_error")` until Block 05 replaces it.

**Operator page**:

- [ ] RF-B04-20: The `/ingestion` page renders in English, shows an "Operator secret" input, and disables "Start ingestion run" until the field has a non-empty value.
- [ ] RF-B04-21: Submitting "Start ingestion run" calls `fetch("/api/ingestion/sync", { method: "POST", headers: { Authorization: \`Bearer <secret>\` } })` and never includes the secret in the URL or the body.
- [ ] RF-B04-22: On 202 the page displays the returned run id and queued status, then polls `GET /api/ingestion/runs/:id` at a fixed interval, updating the displayed counts and per-item statuses, and stops polling when the run reaches `completed` or `failed`.
- [ ] RF-B04-23: On 401 the page shows an "Operator secret was rejected" message, clears the stored secret, and does not start polling.
- [ ] RF-B04-24: On 409 the page shows the active run id returned by the API and offers a link/button to poll that run directly.
- [ ] RF-B04-25: The operator secret is kept only in `sessionStorage`, never rendered back to the DOM, and is cleared by a "Clear secret" control.

## System Flow

1. The operator opens `/ingestion` in a browser.
2. The page reads `sessionStorage["ingestion:secret"]`. If missing, the secret field renders empty and the Start button is disabled until the operator types a value.
3. The operator clicks "Start ingestion run". The page calls `fetch("/api/ingestion/sync", { method: "POST", headers: { Authorization: \`Bearer \${secret}\` } })`.
4. `POST /api/ingestion/sync` (`src/app/api/ingestion/sync/handler.ts`) reads the `Authorization` header and calls `isAuthorizedIngestionSyncRequest(header, env.INGESTION_SYNC_SECRET)`.
5. If authorization fails, the handler responds 401 with `ingestionSyncUnauthorizedResponseSchema.parse({ error: "unauthorized" })`, `Cache-Control: no-store`. `StartIngestionRun.execute` is not called.
6. If authorization succeeds, the handler calls `StartIngestionRun.execute()`.
7. `StartIngestionRun` calls `IngestionRunsRepository.createQueuedRun({ maxDocuments: 3 })`.
8. If the repository throws `ActiveIngestionRunConflictError`, the service returns `{ kind: "conflict", activeRunId }` without publishing an event.
9. Otherwise, the service calls `IngestionEventPublisher.publishSyncRequested(run.id)` and returns `{ kind: "queued", runId: run.id, maxDocuments: 3 }`.
10. The handler maps `kind: "queued"` to 202 with `ingestionSyncQueuedResponseSchema`, or `kind: "conflict"` to 409 with `ingestionSyncConflictResponseSchema`.
11. The page reads the response. On 202, it stores `{ runId, status: "queued" }` and begins polling.
12. Polling calls `fetch(\`/api/ingestion/runs/\${runId}\`, { cache: "no-store" })` at a fixed interval.
13. `GET /api/ingestion/runs/:id` (`src/app/api/ingestion/runs/[id]/handler.ts`) validates the id with `z.string().uuid()`. Invalid ids return 400.
14. The handler calls `GetIngestionRun.execute(runId)`, which calls `IngestionRunsRepository.getRunWithItems(runId)`.
15. A missing run returns 404. A present run returns 200 with `ingestionRunDetailResponseSchema.parse(dto)` and `Cache-Control: no-store`.
16. The page updates the displayed status, counts, and items. When status becomes `completed` or `failed`, polling stops.
17. In parallel, Inngest delivers `ingestion/sync.requested` to `/api/inngest`. The route registers the function via `serve` from `inngest/next` with the current placeholder handler. Block 05 will swap this for the real `ProcessIngestionRun`.

## Invariants / Non-negotiables

- INV-B04-01: `INGESTION_SYNC_SECRET` must never appear in client bundles, in any response body, in logs emitted by this block, or in `ingestion_runs` / `ingestion_run_items` rows (inherits INV-10, INV-12).
- INV-B04-02: Raw provider errors (Drive exceptions, Inngest errors, Postgres errors) must not be serialized in any response body; responses only carry safe `IngestionErrorCode` values or generic strings defined by the schemas.
- INV-B04-03: Route handlers must delegate business logic to application services; no repository, Inngest, or Drive call is made directly from a route file (RN-14).
- INV-B04-04: Every response body must pass its Zod schema before `NextResponse.json`; a schema mismatch must crash the handler rather than silently ship malformed data.
- INV-B04-05: `POST /api/ingestion/sync` must not create any database row or publish any Inngest event when the bearer secret is missing or wrong.
- INV-B04-06: `GET /api/ingestion/runs/:id` must remain a read-only endpoint in F-01; it must not trigger any state transition on the run or its items.
- INV-B04-07: The `/ingestion` page must not persist the operator secret in `localStorage`, in cookies, or in any Next.js server-side cache.
- INV-B04-08: The `/api/inngest` route must not return raw Inngest SDK errors; the placeholder handler used until Block 05 must throw `IngestionError("unknown_error")`, which Block 05 will replace.
- INV-B04-09: This block must not depend on any agents framework (inherits INV-11).

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `StartIngestionRunResult` | Discriminated union: `{ kind: "queued", runId, maxDocuments }` or `{ kind: "conflict", activeRunId }` | Return type of `StartIngestionRun.execute()`. |
| `IngestionRunDetailDto` | `id`, `status`, `maxDocuments`, `selectedCount`, `processedCount`, `failedCount`, `skippedExistingCount`, `lastError`, `items[]` | Public shape returned by `GetIngestionRun.execute()` and validated by `ingestionRunDetailResponseSchema`. |
| `IngestionRunItemDto` | `id`, `driveFileId`, `title`, `status`, `lastError`, `documentId` | Public per-item shape inside `IngestionRunDetailDto`. Drops DB timestamps the page does not need. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/ingestion/sync` | Bearer-authenticated start endpoint. Returns 202 (queued), 401 (unauthorized), 409 (active run). |
| `GET` | `/api/ingestion/runs/:id` | Read-only status endpoint used by the page for polling. Returns 200, 400 (non-UUID), or 404. |
| `GET/POST/PUT` | `/api/inngest` | Inngest `serve` endpoint; registers the ingestion function with the current handler. |
| `GET` | `/ingestion` | English operator page. Client Component. |
| Function | `StartIngestionRun.execute()` | Creates queued run + publishes event, or reports conflict. |
| Function | `GetIngestionRun.execute(runId)` | Reads `IngestionRunWithItems` and maps to `IngestionRunDetailDto`. |
| Function | `createSyncHandler({ startRun, secret })` | Factory returning the `POST` handler; test-injectable. |
| Function | `createRunDetailHandler({ getRun })` | Factory returning the `GET` handler; test-injectable. |

### Key Modules

- `src/application/ingestion/start-ingestion-run.ts` - `StartIngestionRun` service composing `IngestionRunsRepository` and `IngestionEventPublisher`.
- `src/application/ingestion/get-ingestion-run.ts` - `GetIngestionRun` service wrapping `IngestionRunsRepository.getRunWithItems`.
- `src/application/ingestion/schemas.ts` - Zod schemas for all ingestion API response bodies.
- `src/app/api/ingestion/sync/handler.ts` - pure factory `createSyncHandler` used by tests and by `route.ts`.
- `src/app/api/ingestion/sync/route.ts` - default wiring for the `POST` route, reading env and composing repositories.
- `src/app/api/ingestion/runs/[id]/handler.ts` - pure factory `createRunDetailHandler` used by tests and by `route.ts`.
- `src/app/api/ingestion/runs/[id]/route.ts` - default wiring for the `GET` route.
- `src/app/api/inngest/route.ts` - Inngest `serve` wiring with placeholder `ProcessIngestionRunHandler`.
- `src/app/ingestion/page.tsx` - English Client Component; Start + polling + sessionStorage secret.
- `src/app/ingestion/use-ingestion-run.ts` - optional hook extracting fetch/polling logic for testability.
- `src/test/setup-dom.ts` - vitest setup registering `@testing-library/jest-dom` matchers.
- `vitest.config.ts` - environment matchers routing `.test.tsx` to `jsdom`.

## Dependencies

- **Prerequisite features:** F-01 Block 01 (domain errors, status state machine), Block 02 (repositories), Block 03 (ports, Inngest client and publisher, env validation).
- **External packages added:** `@testing-library/react` for component-level tests; `@testing-library/jest-dom` for DOM assertions; `jsdom` for the vitest DOM environment. `inngest` is already a runtime dependency (Block 03); this block additionally imports `inngest/next` `serve` in `/api/inngest`.
- **External services:** None new. Routes rely on Postgres through existing repositories and on Inngest through the existing publisher.
- **Environment variables:** None new. Uses `INGESTION_SYNC_SECRET`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_DEV` already validated in `src/env/server.ts` (Block 03).

## Acceptance Criteria

1. `StartIngestionRun.execute()` returns `{ kind: "queued", ... }` and publishes exactly one Inngest event when no run is active; returns `{ kind: "conflict", activeRunId }` and publishes no event when `createQueuedRun` throws `ActiveIngestionRunConflictError`.
2. `GetIngestionRun.execute(runId)` returns `null` for unknown ids and a DTO that matches `ingestionRunDetailResponseSchema` for known ids, with no columns beyond the DTO shape.
3. `POST /api/ingestion/sync` returns 202 on queued, 401 on missing/wrong bearer (no DB row created, no event published), and 409 with the active run id otherwise. All responses send `Cache-Control: no-store`.
4. `GET /api/ingestion/runs/:id` returns 400 for non-UUID ids without calling the service, 404 for unknown ids, and 200 with a schema-valid DTO for known ids.
5. Response fixtures serialized through `JSON.stringify` do not contain `postgres://`, `INGESTION_SYNC_SECRET`, `BEGIN PRIVATE KEY`, or stack-trace markers.
6. `/ingestion` renders in English, disables Start until a secret is entered, stores the secret only in `sessionStorage`, and never injects it into the rendered DOM.
7. A component test drives: start success (202), start with wrong secret (401, secret cleared), start with active conflict (409, active run id shown), and polling that stops when status becomes `completed` or `failed`.
8. `/api/inngest` exports GET/POST/PUT handlers through `serve` from `inngest/next`, with the placeholder `ProcessIngestionRunHandler` wired in until Block 05 replaces it.
9. Vitest runs `.test.tsx` files under `jsdom` and node-layer `.test.ts` files remain under the default environment, with `setupFiles` applying `@testing-library/jest-dom` matchers only to DOM tests.
10. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| `StartIngestionRun` and `GetIngestionRun` live in Block 04, not Block 05 | Keep both in Block 05 alongside `ProcessIngestionRun`; mock services inside Block 04 route tests | The routes have no useful shape without these services, and they are thin compositions of existing repositories and the existing event publisher. Shipping them here keeps Block 04 self-contained and lets Block 05 focus on the heavier `ProcessIngestionRun` plus end-to-end proofs. Block 05's scope is updated accordingly. |
| Store the operator secret in `sessionStorage`, not `localStorage` | `localStorage` (persistent); no persistence (retype every start); HTTP-only cookie set by the API after login | `sessionStorage` disappears when the tab closes, never goes to disk, and keeps the secret out of any client-side library that inspects `localStorage`. A cookie would require a login endpoint that is out of scope for F-01. Retyping every start is acceptable security but noisier UX; this block strikes a middle ground. |
| `GET /api/ingestion/runs/:id` does not require the operator secret | Require bearer on GET too | The polling endpoint is read-only, returns only safe fields, and is polled frequently. Gating it would add no protection to F-01 (the data it exposes is already safe per INV-B04-02) but would force the page to ship the secret on every poll, widening its exposure in devtools. |
| Test page via `@testing-library/react` + `jsdom` | Extract all logic to a pure hook and test it with fake timers only; skip automated page tests and rely on manual verification | Component tests document the whole operator flow (start + polling + sessionStorage + error branches) in one file and protect against regressions after Block 05 lands. Hook-only tests would still leave the JSX untested; skipping tests violates TDD for user-observable behavior. |
| Use a placeholder `ProcessIngestionRunHandler` in `/api/inngest` until Block 05 | Leave `functions: []`; skip the route entirely in Block 04 | The serve route is a visible operator affordance and needs to exist for the Inngest dev server to connect. The placeholder handler throws a safe `IngestionError("unknown_error")`, which both fails loudly during manual smoke tests and is trivially replaced in Block 05. An empty functions array would make the server unable to receive the event at all. |
| Route handlers split into a factory (`handler.ts`) and default wiring (`route.ts`) | Put everything in `route.ts` and mock modules in tests | Factories are directly callable from tests with injected services, without needing `vi.mock`, and they keep `route.ts` tiny (only env + DI). Same pattern can be reused by later M1/M2 features. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
