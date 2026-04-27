# F-07 Block 01 - Domain: Focused Mode and Selectable Document

## Goal

Add the pure business-logic vocabulary F-07 needs before any persistence,
application, or interface work begins. This block owns the focused-mode request
shape, the selectable-document DTO, and the safe-error vocabulary used when a
focused request targets a document that cannot be answered from.

## Scope

**In scope:**

- A discriminated request type that extends the shared ask request union with
  `mode: "focused"`, a `documentId` UUID, and the optional shared
  `retrieval` settings already defined by F-04 (and extended by F-08).
- A `SelectableRagDocument` DTO describing what `/query` needs to render a
  document picker (id, title, optional bibliographic display fields,
  `chunkCount`, `updatedAt`).
- A `FocusedDocumentRejectionReason` closed union covering the safe outcomes
  produced when the requested document cannot be served:
  `"not_found"`, `"not_processed"`, `"not_indexed"`.
- Pure helpers and unit tests for those types so the persistence and
  application blocks can import them without re-implementing the rules.

**Out of scope:**

- Drizzle schema, migrations, or repository SQL (Block 02).
- Application orchestration (Block 03 owns `ListRagDocuments` and the
  focused branch of `AnswerQuestion`).
- API request/response Zod schemas, route handlers, and `/query` UI (Block
  04).
- Any change to the shared `RetrievalSettings` from F-04 or to the rerank
  strategy added by F-08; this block only re-exports them inside the focused
  request union.
- Any change to `RagQueryRunStatus` or related-term extraction; F-05 still
  owns those.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | Focused RAG requires a valid `documentId`. | The focused request type makes `documentId` non-optional and validates it as a UUID. |
| RN-04 | Focused mode uses the same retrieval-controls model as global mode, including `topK` `3..12` and strategies `standard`, `explore`, and `rerank`. | The focused request reuses the shared `RetrievalSettings` schema unchanged. |
| RN-07 | F-07 must not duplicate the shared generation logic, the F-05 traceability model, or the shared retrieval-strategy contract extended by F-08. | This block introduces no new prompt, no new trace status, and no parallel strategy union — it imports the existing ones. |
| RN-08 | F-07 must not change the existing global request/response behavior. | The global request shape is left untouched; the focused branch is a new variant of the same discriminated union. |
| INV-03 | Focused mode must reuse the shared answer/generation and traceability contracts. | No focused-only prompt or audit shape is declared here. |
| INV-04 | Adding focused mode must not break global mode request or response compatibility. | The discriminated union keeps `{ mode: "global" }` valid as-is. |
| INV-07 | F-07 must not depend on any agents framework. | Domain code imports no agents runtime. |

## Functional Requirements

- [ ] RF-B01-01: A `FocusedRagAskRequest` type/schema accepts
  `{ question, mode: "focused", documentId, retrieval? }` and rejects any
  other unknown top-level fields.
- [ ] RF-B01-02: `documentId` is validated as a UUID; missing or malformed
  ids are rejected at the schema boundary, before retrieval or generation
  can be considered.
- [ ] RF-B01-03: The shared `ragAskRequestSchema` becomes a discriminated
  union over `mode` with `"global"` and `"focused"` variants, leaving the
  existing global variant byte-for-byte compatible.
- [ ] RF-B01-04: `RetrievalSettings` (F-04 + F-08) is reused unchanged inside
  the focused variant; no new strategy is introduced by this block.
- [ ] RF-B01-05: A `SelectableRagDocument` type exposes `id`, `title`,
  optional `authors`, `publicationYear`, `doi`, required `chunkCount`, and
  required `updatedAt`.
- [ ] RF-B01-06: `FocusedDocumentRejectionReason` is a closed union limited
  to `"not_found" | "not_processed" | "not_indexed"`.
- [ ] RF-B01-07: Domain helpers and types remain pure: no imports from
  Next.js, Drizzle, repositories, provider SDKs, or `process.env`.

## Module Contracts

```ts
import { z } from "zod";
import { RetrievalSettingsSchema } from "@/domain/rag/retrieval-settings";

export const FocusedRagAskRequestSchema = z.object({
  question: z.string().min(1),
  mode: z.literal("focused"),
  documentId: z.string().uuid(),
  retrieval: RetrievalSettingsSchema.optional(),
}).strict();

export type FocusedRagAskRequest = z.infer<typeof FocusedRagAskRequestSchema>;

export type FocusedDocumentRejectionReason =
  | "not_found"
  | "not_processed"
  | "not_indexed";

export type SelectableRagDocument = {
  id: string;
  title: string;
  authors: string | null;
  publicationYear: number | null;
  doi: string | null;
  chunkCount: number;
  updatedAt: string;
};
```

The shared `ragAskRequestSchema` is updated (in `src/application/rag/schemas.ts`,
exercised by Block 04) to:

```ts
export const ragAskRequestSchema = z.discriminatedUnion("mode", [
  GlobalRagAskRequestSchema,
  FocusedRagAskRequestSchema,
]);
```

## Key Modules

- `src/domain/rag/focused-request.ts`
- `src/domain/rag/selectable-document.ts`
- `src/domain/rag/focused-rejection.ts`
- `src/domain/rag/index.ts` (re-export the new symbols)

## Tests First

- `src/domain/rag/focused-request.test.ts`
- `src/domain/rag/selectable-document.test.ts`
- `src/domain/rag/focused-rejection.test.ts`

The tests must cover: focused request accepts valid payloads, rejects
non-UUID `documentId`, rejects unknown fields, accepts/rejects retrieval
settings exactly as F-04/F-08 already do; the global variant of the
discriminated union still passes unchanged; `SelectableRagDocument` type
parses through Zod with optional bibliographic fields nullable; the rejection
reason union is closed.

## Done When

- All domain tests pass.
- The discriminated union accepts both global and focused variants without
  breaking existing F-03/F-04/F-05/F-08 schema tests.
- Persistence (Block 02) and application (Block 03) can import
  `SelectableRagDocument`, `FocusedRagAskRequest`, and
  `FocusedDocumentRejectionReason` without re-declaring them.
