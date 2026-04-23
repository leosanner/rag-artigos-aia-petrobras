# F-06 - Conversational Query

## Scope

**In scope:**
- Evolve `/query` into a conversation-capable operator surface without creating
  a separate chat page.
- Add conversation persistence with `rag_conversations` and
  `rag_conversation_messages`.
- Add `POST /api/rag/conversations`, `GET /api/rag/conversations/:id`, and
  `POST /api/rag/conversations/:id/messages`.
- Reuse the existing audited single-turn engine for every assistant reply.
- Keep per-turn citations, sources, related terms, token usage, latency, and
  cost visible for assistant messages.
- Support transcript reload through the `/query` URL.
- Keep F-04 retrieval controls available for each conversation turn.
- Add tests for conversation creation, message ordering, per-turn trace
  linkage, reload behavior, and regression of governance visibility.

**Out of scope:**
- Streaming responses, typing indicators, or partial token rendering.
- Hidden automatic query rewriting, summarization, or agent planning.
- A separate chat-specific generation pipeline.
- Focused retrieval/document selectors; those remain F-07.
- Multi-user auth, RBAC, message deletion, or collaboration features.

## Context & Motivation

After F-04 and F-05, `/query` already has operator-controlled retrieval and a
governed trace model. The next user goal is to make that experience feel like a
real conversation while preserving the same answer auditability.

This feature keeps `/query` as the single operator surface and makes chat a new
interaction mode built on top of the same traceable turn engine, not a parallel
system.

## Business Rules

- RN-01: `/query` remains the single operator surface; there is no separate
  chat page.
- RN-02: `POST /api/rag/conversations` creates an empty conversation record.
- RN-03: The first persisted user message sets the conversation title from the
  trimmed message content, truncated deterministically to 80 characters.
- RN-04: `POST /api/rag/conversations/:id/messages` accepts a user message plus
  the same optional retrieval settings defined by F-04.
- RN-05: Each successful or no-evidence assistant reply must correspond to
  exactly one persisted `rag_query_runs` record and expose its `traceId`.
- RN-06: Technical generation failures after message validation persist the
  failed query run but do not create an assistant transcript row.
- RN-07: Conversation retrieval context uses the latest user message plus up to
  the four immediately preceding visible stored messages, concatenated in
  display order with role labels.
- RN-08: F-06 must not introduce hidden query rewriting, summarization, or any
  second retrieval query besides that explicit concatenated transcript context.
- RN-09: Conversation endpoints require the same operator bearer secret pattern
  used by the existing ask and audit endpoints.
- RN-10: Reloading `/query?conversation=<id>` must restore the persisted
  transcript for that conversation.
- RN-11: Single-turn `POST /api/rag/ask` remains supported; chat reuses the
  same turn engine rather than replacing it.
- RN-12: F-06 must not weaken citation validation, audit visibility, or safe
  error responses.

## Functional Requirements

- [ ] RF-01: The database schema defines `rag_conversations` and
  `rag_conversation_messages`.
- [ ] RF-02: `POST /api/rag/conversations` returns a Zod-validated empty
  conversation with `id`, nullable `title`, and timestamps.
- [ ] RF-03: `GET /api/rag/conversations/:id` returns one conversation with its
  ordered messages and assistant-trace data needed by `/query`.
- [ ] RF-04: `POST /api/rag/conversations/:id/messages` persists the user
  message before running the assistant turn.
- [ ] RF-05: The assistant turn reuses the F-05 audited turn engine and the
  F-04 retrieval controls.
- [ ] RF-06: The retrieval-context builder concatenates the newest user message
  plus up to four immediately preceding stored messages with explicit role
  labels.
- [ ] RF-07: A successful or no-evidence assistant reply is persisted as an
  `assistant` message row linked to the turn `traceId`.
- [ ] RF-08: A technical failure after validation returns the safe error
  response, leaves the user message persisted, and does not create an assistant
  message row.
- [ ] RF-09: `/query` can start a new conversation, load a conversation from
  the URL, and submit additional messages in the same thread.
- [ ] RF-10: `/query` shows per-assistant-message citations, sources, related
  terms, usage, latency, and cost.
- [ ] RF-11: Single-turn audit visibility remains available alongside the
  conversation flow.

## System Flow

1. The operator opens `/query`.
2. If the URL contains `?conversation=<id>`, the page loads
   `GET /api/rag/conversations/:id`.
3. If the operator starts a new thread, the page calls
   `POST /api/rag/conversations` and stores the returned conversation id in the
   URL.
4. The operator submits a user message with optional retrieval controls.
5. The message route validates the body, persists the user message, and builds
   retrieval context from the newest user message plus up to four immediately
   preceding stored messages with role labels.
6. The route delegates to the same audited turn engine used by F-05, passing
   the constructed retrieval context and the normalized retrieval settings.
7. If the turn succeeds or returns the no-evidence answer, the system persists
   an assistant message row linked to the returned `traceId`.
8. If the turn fails technically after validation, the failed query run is still
   persisted by the turn engine, but no assistant message row is added.
9. The route returns the updated transcript slice needed by `/query`.
10. `/query` renders the transcript and keeps each assistant message expandable
    into its citations, sources, related terms, usage, latency, and cost.

## Invariants / Non-negotiables

- INV-01: `/query` must remain the only operator surface for both single-turn
  and conversational querying.
- INV-02: Every persisted assistant transcript row must reference exactly one
  persisted trace record.
- INV-03: Technical failures must not create fake assistant transcript rows.
- INV-04: Retrieval context for chat must be limited to the newest user message
  plus the previous four stored messages; no hidden rewriting step may be
  inserted.
- INV-05: Conversation mode must preserve the same citation validation and safe
  error behavior as single-turn mode.
- INV-06: F-06 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `rag_conversations` | `id`, nullable `title`, `createdAt`, `updatedAt`, `lastMessageAt` | One operator conversation thread. |
| `rag_conversation_messages` | `id`, `conversationId`, `role`, `content`, nullable `traceId`, `createdAt` | Ordered transcript rows. `traceId` is present only on assistant rows. |
| `ConversationMessageResponse` | `id`, `role`, `content`, `createdAt`, nullable `trace` | Assistant messages hydrate audit data from F-05 traces. |
| `ConversationDetailResponse` | `id`, `title`, timestamps, `messages[]` | DTO returned to `/query` for reload and rendering. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `POST` | `/api/rag/conversations` | Creates an empty conversation. |
| `GET` | `/api/rag/conversations/:id` | Returns one conversation with ordered messages and assistant-trace data. |
| `POST` | `/api/rag/conversations/:id/messages` | Persists the user message and runs the assistant turn. |
| `GET` | `/query?conversation=<id>` | Reloads an existing conversation in the shared operator UI. |
| Function | `buildConversationRetrievalContext(input)` | Builds the retrieval context from the latest user message plus the previous four stored messages. |
| Function | `AnswerQuestion.execute(input)` | Existing audited turn engine reused by chat. |

### Key Modules

- `src/db/schema.ts` - conversation tables and relationships to persisted
  trace ids.
- `src/application/rag/*` - conversation services, transcript DTOs, and
  retrieval-context builder.
- `src/repositories/*` - conversation/message persistence and conversation
  detail reads.
- `src/app/api/rag/conversations/*` - create/get/message route handlers.
- `src/app/query/page.tsx` - conversation-first UI state, URL sync, and
  assistant audit expansion.

## Dependencies

- **Prerequisite features:** F-04 Query Controls and Explore; F-05 Answer
  Traceability.
- **External packages added:** None.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  audited turn boundary.
- **Environment variables:** Same as F-05/F-04/F-03. No new env vars are
  required by the contract.

## Acceptance Criteria

1. The operator can create a new conversation on `/query`.
2. The operator can reload `/query?conversation=<id>` and recover the persisted
   transcript for that conversation.
3. Each successful assistant message exposes the same citations, source
   snapshots, related terms, usage, latency, and cost already defined by F-05.
4. The retrieval context for a chat turn contains the newest user message plus
   at most the previous four stored messages in display order.
5. Technical failures after validation persist a failed trace run but do not
   create an assistant transcript row.
6. Existing single-turn querying continues to work.
7. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Keep `/query` as the only operator surface | Add `/chat`; replace `/query` entirely | The user explicitly wants one evolving page, not parallel query experiences. |
| Reuse the existing audited turn engine | Build a chat-only answer path | Governance would drift immediately if chat had its own retrieval/generation stack. |
| Link assistant messages to `traceId` | Duplicate full audit payload inside each message row | The trace tables already own the governed answer record and should remain the source of truth. |
| Restore transcript via URL query param | Browser-only local state; opaque session id | URL-based reload is explicit, testable, and compatible with server-side reads. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
