# F-04 Block 04 - Interface: API and Query Page

## Goal

Expose F-04 retrieval controls through validated API contracts and a PT-BR
`/query` page while keeping retrieval, diversification, and generation
business logic in the application layer. This block defines how the shared
route evolves beyond the F-03 baseline without adding a second endpoint.

## Scope

**In scope:**

- Zod request and response schema updates for optional retrieval controls.
- Strict rejection of unknown retrieval fields and invalid `topK` values.
- `POST /api/rag/ask` route-handler behavior for the expanded request shape.
- PT-BR `/query` controls for `topK`, default standard submit, and an explicit
  explore action.
- Secret persistence in the current tab so the same question can be rerun in
  explore mode without retyping.
- Handler and page tests.

**Out of scope:**

- Retrieval SQL and application orchestration (Blocks 02 and 03).
- Focused-mode selectors, conversations, trace inspection, and later
  `/query` evolution beyond F-04.
- Auth changes, new secrets, or operator provisioning.
- Streaming UI, observability details, and agents.

## Business Rules

- RN-B04-01: `POST /api/rag/ask` accepts JSON bodies matching
  `{ question, mode: "global", retrieval?: { topK?: number; strategy?: "standard" | "explore" } }`.
- RN-B04-02: The nested `retrieval` object is strict: unknown fields are
  rejected with `400 { error: "invalid_request" }`.
- RN-B04-03: Invalid `topK` values outside `3..12`, blank questions, malformed
  JSON, and invalid strategies return `400 { error: "invalid_request" }`.
- RN-B04-04: Success responses return `200` with validated
  `{ answer, mode, sources, metadata }`, including the applied retrieval
  settings.
- RN-B04-05: Typed `generation_failed` results return `502`; typed
  `generation_unavailable` results return `503`.
- RN-B04-06: API responses and UI must not expose secrets, stack traces, raw
  prompts, provider payloads, or hidden internal reasoning.
- RN-B04-07: `/query` copy remains PT-BR by default.
- RN-B04-08: Standard submission and explore rerun are distinct operator
  actions; explore mode is never inferred automatically by the UI.
- RN-B04-09: The current-tab secret persistence behavior from F-03 remains
  available so the operator can rerun with explore mode without retyping.

## Functional Requirements

- [ ] RF-B04-01: `ragAskRequestSchema` accepts an optional strict `retrieval`
  object with `topK?: number` and `strategy?: "standard" | "explore"`.
- [ ] RF-B04-02: The request schema rejects unknown root and retrieval fields.
- [ ] RF-B04-03: The request schema rejects non-integer `topK`, values below
  `3`, and values above `12`.
- [ ] RF-B04-04: Response schemas cover success plus sanitized
  `invalid_request`, `generation_failed`, and `generation_unavailable` shapes
  without adding provider internals.
- [ ] RF-B04-05: `createRagAskHandler` returns `400` for malformed JSON or
  invalid parsed bodies and forwards only validated input to
  `AnswerQuestion.execute`.
- [ ] RF-B04-06: `/query` renders a PT-BR `topK` control with a visible default
  aligned to the F-03 baseline of `6`.
- [ ] RF-B04-07: `/query` renders a default standard submit action and a
  separate explicit explore action using the same question and stored secret.
- [ ] RF-B04-08: `/query` can rerun the same question in explore mode without
  requiring the operator to retype the secret.
- [ ] RF-B04-09: On success, `/query` renders answer, numbered sources, and
  retrieval metadata including applied strategy and candidate count.
- [ ] RF-B04-10: On `400`, `502`, or `503`, `/query` shows safe PT-BR error
  messages without rendering raw provider details.

## Key Modules

- `src/application/rag/schemas.ts`
- `src/app/api/rag/ask/handler.ts`
- `src/app/api/rag/ask/route.ts`
- `src/app/query/page.tsx`
- `src/app/query/constants.ts`
- `src/app/query/page.test.tsx`

## Tests First

- `src/app/api/rag/ask/handler.test.ts`
- `src/app/query/page.test.tsx`

API tests must prove strict request validation, status mapping, and response
schema coverage. Page tests must prove `topK` controls, distinct standard and
explore actions, secret reuse, answer rendering, retrieval metadata rendering,
and safe error handling.

## Done When

- API and page tests pass.
- The shared `POST /api/rag/ask` route remains the only ask endpoint for both
  standard and explore behavior.
- The page extends the F-03 baseline without leaking business logic into the UI
  layer.
