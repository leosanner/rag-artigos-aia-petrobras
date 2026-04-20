# F-02 Block 04 - Interface: API and Page

## Goal

Expose the manual indexing workflow to the operator through validated API
routes and a Portuguese `/indexacao` page, while keeping business logic in the
application layer.

## Scope

**In scope:**

- Zod request/response schemas for indexing APIs.
- `POST /api/rag/indexing/runs` route handler and wiring.
- `GET /api/rag/indexing/runs/:id` route handler and wiring.
- Bearer authorization using existing `INGESTION_SYNC_SECRET`.
- Portuguese `/indexacao` page with operator secret, optional document id, `force`, start action, conflict handling, and polling.
- Handler and component tests.

**Out of scope:**

- Actual background processing logic (Block 03).
- Repository/schema implementation (Block 02).
- Auth beyond the existing bearer-secret pattern.
- Retrieval, question UI, answer generation, citations, observability, and agents.

## Business Rules

- RN-B04-01: `POST /api/rag/indexing/runs` requires `Authorization: Bearer <secret>`.
- RN-B04-02: Unauthorized start requests return 401 and do not create runs or publish events.
- RN-B04-03: Invalid bodies return 400 and do not call `StartIndexingRun`.
- RN-B04-04: Active-run conflicts return 409 with `{ activeRunId }`.
- RN-B04-05: Successful start returns 202 with `{ runId, status: "queued", documentId, force }`.
- RN-B04-06: `GET /api/rag/indexing/runs/:id` is read-only and does not require the operator secret.
- RN-B04-07: Invalid ids return 400; missing runs return 404.
- RN-B04-08: All API responses are Zod-validated before serialization.
- RN-B04-09: API responses and UI must not expose `OPENAI_API_KEY`, `DATABASE_URL`, `INGESTION_SYNC_SECRET`, raw provider details, or stack traces.
- RN-B04-10: `/indexacao` copy is PT-BR by default.
- RN-B04-11: The operator secret is stored only in `sessionStorage` and sent only in the `Authorization` header.

## Functional Requirements

- [ ] RF-B04-01: `indexingStartRequestSchema` accepts `{ documentId?: uuid, force?: boolean }` and defaults `force` to false.
- [ ] RF-B04-02: Response schemas cover queued, conflict, unauthorized, invalid request, invalid id, not found, and run detail.
- [ ] RF-B04-03: `createIndexingRunStartHandler` returns 401 without calling the service when auth fails.
- [ ] RF-B04-04: The start handler returns 400 for invalid JSON/body.
- [ ] RF-B04-05: The start handler forwards validated input to `StartIndexingRun`.
- [ ] RF-B04-06: The start handler returns 202 or 409 based on the service result.
- [ ] RF-B04-07: `createIndexingRunDetailHandler` validates the id path param before calling `GetIndexingRun`.
- [ ] RF-B04-08: The detail handler returns 200, 400, or 404 as appropriate.
- [ ] RF-B04-09: Route files compose production repositories/publishers only; handler files remain dependency-injectable for tests.
- [ ] RF-B04-10: `/indexacao` disables the start button until a secret is present.
- [ ] RF-B04-11: `/indexacao` sends `{ force }` and optional `{ documentId }` in the POST body.
- [ ] RF-B04-12: On 202 the page displays the run id and begins polling.
- [ ] RF-B04-13: Polling stops when run status becomes `completed` or `failed`.
- [ ] RF-B04-14: On 401 the page clears the stored secret and shows a Portuguese rejection message.
- [ ] RF-B04-15: On 409 the page shows the active run id and lets the operator poll it.

## Key Modules

- `src/application/indexing/schemas.ts`
- `src/app/api/rag/indexing/runs/handler.ts`
- `src/app/api/rag/indexing/runs/route.ts`
- `src/app/api/rag/indexing/runs/[id]/handler.ts`
- `src/app/api/rag/indexing/runs/[id]/route.ts`
- `src/app/indexacao/page.tsx`
- `src/app/indexacao/constants.ts`

## Tests First

- `src/app/api/rag/indexing/runs/handler.test.ts`
- `src/app/api/rag/indexing/runs/[id]/handler.test.ts`
- `src/app/indexacao/page.test.tsx`

## Done When

- API and page tests pass.
- All route response bodies are Zod-validated.
- UI copy is Portuguese and the secret is not rendered into visible DOM text.
- No retrieval or answer UI appears in this block.
