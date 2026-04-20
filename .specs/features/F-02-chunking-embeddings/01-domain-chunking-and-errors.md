# F-02 Block 01 - Domain: Chunking and Safe Errors

## Goal

Build the pure business-logic foundation for F-02 before touching pgvector,
OpenAI, Inngest, API routes, or UI. This block owns deterministic chunking over
`refined_text` and the closed error catalog that later blocks can safely persist
and return.

## Scope

**In scope:**

- Hybrid paragraph-aware chunking over a caller-provided `refinedText` string.
- Stable `chunkIndex` ordering for identical input, chunking version, and config.
- Local deterministic token estimation with no tokenizer dependency.
- Chunking constants: version, max estimated tokens `900`, overlap `150`.
- Safe indexing error codes for run/run-item persistence and API responses.
- Unit tests for chunking behavior and safe error normalization.

**Out of scope:**

- Drizzle schema, pgvector, migrations, repositories, and Postgres tests.
- OpenAI/Vercel AI SDK adapters.
- Inngest, route handlers, Zod API schemas, `/indexacao`.
- Retrieval, generation, citations, observability, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | Chunking reads only `documents.refined_text`. | Public input is named `refinedText`; no document/raw-text access exists here. |
| RN-03 | Blank `refined_text` is invalid input. | Chunker rejects blank input. |
| RN-05 | `chunk_index` is stable. | Chunking algorithm is deterministic and assigns indexes from final order. |
| RN-06 | Default strategy is hybrid paragraph-aware 900/150. | Constants encode defaults. |
| INV-01 | Never create chunks from `raw_text`. | Domain API does not accept `rawText`. |
| INV-03 | Retrieval-ready chunks are non-empty. | Chunker returns only non-empty content. |
| INV-07 | No raw stack traces or provider details in API responses. | Error catalog is closed and safe. |

## Functional Requirements

- [ ] RF-B01-01: `estimateTokens(text)` deterministically counts word/number/symbol units with no external dependency.
- [ ] RF-B01-02: `HybridTextChunker.chunk({ refinedText })` rejects empty or whitespace-only input.
- [ ] RF-B01-03: The chunker normalizes whitespace without semantic rewriting.
- [ ] RF-B01-04: Paragraph boundaries are preserved when paragraphs fit within the max estimated token limit.
- [ ] RF-B01-05: Long paragraphs are split deterministically without exceeding `maxEstimatedTokens`.
- [ ] RF-B01-06: Adjacent chunks include deterministic overlap up to `overlapEstimatedTokens`.
- [ ] RF-B01-07: Every output chunk has `chunkIndex`, `content`, and `estimatedTokens`.
- [ ] RF-B01-08: `chunkIndex` starts at 0 and increments by 1 without gaps.
- [ ] RF-B01-09: The same input/config produces byte-for-byte equal output across calls.
- [ ] RF-B01-10: `IndexingErrorCode` is a closed union safe for persistence and API responses.
- [ ] RF-B01-11: `toSafeIndexingErrorCode(err)` returns the explicit code for known indexing errors and `"unknown_error"` for every other input.

## Module Contracts

```ts
export type ChunkingConfig = {
  chunkingVersion: string;
  maxEstimatedTokens: number;
  overlapEstimatedTokens: number;
};

export type ChunkedText = {
  chunkIndex: number;
  content: string;
  estimatedTokens: number;
};

export interface TextChunker {
  chunk(input: { refinedText: string }): ChunkedText[];
}
```

```ts
export type IndexingErrorCode =
  | "document_not_indexable"
  | "refined_text_empty"
  | "chunking_failed"
  | "embedding_failed"
  | "embedding_dimensions_mismatch"
  | "persistence_failed"
  | "unknown_error";
```

## Tests First

- `src/domain/chunking/hybrid-text-chunker.test.ts`
- `src/domain/indexing/errors.test.ts`

The tests must cover stability, paragraph preservation, long paragraph splitting,
overlap, blank input, and no-leak error normalization.

## Done When

- All block tests pass.
- `src/domain/chunking/*` and `src/domain/indexing/*` do not import Drizzle,
  OpenAI, Inngest, Next.js, repositories, or `process.env`.
- Later blocks can import the chunker and error catalog without editing this
  block.
