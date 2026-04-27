# F-07 Block 03 - Application: ListRagDocuments and Focused AnswerQuestion

## Goal

Wire Block 01 vocabulary and Block 02 read paths into the existing audited
turn engine. This block introduces the `ListRagDocuments` use case used by the
selector endpoint and extends `AnswerQuestion` so a focused ask reuses the
exact retrieval, generation, citation, related-term, and trace-persistence
path already implemented for F-03/F-04/F-05/F-08.

## Scope

**In scope:**

- `ListRagDocuments.execute()` — orchestrates the selector repository read
  and projects `SelectableRagDocument` DTOs.
- Extending `AnswerQuestion.execute(input)` to dispatch on the discriminated
  request union: when `mode === "focused"`, classify the document, short-
  circuit on rejection, otherwise pass `documentId` through to retrieval and
  reuse the rest of the pipeline unchanged.
- Passing `documentId` through `RetrieveChunks.search(input)` to the
  document-scoped repository search.
- Persisting traces with `mode = "focused"` and the requested `documentId`
  alongside the existing F-05/F-08 trace columns; this block does not change
  the `rag_query_runs` schema, only the value written into `mode`.
- Tests with fakes for repositories, embedding, generation, and reranker
  proving: (a) generation is never called when classification rejects;
  (b) the `documentId` filter reaches the chunks repository; (c) the
  no-evidence branch is reused for zero focused chunks; (d) the persisted
  trace exposes `mode: "focused"` and the requested `documentId`.

**Out of scope:**

- Domain types, Zod schemas, and discriminated union (Block 01).
- Repository SQL and migrations (Block 02).
- Route handlers, request/response Zod, bearer-secret guard, and `/query`
  UI (Block 04).
- Any reimplementation of F-04 retrieval normalization, F-05 trace
  persistence, F-08 reranking orchestration, or the F-03 prompt/citation
  validation.
- Conversation-mode focused workflow — F-06 already orchestrates
  conversations and will inherit focused-mode automatically once the shared
  ask service supports it.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | The selected document must be processed and have at least one retrieval-ready chunk. | `AnswerQuestion` calls `classifyForFocusedRag` and rejects before retrieval. |
| RN-03 | Focused retrieval must return chunks only from the selected document. | The use case forwards `documentId` to `RetrieveChunks` so the repository filter applies. |
| RN-06 | A focused request for an unknown, non-processed, or unindexed document returns a safe client error and does not call the generation provider. | The classification branch returns a typed rejection before embedding/generation calls. |
| RN-07 | F-07 must not duplicate the shared generation logic, the F-05 traceability model, or the shared retrieval-strategy contract extended by F-08. | The focused branch reuses `AnswerQuestion`, `RetrieveChunks`, the same prompt/context assembler, the same trace writer, and (when `strategy = "rerank"`) the F-08 `RerankingProvider`. |
| RN-08 | F-07 must not change the existing global request/response behavior. | The global branch continues through the unchanged pipeline. |
| INV-03 | Focused mode must reuse the shared answer/generation and traceability contracts. | No focused-only prompt, no focused-only audit type. |
| INV-05 | Focused mode must not bypass or weaken the F-05 trace-persistence model. | The trace writer is invoked on the same control points; failed classifications produce no `rag_query_runs` row, matching how F-05 treats unauthorized/invalid requests. |

## Functional Requirements

- [ ] RF-B03-01: `ListRagDocuments.execute()` returns
  `{ documents: SelectableRagDocument[] }` ordered by `updatedAt DESC`,
  mapping repository rows into the DTO without any extra provider calls.
- [ ] RF-B03-02: `AnswerQuestion.execute(input)` accepts the discriminated
  union and routes `mode: "focused"` through a focused branch while leaving
  the global branch byte-compatible with F-04/F-05/F-08 behavior.
- [ ] RF-B03-03: The focused branch calls
  `DocumentsRepository.classifyForFocusedRag(documentId)` first; on any
  result other than `"ok"` it returns a typed rejection
  (`{ status: "focused_document_rejected", reason }`) without calling
  embedding, retrieval, reranker, or generation, and without persisting a
  `rag_query_runs` row.
- [ ] RF-B03-04: When classification is `"ok"`, the focused branch reuses
  the F-04 retrieval-settings normalization (default `topK = 6`,
  `strategy = "standard"`).
- [ ] RF-B03-05: `RetrieveChunks.search(input)` accepts an optional
  `documentId` and forwards it to the repository search; when present,
  `candidateTopK` policy from F-04/F-08 still applies.
- [ ] RF-B03-06: When focused retrieval returns zero chunks, the use case
  reuses the existing `answered_no_evidence` branch (same DTO, same trace
  status) rather than introducing a focused-only "no evidence" shape.
- [ ] RF-B03-07: When focused retrieval returns chunks, context assembly,
  generation, citation validation, related-term extraction (F-05), and
  rerank stage (F-08, only when `strategy = "rerank"`) run unchanged.
- [ ] RF-B03-08: Persisted traces for focused successes/failures store
  `mode = "focused"` and the requested `documentId` (existing F-05 columns
  are sufficient — the only new value is the `mode` discriminator and the
  `documentId` field that should be added to `rag_query_runs` if not yet
  present; if it already is, this block only writes to it).
- [ ] RF-B03-09: Tests use fakes for embedding, retrieval, reranker, and
  generation, plus real classification/search behavior through repository
  fakes that respect the Block 02 contract.

## Module Contracts

```ts
export type AnswerQuestionInput = FocusedRagAskRequest | GlobalRagAskRequest;

export type AnswerQuestionResult =
  | { status: "answered"; /* existing F-05 success shape */ }
  | { status: "answered_no_evidence"; /* existing F-05 shape */ }
  | { status: "generation_failed"; /* existing safe error */ }
  | { status: "generation_unavailable"; /* existing safe error */ }
  | { status: "reranking_failed"; /* F-08 safe error */ }
  | { status: "reranking_unavailable"; /* F-08 safe error */ }
  | { status: "focused_document_rejected"; reason: FocusedDocumentRejectionReason };

export interface AnswerQuestion {
  execute(input: AnswerQuestionInput): Promise<AnswerQuestionResult>;
}

export interface ListRagDocuments {
  execute(): Promise<{ documents: SelectableRagDocument[] }>;
}

export type RetrieveChunksInput = {
  question: string;
  embedding: number[];
  retrieval: NormalizedRetrievalSettings;
  documentId?: string;
};
```

## Key Modules

- `src/application/rag/answer-question.ts` (extended)
- `src/application/rag/retrieve-chunks.ts` (extended)
- `src/application/rag/list-rag-documents.ts` (new)
- `src/application/rag/schemas.ts` (re-export of focused DTO; the actual Zod
  request union is exercised by Block 04)
- `src/application/rag/ports.ts` (only if a new port is needed; prefer
  reusing `DocumentsRepository`/`DocumentChunksRepository` directly).

## Tests First

- `src/application/rag/list-rag-documents.test.ts`
- `src/application/rag/answer-question.test.ts` (extended with focused
  cases)
- `src/application/rag/retrieve-chunks.test.ts` (extended with `documentId`
  forwarding)

Tests must cover: classification rejection produces no embedding/generation
call and no persisted run; classification `"ok"` leads to the same trace
fields as global mode plus `mode: "focused"` and `documentId`; zero focused
chunks returns the shared `answered_no_evidence` shape; rerank strategy on
focused mode invokes the reranker exactly once; generation failure path
persists a failed run with the same safe codes used in global mode.

## Done When

- Application tests pass.
- `AnswerQuestion` and `RetrieveChunks` accept the discriminated union and
  the optional `documentId` without regressing any F-03/F-04/F-05/F-08
  test.
- Block 04 can implement the route handlers and `/query` UI by wiring these
  use cases without re-implementing classification, retrieval, or trace
  logic.
