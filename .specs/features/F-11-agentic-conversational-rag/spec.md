# F-11 — Agentic Conversational RAG (Tool-Calling with Mastra)

## Scope

**In scope:**
- Replace the fixed `embed → search → (rerank?) → generate` pipeline on
  `POST /api/rag/conversations/:id/messages` (SSE only) with a model-driven
  agentic loop in which the LLM decides when to call retrieval tools.
- Adopt Mastra (`@mastra/core`, `@mastra/ai-sdk`) as the agent runtime,
  hidden behind a `RagAgentRuntime` strategy interface.
- Expose three tools to the agent: `search_corpus` (global retrieval),
  `search_document` (document-scoped retrieval by id), and
  `list_documents` (governed catalogue of `processed` documents).
- Hard-cap the agent at 3 steps per turn (`MAX_AGENT_STEPS = 3`).
- Add a child audit table `rag_query_run_tool_calls` and three new
  columns on `rag_query_runs` (`execution_mode`, `agent_steps`,
  `agent_stopped_reason`) so every tool call is traceable.
- Extend the F-10 SSE event vocabulary with `tool_call` and `tool_result`
  events, and additional `phase` values `planning`, `tool_calling`,
  `answering`. All existing F-10 events remain backwards compatible.
- Allow meta-conversational answers (questions about the transcript
  itself) to be answered directly from the conversation history, with no
  retrieval and empty citations, without producing a “no evidence” error.
- Tests covering: per-tool unit behavior, agentic turn orchestration with
  Mastra mocked, persistence of tool-call rows, citation validation
  against the union of `tool_result` matches, no-tool meta turn,
  `max_steps` stop, focused tool errors, and full regression of F-06,
  F-08, and F-10 behaviors.

**Out of scope:**
- Any change to `POST /api/rag/ask`. It keeps the deterministic
  single-shot path through `AnswerQuestion` and is the regression oracle.
- Replacing the governance tables (`rag_conversations`,
  `rag_conversation_messages`, `rag_query_runs`) or routing them through
  Mastra’s `PostgresStore` / `PgVector`. Mastra is a runtime, not a
  source of truth.
- Mastra working memory, semantic recall over past messages, multi-agent
  orchestration, or workflow graphs. The conversation window stays at
  `CONVERSATION_CONTEXT_MAX_PREDECESSORS = 4` (F-06 RN-07).
- Streaming on `POST /api/rag/ask`, reconnect/resume semantics, or
  partial trace persistence (still constrained by F-10).
- F-07 focused RAG via UI selection. The `search_document` tool is a
  separate, model-driven capability and does not replace explicit
  focused mode in the UI.
- Inline clickable citation markers, agent thought/plan rendering on
  `/query`, or any “chain-of-thought” surface.
- Removing or weakening the citation validator from F-05.

## Context & Motivation

F-06 added conversational `/query`, F-08 added rerank as an explicit
retrieval strategy, and F-10 added SSE streaming on the conversation
transport. Across all three, retrieval is unconditionally executed
before the LLM is invoked: every assistant turn embeds the latest user
message, searches the corpus, optionally reranks, and then generates an
answer constrained to the recovered chunks.

The active problem (reported by the operator) is that this pipeline is
hostile to **meta-conversational** turns. Asking “what was my first
question?” after a few exchanges sends the system to retrieval, which
finds nothing aligned with the user’s intent, so the answer collapses to
the no-evidence response. F-06 RN-07 already injects up to four prior
messages into the prompt, but the system-prompt contract from F-05
forbids the model from answering without retrieved evidence — by design.

This feature changes the contract for the **streaming conversation path
only**: the LLM, given tools, decides whether retrieval is needed. Meta
turns get answered from the transcript with empty citations; substantive
turns trigger one or more `search_*` calls; ambiguous turns may chain up
to three calls before answering or stopping.

Mastra adoption is intentional and earlier than the M4 milestone planned
in `.specs/project/ROADMAP.md`. The decision is recorded as a new AD-###
in `.specs/project/STATE.md`. Rationale: Mastra delivers the agent loop,
tool integration, and AI SDK streaming bridge already required by this
feature; deferring to M4 would mean either reimplementing those
primitives by hand or blocking F-11 on the M4 PoC.

Project-level rules and prior contracts that this feature must keep
intact are described in [`CLAUDE.md`](../../../CLAUDE.md),
[`.specs/project/ARCHITECTURE.md`](../../project/ARCHITECTURE.md),
[F-05](../F-05-answer-traceability/spec.md),
[F-06](../F-06-conversational-query/spec.md),
[F-08](../F-08-reranked-retrieval/spec.md), and
[F-10](../F-10-streaming-query-ux/spec.md).

## Business Rules

- RN-01: The agentic loop is enabled only on
  `POST /api/rag/conversations/:id/messages` when SSE is negotiated. The
  JSON fallback for that route and `POST /api/rag/ask` continue to use
  the existing fixed pipeline.
- RN-02: Each conversation turn produces exactly one
  `rag_conversation_messages` user row, exactly one
  `rag_query_runs` row, and at most one assistant
  `rag_conversation_messages` row, the same as F-06 / F-10.
- RN-03: The agent may execute zero or more tool calls per turn, capped
  at `MAX_AGENT_STEPS = 3`. Each call is persisted as one
  `rag_query_run_tool_calls` row, in order, linked to the parent
  `rag_query_runs.id`.
- RN-04: When the agent issues no tool calls, the assistant message is
  persisted with empty citations and empty sources. This is a legitimate
  outcome, not an error.
- RN-05: The governed `question` column on `rag_query_runs` is still the
  raw latest user message text, never the rewritten query an agent might
  pass to `search_corpus` or `search_document`. F-06 RN-07a is preserved.
- RN-06: Citation validation continues to require that every
  `[source:...]` marker in the assistant text references a chunk
  returned by some `tool_result` of the same turn. Turns with zero tool
  calls must not contain any citation markers.
- RN-07: Tool input is validated by a Zod schema. Invalid input must
  produce a structured `tool_result` with `ok: false` and a typed error
  code, not a 5xx, and must not abort the turn.
- RN-08: Known retrieval errors (`document_not_focusable`,
  `document_not_found`, embedding failure, rerank failure) become
  structured `tool_result` errors. The agent may recover by issuing
  another tool call or by answering with what it has.
- RN-09: `list_documents` only returns documents with
  `status = 'processed'` and is capped at 50 rows in v1.
- RN-10: When the agent reaches `MAX_AGENT_STEPS` without producing a
  final answer, the runtime issues one final answer-only step (no
  tools), persists `agent_stopped_reason = 'max_steps'`, and the assistant
  message reflects that final step. If even that step produces no text,
  the turn fails technically (RN-13).
- RN-11: SSE event order within a turn is:
  `user_message_created → phase(planning) →
   (phase(tool_calling) → tool_call → source* → tool_result)* →
   phase(answering) → answer_delta* → done`.
  Existing F-10 consumers that ignore unknown event types must not break.
- RN-12: Mastra is invoked exclusively through the `RagAgentRuntime`
  interface in `src/application/rag/`. No domain or interface module may
  import `@mastra/*` directly.
- RN-13: Technical failures after the user message is persisted produce
  a safe `error` SSE event, leave the user message persisted, persist
  the `rag_query_runs` row with the failure status, and do not insert an
  assistant transcript row. F-06 INV-03 is preserved.
- RN-14: Conversation context size is unchanged: the agent receives the
  newest user message plus up to four immediately preceding stored
  messages, mapped to AI SDK `UIMessage` form, in display order.

## Functional Requirements

- [ ] RF-01: A new migration creates `rag_query_run_tool_calls` and adds
  `execution_mode`, `agent_steps`, `agent_stopped_reason` to
  `rag_query_runs`. Drizzle schema in `src/db/schema.ts` is updated
  accordingly.
- [ ] RF-02: A `RagAgentRuntime` interface is defined in
  `src/application/rag/rag-agent-runtime.ts`, with a `MastraRagAgentRuntime`
  implementation under `src/infrastructure/ai/`.
- [ ] RF-03: Three tools are implemented as adapters over existing
  application/infrastructure: `search_corpus`, `search_document`,
  `list_documents`. Each has a Zod input schema and a typed output
  schema.
- [ ] RF-04: `StreamConversationMessage` delegates the assistant turn to
  `RagAgentRuntime.stream(...)` instead of calling `RetrieveChunks` and
  the generation provider directly.
- [ ] RF-05: New SSE events `tool_call` and `tool_result` are emitted by
  the runtime and serialized by the route handler. The `phase` event
  carries the new values `planning`, `tool_calling`, `answering`.
- [ ] RF-06: Each tool call performed during a turn is persisted as a
  `rag_query_run_tool_calls` row with `step_index`, `tool_name`, `args`,
  `result_summary`, and `latency_ms`.
- [ ] RF-07: Meta-conversational turns (zero tool calls) persist an
  assistant message with empty citations and empty sources, and the
  trace stores `execution_mode = 'agentic'`, `agent_steps = 1`,
  `agent_stopped_reason = 'finished'`.
- [ ] RF-08: When the agent reaches `MAX_AGENT_STEPS`, the runtime
  forces a final answer-only step, persists
  `agent_stopped_reason = 'max_steps'`, and still produces a valid
  assistant message tied to the trace.
- [ ] RF-09: `POST /api/rag/ask` continues to call `AnswerQuestion`
  unchanged and writes `execution_mode = 'single_shot'` on its trace.
- [ ] RF-10: The citation validator from F-05 runs against the union of
  matches from all `tool_result` events of the turn before the assistant
  message is persisted.
- [ ] RF-11: A new AD-### entry in `.specs/project/STATE.md` documents
  the Mastra adoption decision; `.specs/project/ROADMAP.md` references
  F-11 in the M3/M4 bridge area; `CLAUDE.md` notes the “runtime only”
  boundary for Mastra.
- [ ] RF-12: Tests cover each business rule above, including the four
  end-to-end cases listed in the plan’s Verification section.

## System Flow

1. The operator submits a message on `/query` against an existing
   conversation. The browser sends `Accept: text/event-stream` to
   `POST /api/rag/conversations/:id/messages`.
2. The route handler in
   `src/app/api/rag/conversations/[id]/messages/handler.ts` validates
   the request, persists the user message, and emits
   `user_message_created`, exactly as today.
3. The handler delegates to `StreamConversationMessage.execute(...)`,
   which loads up to four previous stored messages plus the new one,
   maps them to AI SDK `UIMessage` form, and calls
   `runtime.stream({ messages, retrievalSettings, traceId,
   conversationId, emit })`.
4. `MastraRagAgentRuntime.stream` constructs a `Mastra Agent` with the
   configured generation model, the system prompt (extended with tool
   guidance), the three tools, and `stopWhen: stepCountIs(3)`. It calls
   `agent.stream(messages, { ... })`.
5. The runtime translates Mastra/AI SDK chunks into the application’s
   SSE event union:
   - `phase(planning)` is emitted once when streaming starts.
   - On each `tool-call` chunk: `phase(tool_calling)` (idempotent within
     a step), then `tool_call` with `{ callId, tool, args }`. The
     runtime records a partial `ToolCallRecord` in a buffer.
   - The tool itself executes inside the runtime (server-side):
     - `search_corpus` and `search_document` reuse `RetrieveChunks.search`
       with the turn’s `retrievalSettings` as defaults.
     - `list_documents` reuses `documentsRepository.listProcessed()`.
     - Each match returned by `search_*` is also emitted as a `source`
       SSE event (preserving the F-10 source channel that the UI
       already consumes).
   - On the matching `tool-result` chunk: `tool_result` with a compact
     summary `{ ok, matchCount?, topScore?, error? }`. The buffered
     `ToolCallRecord` is finalized with `result_summary` and
     `latency_ms`.
   - On the first `text-delta` chunk: `phase(answering)` once, then
     `answer_delta` per chunk.
6. On Mastra `finish`, the runtime:
   - Computes `agent_stopped_reason` (`finished`, `max_steps`, or
     `error`).
   - Runs the F-05 citation validator against the union of matches from
     all `tool_result` events of this turn.
   - Persists the `rag_query_runs` row with `execution_mode = 'agentic'`,
     `agent_steps`, `agent_stopped_reason`, prompt/model/usage as today.
   - Persists each buffered `ToolCallRecord` as a row in
     `rag_query_run_tool_calls`.
   - Persists the assistant `rag_conversation_messages` row linked to
     the trace.
   - Emits `done` with the `traceId` and the assistant message
     identifier.
7. If the agent never called a tool (meta turn), step 6 still runs but
   citations and sources are empty, and `rag_query_run_tool_calls` has
   zero rows.
8. If `MAX_AGENT_STEPS` is reached without an answer, the runtime
   issues one final `agent.generate` (or equivalent) call with tools
   disabled, then proceeds to step 6 with `agent_stopped_reason =
   'max_steps'`. If that final step still yields no text, the turn fails
   per RN-13.
9. Any technical failure after the user message is persisted converts
   to a safe `error` SSE event, persists the failed `rag_query_runs`
   row, and does not create an assistant transcript row.

## Invariants / Non-negotiables

- INV-01: Mastra must never become a dependency of `domain/*` or
  `app/api/*`. Any Mastra import outside `infrastructure/ai/` is a
  contract violation.
- INV-02: Every assistant `rag_conversation_messages` row references
  exactly one `rag_query_runs` row (preserves F-06 INV-02).
- INV-03: Every persisted `rag_query_run_tool_calls` row references a
  persisted `rag_query_runs` row (FK with `ON DELETE CASCADE`). No
  orphan tool-call rows are ever written.
- INV-04: A turn that issues zero tool calls must persist zero citations
  and zero source rows, and the assistant text must contain no
  `[source:...]` markers.
- INV-05: The governed `rag_query_runs.question` column is always the
  raw latest user message text, never an agent-rewritten query.
- INV-06: `POST /api/rag/ask` behavior is byte-compatible with its
  pre-F-11 contract; F-11 must not change its response shape, status
  codes, persisted columns (other than the new default
  `execution_mode = 'single_shot'`), or single-retrieval guarantee.
- INV-07: The conversation context window is always the latest user
  message plus at most the four immediately preceding stored messages.
  No hidden summarization or semantic recall is performed.
- INV-08: SSE event types added by F-11 are additive. Existing F-10
  consumers that only handle `user_message_created`, `phase`, `source`,
  `answer_delta`, `done`, `error` must continue to render correct
  transcripts (modulo the new tool indicators).

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `rag_query_runs` (extended) | `execution_mode ('single_shot'\|'agentic')`, nullable `agent_steps`, nullable `agent_stopped_reason ('finished'\|'max_steps'\|'error')` | Default `'single_shot'`. F-11 turns set `'agentic'`. |
| `rag_query_run_tool_calls` (new) | `id`, `query_run_id` FK, `step_index`, `tool_name`, `args jsonb`, `result_summary jsonb`, `latency_ms`, `created_at` | Unique `(query_run_id, step_index)`. Cascade delete from `rag_query_runs`. |
| `ToolCallRecord` (domain) | `stepIndex`, `tool`, `args`, `resultSummary`, `latencyMs` | Buffered in memory during a turn before persistence. |
| `AgentTurnOutcome` (domain) | `assistantText`, `toolCalls[]`, `sourcesUnion[]`, `agentStoppedReason`, `usage` | Returned by `RagAgentRuntime.stream`’s `finish` handler to the use case. |
| `SearchCorpusInput` / `SearchDocumentInput` / `ListDocumentsInput` | Zod schemas | Inputs validated before dispatch to underlying services. |
| `SearchCorpusOutput` / `SearchDocumentOutput` / `ListDocumentsOutput` | Zod schemas | Outputs constrained so the agent cannot leak prompt-internal payloads. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| POST | `/api/rag/conversations/:id/messages` (SSE) | Now backed by the agentic runtime when SSE is negotiated. JSON fallback unchanged. |
| POST | `/api/rag/ask` | Unchanged. Keeps the single-shot path. |
| TS | `RagAgentRuntime.stream({ messages, retrievalSettings, traceId, conversationId, emit }) → Promise<AgentTurnOutcome>` | Application boundary; emits SSE events via the `emit` callback supplied by the use case. |
| TS | `createSearchCorpusTool(deps) → MastraTool`, `createSearchDocumentTool(deps)`, `createListDocumentsTool(deps)` | Factory functions that return Mastra tools; receive existing repositories/use cases by DI. |

### Key Modules

- `src/db/schema.ts` — extend `rag_query_runs`; add
  `rag_query_run_tool_calls` table.
- `drizzle/<n>_rag_agentic_tool_calls.sql` — generated migration.
- `src/domain/rag/agent-tool-call.ts` — `ToolCallRecord`,
  `AgentStoppedReason`, `AgentTurnOutcome` types and constants
  (`MAX_AGENT_STEPS = 3`).
- `src/application/rag/rag-agent-runtime.ts` — `RagAgentRuntime`
  interface, DTOs, and the tool-call validation contract.
- `src/application/rag/stream-conversation-message.ts` — delegate
  assistant turn to `RagAgentRuntime`; build `UIMessage[]` from stored
  history; orchestrate persistence on `finish`.
- `src/application/rag/stream-conversation-message-events.ts` — extend
  the event union with `tool_call`, `tool_result`; extend `phase`
  values.
- `src/app/api/rag/conversations/[id]/messages/handler.ts` — serialize
  the new events; no business logic added here.
- `src/infrastructure/ai/mastra-rag-agent-runtime.ts` —
  `MastraRagAgentRuntime` implementation. Builds `Agent`, wires tools,
  bridges Mastra/AI SDK chunks to the application event union.
- `src/infrastructure/ai/rag-agent-tools/search-corpus.tool.ts`,
  `search-document.tool.ts`, `list-documents.tool.ts` — adapters over
  `RetrieveChunks` and `documentsRepository`.
- `src/application/rag/answer-question.ts` — unchanged; still used by
  `/api/rag/ask`. May only learn about the new `execution_mode` default.
- `.specs/features/F-11-agentic-conversational-rag/01..05-*.md` —
  block-level execution contracts (sibling docs).
- `.specs/project/STATE.md`, `ROADMAP.md`, `CHANGELOG.md`, root
  `CLAUDE.md` — doc sync.

## Dependencies

- **Prerequisite features:** F-04 (Query Controls), F-05 (Answer
  Traceability), F-06 (Conversational Query), F-08 (Reranked Retrieval),
  F-10 (Streaming Query UX). All must be present and green.
- **External packages added:**
  - `@mastra/core` — agent + tool primitives.
  - `@mastra/ai-sdk` — Vercel AI SDK bridge for streaming.
  - (Versions resolved at install time; pinned in `package.json` and
    captured in the AD-### entry in `STATE.md`.)
  - **Not added in v1:** `@mastra/memory`, `@mastra/pg`,
    `@mastra/fastembed`. Their adoption is deferred behind separate
    decisions.
- **External services:** Same as today — Postgres + pgvector via
  Drizzle, OpenAI generation/embeddings via Vercel AI SDK. No new
  external service.
- **Environment variables:** No new variables introduced. The agent uses
  the same model and provider configuration the current generation
  layer reads.

## Acceptance Criteria

1. With Mastra mocked, a unit test of `MastraRagAgentRuntime.stream`
   asserts the event order specified in RN-11 for a single-tool turn,
   for a zero-tool turn, and for a max-steps turn.
2. Integration test against a real Postgres: a meta-conversational
   prompt (e.g. “What was my first question?”) on an existing
   conversation yields an assistant message with no citations, no
   `source` events, zero `rag_query_run_tool_calls` rows, and a
   `rag_query_runs` row with `execution_mode = 'agentic'`,
   `agent_steps = 1`, `agent_stopped_reason = 'finished'`.
3. Integration test: a substantive prompt that triggers `search_corpus`
   produces ≥ 1 `rag_query_run_tool_calls` row with the correct
   `tool_name`, `step_index`, and a `result_summary` that records
   `matchCount` and `topScore`. Citations in the assistant text
   resolve against the union of returned matches.
4. Integration test: a prompt that scopes to a known document via
   `search_document` records `tool_name = 'search_document'` and the
   correct `documentId` in `args`. A request for an unknown
   `documentId` produces a `tool_result` with `ok: false` and the
   appropriate error code, the agent recovers, and the turn still
   completes.
5. Integration test: a prompt forced into ≥ 3 tool calls stops with
   `agent_stopped_reason = 'max_steps'`, still persists an assistant
   message, and the assistant text contains only citations covered by
   recovered chunks.
6. Regression test: every existing test under
   `src/**/*.test.ts(x)` for F-06, F-08, F-10 passes unchanged.
7. Regression test: `POST /api/rag/ask` continues to write
   `execution_mode = 'single_shot'`, zero rows in
   `rag_query_run_tool_calls`, and the same response shape it had
   before F-11.
8. Static checks: `pnpm lint`, `pnpm typecheck`, and `pnpm test` all
   pass locally and in CI.
9. Manual `pnpm dev` walkthrough on `/query` reproduces the four cases
   listed in the approved plan’s Verification section (RAG, meta,
   focused, max-steps).
10. The independent reviewer (`codex:rescue`, fresh thread) confirms
    the diff matches `spec.md` plus blocks 01..05 and the AD-### entry
    in `STATE.md`.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Adopt Mastra now as agent runtime | Vercel AI SDK only with hand-rolled tool loop; defer to M4 PoC | Mastra delivers loop, tool integration, and SSE bridge already required by F-11; rolling our own duplicates work; deferring blocks the bug fix. Recorded as new AD-### in `STATE.md`. |
| Keep governance in our own tables; do not use `@mastra/memory` / `PostgresStore` | Use Mastra memory tables as primary store | F-05/F-06 contracts (1:1 trace ↔ assistant message, governed `question`, citation validator) cannot be expressed by Mastra’s generic memory; splitting the source of truth would weaken audit guarantees. |
| Cap at `MAX_AGENT_STEPS = 3` | Open-ended loop; `2`; `5` | 3 covers the realistic chain (list → search global → search focused) for this corpus while bounding latency, token cost, and trace size. Tunable later by AD entry. |
| Three tools (`search_corpus`, `search_document`, `list_documents`) | Single mega-tool with mode flag; only `search_corpus` | Distinct tools give the model clearer affordances and make the audit trail directly inspectable per intent. |
| SSE events `tool_call` / `tool_result` are additive; `source` channel reused | Replace `source` with tool-result payload | Keeps F-10 client compatible without changes; tool events become an opt-in indicator surface. |
| Streaming-only surface for v1 | Enable agentic loop on JSON conversation route too; on `/api/rag/ask` too | The streaming path is the live UX where the bug bites; `/api/rag/ask` retains its predictable single-shot contract used by audit tooling. |
| `list_documents` returns only `processed` documents, capped at 50 | Return all; paginated; unbounded | Honors the project’s “processed-only” chunking rule and bounds prompt cost. Pagination deferred until a real need surfaces. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?

## Block Map

The execution contract is split across the following sibling docs.
Reviewers should read this `spec.md` first, then any block whose layer
they are auditing.

- [`01-domain-agent-tools-and-turn-types.md`](./01-domain-agent-tools-and-turn-types.md)
- [`02-persistence-tool-call-audit-and-run-mode.md`](./02-persistence-tool-call-audit-and-run-mode.md)
- [`03-application-agent-runtime-and-streamed-turn.md`](./03-application-agent-runtime-and-streamed-turn.md)
- [`04-infrastructure-mastra-runtime-and-tools.md`](./04-infrastructure-mastra-runtime-and-tools.md)
- [`05-integration-and-review.md`](./05-integration-and-review.md)
