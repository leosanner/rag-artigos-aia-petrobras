# F-07 Block 02 - Persistence: Selectable Documents and Document-Scoped Retrieval

## Goal

Add the governed read paths F-07 needs without introducing new tables: a
selector query that lists only documents safe to focus on, and a
document-scoped variant of the existing vector search that enforces a strict
`document_id` filter at the database layer.

## Scope

**In scope:**

- A repository read on `documents-repository.ts` (or a sibling reader) that
  returns processed documents which already have at least one row in
  `document_chunks`, projecting the fields `SelectableRagDocument` needs
  (including `chunkCount` and `updatedAt`).
- An extension of `document-chunks-repository.ts` that performs the same
  vector search used by global / explore / rerank first-pass retrieval but
  applies a parameterized `document_id = $1` predicate at the SQL level.
- A repository helper that reports whether a given `documentId` is unknown,
  pending/failed (not processed), or processed-but-unindexed, so the
  application layer can map to `FocusedDocumentRejectionReason` without
  issuing a second round-trip.
- Real-Postgres repository tests covering the selector filter, the strict
  document-scoped vector search, and the rejection-classifier branches.

**Out of scope:**

- Domain types and Zod validation (Block 01).
- Application orchestration, embedding calls, generation, and trace
  persistence (Block 03 and the existing F-05 path).
- Any change to `rag_query_runs` / `rag_query_run_sources` schema; F-05
  Block 02 owns it and F-08 already covers `retrieval_score` /
  `rerank_score` columns.
- API routes, request/response Zod schemas, and `/query` UI (Block 04).
- Any new table, migration, or index unrelated to the selector and
  document-scoped read paths.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | The selected document must be `processed` and have at least one retrieval-ready chunk. | The selector and rejection classifier both gate on `status = 'processed'` AND `EXISTS (chunk)`. |
| RN-03 | Focused retrieval must return chunks only from the selected document. | The vector search applies `document_id = $1` as a SQL `WHERE` predicate, not as post-filter. |
| RN-05 | The UI must not offer pending, failed, or unindexed documents as selectable focused targets. | The selector excludes pending, failed, and processed-but-unindexed documents. |
| INV-01 | Focused mode must never return a chunk whose `document_id` differs from the requested `documentId`. | The repository test asserts the predicate on real seed data covering multiple documents. |
| INV-02 | Focused mode must not make pending, failed, or unindexed documents selectable. | The selector test seeds all four states and asserts the result set. |
| INV-06 | API responses must not leak database URLs, API keys, or raw provider errors. | Repository errors propagate as typed failures; no SQL error messages cross this boundary. |

## Functional Requirements

- [ ] RF-B02-01: `DocumentsRepository.listSelectableForFocusedRag()` returns
  rows for documents where `status = 'processed'` AND at least one
  `document_chunks` row exists, with `chunkCount` and `updatedAt`
  projections.
- [ ] RF-B02-02: The selector query returns rows ordered by `updatedAt DESC`
  (most recently updated first) so the picker has a stable order.
- [ ] RF-B02-03: `DocumentsRepository.classifyForFocusedRag(documentId)`
  returns one of `"not_found" | "not_processed" | "not_indexed" | "ok"` in a
  single round-trip.
- [ ] RF-B02-04: `DocumentChunksRepository.searchByEmbedding(input)` accepts
  an optional `documentId` filter; when present, the SQL `WHERE` clause
  parameterizes `document_id = $documentId` alongside the existing strategy
  filters.
- [ ] RF-B02-05: When the `documentId` filter is set and the document has
  zero chunks matching the strategy fan-out, the repository returns an
  empty array (no synthetic rows).
- [ ] RF-B02-06: The selector and classifier reuse Drizzle parameterization;
  no string interpolation of `documentId` into SQL.
- [ ] RF-B02-07: Repository tests run against real Postgres + pgvector using
  the same helper already used by F-02/F-03 repositories.

## Module Contracts

```ts
export type SelectableDocumentRow = {
  id: string;
  title: string;
  authors: string | null;
  publicationYear: number | null;
  doi: string | null;
  chunkCount: number;
  updatedAt: Date;
};

export type FocusedDocumentClassification =
  | "ok"
  | "not_found"
  | "not_processed"
  | "not_indexed";

export interface DocumentsRepository {
  // existing reads...
  listSelectableForFocusedRag(): Promise<SelectableDocumentRow[]>;
  classifyForFocusedRag(documentId: string): Promise<FocusedDocumentClassification>;
}

export type SearchChunksInput = {
  embedding: number[];
  topK: number;
  documentId?: string;
};

export interface DocumentChunksRepository {
  searchByEmbedding(input: SearchChunksInput): Promise<RetrievedChunkMatch[]>;
}
```

## Key Modules

- `src/repositories/documents-repository.ts`
- `src/repositories/document-chunks-repository.ts`

## Tests First

- `src/repositories/documents-repository.test.ts` (extended)
- `src/repositories/document-chunks-repository.test.ts` (extended)

Tests must cover: selector excludes pending/failed/processed-but-unindexed;
selector projects `chunkCount`/`updatedAt`/optional bibliographic fields and
orders by `updatedAt DESC`; classifier returns the correct branch for each
seeded state including unknown ids; document-scoped vector search returns
only chunks belonging to the requested document across multi-document seeds;
empty result for documents with zero chunks under the strategy.

## Done When

- Repository tests pass against real Postgres.
- The selector and document-scoped search can be wired into Block 03 without
  raw SQL leaking into the application layer.
- No production code outside the repository layer reads the
  `documents`/`document_chunks` tables for focused-mode purposes.
