# F-03 Block 01 - Domain: Context, Citations, and Answer Rules

## Goal

Build the pure business-logic foundation for F-03 before touching pgvector,
OpenAI, route handlers, or UI. This block owns source numbering, prompt-context
assembly, citation-marker parsing and validation, insufficient-evidence answer
rules, and the closed safe error catalog for generation failures.

## Scope

**In scope:**

- Deterministic numbering of retrieved sources in retrieval order.
- Context assembly that turns retrieved matches into prompt-ready numbered
  source blocks.
- Citation-marker parsing from generated answer text.
- Citation validation against the numbered `sources` array.
- Insufficient-evidence answer builders for the no-chunk path.
- Safe generation error codes used by later blocks for HTTP responses.
- Unit tests for numbering stability, parser behavior, validator behavior, and
  no-provider answer rules.

**Out of scope:**

- pgvector queries, repository SQL, and Postgres tests.
- Query embedding and generation provider adapters.
- Zod API schemas, route handlers, and `/consulta`.
- Focused retrieval, M3 observability, streaming, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-06 | Successful generated answers with retrieved sources must use inline citations. | Citation parsing and validation live here. |
| RN-07 | Citation markers are validated in the backend before serialization. | Validator rejects missing, malformed, or out-of-range markers. |
| RN-08 | Retrieved but uncited sources may still remain in the successful response. | Validator checks only cited numbers; it does not require every source to be cited. |
| RN-10 | No retrieved chunks returns an insufficient-evidence answer without generation. | No-chunk answer builders are pure helpers in this block. |
| RN-12 | Invalid generated output fails with `generation_failed`. | Safe generation error catalog is owned here. |
| INV-03 | Success responses must not cite absent sources. | Validator enforces this strictly. |
| INV-04 | Retrieved-source answers must contain at least one valid citation marker. | Validator rejects citation-less generation when sources exist. |

## Functional Requirements

- [ ] RF-B01-01: `numberSources(matches)` assigns `sourceNumber` starting at 1
  and preserves retrieval order.
- [ ] RF-B01-02: `assembleRagContext(sources)` produces deterministic numbered
  source blocks for prompt input.
- [ ] RF-B01-03: Context assembly preserves the source numbering exposed in the
  response DTO.
- [ ] RF-B01-04: `extractCitationNumbers(answer)` recognizes repeated citation
  markers like `[1]`, `[2]`, `[10]` and returns them in encounter order.
- [ ] RF-B01-05: Citation parsing ignores plain numbers that are not formatted
  as bracketed markers.
- [ ] RF-B01-06: `assertValidCitationMarkers(answer, sources)` rejects answers
  with no citation markers when `sources.length > 0`.
- [ ] RF-B01-07: `assertValidCitationMarkers(answer, sources)` rejects markers
  that reference source numbers outside the available range.
- [ ] RF-B01-08: The validator allows retrieved sources to remain uncited in
  the success response.
- [ ] RF-B01-09: `buildNoEvidenceAnswer()` returns a Portuguese insufficient-
  evidence answer for the no-chunk path without requiring generation.
- [ ] RF-B01-10: `GenerationFailureCode` is a closed union limited to
  `generation_failed` and `generation_unavailable`.
- [ ] RF-B01-11: `toSafeGenerationFailureCode(err)` maps known generation
  failures to explicit safe codes and every other value to
  `generation_failed`.

## Module Contracts

```ts
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

export type RagSource = RetrievedChunkMatch & {
  sourceNumber: number;
};

export type AssembledRagContext = {
  sources: RagSource[];
  promptContext: string;
};
```

```ts
export type GenerationFailureCode =
  | "generation_failed"
  | "generation_unavailable";

export function numberSources(
  matches: RetrievedChunkMatch[],
): RagSource[];

export function assembleRagContext(
  matches: RetrievedChunkMatch[],
): AssembledRagContext;

export function extractCitationNumbers(answer: string): number[];

export function assertValidCitationMarkers(
  answer: string,
  sources: RagSource[],
): void;

export function buildNoEvidenceAnswer(): string;

export function toSafeGenerationFailureCode(
  err: unknown,
): GenerationFailureCode;
```

## Tests First

- `src/domain/rag/context-assembler.test.ts`
- `src/domain/rag/citation-markers.test.ts`
- `src/domain/rag/answer-rules.test.ts`

The tests must cover numbering stability, prompt-context determinism, valid and
invalid citation scenarios, repeated markers, citation-less generated output,
and the Portuguese no-evidence answer path.

## Done When

- All block tests pass.
- `src/domain/rag/*` does not import Drizzle, OpenAI, Vercel AI SDK, Next.js,
  repositories, or `process.env`.
- Later blocks can build retrieval and generation on top of these pure helpers
  without editing the core citation rules.
