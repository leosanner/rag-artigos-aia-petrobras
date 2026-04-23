# F-04 Block 03 - Application: Retrieval Controls and Prompting

## Goal

Close the application/provider boundary for F-04: `AnswerQuestion`
normalizes retrieval settings, selects the standard or explore retrieval path,
assembles stable metadata, and switches prompt behavior without weakening the
F-03 citation-validation or safe failure rules.

## Scope

**In scope:**

- Retrieval-setting normalization in `AnswerQuestion`.
- Strategy-aware retrieval orchestration through `RetrieveChunks.search(input)`.
- Explore-mode use of Block 01 diversification after candidate fetches.
- Prompt-version or prompt-mode branching for standard versus explore answers.
- Success metadata assembly for applied `topK`, `retrievalStrategy`, and
  `candidateTopK`.
- Unit tests with fake retrieval and fake generation providers.

**Out of scope:**

- Repository SQL implementation (Block 02), except through public APIs.
- Route handlers and `/query` UI (Block 04).
- New persistence, trace IDs, token accounting, or chat state.
- Focused retrieval, reranking, streaming, and agents.

## Business Rules

- RN-B03-01: `AnswerQuestion` still accepts only `{ mode: "global" }` in F-04;
  retrieval controls extend the request shape but do not add a new mode.
- RN-B03-02: Omitting `retrieval` is normalized to
  `{ topK: 6, strategy: "standard" }`.
- RN-B03-03: Standard mode retrieves exactly the applied `topK` and does not
  run the diversification step.
- RN-B03-04: Explore mode retrieves `candidateTopK = min(24, topK * 3)`
  candidates, then applies deterministic downselection to final `topK`.
- RN-B03-05: Query embedding uses the same active embedding model/dimension
  contract defined by F-02/F-03.
- RN-B03-06: Retrieved matches are numbered only after the final standard or
  diversified selection is complete.
- RN-B03-07: The generation provider receives the selected prompt context plus
  enough strategy information to request either a standard synthesis or `2..4`
  cited perspectives.
- RN-B03-08: Citation validation, insufficient-evidence handling, and safe
  generation failure mapping remain exactly as defined by F-03.
- RN-B03-09: Success metadata includes `mode`, applied `topK`,
  `retrievalStrategy`, `candidateTopK`, `promptVersion`, `generationModel`,
  and `embeddingModel`.
- RN-B03-10: Provider-specific calls remain behind ports and F-04 does not
  introduce any agents dependency.

## Functional Requirements

- [x] RF-B03-01: `AnswerQuestion.execute(input)` accepts
  `{ question, mode: "global", retrieval?: { topK?: number; strategy?: "standard" | "explore" } }`.
- [x] RF-B03-02: `AnswerQuestion.execute(input)` normalizes omitted retrieval
  settings before calling retrieval.
- [x] RF-B03-03: `RetrieveChunks.search(input)` accepts normalized retrieval
  settings instead of using a fixed F-03-only top-k.
- [x] RF-B03-04: Standard-mode retrieval calls the repository once with the
  applied `topK`.
- [x] RF-B03-05: Explore-mode retrieval calls the repository once with
  `candidateTopK`, then runs Block 01 deterministic downselection to final
  `topK`.
- [x] RF-B03-06: No retrieved chunks still return the Portuguese
  insufficient-evidence answer without calling the generation provider.
- [x] RF-B03-07: The generation provider receives a prompt variant that asks
  for `2..4` cited perspectives when `strategy = "explore"`.
- [x] RF-B03-08: Standard mode preserves the F-03 answer-generation behavior
  apart from applied retrieval metadata.
- [x] RF-B03-09: Success results include the applied retrieval metadata and the
  final selected `sources`.
- [x] RF-B03-10: Error results remain limited to safe
  `generation_failed` or `generation_unavailable`.
- [x] RF-B03-11: Unit tests prove normalization defaults, standard-mode
  direct retrieval, explore-mode diversification, prompt branching, metadata
  assembly, and unchanged citation-validation failure handling.

## Module Contracts

```ts
export type GlobalRagAskInput = {
  question: string;
  mode: "global";
  retrieval?: {
    topK?: number;
    strategy?: "standard" | "explore";
  };
};

export type RagAnswerMetadata = {
  mode: "global";
  topK: number;
  retrievalStrategy: "standard" | "explore";
  candidateTopK: number;
  promptVersion: string;
  generationModel: string;
  embeddingModel: string;
};
```

```ts
export interface RetrieveChunks {
  search(input: {
    question: string;
    retrieval: RagRetrievalSettings;
  }): Promise<RetrievedChunkMatch[]>;
  readonly embeddingModel: string;
  readonly chunkingVersion: string;
}

export interface GenerationProvider {
  generateAnswer(input: {
    question: string;
    promptContext: string;
    promptVersion: string;
    generationModel: string;
    retrievalStrategy: "standard" | "explore";
  }): Promise<{ answer: string }>;
}
```

## Key Modules

- `src/application/rag/answer-question.ts`
- `src/application/rag/retrieve-chunks.ts`
- `src/application/rag/ports.ts`
- `src/application/rag/schemas.ts`
- `src/application/rag/constants.ts`
- `src/infrastructure/ai/openai-generation-provider.ts`

## Tests First

- `src/application/rag/answer-question.test.ts`
- `src/application/rag/retrieve-chunks.test.ts`
- `src/infrastructure/ai/openai-generation-provider.test.ts`

Tests must use fake retrieval and generation providers for orchestration
coverage and must not make real OpenAI calls.

## Done When

- Application and adapter tests pass without real provider calls.
- `AnswerQuestion` owns retrieval-setting normalization and strategy-aware
  orchestration while route handlers stay thin.
- Explore prompting, diversified selection, and metadata assembly are all
  replaceable through ports and pure helpers without changing the route or UI
  layer.
