# F-06 Block 03 - Application: Conversation Turn Orchestration

## Goal

Tie the domain helpers (Block 01) and the transcript repositories (Block 02)
to the existing audited turn engine from F-05 so a conversational turn reuses
one single path for retrieval, generation, governance, and audit — without
introducing a chat-only pipeline.

## Scope

**In scope:**

- Use cases for creating conversations, reading conversation detail, and
  appending messages.
- Orchestration of user-message persistence, context construction, turn
  delegation, and assistant-row linkage.
- Title assignment on the first user message.
- Safe error contract for technical failures after validation.
- Tests first with fake providers and real repositories, same pattern as F-05
  Block 03.

**Out of scope:**

- Schema/migrations and repository SQL (Block 02).
- Context builder and title derivation rules (Block 01).
- API route handlers, request/response Zod schemas, and `/query` UI
  (Block 04).
- Any reimplementation of `AnswerQuestion` or F-04 retrieval normalization.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-04 | `POST /api/rag/conversations/:id/messages` accepts a user message plus the same optional retrieval settings defined by F-04. | The `AppendConversationMessage` input reuses the F-04 retrieval settings schema. |
| RN-05 | Each successful or no-evidence assistant reply must correspond to exactly one persisted `rag_query_runs` record and expose its `traceId`. | The use case persists an assistant row linked to the trace returned by the turn engine. |
| RN-06 | Technical generation failures after message validation persist the failed query run but do not create an assistant transcript row. | The use case short-circuits the assistant-append step on failure while leaving the user row in place. |
| RN-07 | Conversation retrieval context uses the latest user message plus up to the four immediately preceding visible stored messages. | The use case pulls the previous slice through the repository and delegates concatenation to the Block 01 builder. |
| RN-11 | Single-turn `POST /api/rag/ask` remains supported; chat reuses the same turn engine rather than replacing it. | The use case calls `AnswerQuestion.execute` instead of introducing a new engine. |
| INV-02 | Every persisted assistant transcript row must reference exactly one persisted trace record. | Assistant persistence only happens on success/no-evidence, with the `traceId` returned by the engine. |
| INV-03 | Technical failures must not create fake assistant transcript rows. | Failure branches skip the assistant `append` call entirely. |
| INV-05 | Conversation mode must preserve the same citation validation and safe error behavior as single-turn mode. | The use case re-exports the same safe-error DTO that F-05 uses for single-turn ask. |

## Functional Requirements

- [ ] RF-B03-01: `CreateConversation.execute()` writes an empty conversation
  record and returns its id and timestamps.
- [ ] RF-B03-02: `GetConversationDetail.execute({ id })` returns the ordered
  transcript with hydrated assistant traces, or a not-found signal for
  unknown ids.
- [ ] RF-B03-03: `AppendConversationMessage.execute` persists the incoming
  user message before any retrieval or generation call.
- [ ] RF-B03-04: When the appended row is the first user message, the use
  case assigns the conversation title via `deriveConversationTitle` and
  `ConversationRepository.updateTitleIfUnset`.
- [ ] RF-B03-05: The use case fetches the previous four visible stored
  messages and constructs retrieval context via
  `buildConversationRetrievalContext`.
- [ ] RF-B03-06: The use case calls `AnswerQuestion.execute` with the
  constructed context and the normalized F-04 retrieval settings; it does not
  reimplement retrieval, ranking, or prompting.
- [ ] RF-B03-07: On `answered` or `answered_no_evidence` status, the use case
  appends an assistant row linked to the returned `traceId` and updates
  `lastMessageAt`.
- [ ] RF-B03-08: On `generation_failed` or `generation_unavailable`, the use
  case returns the safe error response and does NOT append an assistant row.
- [ ] RF-B03-09: The response DTO returns the transcript slice needed by
  `/query` (created user message, optional assistant message with hydrated
  trace), never the raw provider payload.

## Module Contracts

```ts
export type AppendConversationMessageInput = {
  conversationId: string;
  userMessageContent: string;
  retrievalSettings?: RetrievalSettingsInput;
};

export type AppendConversationMessageOutput =
  | {
      status: "answered" | "answered_no_evidence";
      userMessage: ConversationMessageResponse;
      assistantMessage: ConversationMessageResponse;
    }
  | {
      status: "generation_failed" | "generation_unavailable";
      userMessage: ConversationMessageResponse;
      errorCode: RagQueryRunErrorCode;
    };
```

```ts
export class AppendConversationMessage {
  constructor(deps: {
    conversations: ConversationRepository;
    messages: ConversationMessageRepository;
    answerQuestion: AnswerQuestion;
  }) {}
  execute(
    input: AppendConversationMessageInput,
  ): Promise<AppendConversationMessageOutput>;
}
```

## Key Modules

- `src/application/rag/create-conversation.ts`
- `src/application/rag/get-conversation-detail.ts`
- `src/application/rag/append-conversation-message.ts`
- co-located `*.test.ts` files

Reuses:

- `AnswerQuestion` — F-05, `src/application/rag/answer-question.ts`.
- `RetrievalSettingsSchema` / normalization — F-04 application layer.
- `buildConversationRetrievalContext`, `deriveConversationTitle` — Block 01.
- `RagQueryRunStatus`, `RagQueryRunErrorCode`, `isFailedRunStatus` — F-05
  domain.

## Tests First

- `src/application/rag/create-conversation.test.ts`
- `src/application/rag/get-conversation-detail.test.ts`
- `src/application/rag/append-conversation-message.test.ts`

Tests must use real repositories with real Postgres (same pattern as F-05
Block 03) plus a fake turn engine to inject each persisted-run status. They
must cover: first-message title assignment, idempotent title on later
messages, preserved transcript order, assistant linked to returned `traceId`,
assistant row absent on failure, safe error DTO shape, and retrieval settings
forwarded unchanged to `AnswerQuestion`.

## Done When

- Application tests pass.
- The use cases reuse the audited F-05 turn engine with no parallel
  retrieval/generation path.
- Later interface block only has to translate HTTP requests to these use
  cases and render the returned DTOs.
