# F-06 Block 02 - Persistence: Conversations and Messages

## Goal

Add the governed storage layer for F-06: one conversation record per operator
thread, ordered transcript rows, and assistant-to-trace linkage that reuses
the F-05 run tables instead of duplicating audit payloads.

## Scope

**In scope:**

- Drizzle schema additions for `rag_conversations` and
  `rag_conversation_messages`.
- Supporting enum/check/index definitions needed by those tables.
- Repository writes for conversation creation, title finalization, and
  transcript append.
- Repository reads for conversation detail plus the previous-visible-messages
  slice used by the application block.
- Real Postgres repository tests for write/read behavior.

**Out of scope:**

- Retrieval-context construction and title derivation rules; Block 01 owns
  those.
- Application orchestration, turn delegation, and provider usage.
- API routes, response schemas, and `/query`.
- Redefinition of `rag_query_runs` schema; F-05 Block 02 owns it and this
  block only adds an FK into it.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | `POST /api/rag/conversations` creates an empty conversation record. | The conversation repository supports creating a row with `null` title and no messages. |
| RN-05 | Each successful or no-evidence assistant reply must correspond to exactly one persisted `rag_query_runs` record and expose its `traceId`. | `rag_conversation_messages.trace_id` FKs into `rag_query_runs`, NOT NULL only for assistant rows. |
| RN-06 | Technical generation failures after message validation persist the failed query run but do not create an assistant transcript row. | The schema permits user rows without a sibling assistant row; assistant rows require an existing trace. |
| INV-02 | Every persisted assistant transcript row must reference exactly one persisted trace record. | A CHECK/conditional FK enforces `trace_id IS NOT NULL` when `role = 'assistant'`. |
| INV-03 | Technical failures must not create fake assistant transcript rows. | No write path creates an assistant row without a committed trace id. |

## Functional Requirements

- [ ] RF-B02-01: The database schema defines `rag_conversations` with `id`,
  nullable `title`, `createdAt`, `updatedAt`, and `lastMessageAt`.
- [ ] RF-B02-02: The database schema defines `rag_conversation_messages` with
  `id`, `conversationId`, `role`, `content`, nullable `traceId`, and
  `createdAt`.
- [ ] RF-B02-03: `rag_conversation_messages.conversation_id` FKs into
  `rag_conversations(id)` and cascades on delete.
- [ ] RF-B02-04: `rag_conversation_messages.trace_id` FKs into
  `rag_query_runs(id)` and is NOT NULL whenever `role = 'assistant'`.
- [ ] RF-B02-05: A composite index on `(conversation_id, created_at)` supports
  ordered transcript reads.
- [ ] RF-B02-06: `ConversationRepository.create()` writes an empty
  conversation with `null` title and returns its id and timestamps.
- [ ] RF-B02-07: `ConversationRepository.updateTitleIfUnset(id, title)` sets
  the title only when the stored title is still `null` (idempotent with
  respect to later messages).
- [ ] RF-B02-08: `ConversationRepository.touchLastMessageAt(id, date)` updates
  `lastMessageAt` and `updatedAt` without mutating `title`.
- [ ] RF-B02-09: `ConversationMessageRepository.append(input)` writes one
  transcript row with the given role/content/traceId in a single statement.
- [ ] RF-B02-10: `ConversationMessageRepository.listPreviousVisible(id,
  limit)` returns up to `limit` (default 4) immediately preceding visible
  messages in display order.
- [ ] RF-B02-11: `ConversationRepository.getDetail(id)` returns the
  conversation plus ordered messages and hydrates assistant rows with their
  F-05 trace data via `RagQueryRunsRepository.getById`, without duplicating
  trace payload columns.
- [ ] RF-B02-12: Repository tests prove ordered reads, assistant-without-trace
  is rejected by the database, and title update is applied at most once.

## Module Contracts

```ts
export type PersistConversationMessageInput = {
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  traceId: string | null;
};

export interface ConversationRepository {
  create(): Promise<{ id: string; createdAt: Date; updatedAt: Date }>;
  updateTitleIfUnset(id: string, title: string): Promise<void>;
  touchLastMessageAt(id: string, date: Date): Promise<void>;
  getDetail(id: string): Promise<ConversationDetail | null>;
}

export interface ConversationMessageRepository {
  append(input: PersistConversationMessageInput): Promise<{
    id: string;
    createdAt: Date;
  }>;
  listPreviousVisible(
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessageForContext[]>;
}
```

## Key Modules

- `src/db/schema.ts`
- `drizzle/*` (new migration for the two tables + FK into `rag_query_runs`)
- `src/repositories/conversation-repository.ts`
- `src/repositories/conversation-message-repository.ts`
- `src/test/db.ts`

## Tests First

- `src/repositories/conversation-repository.test.ts`
- `src/repositories/conversation-message-repository.test.ts`

Repository tests must use real Postgres and explicitly prove append ordering,
assistant-requires-trace constraint, idempotent title update, previous-visible
slice limit, and conversation detail hydration through the F-05 run
repository.

## Done When

- Repository tests pass against real Postgres.
- The transcript schema links assistant rows to trace ids without duplicating
  F-05 audit columns.
- Later application and interface blocks can persist transcripts and read
  conversation detail without recomputing retrieval or reconstructing audit
  payloads.
