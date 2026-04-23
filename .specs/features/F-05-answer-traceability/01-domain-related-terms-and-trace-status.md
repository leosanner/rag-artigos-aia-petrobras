# F-05 Block 01 - Domain: Related Terms and Trace Status

## Goal

Build the pure business-logic foundation for F-05 before touching Drizzle
schema, route handlers, or `/query`. This block owns deterministic related-term
extraction plus the safe trace status/error vocabulary reused by persistence
and application code.

## Scope

**In scope:**

- Pure types for persisted run statuses and safe failure codes.
- Deterministic related-term extraction from normalized question text plus
  retrieved source excerpts.
- Question-only fallback when no sources were selected for the run.
- Stable ranking, tie-breaking, and the cap of 8 persisted terms.
- Pure helpers and tests for the audit-term DTO shape used by later layers.

**Out of scope:**

- Drizzle schema, migrations, or repository writes.
- Provider usage/cost normalization and latency measurement.
- API request/response schemas, route handlers, and `/query`.
- Conversation state, focused retrieval, streaming, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-05 | Persisted run status values are `answered`, `answered_no_evidence`, `generation_failed`, and `generation_unavailable`. | The domain exposes the closed safe status vocabulary reused everywhere else. |
| RN-08 | "Top related tokens" are represented as deterministic related terms/themes, not raw provider token attribution. | Extraction is rule-based and auditable instead of model-driven. |
| RN-09 | Related terms are extracted from normalized question text plus retrieved source excerpts, ranked deterministically, and capped at 8 results. | The extractor owns the deterministic ranking and fallback inputs. |
| RN-10 | Each related term persists its rank, n-gram size, total frequency, and source-coverage count. | The domain result shape matches the persistence contract. |
| RN-13 | Stored traces must never include raw prompt text, operator secrets, stack traces, or raw provider response bodies. | Domain helpers operate only on normalized question text and source excerpts. |
| INV-04 | Related terms must come from deterministic extraction over the question plus retrieved excerpts, not from model output. | No provider call or LLM-generated keyword path exists in this block. |

## Functional Requirements

- [ ] RF-B01-01: `extractRelatedTerms(input)` accepts normalized question text
  and zero or more source excerpts and returns at most 8 ranked terms.
- [ ] RF-B01-02: When retrieved sources exist, extraction considers both the
  question text and the selected source excerpts.
- [ ] RF-B01-03: When no sources exist, extraction falls back to the question
  text alone and still returns a deterministic result set.
- [ ] RF-B01-04: Each returned term includes `rank`, `term`, `ngramSize`,
  `frequency`, and `sourceCoverageCount`.
- [ ] RF-B01-05: Duplicate occurrences collapse into one normalized term record
  with aggregated frequency and source-coverage counts.
- [ ] RF-B01-06: Ranking is deterministic for the same normalized inputs, with
  stable tie-breaking so repeated runs produce the same term order.
- [ ] RF-B01-07: The domain exposes a closed `RagQueryRunStatus` type limited
  to `answered`, `answered_no_evidence`, `generation_failed`, and
  `generation_unavailable`.
- [ ] RF-B01-08: Failure codes remain limited to the safe vocabulary
  `generation_failed` and `generation_unavailable`; success statuses carry no
  technical error detail.
- [ ] RF-B01-09: Domain helpers remain pure and do not import Next.js, Drizzle,
  repositories, provider SDKs, or `process.env`.

## Module Contracts

```ts
export type RagQueryRunStatus =
  | "answered"
  | "answered_no_evidence"
  | "generation_failed"
  | "generation_unavailable";

export type RagQueryRunErrorCode =
  | "generation_failed"
  | "generation_unavailable";

export type RelatedTerm = {
  rank: number;
  term: string;
  ngramSize: number;
  frequency: number;
  sourceCoverageCount: number;
};
```

```ts
export function extractRelatedTerms(input: {
  question: string;
  sourceExcerpts: string[];
  limit?: number;
}): RelatedTerm[];

export function isFailedRunStatus(status: RagQueryRunStatus): boolean;
```

## Key Modules

- `src/domain/rag/related-terms.ts`
- `src/domain/rag/query-run-status.ts`
- `src/domain/rag/index.ts`

## Tests First

- `src/domain/rag/related-terms.test.ts`
- `src/domain/rag/query-run-status.test.ts`

The tests must cover deterministic extraction, stable ranking/tie-breaking, the
cap of 8, question-only fallback, aggregated frequency/source coverage, and the
closed safe status/error vocabulary.

## Done When

- Domain tests pass.
- Related-term extraction remains pure and deterministic.
- Later persistence and application blocks can reuse the same status/error
  vocabulary and related-term DTOs without reimplementing the rules.

