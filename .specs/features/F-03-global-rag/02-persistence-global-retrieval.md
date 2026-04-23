# F-03 Block 02 - Persistence: Global Retrieval

## Goal

Extend the F-02 persistence layer with the read-only retrieval query needed by
F-03: active-config global pgvector search joined to document metadata and
returned through a repository DTO that is already traceable enough for sources
and citations.

## Scope

**In scope:**

- Repository additions for global vector search against `document_chunks`.
- Join to `documents` for title, pipeline version, and processed-status checks.
- Filtering by active `chunking_version` and active `embedding_model`.
- Scoring with `1 - cosine_distance` and descending-score ordering.
- Return DTOs containing the full chunk text in `excerpt`.
- Real Postgres repository tests covering pgvector similarity behavior.

**Out of scope:**

- Schema changes or new migrations.
- Context assembly, citation validation, or answer generation.
- Query embedding and application orchestration.
- API routes, Zod schemas, and `/query`.
- Focused retrieval; that belongs to F-07.

## Business Rules

- RN-B02-01: Global retrieval reads only from `document_chunks` joined to
  `documents`; it never reads `documents.raw_text`.
- RN-B02-02: Search filters to the active `chunking_version` and active
  `embedding_model`.
- RN-B02-03: Search returns only rows whose parent document is still
  `processed`.
- RN-B02-04: Search applies no document filter in F-03.
- RN-B02-05: Scores are computed as `1 - cosine_distance`, where higher is
  better.
- RN-B02-06: Results are ordered by descending score, with stable tie-breaking
  by document id and chunk index.
- RN-B02-07: `excerpt` is the full `document_chunks.content`, not a UI-trimmed
  snippet.
- RN-B02-08: Repository methods remain read-only for RAG retrieval and must not
  mutate `documents` or `document_chunks`.

## Functional Requirements

- [ ] RF-B02-01: `DocumentChunksRepository.searchGlobal(input)` accepts a query
  embedding, top-k, active `chunkingVersion`, and active `embeddingModel`.
- [ ] RF-B02-02: `searchGlobal(input)` returns at most `topK` matches ordered
  by descending `score`.
- [ ] RF-B02-03: `searchGlobal(input)` joins `documents` and returns
  `documentTitle` plus `documentPipelineVersion`.
- [ ] RF-B02-04: `searchGlobal(input)` excludes rows from non-matching
  `chunking_version` values.
- [ ] RF-B02-05: `searchGlobal(input)` excludes rows from non-matching
  `embedding_model` values.
- [ ] RF-B02-06: `searchGlobal(input)` excludes rows whose parent document is
  not `processed`.
- [ ] RF-B02-07: Each match includes `chunkId`, `documentId`, `documentTitle`,
  `chunkIndex`, `excerpt`, `score`, `documentPipelineVersion`,
  `chunkingVersion`, and `embeddingModel`.
- [ ] RF-B02-08: The repository returns an empty array when no active-config
  retrieval-ready chunks exist.
- [ ] RF-B02-09: Real Postgres tests prove active-config filtering, descending
  score ordering, top-k limiting, and exclusion of non-processed rows.

## Module Contracts

```ts
export type SearchGlobalChunksInput = {
  queryEmbedding: number[];
  topK: number;
  chunkingVersion: string;
  embeddingModel: string;
};

export type RetrievedChunkMatch = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
};
```

```ts
class DocumentChunksRepository {
  searchGlobal(input: SearchGlobalChunksInput): Promise<RetrievedChunkMatch[]>;
}
```

## Key Modules

- `src/repositories/document-chunks-repository.ts`
- `src/repositories/document-chunks-repository.test.ts`
- `src/test/db.ts`

## Tests First

- Extend `src/repositories/document-chunks-repository.test.ts`

Repository tests must use real Postgres with pgvector and must explicitly prove
that retrieval ignores chunks from old indexing configurations.

## Done When

- Repository tests pass against real Postgres.
- No schema or migration changes are needed for F-03 Block 02.
- Later application code can consume a retrieval DTO that already contains the
  full source metadata required by the success response.
