# F-10 Block 02 - Infrastructure: OpenAI Streaming Adapter

## Goal

Extend the generation-provider boundary so the application layer can consume
text deltas in real time while still receiving the final accumulated answer and
the same normalized usage/cost metadata already required by F-05.

## Scope

**In scope:**

- `GenerationProvider.streamAnswer(...)` beside the existing sync method.
- AI SDK `streamText(...)` wiring inside the OpenAI adapter.
- Delta forwarding, final-answer accumulation, and normalized usage/cost
  calculation.
- Safe failure classification for streamed provider errors.
- Adapter tests with injected AI SDK primitives.

**Out of scope:**

- Application-layer event ordering; that belongs to Block 01.
- HTTP/SSE framing; that belongs to Block 03.
- `/query` UI rendering; that belongs to Block 04.
- New models, new env vars, or provider-specific payload exposure.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-04 | The streamed UX uses `answer_delta` for text chunks. | The adapter forwards only plain text deltas through `onTextDelta`, not raw provider chunk payloads. |
| RN-07 | The assistant row persists only after final answer accumulation and validation. | `streamAnswer(...)` returns one final accumulated answer string to the application layer; it does not persist anything itself. |
| RN-09 | Safe generation failures still persist governed failed runs. | The adapter keeps the existing failure mapping so `AnswerQuestion` can persist the safe failure status exactly as before. |
| INV-02 | Streaming must reuse the existing audited turn engine. | The provider boundary remains the same application abstraction; only a streaming method is added. |
| INV-07 | No raw provider internals may leak through API or UI. | The adapter hides AI SDK stream details and exposes only `{ answer, usage }` plus optional text-delta callbacks. |

## Functional Requirements

- [x] RF-B02-01: The generation-provider port exports both
  `generateAnswer(...)` and `streamAnswer(...)`.
- [x] RF-B02-02: `streamAnswer(...)` accepts the same governed prompt inputs as
  the sync method plus an optional `onTextDelta(...)` callback.
- [x] RF-B02-03: The OpenAI adapter uses the existing prompt-building logic for
  both sync and stream modes so prompt text does not diverge.
- [x] RF-B02-04: The OpenAI adapter forwards non-empty text deltas to the
  application callback in the order emitted by the AI SDK.
- [x] RF-B02-05: The OpenAI adapter accumulates the final streamed text,
  trims it, rejects empty answers, and returns normalized usage/cost metadata.
- [x] RF-B02-06: Streamed provider failures keep the existing safe mapping to
  `generation_failed` and `generation_unavailable`.
- [x] RF-B02-07: The adapter reuses the same OpenAI cost-estimation helper for
  sync and stream modes.

## Module Contracts

```ts
export type StreamAnswerInput = GenerateAnswerInput & {
  onTextDelta?: (textDelta: string) => Promise<void> | void;
};

export interface GenerationProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
  streamAnswer(input: StreamAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
}
```

```ts
export class OpenAiGenerationProvider implements GenerationProvider {
  async generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;

  async streamAnswer(input: StreamAnswerInput): Promise<{
    answer: string;
    usage: GenerationUsage;
  }>;
}
```

## Key Modules

- `src/application/rag/ports.ts`
- `src/infrastructure/ai/openai-generation-provider.ts`
- `src/infrastructure/ai/openai-generation-provider.test.ts`

## Tests First

- `src/infrastructure/ai/openai-generation-provider.test.ts`
  - `it("streams text deltas, accumulates the final answer, and returns normalized usage", ...)`
  - `it("rejects an empty streamed answer with a sanitized generation_failed error", ...)`
  - `it("maps transient provider failures during streaming to generation_unavailable", ...)`

## Done When

- The generation-provider interface supports both sync and streaming calls
  without changing the application-level governance contract.
- The OpenAI adapter emits only text deltas and final normalized usage/cost
  data, never raw AI SDK stream payloads.
- Empty streamed answers and transient provider failures map to the existing
  safe generation error vocabulary.
- Adapter streaming tests pass.
