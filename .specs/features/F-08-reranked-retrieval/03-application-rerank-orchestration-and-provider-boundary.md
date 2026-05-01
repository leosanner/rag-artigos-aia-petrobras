# F-08 Block 03 - Application: Rerank Orchestration and Provider Boundary

## Goal

Close the shared application and provider boundary for F-08: `RetrieveChunks`
must keep ownership of the retrieval pipeline, `AnswerQuestion` must keep
ownership of no-evidence handling, prompt selection, trace persistence, and
safe error mapping, and the new reranking provider must remain swappable and
provider-agnostic.

## Scope

**In scope:**

- Extending `RetrieveChunks.search(...)` so `standard`, `explore`, and
  `rerank` all flow through the same embedding and first-pass search path.
- A new `RerankingProvider` application port plus normalized input/result
  types.
- A dedicated reranking failure type that preserves safe error codes and
  already-measured embedding usage.
- Extending answer metadata and audit assembly with reranking fields when the
  reranker actually ran successfully.
- Unit tests with fake repositories, fake generation providers, and fake
  reranking providers.

**Out of scope:**

- Drizzle schema and repository SQL; Block 02 owns those.
- Ask/query-run handlers, Zod DTOs, and `/query`; Block 04 owns those.
- Choosing the concrete reranker vendor/model in the abstract; the Cohere
  adapter that eventually lands in `src/infrastructure/ai/` still plugs into
  the port defined here instead of changing the application contract.
- Conversation-route SSE behavior, focused-mode verification, or streaming
  event payloads; Block 05 records those follow-up sync points only.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-05 | `rerank` uses `candidateTopK = min(24, topK * 3)`. | `RetrieveChunks` computes the first-pass candidate size with the shared helper. |
| RN-06 | The first-pass candidate set is the existing global score-ordered vector search result. | `RetrieveChunks` reuses the current repository search before invoking the reranker. |
| RN-07 | The reranking stage may only reorder or downselect first-pass candidates. | `RetrieveChunks` validates the reranker output against the first-pass ids. |
| RN-08 | The final reranked selection contains exactly `topK` matches when enough candidates exist. | The rerank validator enforces final-size semantics before context assembly. |
| RN-09 | `rerank` uses the standard answer-generation path. | `AnswerQuestion` passes `retrievalStrategy: "rerank"` through the standard prompt branch. |
| RN-10 | `explore` remains unchanged. | `RetrieveChunks` still uses diversification only for `explore`. |
| RN-11 | Successful reranked answers record reranker metadata, reranking audit, and score evidence. | `RetrieveChunksResult` carries normalized reranking metadata/audit to `AnswerQuestion`. |
| RN-14 | Safe reranking failures persist a governed trace and skip generation. | `AnswerQuestion` maps the dedicated failure type directly to safe rerank error results. |
| INV-04 | `rerank` must use the standard answer-generation prompt path. | The generation provider treats `rerank` like `standard`, not `explore`. |
| INV-05 | A reranking failure must never fall through to generation. | `AnswerQuestion` returns the safe rerank error before prompt assembly or generation. |
| INV-08 | F-08 must stay behind a reranking provider interface. | All provider-specific rerank behavior lives behind `RerankingProvider`. |

## Functional Requirements

- [ ] RF-B03-01: `RetrieveChunks.search(input)` continues to embed the query
  exactly once and perform exactly one first-pass repository search for all
  strategies.
- [ ] RF-B03-02: When `strategy = "standard"`, `RetrieveChunks` returns the
  repository result directly with `reranking = null`.
- [ ] RF-B03-03: When `strategy = "explore"`, `RetrieveChunks` fetches
  `candidateTopK`, applies deterministic diversified selection, and returns
  `reranking = null`.
- [ ] RF-B03-04: When `strategy = "rerank"` and the first-pass candidate set is
  empty, `RetrieveChunks` returns `matches = []`, `reranking = null`, and never
  calls the reranking provider.
- [ ] RF-B03-05: When `strategy = "rerank"` and candidates exist,
  `RetrieveChunks` calls `RerankingProvider.rerank(...)` exactly once with the
  normalized question, ordered candidates, `topK`, and `candidateTopK`.
- [ ] RF-B03-06: `RetrieveChunks` validates the reranker output against the
  Block 01 invariants and throws a dedicated reranking failure when the output
  is invalid.
- [ ] RF-B03-07: `RetrieveChunksResult` extends to
  `{ matches, embedding, reranking }`, where `reranking` is either `null` or
  `{ metadata, audit }`.
- [ ] RF-B03-08: `AnswerQuestion` includes nullable `rerankerProvider` and
  `rerankerModel` in response metadata and a nullable `reranking` object in the
  response audit.
- [ ] RF-B03-09: `AnswerQuestion` maps reranking failures to safe
  `reranking_failed` or `reranking_unavailable`, persists the failed run, and
  does not call the generation provider.
- [ ] RF-B03-10: `GenerationProvider.generateAnswer(...)` and
  `GenerationProvider.streamAnswer(...)` both accept
  `retrievalStrategy: "standard" | "explore" | "rerank"`, but `rerank` follows
  the same standard-synthesis prompt branch as `standard`.

## Module Contracts

```ts
export type RetrieveChunksResult = {
  matches: RerankedChunkMatch[];
  embedding: EmbeddingUsage;
  reranking: {
    metadata: RagRerankingMetadata;
    audit: RagRerankingAudit;
  } | null;
};

export interface RerankingProvider {
  rerank(input: {
    question: string;
    matches: FirstPassChunkMatch[];
    topK: number;
    candidateTopK: number;
  }): Promise<{
    matches: RerankedChunkMatch[];
    metadata: RagRerankingMetadata;
    audit: RagRerankingAudit;
  }>;
}
```

```ts
export class RerankingFailure extends Error {
  readonly code: "reranking_failed" | "reranking_unavailable";
  readonly embedding: EmbeddingUsage | null;
  readonly cause: unknown;
}

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput & {
    retrievalStrategy: "standard" | "explore" | "rerank";
  }): Promise<{ answer: string; usage: GenerationUsage }>;

  streamAnswer?(input: GenerateAnswerInput & {
    retrievalStrategy: "standard" | "explore" | "rerank";
  }): Promise<StreamedGenerationResult>;
}
```

## Key Modules

- `src/application/rag/retrieve-chunks.ts`
- `src/application/rag/answer-question.ts`
- `src/application/rag/ports.ts`
- `src/application/rag/schemas.ts`
- `src/infrastructure/ai/openai-generation-provider.ts`
- `src/infrastructure/ai/cohere-reranking-provider.ts`

## Tests First

- `src/application/rag/retrieve-chunks.test.ts`
- `src/application/rag/answer-question.test.ts`
- `src/infrastructure/ai/openai-generation-provider.test.ts`

Tests must use fake reranking and generation providers for orchestration
coverage. They must explicitly prove: zero-candidate rerank skips the provider,
successful rerank calls the provider once, invalid rerank output fails safely,
and rerank failures persist safe run statuses without falling through to
generation.

## Done When

- `RetrieveChunks` remains the single retrieval pipeline entrypoint for
  standard, explore, and rerank.
- `AnswerQuestion` remains the single-turn orchestrator for no-evidence,
  generation, citation validation, and trace persistence.
- The reranker can be swapped later without editing route handlers, UI code, or
  repository logic.
