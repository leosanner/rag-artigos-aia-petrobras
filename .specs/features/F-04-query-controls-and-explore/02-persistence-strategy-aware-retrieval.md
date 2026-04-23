# F-04 Block 02 - Persistence: Strategy-Aware Retrieval

## Goal

Extend the F-03 retrieval repository contract for F-04: the persistence layer
must support standard top-k fetches and larger explore candidate fetches while
keeping the same active-config, processed-document, score-ordered retrieval
rules.

## Scope

**In scope:**

- Repository query behavior for request-driven `topK`.
- Explore-mode candidate fetches up to `candidateTopK = min(24, topK * 3)`.
- The same active `chunking_version` and active `embedding_model` filtering
  already established by F-02/F-03.
- Deterministic descending-score ordering with stable tie-breaking before any
  application-level diversification.
- Real Postgres repository tests covering standard and explore fetch sizes.

**Out of scope:**

- New tables, migrations, or schema changes.
- Diversification logic; that belongs to Block 01.
- Application orchestration, prompt branching, or metadata assembly.
- API routes, Zod schemas, and `/query`.
- Trace persistence, observability writes, conversations, and agents.

## Business Rules

- RN-B02-01: F-04 retrieval remains read-only and must not mutate
  `documents`, `document_chunks`, or any observability table.
- RN-B02-02: Retrieval reads only from `document_chunks` joined to
  `documents`; it never reads `documents.raw_text`.
- RN-B02-03: Standard mode fetches at most the requested `topK` matches.
- RN-B02-04: Explore mode fetches at most `candidateTopK = min(24, topK * 3)`
  matches before diversification.
- RN-B02-05: Search filters to the active `chunking_version` and active
  `embedding_model`.
- RN-B02-06: Search returns only rows whose parent document is `processed`.
- RN-B02-07: Scores are computed as `1 - cosine_distance`, where higher is
  better.
- RN-B02-08: Results are ordered by descending score, with stable tie-breaking
  by document id and chunk index, before the application layer diversifies
  explore results.
- RN-B02-09: Repository DTOs remain identical to F-03 so explore mode can
  reuse the same downstream source-numbering and citation flow.

## Functional Requirements

- [ ] RF-B02-01: `DocumentChunksRepository.searchGlobal(input)` accepts a query
  embedding, requested `topK`, active `chunkingVersion`, and active
  `embeddingModel`.
- [ ] RF-B02-02: `searchGlobal(input)` returns at most the requested `topK`
  matches ordered by descending `score`.
- [ ] RF-B02-03: Standard-mode callers may pass any validated `topK` in the
  inclusive range `3..12`.
- [ ] RF-B02-04: Explore-mode callers may pass any validated candidate fetch
  size up to `24`.
- [ ] RF-B02-05: `searchGlobal(input)` joins `documents` and returns
  `documentTitle` plus `documentPipelineVersion`.
- [ ] RF-B02-06: `searchGlobal(input)` excludes rows from non-matching
  `chunking_version` values.
- [ ] RF-B02-07: `searchGlobal(input)` excludes rows from non-matching
  `embedding_model` values.
- [ ] RF-B02-08: `searchGlobal(input)` excludes rows whose parent document is
  not `processed`.
- [ ] RF-B02-09: Repository tests prove standard and explore fetch sizes,
  active-config filtering, descending score ordering, and exclusion of
  non-processed rows.

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
that explore-mode candidate fetches remain capped at the requested size and
still ignore old indexing configurations.

## Done When

- Repository tests pass against real Postgres.
- No schema, migration, or persistence-model changes are needed for F-04 Block
  02.
- Later application code can request either standard top-k or explore
  candidate fetches without changing the repository DTO shape.
