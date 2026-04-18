# Health Endpoint — Specification

## Problem Statement

Before M1 features (ingestion, retrieval) land, the project needs a single operational signal — a health endpoint — to make production deploys safe: uptime monitors can probe it, load balancers can gate traffic on it, and incident response has a first place to look. The project has no HTTP routes yet; this endpoint also establishes the conventions every subsequent route will reuse.

Two hard constraints shape the design:

1. **No credential leakage.** The response must never surface connection strings, environment variable values, driver stack traces, or SQL error messages. Real errors go to the server log only.
2. **Additive extensibility.** Future milestones will add checks for Google Drive, embedding provider, LLM provider. The shape has to accept new checks without breaking consumers of the current one.

---

## Goals

- [ ] `GET /api/health` returns the aggregate health of the application and its critical dependencies (currently Postgres).
- [ ] Response body is fully validated by Zod before serialization and contains zero credentials, stack traces, or driver-level error details.
- [ ] HTTP status mirrors aggregate health: `200` when all critical checks pass, `503` when any critical check fails. This lets probes gate on the status code alone, without parsing JSON.
- [ ] Per-check failures are logged server-side (via `console.error`) with enough detail for triage, while the response body carries only a generic `unavailable` marker with latency.
- [ ] Unit tests written **before** implementation, covering aggregate status, per-check failure isolation, log emission, and the no-leak contract.

---

## Out of Scope

| Feature | Reason |
| --- | --- |
| Authentication on the endpoint | DEMO context; monitoring tools expect public `/health`. Re-evaluate when the app is exposed outside the internal network. |
| Liveness vs readiness split (`/live` + `/ready`) | Kubernetes-style split not needed for Vercel. One endpoint suffices. |
| Drive / embedding / LLM checks | Added alongside each integration. Shape is designed to accept them additively. |
| Structured logging | Waits for the observability layer (M3). `console.error` is the pragmatic placeholder; the external contract does not change. |
| Non-critical checks (checks that don't degrade aggregate status) | Premature abstraction while every current check is critical. Add a `critical` flag when the first non-critical check appears. |
| Endpoint versioning, response schema evolution policy | No consumers yet. Revisit when the first one lands. |

---

## User Stories

### P1: Operator probes app health ⭐ MVP

**User Story**: As the DEMO operator (or an automated uptime monitor), I want to `GET /api/health` and instantly know whether the app is up and connected to Postgres, without having to parse credentials out of any error.

**Why P1**: Without this, production deploys have no observable signal beyond "the homepage renders", which tells nothing about whether ingestion/retrieval dependencies are reachable.

**Acceptance Criteria**:

1. WHEN the app is running AND Postgres is reachable THEN the system SHALL respond `200` with body `{ status: 'ok', timestamp, version, checks: { app: { status: 'ok', latencyMs }, database: { status: 'ok', latencyMs } } }`.
2. WHEN Postgres is unreachable (container down, wrong credentials, network failure) THEN the system SHALL respond `503` with body `{ status: 'degraded', ..., checks.database: { status: 'unavailable', latencyMs } }`.
3. WHEN any check throws THEN the error SHALL be logged server-side via `console.error` with the check name and the original error, AND the response body SHALL NOT contain the error message, stack, or any environment value.
4. WHEN the response is serialized THEN it SHALL pass `healthResponseSchema.parse` — the schema is the single source of truth for the wire format.
5. The response SHALL carry `Cache-Control: no-store` so CDNs and proxies never cache a stale health snapshot.

**Independent Test**: `pnpm dev` + Postgres up → `curl -i /api/health` returns 200 with both checks ok. Stop Postgres → same curl returns 503 with `database.status: 'unavailable'`, and the dev-server stderr shows a `console.error` with the driver error. `curl` body contains zero occurrence of `DATABASE_URL`, `postgres://`, `ECONNREFUSED`, or stack-trace fragments.

---

### P1: Test harness for health checks ⭐ MVP

**User Story**: As a contributor, I want `checkHealth` to be directly unit-testable without booting Postgres, so TDD covers the aggregation and no-leak contract without infra overhead.

**Why P1**: The TDD mandate (CLAUDE.md) applies to the aggregation logic. Coupling it to a live DB blocks fast iteration and hides the aggregation bug surface.

**Acceptance Criteria**:

1. WHEN `checkHealth` is called with a list of check functions THEN it SHALL execute them concurrently via `Promise.all`, measure per-check latency, and aggregate results into a `HealthReport`.
2. WHEN all checks resolve THEN the report SHALL have `status: 'ok'` and each check's `status: 'ok'`.
3. WHEN one check rejects THEN the report SHALL have `status: 'degraded'`, the failing check SHALL have `status: 'unavailable'` with a real `latencyMs >= 0`, and the other checks SHALL remain `status: 'ok'`.
4. WHEN a check rejects THEN `console.error` SHALL be invoked with the check name and the original error. The returned report SHALL NOT contain the error's message or any derived string.

**Independent Test**: `src/application/health/check-health.test.ts` covers all four criteria with inline fake check functions — no DB, no network.

---

## Edge Cases

- **Slow Postgres (alive but unresponsive):** currently not bounded. A hung `SELECT 1` will hang the response. Phase-1 risk is low (local Postgres), but the Drive/LLM checks in future iterations MUST wrap calls in a timeout. Tracked as a follow-up, not blocking here.
- **Cold start on Vercel:** first hit after idle will include connection-pool setup in `database.latencyMs`. Acceptable — the number is still informative, just higher.
- **Zod parse failure on response:** indicates a programmer error (service returned a shape the schema rejects). The route handler lets the error propagate to Next.js's error boundary (→ 500). Not a runtime condition we handle.
- **Non-critical check failure (future):** out of scope until the first non-critical check exists. When added, aggregate `status` definition will extend to distinguish `ok | degraded | error`.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HEALTH-01 | P1: Operator probes — happy path | Implementing | Pending |
| HEALTH-02 | P1: Operator probes — DB down returns 503 | Implementing | Pending |
| HEALTH-03 | P1: Operator probes — no leak in body | Implementing | Pending |
| HEALTH-04 | P1: Operator probes — Zod on response + no-store cache | Implementing | Pending |
| HEALTH-05 | P1: Test harness — aggregation logic | Implementing | Pending |
| HEALTH-06 | P1: Test harness — internal log emission | Implementing | Pending |

**ID format:** `HEALTH-NN`
**Status values:** Pending → In Design → Implementing → Verified

---

## Success Criteria

- [ ] `curl -i http://localhost:3000/api/health` returns 200 with `status: 'ok'` when Postgres is up.
- [ ] Stopping Postgres flips the endpoint to 503 with `status: 'degraded'` and `database.status: 'unavailable'` within one request (no retry storm).
- [ ] The response body — in both success and failure paths — contains no substring of `DATABASE_URL`, `postgres://`, `ECONNREFUSED`, `Error:`, or stack-trace markers like `at Object.<anonymous>`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all green, with ≥ 6 tests in `check-health.test.ts`.
- [ ] Adding a third check (hypothetical Drive check) requires only appending one entry to the route handler's check list — no changes to service, schema, or response contract.

---

## Files

| File | Purpose |
| --- | --- |
| [src/app/api/health/route.ts](../../../src/app/api/health/route.ts) | Next.js route handler. Wires real `db`, assembles response, applies Zod, sets HTTP status and cache header. |
| [src/application/health/check-health.ts](../../../src/application/health/check-health.ts) | Application service. Runs checks concurrently, aggregates status, logs failures. Pure, no DB imports. |
| [src/application/health/checks/app.ts](../../../src/application/health/checks/app.ts) | Trivial app-liveness check. |
| [src/application/health/checks/database.ts](../../../src/application/health/checks/database.ts) | Factory that closes over a Drizzle client and issues `SELECT 1`. |
| [src/application/health/schemas.ts](../../../src/application/health/schemas.ts) | Zod schemas (`healthResponseSchema`, `healthCheckResultSchema`) + inferred types. Single source of truth for the wire contract. |
| [src/application/health/check-health.test.ts](../../../src/application/health/check-health.test.ts) | Unit tests (TDD — written before implementation). |

---

## Open Questions

None for this iteration. Deliberately deferred:

- Timeout budget per check — add when the first non-local check (Drive/LLM) lands.
- Non-critical checks and richer status vocabulary (`ok | degraded | error`) — same trigger.
- Shared-secret authentication on the endpoint — only if the DEMO is exposed on the public internet.
