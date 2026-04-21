# F-03 Block 03 - Application: Retrieval and Generation

## Goal

Close the application/provider boundary for F-03: `AnswerQuestion` orchestrates
query embedding, active-config retrieval, context assembly, prompt versioning,
generation, citation validation, and safe result mapping without leaking
provider details into the route layer.

## Scope

**In scope:**

- `AnswerQuestion` application service for F-03 global mode.
- Retrieval service wiring query embedding to repository search.
- Application ports for query embedding, retrieval, and answer generation.
- Prompt version constants and generation input shape.
- OpenAI generation adapter using the Vercel AI SDK provider boundary.
- Env validation for `RAG_GENERATION_MODEL`.
- Unit tests with fake retrieval and fake generation providers.

**Out of scope:**

- Route handlers and `/query` UI (Block 04).
- Repository SQL implementation (Block 02), except through public APIs.
- Focused mode, document listing, and F-04 selector behavior.
- Persistence of answers, token usage, costs, latency, or traces.
- Streaming responses, reranking, and agents.

## Business Rules

- RN-B03-01: `AnswerQuestion` accepts only `{ mode: "global" }` in F-03.
- RN-B03-02: Question embedding uses the same active embedding
  model/dimension contract used by F-02 retrieval-ready chunks.
- RN-B03-03: Retrieval uses top-k `6` and the active indexing configuration.
- RN-B03-04: No-chunk requests return the Portuguese insufficient-evidence
  answer immediately and do not call the generation provider.
- RN-B03-05: Retrieved matches are numbered in retrieval order before prompt
  assembly and before success serialization.
- RN-B03-06: The generation provider receives the question, numbered prompt
  context, prompt version, and configured generation model.
- RN-B03-07: When retrieved sources exist, generated output without valid
  citation markers fails with `generation_failed`.
- RN-B03-08: Technical provider failures are normalized to either
  `generation_failed` or `generation_unavailable`.
- RN-B03-09: Technical error results do not include `sources`; only successful
  business results include `answer`, `sources`, and `metadata`.
- RN-B03-10: F-03 keeps all provider-specific calls behind ports and does not
  import or depend on any agents framework.

## Functional Requirements

- [ ] RF-B03-01: `AnswerQuestion.execute(input)` accepts
  `{ question, mode: "global" }`.
- [ ] RF-B03-02: `AnswerQuestion.execute(input)` rejects unsupported modes
  before retrieval.
- [ ] RF-B03-03: The retrieval flow calls the query-embedding port using the
  active embedding model contract inherited from F-02.
- [ ] RF-B03-04: The retrieval flow calls the repository with top-k `6`, active
  `chunkingVersion`, and active `embeddingModel`.
- [ ] RF-B03-05: No retrieved chunks return a success result with the
  Portuguese insufficient-evidence answer, empty `sources`, and stable
  metadata.
- [ ] RF-B03-06: Retrieved chunks are converted into numbered `RagSource`
  objects and prompt context through the Block 01 helpers.
- [ ] RF-B03-07: The generation provider receives `{ question, promptContext,
  promptVersion, generationModel }`.
- [ ] RF-B03-08: The OpenAI generation adapter reads `OPENAI_API_KEY` and
  `RAG_GENERATION_MODEL` from validated server env.
- [ ] RF-B03-09: `RAG_GENERATION_MODEL` is required outside tests and has no
  concrete default value in the F-03 contract.
- [ ] RF-B03-10: After generation returns, the application validates citation
  markers against the numbered `sources`.
- [ ] RF-B03-11: Missing, malformed, or out-of-range citation markers produce a
  typed `generation_failed` error result.
- [ ] RF-B03-12: Provider/network failures are normalized to
  `generation_failed` or `generation_unavailable` without leaking raw details.
- [ ] RF-B03-13: Successful business results include `answer`, `mode`,
  `sources`, and `metadata`.
- [ ] RF-B03-14: Error results include only `{ error }`, where `error` is
  `generation_failed` or `generation_unavailable`.
- [ ] RF-B03-15: Unit tests prove no-chunk short-circuiting, insufficient-
  evidence success, active-config propagation, citation validation failure, and
  provider failure mapping without real OpenAI calls.

## Module Contracts

```ts
export type GlobalRagAskInput = {
  question: string;
  mode: "global";
};

export type AnswerQuestionResult =
  | {
      kind: "answered";
      answer: string;
      mode: "global";
      sources: RagSource[];
      metadata: RagAnswerMetadata;
    }
  | {
      kind: "error";
      error: "generation_failed" | "generation_unavailable";
    };
```

```ts
export interface QuestionEmbeddingProvider {
  embedQuestion(question: string): Promise<number[]>;
}

export interface GenerationProvider {
  generateAnswer(input: {
    question: string;
    promptContext: string;
    promptVersion: string;
    generationModel: string;
  }): Promise<{ answer: string }>;
}
```

## Key Modules

- `src/application/rag/answer-question.ts`
- `src/application/rag/ports.ts`
- `src/application/rag/schemas.ts`
- `src/infrastructure/ai/openai-generation-provider.ts`
- `src/env/server.ts`

## Tests First

- `src/application/rag/answer-question.test.ts`
- `src/infrastructure/ai/openai-generation-provider.test.ts`
- `src/env/server.test.ts`

Tests must use fake retrieval and generation providers for orchestration
coverage and must not make real OpenAI calls.

## Done When

- Application and adapter tests pass without real provider calls.
- `AnswerQuestion` owns orchestration while route handlers stay thin.
- Query embedding, retrieval, citation validation, and generation are all
  replaceable through ports without changing the route or UI layer.
