# F-03 Block 04 - Interface: API and Page

## Goal

Expose the global RAG workflow through validated API routes and a minimal
Portuguese `/consulta` page while keeping retrieval and generation business
logic in the application layer.

## Scope

**In scope:**

- Zod request and response schemas for the global ask API.
- `POST /api/rag/ask` route handler and wiring.
- Safe HTTP status mapping for invalid request and generation failures.
- Portuguese `/consulta` page with one global question form, loading states,
  answer rendering, and numbered sources.
- UI-only excerpt truncation in the page component.
- Handler and page tests.

**Out of scope:**

- Retrieval SQL and generation orchestration (Blocks 02 and 03).
- Focused-mode selectors and document listing; those are F-04.
- Auth, secrets, or operator-only bearer protection.
- Streaming UI, chat history, observability, and agents.

## Business Rules

- RN-B04-01: `POST /api/rag/ask` accepts only JSON bodies matching
  `{ question, mode: "global" }`.
- RN-B04-02: Invalid JSON or invalid request bodies return `400` with
  `{ error: "invalid_request" }` and do not call `AnswerQuestion`.
- RN-B04-03: Successful ask responses return `200` with validated
  `{ answer, mode, sources, metadata }`.
- RN-B04-04: Typed `generation_failed` results return `502` with
  `{ error: "generation_failed" }`.
- RN-B04-05: Typed `generation_unavailable` results return `503` with
  `{ error: "generation_unavailable" }`.
- RN-B04-06: All API responses are Zod-validated before serialization.
- RN-B04-07: API responses and UI must not expose `OPENAI_API_KEY`,
  `DATABASE_URL`, raw provider details, stack traces, or prompt internals.
- RN-B04-08: `/consulta` copy is PT-BR by default.
- RN-B04-09: `/consulta` is global-only in F-03 and does not render any
  focused-mode selector.
- RN-B04-10: `/consulta` truncates excerpts visually in the rendered component
  only; the API payload remains unchanged.

## Functional Requirements

- [ ] RF-B04-01: `ragAskRequestSchema` accepts `{ question, mode: "global" }`
  and rejects blank questions.
- [ ] RF-B04-02: Response schemas cover success, `invalid_request`,
  `generation_failed`, and `generation_unavailable`.
- [ ] RF-B04-03: `createRagAskHandler` returns `400` for malformed JSON or
  invalid parsed bodies.
- [ ] RF-B04-04: The ask handler forwards validated input to
  `AnswerQuestion.execute`.
- [ ] RF-B04-05: The ask handler returns `200`, `502`, or `503` based on the
  typed application result.
- [ ] RF-B04-06: Route files compose production dependencies only; handler
  files remain dependency-injectable for tests.
- [ ] RF-B04-07: `/consulta` renders a Portuguese question form and submit
  button for global mode.
- [ ] RF-B04-08: `/consulta` shows a loading state while the ask request is in
  flight.
- [ ] RF-B04-09: On `200`, `/consulta` renders the answer and numbered sources.
- [ ] RF-B04-10: `/consulta` truncates rendered excerpts visually without
  mutating the underlying response payload.
- [ ] RF-B04-11: On `400`, `/consulta` shows a safe validation error message.
- [ ] RF-B04-12: On `502` or `503`, `/consulta` shows a safe technical failure
  message without rendering raw provider details.

## Key Modules

- `src/application/rag/schemas.ts`
- `src/app/api/rag/ask/handler.ts`
- `src/app/api/rag/ask/route.ts`
- `src/app/consulta/page.tsx`
- `src/app/consulta/constants.ts`

## Tests First

- `src/app/api/rag/ask/handler.test.ts`
- `src/app/consulta/page.test.tsx`

API tests must prove status mapping and Zod validation. Page tests must prove
global-only rendering, loading states, answer rendering, source rendering, and
safe error handling.

## Done When

- API and page tests pass.
- All route response bodies are Zod-validated.
- The page stays intentionally minimal and global-only so F-04 can extend the
  same surface without reworking the base ask flow.
