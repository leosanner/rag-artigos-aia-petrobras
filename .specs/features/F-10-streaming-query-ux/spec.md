# F-10 - Streaming Query UX

## Scope

**In scope:**
- Add a new stream-first UX for conversation turns on the shared `/query`
  surface.
- Negotiate SSE on `POST /api/rag/conversations/:id/messages` when the client
  sends `Accept: text/event-stream`.
- Keep the current JSON conversation response as a fallback for non-stream
  clients and as the regression oracle.
- Stream the final selected answer sources before answer generation begins.
- Stream answer text deltas into the active assistant bubble on `/query`.
- Persist the final assistant transcript row only after the full answer is
  validated and the governed trace is stored.
- Reuse the existing audited turn engine, focused-document checks, trace
  persistence, and safe error handling.
- Add tests plus project-doc sync for the new transport and UX contract.

**Out of scope:**
- Streaming on `POST /api/rag/ask`; that endpoint remains JSON-only in this
  first cut.
- Partial assistant persistence, partial trace persistence, reconnect/resume
  semantics, or resumable stream ids.
- Streaming inline clickable citation markers such as `[1]`.
- Exposing the full retrieval candidate pool, provider chunk payloads, prompts,
  or chain-of-thought data.
- Any new chat route, agent workflow, or non-conversation query surface.

## Context & Motivation

F-06 made `/query` conversational and F-09 tightened the source-driven handoff
into focused mode, but the user still had to wait for the entire assistant turn
before seeing any progress. The next UX step is to make the chat feel live
without splitting it into a second pipeline or weakening the F-05/F-06/F-07
governance model.

This contract introduces streaming only on the conversation transport first.
The operator sees when the system is retrieving sources, sees the final source
list appear in real time, and then sees the answer text arrive token by token
inside the same transcript bubble that is later replaced by the persisted,
audited assistant message.

## Implementation Blocks

This feature is implemented in the same small-block style used by the previous
feature folders. Read this overview first, then open only the block document
needed for the current task:

- [01 - Application: Streamed Turn and Event Vocabulary](01-application-streamed-turn-and-events.md): transport-agnostic event union, streamed conversation use case, and `AnswerQuestion` streaming orchestration.
- [02 - Infrastructure: OpenAI Streaming Adapter](02-infrastructure-openai-streaming.md): `GenerationProvider.streamAnswer(...)`, AI SDK `streamText(...)`, delta forwarding, and normalized usage/cost capture.
- [03 - Interface: SSE Conversation Route](03-interface-sse-conversation-route.md): content negotiation, SSE serialization, Zod event schemas, safe pre-stream JSON failures, and mid-stream `error` events.
- [04 - Interface: Streaming Query Page](04-interface-streaming-query-page.md): transient assistant bubble, live source preview, token-by-token rendering, final trace hydration, and safe failure UX on `/query`.
- [05 - Integration and Review](05-integration-and-review.md): end-to-end verification, doc sync, closeout commands, and the fresh-reviewer handoff requirement.

## Business Rules

- RN-01: Streaming is introduced only on
  `POST /api/rag/conversations/:id/messages`.
- RN-02: The conversation route must keep the current JSON response contract
  for non-stream clients.
- RN-03: SSE mode is enabled only when the request `Accept` header includes
  `text/event-stream`.
- RN-04: The streamed conversation flow uses the event vocabulary:
  `user_message_created`, `phase`, `source`, `answer_delta`, `done`, and
  `error`.
- RN-05: The only live sources exposed during streaming are the final selected
  answer sources, emitted in retrieval order before answer generation begins.
- RN-06: The user transcript row is persisted before any retrieval or
  generation begins.
- RN-07: The assistant transcript row is persisted only after the full answer
  is accumulated, citation-validated, and the final governed trace is stored.
- RN-08: Focused-document rejections after user-message persistence are exposed
  as streamed `error` events and must not create a fake assistant row.
- RN-09: Technical generation failures after request validation still persist a
  failed run exactly as today, but do not create an assistant transcript row.
- RN-10: Pre-stream failures remain ordinary HTTP JSON responses with safe
  status codes; once streaming starts, safe turn failures are communicated
  through SSE `error` events under HTTP 200.
- RN-11: `/query` shows PT-BR streaming copy (`Consultando fontes...`,
  `Gerando resposta...`) while the contract and payloads remain English.
- RN-12: If the client stream ends unexpectedly, recovery is by conversation
  reload; resumable streams are out of scope for this contract.

## Functional Requirements

- [x] RF-01: The application layer defines a transport-agnostic streamed
  conversation event union covering `user_message_created`, `phase`, `source`,
  `answer_delta`, `done`, and `error`.
- [x] RF-02: `AnswerQuestion` exposes a streaming execution path that reuses
  the same focused validation, retrieval, citation validation, trace
  persistence, and safe failure mapping as the non-stream path.
- [x] RF-03: The generation-provider boundary exposes both
  `generateAnswer(...)` and `streamAnswer(...)`.
- [x] RF-04: The OpenAI generation adapter streams only text deltas to the
  application layer, accumulates the final answer internally, and returns the
  same normalized usage/cost metadata already required by F-05.
- [x] RF-05: `POST /api/rag/conversations/:id/messages` negotiates between SSE
  and JSON on the same route.
- [x] RF-06: SSE responses use explicit stream headers and Zod-backed event
  payload serialization.
- [x] RF-07: `/query` appends the persisted user message as soon as the
  `user_message_created` event arrives.
- [x] RF-08: `/query` renders `Consultando fontes...` and progressively shows
  the final selected source previews before answer generation starts.
- [x] RF-09: `/query` renders streamed answer deltas inside a transient
  assistant bubble and replaces that bubble with the persisted assistant
  message on `done`.
- [x] RF-10: No-evidence turns complete safely without answer deltas and still
  hydrate the final persisted assistant trace.
- [x] RF-11: Stream failures keep the user message, show the safe PT-BR error
  message, and do not fabricate a persisted assistant row.
- [x] RF-12: Successful streamed turns can be reloaded through
  `GET /api/rag/conversations/:id` and show the persisted assistant row plus
  trace data.

## System Flow

1. The operator submits a chat turn on `/query`.
2. The page ensures a conversation id exists, then sends
   `POST /api/rag/conversations/:id/messages` with
   `Accept: text/event-stream, application/json`.
3. The route validates the bearer secret, conversation id, and JSON body before
   any stream starts.
4. If the client asked for SSE, the route performs a conversation-existence
   preflight and returns ordinary JSON `400`/`401`/`404` failures for
   malformed, unauthorized, or unknown requests.
5. The route delegates to `StreamConversationMessage`, which persists the user
   message, updates title/last-message bookkeeping, and emits
   `user_message_created` followed by `phase: "retrieving_sources"`.
6. `StreamConversationMessage` calls `AnswerQuestion.executeStream(...)`, which
   reuses the existing audited turn path and emits the final selected
   `source` events in retrieval order.
7. If sources exist, `AnswerQuestion` signals generation start and the
   generation adapter emits `answer_delta` chunks while accumulating the final
   answer internally.
8. `AnswerQuestion` validates the final accumulated answer, persists the
   success/failure run, and returns the same governed result shape used by the
   non-stream path.
9. On success or no-evidence completion, `StreamConversationMessage` persists
   the assistant transcript row, reloads the hydrated assistant trace, and
   emits `done`.
10. On focused rejection or safe generation failure after the stream has
    started, `StreamConversationMessage` emits `error` under HTTP 200 and does
    not append an assistant transcript row.
11. `/query` uses the stream to render the transient assistant bubble and then
    swaps in the final persisted assistant message plus audit UI once `done`
    arrives.

## Invariants / Non-negotiables

- INV-01: `POST /api/rag/ask` remains non-streaming and JSON-only in this
  contract.
- INV-02: The streamed conversation path must reuse the same audited turn
  engine; it must not fork retrieval/generation governance into a second chat
  pipeline.
- INV-03: Live source previews must be limited to the final selected answer
  sources and must preserve retrieval order.
- INV-04: Pre-stream failures are HTTP JSON failures; mid-stream failures are
  SSE `error` events under HTTP 200.
- INV-05: No assistant transcript row may be persisted before final citation
  validation and trace persistence succeed.
- INV-06: Failed streamed turns still persist the failed governed run record,
  but never a fake assistant transcript row.
- INV-07: Stream payloads and UI must not expose raw prompts, stack traces,
  provider internals, raw provider chunks, or hidden reasoning artifacts.
- INV-08: Conversation reload continues to rely only on persisted transcript
  rows and traces, not on any transient stream cache.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `StreamConversationMessageEvent` | `type`, event-specific payload | Transport-agnostic application event union for the streamed conversation flow. |
| `RagConversationStreamEvent` | HTTP-safe DTO version of the streamed event union | Zod-validated event payload serialized into SSE frames. |
| `StreamingAssistantState` | `status`, `phase`, `content`, `sources` | Client-only transient state for the active assistant bubble on `/query`. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/rag/conversations/:id/messages` | Returns JSON fallback by default or SSE when `Accept: text/event-stream` is requested. |
| Function | `AnswerQuestion.executeStream(input, callbacks)` | Reuses the audited answer pipeline while exposing source and answer-delta callbacks. |
| Strategy | `GenerationProvider.streamAnswer(input)` | Streams text deltas and returns the final accumulated answer plus normalized usage/cost metadata. |

### Key Modules

- `src/application/rag/answer-question.ts` - shared sync/stream answer
  orchestration plus final citation validation and governed run persistence.
- `src/application/rag/stream-conversation-message-events.ts` -
  transport-agnostic streamed event vocabulary.
- `src/application/rag/stream-conversation-message.ts` - streamed conversation
  use case that persists the user row first and the assistant row only on
  success.
- `src/application/rag/schemas.ts` - Zod SSE event schemas and exported types.
- `src/infrastructure/ai/openai-generation-provider.ts` - AI SDK streaming
  adapter with normalized usage/cost output.
- `src/app/api/rag/conversations/dto.ts` - DTO serialization for streamed
  events.
- `src/app/api/rag/conversations/[id]/messages/handler.ts` - dual-mode JSON/SSE
  conversation route handler.
- `src/app/query/page.tsx` - stream reader, transient assistant UX, and final
  trace hydration.
- `src/app/query/page.module.css` - streaming transcript styling.

## Dependencies

- **Prerequisite features:** F-05 Answer Traceability; F-06 Conversational
  Query; F-07 Focused RAG; F-09 Source Card Focused Handoff.
- **External packages added:** None. The existing AI SDK streaming primitives
  are reused.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  provider boundary.
- **Environment variables:** Same runtime env as F-05/F-06/F-07. No new env
  vars are required by this contract.

## Acceptance Criteria

1. `POST /api/rag/conversations/:id/messages` returns an ordered SSE event
   stream on successful streamed turns, including the persisted user message,
   live source previews, answer deltas, and the final persisted assistant
   message.
2. The same route keeps the previous JSON response contract for non-stream
   clients.
3. Successful streamed turns persist the assistant transcript row and can be
   reloaded through `GET /api/rag/conversations/:id` with the same governed
   trace data already shown by `/query`.
4. Safe streamed failures persist the failed run, keep the user transcript
   row, and do not create an assistant transcript row.
5. `/query` shows PT-BR live progress for source retrieval and answer
   generation without a second follow-up fetch after success.
6. The streaming transport exposes only the final selected sources, not the
   full retrieval candidate pool.
7. `POST /api/rag/ask` remains unchanged and non-streaming.
8. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Stream the existing conversation route instead of adding a new endpoint | Create `/stream` route; stream `POST /api/rag/ask` first | Keeps the transport upgrade local to the chat path already used by `/query` and preserves one conversation contract. |
| Negotiate SSE through `Accept: text/event-stream` | Add a query param or a second HTTP method | Content negotiation keeps the route stable and preserves the current JSON response as a regression oracle. |
| Emit only the final selected answer sources live | Expose the full retrieval candidate pool | The operator wants explainable live progress without leaking intermediate candidates that are not part of the governed answer record. |
| Persist the assistant transcript row only after final validation | Persist partial answer text as the stream progresses | Governance remains aligned with the final trace and avoids fake or invalid assistant transcript rows. |
| Keep `POST /api/rag/ask` non-streaming in this cut | Stream both ask and conversation transports together | The user goal is the `/query` chat UX first; limiting the blast radius keeps the transport change smaller and more reviewable. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
