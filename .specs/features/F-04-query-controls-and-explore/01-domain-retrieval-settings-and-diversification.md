# F-04 Block 01 - Domain: Retrieval Settings and Diversification

## Goal

Build the pure business-logic foundation for F-04 before touching repository
queries, route handlers, or `/query`. This block owns normalized retrieval
settings, candidate-top-k calculation, and deterministic diversified
downselection for explore mode.

## Scope

**In scope:**

- Retrieval-setting domain types for `topK` and `strategy`.
- Default-setting helpers for omitted retrieval controls.
- Pure calculation of `candidateTopK = min(24, topK * 3)`.
- Deterministic diversified selection from score-ordered candidates.
- Pure helpers and tests for the two-chunks-per-document cap while
  alternatives remain available.

**Out of scope:**

- pgvector queries or repository SQL.
- Application orchestration, provider adapters, or prompt assembly.
- API request/response schemas, route handlers, and `/query`.
- Trace persistence, conversations, focused retrieval, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | Omitting `retrieval` is equivalent to `{ topK: 6, strategy: "standard" }`. | Default helpers define the normalized retrieval baseline. |
| RN-03 | `topK` must be an integer in the inclusive range `3..12`. | Domain helpers assume validated inputs inside the allowed range. |
| RN-06 | `"explore"` is operator-driven and must never be activated by a hidden classifier or prompt heuristic. | Domain types treat strategy as explicit input only. |
| RN-07 | Explore mode computes `candidateTopK = min(24, topK * 3)`. | Candidate-count calculation is owned here. |
| RN-08 | Explore mode retrieves candidates ordered by descending score, then diversifies deterministically. | Diversified selection consumes score-ordered candidates and never randomizes. |
| RN-09 | Diversification caps at two chunks per document while alternatives remain, then backfills by score if needed. | Selection helper enforces the cap and backfill behavior. |
| INV-02 | F-04 must never activate explore mode automatically. | Strategy is explicit input only; there is no auto-switching helper. |
| INV-03 | F-04 must never request more than `24` retrieval candidates. | Candidate-top-k helper hard-caps explore fetches at `24`. |

## Functional Requirements

- [x] RF-B01-01: `normalizeRetrievalSettings(input)` returns
  `{ topK: 6, strategy: "standard" }` when `retrieval` is omitted.
- [x] RF-B01-02: `normalizeRetrievalSettings(input)` preserves an explicit
  `topK` when provided and defaults only the omitted `strategy`.
- [x] RF-B01-03: `getCandidateTopK(settings)` returns `settings.topK` for
  standard mode and `min(24, settings.topK * 3)` for explore mode.
- [x] RF-B01-04: `selectDiversifiedMatches(input)` is deterministic for the
  same score-ordered candidate list and `topK`.
- [x] RF-B01-05: `selectDiversifiedMatches(input)` never selects more than
  `topK` matches.
- [x] RF-B01-06: `selectDiversifiedMatches(input)` enforces a cap of two
  chunks per document while at least one other document still has an unselected
  candidate.
- [x] RF-B01-07: When the diversity cap alone would leave the selection shorter
  than `topK`, `selectDiversifiedMatches(input)` backfills with the remaining
  highest-scoring candidates.
- [x] RF-B01-08: When candidate count is already `<= topK`,
  `selectDiversifiedMatches(input)` preserves retrieval order and returns the
  input matches unchanged.
- [x] RF-B01-09: Domain helpers do not inspect question text and do not infer
  explore mode from content.

## Module Contracts

```ts
export type RagRetrievalStrategy = "standard" | "explore";

export type RagRetrievalSettings = {
  topK: number;
  strategy: RagRetrievalStrategy;
};

export type RagRetrievalInput = Partial<RagRetrievalSettings>;
```

```ts
export function normalizeRetrievalSettings(
  input?: RagRetrievalInput,
): RagRetrievalSettings;

export function getCandidateTopK(
  settings: RagRetrievalSettings,
): number;

export function selectDiversifiedMatches(input: {
  matches: RetrievedChunkMatch[];
  topK: number;
}): RetrievedChunkMatch[];
```

## Key Modules

- `src/domain/rag/retrieval-settings.ts`
- `src/domain/rag/diversified-selection.ts`
- `src/domain/rag/index.ts`

## Tests First

- `src/domain/rag/retrieval-settings.test.ts`
- `src/domain/rag/diversified-selection.test.ts`

The tests must cover default normalization, candidate-top-k bounds,
deterministic selection, the per-document cap, and score-ordered backfill when
diversity alone would underfill the context.

## Done When

- All block tests pass.
- The domain helpers remain pure and do not import Next.js, Drizzle, provider
  SDKs, repositories, or `process.env`.
- Later persistence and application blocks can reuse the same normalized
  retrieval settings and diversification logic without reimplementing the
  rules.
