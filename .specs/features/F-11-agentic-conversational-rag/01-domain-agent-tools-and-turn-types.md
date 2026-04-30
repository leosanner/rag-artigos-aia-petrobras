# F-11 Block 01 — Domain: Agent Tool Calls and Turn Types

## Goal

Establish the framework-agnostic domain vocabulary for the agentic
conversational turn so every other layer of F-11 (persistence,
application, infrastructure, interface) can refer to a single set of
types without importing Mastra or AI SDK symbols.

## Scope

**In scope:**

- `MAX_AGENT_STEPS` constant (= 3) and `AgentStoppedReason` union
  (`'finished' | 'max_steps' | 'error'`).
- `ExecutionMode` union (`'single_shot' | 'agentic'`) used by
  `rag_query_runs`.
- `ToolName` union (`'search_corpus' | 'search_document' |
  'list_documents'`) and Zod-derived input/output type aliases for each
  tool, importing schemas from Block 04 via type-only imports.
- `ToolCallRecord` value object — the in-memory representation of one
  agent step that will eventually be persisted as a
  `rag_query_run_tool_calls` row.
- `AgentTurnOutcome` value object — what the runtime returns to the
  application use case at the end of a turn.
- Domain-level invariants enforced by simple constructors / factory
  functions:
  - `step_index` is non-negative and strictly increasing per turn.
  - `tool_name` is restricted to `ToolName`.
  - `latency_ms` is a non-negative integer.
- Pure unit tests covering the constructors and invariants above.

**Out of scope:**

- Drizzle schema changes; those live in Block 02.
- The `RagAgentRuntime` interface; that lives in Block 03.
- Mastra wiring or any LLM provider concerns; those live in Block 04.
- SSE event types `tool_call` / `tool_result`; those are application-
  layer concerns and live in Block 03 alongside the existing event
  union.

## Files Touched

- New: `src/domain/rag/agent-tool-call.ts`
- New: `src/domain/rag/agent-turn-outcome.ts`
- Mod: `src/domain/rag/index.ts` (re-exports if a barrel exists)

## Acceptance Criteria

1. `MAX_AGENT_STEPS` is exported from `agent-tool-call.ts` with the
   value `3` and is the only place this number is hard-coded in the
   project.
2. Constructing a `ToolCallRecord` with a negative `step_index`,
   negative `latency_ms`, or unknown `tool_name` throws a typed
   domain error (or fails Zod parsing) that names the invariant
   violated.
3. `AgentTurnOutcome` exposes `assistantText`, `toolCalls[]`,
   `sourcesUnion[]`, `agentStoppedReason`, and `usage`. The type does
   not import any Mastra or AI SDK symbol.
4. Unit tests in `src/domain/rag/agent-tool-call.test.ts` cover the
   happy path and each invariant violation listed above.

## Notes for Implementer

- Keep this module dependency-free except for `zod`. It must be safe to
  import from any layer.
- `ToolCallRecord` should be deliberately small — `args` and
  `resultSummary` are typed as `unknown` here and refined at the
  application boundary; the domain’s job is to guarantee shape and
  ordering, not semantic correctness of payloads.
- Prefer plain factory functions (`createToolCallRecord(...)`) over
  classes; the rest of the codebase follows the same style.
