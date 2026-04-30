# F-11 Block 04 — Infrastructure: Mastra Runtime and Tools

## Goal

Implement `RagAgentRuntime` against Mastra and the Vercel AI SDK
streaming bridge, expose the three retrieval tools, and translate
Mastra/AI SDK chunks into the application’s SSE event union — without
leaking any Mastra type above `src/infrastructure/ai/`.

## Scope

**In scope:**

- `MastraRagAgentRuntime` implementing `RagAgentRuntime` from Block 03.
  Constructed via DI: receives `RetrieveChunks`, `documentsRepository`,
  generation model id, system prompt builder, and any feature flags.
- Build a Mastra `Agent` per turn (or per runtime instance with
  per-turn `messages`) configured with:
  - `model`: same generation model used by the existing single-shot
    path.
  - `instructions`: existing system prompt, extended with explicit tool
    guidance — “answer directly from the conversation history when the
    question is meta; call tools only when corpus evidence is needed;
    never fabricate citations”.
  - `tools`: `{ search_corpus, search_document, list_documents }`.
  - `stopWhen: stepCountIs(MAX_AGENT_STEPS)`.
- Tool factories under `src/infrastructure/ai/rag-agent-tools/`:
  - `search_corpus`: input `{ query, topK?, strategy? }`; calls
    `RetrieveChunks.search` with the turn’s default
    `retrievalSettings`; emits a `source` SSE event for every match it
    returns; returns `{ matches: [...] }` plus a compact summary the
    runtime persists in `result_summary`.
  - `search_document`: input `{ documentId, query, topK? }`; same path
    as `search_corpus` with a doc filter; converts known errors
    (`document_not_found`, `document_not_focusable`) into
    `{ ok: false, error }` outputs without throwing.
  - `list_documents`: no input; calls
    `documentsRepository.listProcessed({ limit: 50 })`; returns
    `{ documents: [...] }`.
  - All inputs validated by Zod inside the tool factory.
- Streaming bridge: subscribe to `agent.stream(...)` chunks; for each
  chunk type produce the matching application event:
  - `tool-call` → `phase('tool_calling')` (idempotent within step) +
    `tool_call`. Buffer a partial `ToolCallRecord`.
  - Tool execution start time is captured to compute `latency_ms`.
  - `tool-result` → `tool_result(summary)`. Finalize the
    `ToolCallRecord` and append to the in-memory list.
  - `text-delta` → on the first delta of the turn, emit
    `phase('answering')`; then `answer_delta` per delta.
  - `finish` → resolve `AgentTurnOutcome`:
    `{ assistantText, toolCalls[], sourcesUnion[], agentStoppedReason,
    usage }`. Determine `agentStoppedReason` from Mastra’s
    `finishReason` and the step counter.
- If the agent reaches `MAX_AGENT_STEPS` with `finishReason ===
  'tool-calls'`, the runtime issues one final non-streaming
  `agent.generate(...)` (or equivalent) with tools disabled to coerce
  a final answer. Result is appended to the assistant text and
  `agentStoppedReason` becomes `'max_steps'`.
- Unit tests:
  - Each tool, with `RetrieveChunks` and `documentsRepository` faked,
    asserting Zod validation, error mapping, and source emission.
  - The runtime, with Mastra mocked at the `agent.stream` boundary,
    asserting event translation order, the `max_steps` final-step
    behavior, and the framework boundary (no Mastra symbol leaks
    upward).

**Out of scope:**

- Working memory, semantic recall, multi-agent setups, Mastra
  workflows, or `@mastra/memory` / `@mastra/pg` dependencies.
- Provider streaming for `/api/rag/ask`. That route keeps the
  pre-F-10/F-11 path.
- Telemetry beyond what `usage` already carries.

## Files Touched

- New: `src/infrastructure/ai/mastra-rag-agent-runtime.ts`
- New: `src/infrastructure/ai/rag-agent-tools/search-corpus.tool.ts`
- New: `src/infrastructure/ai/rag-agent-tools/search-document.tool.ts`
- New: `src/infrastructure/ai/rag-agent-tools/list-documents.tool.ts`
- New: `src/infrastructure/ai/rag-agent-tools/types.ts` (shared Zod
  schemas, type-imported by Block 01).
- Mod: `package.json` — add `@mastra/core`, `@mastra/ai-sdk`.
- New: corresponding `*.test.ts` files.

## Acceptance Criteria

1. The only files importing `@mastra/*` are inside
   `src/infrastructure/ai/`. A repo-wide grep enforced by a unit test
   passes.
2. Each tool validates input with Zod; invalid input yields a
   structured `{ ok: false, error }` output and never throws to the
   agent loop.
3. `search_corpus` and `search_document` emit one `source` event per
   returned match; the union of these matches is what the citation
   validator in Block 03 receives.
4. With Mastra mocked, a turn that the mock drives to three tool calls
   and no final answer triggers the runtime’s forced final step,
   produces `agentStoppedReason === 'max_steps'`, and still resolves
   `assistantText` to a non-empty string when the forced step yields
   text.
5. Tool failure modes (`document_not_found`, `document_not_focusable`,
   embedding/rerank failures) do not abort the turn; the agent receives
   `{ ok: false, error }` and may continue.
6. Linting, typechecking, and unit tests pass.

## Notes for Implementer

- Use Mastra’s AI SDK bridge (`@mastra/ai-sdk`) so the chunk shape is
  the standard AI SDK v5 shape we already understand from F-10.
- Keep tools small: each is a thin adapter over an existing application
  use case or repository. No business logic in tools — they translate
  Zod-validated input into use-case input, and use-case output into the
  tool’s declared output schema.
- The forced final step on `max_steps` should reuse the same generation
  model and the system prompt (with tool list omitted) so the answer
  remains compatible with the citation validator.
- Capture per-tool `latency_ms` with `performance.now()` straddling the
  underlying use-case call only — not the Mastra wrapper time.
