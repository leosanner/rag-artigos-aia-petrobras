# F-05 Block 03 - Application: Audited Ask Flow and Provider Metrics

## Goal

Close the application/provider boundary for F-05: the single-turn ask flow must
capture normalized provider usage/cost metadata, measure total latency, persist
one audited run per authorized/schema-valid ask attempt, and expose application
services for audit reads.

## Scope

**In scope:**

- Provider-port expansion for normalized embedding and generation usage/cost
  metadata.
- Total-latency measurement across the audited ask flow.
- Related-term extraction orchestration using Block 01 helpers.
- Audited run persistence for success, no-evidence, and safe technical failure
  paths.
- Route-agnostic application services for recent-run listing and run-detail
  lookup.
- Unit tests with fake repositories/providers.

**Out of scope:**

- Drizzle schema and repository SQL; Block 02 owns those.
- API route handlers, Zod response schemas, and `/query`.
- New chat/conversation behavior, focused retrieval, streaming, and agents.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | Every authorized, schema-valid `POST /api/rag/ask` attempt persists one `rag_query_runs` record. | `AnswerQuestion` becomes the audited single-turn orchestrator. |
| RN-03 | Successful ask responses include a stable `traceId`. | The application returns the persisted run id on success. |
| RN-04 | Failed ask responses remain sanitized and do not expose trace storage internals, raw provider bodies, raw prompts, or secrets. | The application persists failures internally but keeps the same safe outward error codes. |
| RN-06 | Persisted traces store the applied `topK`, retrieval strategy, and `candidateTopK` actually used. | The application passes applied retrieval metadata into persistence. |
| RN-07 | Persisted source snapshots must match the source list used for answer generation or no-evidence handling for that run. | The application persists the selected sources after numbering/citation validation. |
| RN-09 | Related terms are extracted from the normalized question text plus retrieved source excerpts, ranked deterministically, and capped at 8 results. | The audited ask flow calls the block-01 extractor before persistence. |
| RN-11 | Embedding and generation adapters must return normalized numeric usage and estimated-cost metadata to the application layer. | Provider ports expand here. |
| RN-14 | F-05 stays single-turn; it does not introduce conversations or chat transcript state. | The audited flow extends `AnswerQuestion`; it does not create a second turn engine. |
| INV-05 | Technical error responses must remain sanitized even when the failed run is persisted internally. | Persistence happens before response serialization, without leaking internals. |
| INV-06 | F-05 must not introduce chat conversations or a second turn engine. | Audit reads and writes reuse the same single-turn application path. |

## Functional Requirements

- [ ] RF-B03-01: `QuestionEmbeddingProvider.embedQuestion(question)` returns
  `{ embedding, usage }`, where `usage` exposes normalized numeric token/cost
  data for the embedding call.
- [ ] RF-B03-02: `GenerationProvider.generateAnswer(input)` returns
  `{ answer, usage }`, where `usage` exposes normalized numeric token/cost data
  for the generation call.
- [ ] RF-B03-03: `AnswerQuestion.execute(input)` measures total latency from
  before question embedding until the run is ready for response serialization.
- [ ] RF-B03-04: After retrieval selects sources, `AnswerQuestion` derives
  related terms from the normalized question plus selected source excerpts
  before persisting the run.
- [ ] RF-B03-05: The no-source path persists status `answered_no_evidence`,
  skips generation, and records null or zero generation usage/cost fields.
- [ ] RF-B03-06: The source-backed success path validates citations exactly as
  F-03 requires, persists status `answered`, and returns `traceId`,
  `relatedTerms`, and audit metrics together with the answer payload.
- [ ] RF-B03-07: Technical generation failures after request validation persist
  one failed run with the safe failure code plus any already-selected sources
  and related terms.
- [ ] RF-B03-08: The audited ask flow does not persist unauthorized or
  schema-invalid requests; the route boundary remains responsible for that.
- [ ] RF-B03-09: Application services expose recent-run summaries and one
  run-detail lookup through repository-backed read use cases.
- [ ] RF-B03-10: Unit tests prove usage/cost aggregation, latency capture,
  no-evidence persistence, failed-run persistence, and unchanged safe error
  mapping.

## Module Contracts

```ts
export type EmbeddingUsage = {
  inputTokens: number;
  estimatedCostUsd: number;
};

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type RagAnswerAudit = {
  latencyMs: number;
  embedding: EmbeddingUsage;
  generation: GenerationUsage | null;
  totalCostUsd: number;
};
```

```ts
export interface QuestionEmbeddingProvider {
  embedQuestion(question: string): Promise<{
    embedding: number[];
    usage: EmbeddingUsage;
  }>;
}

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
}
```

```ts
export type AnswerQuestionAnsweredResult = {
  kind: "answered";
  traceId: string;
  answer: string;
  mode: "global";
  sources: RagSource[];
  relatedTerms: RelatedTerm[];
  metadata: RagAnswerMetadata;
  audit: RagAnswerAudit;
};

export interface RagRunSummaryReader {
  listRecent(): Promise<RagRunSummary[]>;
}

export interface RagRunDetailReader {
  getById(id: string): Promise<RagRunDetail | null>;
}
```

## Key Modules

- `src/application/rag/answer-question.ts`
- `src/application/rag/ports.ts`
- `src/application/rag/schemas.ts`
- `src/application/rag/list-query-runs.ts`
- `src/application/rag/get-query-run.ts`
- `src/infrastructure/ai/openai-embedding-provider.ts`
- `src/infrastructure/ai/openai-generation-provider.ts`

## Tests First

- `src/application/rag/answer-question.test.ts`
- `src/application/rag/list-query-runs.test.ts`
- `src/application/rag/get-query-run.test.ts`
- `src/infrastructure/ai/openai-embedding-provider.test.ts`
- `src/infrastructure/ai/openai-generation-provider.test.ts`

Tests must use fake repositories/providers for orchestration coverage and must
not make real OpenAI calls.

## Done When

- Application and adapter tests pass without real provider calls.
- `AnswerQuestion` owns the audited single-turn flow while route handlers stay
  thin.
- Audit read services are reusable by the later interface block and by F-06
  without introducing a second generation pipeline.

