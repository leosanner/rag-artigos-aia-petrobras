# F-11 Block 03 — Application: Agent Runtime and Streamed Turn

## Goal

Introduce the `RagAgentRuntime` strategy boundary and rewire
`StreamConversationMessage` to drive the assistant turn through it,
without leaking Mastra or AI SDK types into the application or the
route handler. Extend the streaming event union to carry the new
agentic signals.

## Scope

**In scope:**

- New `RagAgentRuntime` interface in
  `src/application/rag/rag-agent-runtime.ts`, framework-agnostic.
- DTOs:
  - `RagAgentRuntimeStreamInput`: `{ messages: UIMessageLike[],
    retrievalSettings, traceId, conversationId, emit:
    (event: StreamConversationMessageEvent) => void }`. `UIMessageLike`
    is a minimal local type — not an AI SDK import.
  - Returns `Promise<AgentTurnOutcome>` (Block 01).
- Extension of the streamed-conversation event union in
  `src/application/rag/stream-conversation-message-events.ts`:
  - New events: `tool_call`, `tool_result`.
  - `phase` now also accepts `'planning' | 'tool_calling' | 'answering'`.
  - All other event types are preserved exactly (back-compat).
- Refactor `StreamConversationMessage.execute(...)` so that:
  1. It still validates input, persists the user message, and emits
     `user_message_created`.
  2. It loads up to 4 prior stored messages plus the current one and
     converts them to `UIMessageLike[]` in display order.
  3. It calls `runtime.stream(...)`, forwarding the SSE `emit` callback.
  4. On the resulting `AgentTurnOutcome`, it runs the F-05 citation
     validator against the union of matches from all `tool_result`s,
     persists the parent `rag_query_runs` row, the
     `rag_query_run_tool_calls` rows, and the assistant
     `rag_conversation_messages` row in a single transaction.
  5. On technical failure after step 1 it emits `error`, persists the
     failed run with `agent_stopped_reason = 'error'`, and does not
     create an assistant transcript row.
- Tests with a fake `RagAgentRuntime` proving:
  - Event order matches RN-11 of `spec.md` for tool-using turns.
  - Zero-tool turns persist empty citations / empty sources / zero
    `rag_query_run_tool_calls` rows.
  - `max_steps` outcomes still produce a valid assistant message with
    `agent_stopped_reason = 'max_steps'`.
  - Failure paths emit `error` and never create an assistant row.

**Out of scope:**

- Mastra-specific bridging. The fake runtime in tests stands in for it;
  real wiring is Block 04.
- HTTP serialization of the new events; that lives in Block 03b /
  Block 04 of the route handler family. (Existing handler change is
  purely additive: serialize new event types via the same `event:
  data:` SSE writer.)
- `AnswerQuestion` / `AppendConversationMessage` / `/api/rag/ask`. They
  remain untouched aside from any unavoidable type-only updates from
  the new `execution_mode` column.

## Files Touched

- New: `src/application/rag/rag-agent-runtime.ts`
- Mod: `src/application/rag/stream-conversation-message.ts`
- Mod: `src/application/rag/stream-conversation-message-events.ts`
- Mod: `src/app/api/rag/conversations/[id]/messages/handler.ts`
  (serialization only)
- New: `src/application/rag/stream-conversation-message.test.ts`
  additions covering F-11 paths.

## Acceptance Criteria

1. `RagAgentRuntime` is the only application-layer type the handler /
   use case mentions; no Mastra type leaks above
   `src/infrastructure/ai/`.
2. The event union is a discriminated union and exhaustive; a TypeScript
   `satisfies` test ensures that `tool_call`, `tool_result`, and the
   new `phase` values are present.
3. `StreamConversationMessage.execute` writes the parent run, child
   tool-call rows, and the assistant message inside one transaction.
   A simulated DB failure in any half rolls everything back and no SSE
   `done` is emitted.
4. With a fake runtime that issues zero tool calls, the persisted trace
   has `execution_mode = 'agentic'`, `agent_steps = 1`,
   `agent_stopped_reason = 'finished'`, and the assistant message has
   no citations.
5. With a fake runtime that triggers a `max_steps` outcome, the
   persisted trace has `agent_stopped_reason = 'max_steps'` and the
   assistant message’s citations resolve only against matches captured
   in `tool_result`s seen so far.
6. Existing F-06 / F-10 tests continue to pass without modification.

## Notes for Implementer

- The `emit` callback supplied to `runtime.stream` is the same channel
  the route handler already feeds into the SSE response writer. Do not
  buffer events in the use case; forward immediately.
- The citation validator is the existing F-05 utility. It must be
  invoked exactly once per turn, against the union of matches from all
  `tool_result` events of that turn (in `step_index` order).
- Keep `UIMessageLike` minimal: `{ role: 'user' | 'assistant', content:
  string }` is enough for v1. We deliberately avoid the AI SDK
  `UIMessage` shape at this boundary so Mastra can be replaced without
  rippling into the application layer.
