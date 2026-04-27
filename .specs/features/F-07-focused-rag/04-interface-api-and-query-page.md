# F-07 Block 04 - Interface: Documents API, Ask Extension, and `/query` Page

## Goal

Expose Block 03 use cases over HTTP and evolve `/query` with focused mode on
top of the existing shared shell (F-04 controls + F-05 audit + F-06
conversation + F-08 rerank), without creating a separate page or weakening
any existing safe error/audit contract.

## Scope

**In scope:**

- `GET /api/rag/documents` route handler that delegates to
  `ListRagDocuments`, validates the response with Zod, and reuses the
  bearer-secret guard already used by `/api/rag/ask`.
- Extending `POST /api/rag/ask` request validation to accept the focused
  variant of the discriminated union; mapping the typed
  `focused_document_rejected` outcome from Block 03 to a sanitized HTTP
  response (`404` for `"not_found"`, `422` for `"not_processed"` /
  `"not_indexed"`).
- Returning focused-success responses with `mode: "focused"` and
  `documentId` echoed in metadata, on top of the existing F-05/F-08 success
  payload.
- `/query` UI: a mode toggle (global ↔ focused), a document picker that
  loads from `/api/rag/documents`, and a submit-disabled state until a
  document is selected. The retrieval controls (`topK`, strategy
  standard/explore/rerank), audit panel, and conversation shell remain
  intact and apply to focused mode the same way they apply to global mode.
- Route-level and page-level tests.

**Out of scope:**

- Use-case implementations (Block 03), repository SQL (Block 02), and
  domain types (Block 01).
- New audit endpoints; F-05 already serves the audit views and they need
  no schema change for focused mode.
- Document preview / PDF viewer / metadata editing / reprocessing.
- Streaming transport, multi-document subset filters, metadata filters,
  cross-document comparison.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-04 | Focused mode uses the same retrieval-controls model as global mode. | The focused submission path reuses the F-04/F-08 retrieval controls UI and sends the same `retrieval` payload. |
| RN-05 | The UI must not offer pending, failed, or unindexed documents as selectable focused targets. | The picker only renders what `/api/rag/documents` returns; no client-side override. |
| RN-06 | A focused request for an unknown, non-processed, or unindexed document returns a safe client error and does not call generation. | The route maps the Block 03 typed rejection to `404` or `422` with `{ error: "..." }` and never reaches embedding/generation. |
| RN-08 | F-07 must not change the existing global request/response behavior. | The discriminated union keeps the global request shape intact; existing global responses remain unchanged. |
| INV-04 | Adding focused mode must not break global mode request or response compatibility. | Route tests assert the existing global payloads keep parsing successfully against the new discriminated schema. |
| INV-06 | API responses must not leak database URLs, API keys, or raw provider errors. | All error branches return sanitized DTOs; no SQL/provider strings escape. |

## Functional Requirements

- [ ] RF-B04-01: `GET /api/rag/documents` requires the operator bearer
  secret, calls `ListRagDocuments.execute()`, validates the response with
  Zod, and returns `{ documents: SelectableRagDocument[] }`.
- [ ] RF-B04-02: `POST /api/rag/ask` accepts the focused variant of the
  discriminated union and rejects malformed payloads (missing/invalid
  `documentId`, unknown fields, invalid retrieval) with the existing
  `{ error: "invalid_request" }` 422 response.
- [ ] RF-B04-03: A focused request whose `documentId` is unknown returns
  HTTP 404 with `{ error: "document_not_found" }`; a focused request whose
  document is not processed or not indexed returns HTTP 422 with
  `{ error: "document_not_focusable" }` (single sanitized code, with the
  specific reason carried internally for traceability but not leaked).
- [ ] RF-B04-04: Focused success responses carry the same F-05/F-08 audit
  payload (traceId, sources, related terms, audit metrics, retrieval
  metadata) plus `mode: "focused"` and the requested `documentId` in
  metadata.
- [ ] RF-B04-05: `/query` adds a mode selector (global / focused) and a
  document picker driven by `/api/rag/documents`. Existing controls
  (`topK`, strategy, conversation shell, audit panel) remain visible and
  apply identically in both modes.
- [ ] RF-B04-06: `/query` disables the focused submit action until a
  selectable document is chosen.
- [ ] RF-B04-07: Switching between global and focused does not clear the
  retrieval controls, the active conversation, or the audit selection.
- [ ] RF-B04-08: All `/query` strings introduced by F-07 are PT-BR per the
  project rule; the focused-mode controls follow the same labelling style
  as the existing F-04/F-05/F-08 controls.

## Module Contracts

```ts
export const SelectableRagDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  authors: z.string().nullable(),
  publicationYear: z.number().int().nullable(),
  doi: z.string().nullable(),
  chunkCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const ListRagDocumentsResponseSchema = z.object({
  documents: z.array(SelectableRagDocumentSchema),
});

export const RagAskFocusedErrorSchema = z.object({
  error: z.union([
    z.literal("invalid_request"),
    z.literal("document_not_found"),
    z.literal("document_not_focusable"),
    /* existing F-03/F-05/F-08 error codes */
  ]),
});
```

```http
GET  /api/rag/documents          → 200 ListRagDocumentsResponse | 401
POST /api/rag/ask                → 200 RagAskResponse
                                   | 401 | 422 invalid_request
                                   | 404 document_not_found
                                   | 422 document_not_focusable
```

## Key Modules

- `src/app/api/rag/documents/route.ts` (new)
- `src/app/api/rag/ask/route.ts` (extended)
- `src/application/rag/schemas.ts` (request discriminated union assembled
  from Block 01 types)
- `src/app/query/page.tsx` (focused-mode UI)
- `src/app/query/_components/*` (any new picker/toggle components colocated
  with the existing query components)

## Tests First

- `src/app/api/rag/documents/route.test.ts`
- `src/app/api/rag/ask/route.test.ts` (extended with focused cases)
- `src/app/query/page.test.tsx` (extended: mode toggle, picker, disabled
  submit)

Tests must cover: documents endpoint requires auth and excludes
non-selectable documents; ask endpoint accepts focused payload, returns 404
for unknown id and 422 for non-processed/unindexed without invoking
embedding or generation; ask endpoint global path is untouched; `/query`
disables focused submit until a document is picked and re-enables it after
selection; switching modes preserves retrieval controls and conversation
state.

## Done When

- Route and page tests pass.
- `pnpm lint && pnpm typecheck` are green.
- `/query` exposes focused mode end-to-end on top of the shared shell with
  no regression on global, conversation, or rerank flows.
