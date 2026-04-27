# F-07 Block 05 - Integration and Review

## Goal

Close F-07 as an implemented vertical after Blocks 01-04 land: prove that
the document selector excludes non-selectable documents, that focused
retrieval applies a strict `documentId` filter, that all four shared `/query`
contracts (F-04 controls, F-05 audit, F-06 conversation, F-08 rerank) keep
working in both modes, and that the required independent-review handoff is
prepared.

## Scope

**In scope:**

- Final closeout of F-07 as an implemented vertical: focused vocabulary,
  selector + document-scoped retrieval reads, focused-aware `AnswerQuestion`
  + `ListRagDocuments` use cases, `/api/rag/documents` and `/api/rag/ask`
  routes, and `/query` focused-mode UI.
- End-to-end verification using real Postgres for repository behavior and
  fake providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details
  shifted during Blocks 01-04.
- Project-doc updates only if the F-07 contract changed materially during
  implementation.
- Review-packet preparation for the required independent review workflow
  (`codex:rescue` per CLAUDE.md): the F-07 spec, the four block docs, and
  the implementation diff against `main`.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- Multi-document subset filters, metadata filters, cross-document
  comparison, document preview/PDF viewer, metadata editing.
- Streaming transport, agentic workflows.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-03 | Focused retrieval must return chunks only from the selected document. | E2E asserts the source list of focused responses contains only chunks belonging to the selected document across multi-document seeds. |
| RN-05 | The UI must not offer pending, failed, or unindexed documents as selectable focused targets. | E2E asserts `/api/rag/documents` excludes pending/failed/processed-but-unindexed seeds. |
| RN-06 | A focused request for an unknown, non-processed, or unindexed document returns a safe client error and does not call generation. | E2E asserts the route rejects with 404/422 and the generation provider fake records zero calls. |
| RN-08 | F-07 must not change the existing global request/response behavior. | Regression covers F-03/F-04/F-05/F-08 single-turn paths and F-06 conversational path. |
| INV-01 | Focused mode must never return a chunk whose `document_id` differs from the requested `documentId`. | Verified by direct DB inspection of selected sources for a focused success. |
| INV-04 | Adding focused mode must not break global mode request or response compatibility. | Existing global ask tests stay green without payload changes. |
| INV-05 | Focused mode must not bypass or weaken the F-05 trace-persistence model. | Successful focused asks persist exactly one `rag_query_runs` row with `mode = 'focused'` and the requested `documentId`; classification rejections persist no row. |

## Functional Requirements

- [ ] RF-B05-01: The parent `spec.md` remains the authoritative contract
  and reflects any refinements discovered during Blocks 01-04.
- [ ] RF-B05-02: End-to-end verification exercises:
  1. Seed pending, failed, processed-without-chunks, and processed-with-
     chunks documents.
  2. `GET /api/rag/documents` returns only the processed-with-chunks
     entries.
  3. `POST /api/rag/ask` with focused mode and an unknown id returns 404
     and creates no `rag_query_runs` row; the embedding/generation
     provider fakes record zero calls.
  4. `POST /api/rag/ask` with focused mode and a non-processed id returns
     422 and creates no `rag_query_runs` row.
  5. `POST /api/rag/ask` with focused mode and a valid id returns the same
     cited-answer / sources / related-terms / audit shape as global mode,
     plus `mode: "focused"` and the requested `documentId`, with all
     selected sources confirmed to belong to that document.
  6. The same focused request with `strategy: "rerank"` invokes the F-08
     reranker exactly once and persists `retrievalScore` plus
     `rerankScore` for each selected source.
  7. The same focused request issued inside an F-06 conversation appends a
     valid assistant transcript row linked to the focused trace.
- [ ] RF-B05-03: Single-turn `/api/rag/ask` global mode is exercised in
  regression to prove focused mode did not displace it; `/query` global
  flow keeps producing identical responses.
- [ ] RF-B05-04: The acceptance-criteria checklist from `spec.md`
  §Acceptance Criteria is mapped 1-to-1 to verification evidence (test
  name or manual probe) before the review handoff.
- [ ] RF-B05-05: `pnpm lint`, `pnpm typecheck`, and `pnpm test` are green.
- [ ] RF-B05-06: An independent review is opened via `codex:rescue` (or
  the reviewer the user explicitly approved) with: the F-07 `spec.md`, the
  four block docs, and the implementation diff. The reviewer agent must be
  fresh — never the implementer thread — per CLAUDE.md.

## Verification Steps

1. Run repository, application, route, and page tests added in Blocks
   02-04.
2. Run the end-to-end probe described in RF-B05-02 against real Postgres.
3. Inspect a successful focused trace row in `rag_query_runs` and confirm
   `mode = 'focused'`, the requested `documentId`, and the F-05/F-08
   columns.
4. Run `pnpm lint && pnpm typecheck && pnpm test`.
5. Bundle the review packet (spec + 4 blocks + diff) and hand off via
   `codex:rescue`.

## Done When

- All five verification steps pass.
- The `spec.md` Acceptance Criteria checklist matches the implementation
  evidence.
- The independent reviewer either approves or returns actionable
  findings; no F-07 acceptance item is marked done on implementer
  confidence alone.
- `.specs/project/STATE.md` and `.specs/project/CHANGELOG.md` are updated
  if the F-07 contract changed materially during implementation.
