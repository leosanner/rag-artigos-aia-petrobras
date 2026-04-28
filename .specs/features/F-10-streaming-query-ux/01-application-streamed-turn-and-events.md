# F-10 Block 01 - Application: Streamed Turn and Event Vocabulary

## Goal

Add the application-level streaming contract for conversation turns without
forking the audited answer engine: one transport-agnostic event union, one
streamed conversation use case, and one streaming path inside `AnswerQuestion`
that still owns focused validation, retrieval, citation checks, and trace
persistence.

## Scope

**In scope:**

- The streamed conversation event union.
- A dedicated streamed conversation use case alongside the existing JSON
  append-message use case.
- A streaming execution path inside `AnswerQuestion`.
- Success, no-evidence, focused-rejection, and generation-failure behavior for
  streamed turns.
- Application tests with fake generation/retrieval boundaries and real
  repositories where persistence proof matters.

**Out of scope:**

- Provider-specific streaming implementation details; those belong to Block 02.
- HTTP headers, SSE serialization, or route content negotiation; those belong
  to Block 03.
- `/query` rendering and transient client state; those belong to Block 04.
- Reconnect/resume semantics, partial trace persistence, or partial assistant
  persistence.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-04 | The streamed flow uses `user_message_created`, `phase`, `source`, `answer_delta`, `done`, and `error`. | `StreamConversationMessageEvent` defines that exact closed union. |
| RN-05 | Only the final selected answer sources are shown live, in retrieval order. | `AnswerQuestion.executeStream(...)` emits sources only after final selection via `assembleRagContext(...)`. |
| RN-06 | The user transcript row is persisted before retrieval or generation begins. | `StreamConversationMessage.execute(...)` appends the user row before any turn-engine call and emits `user_message_created` from the persisted row. |
| RN-07 | The assistant row persists only after final answer validation and trace persistence. | `StreamConversationMessage.execute(...)` appends the assistant row only after `AnswerQuestion.executeStream(...)` returns a successful governed result. |
| RN-08 | Focused rejections after user-message persistence emit streamed `error` and no assistant row. | `StreamConversationMessage` maps focused rejection reasons to `document_not_found` or `document_not_focusable` events. |
| RN-09 | Failed streamed turns still persist the failed run but not an assistant row. | `AnswerQuestion.executeStream(...)` reuses the existing failure persistence path; `StreamConversationMessage` skips assistant append on `kind: "error"`. |
| INV-02 | The streamed path must reuse the same audited turn engine. | `executeStream(...)` is a second entry point into the existing `AnswerQuestion` implementation rather than a chat-only pipeline. |
| INV-05 | No assistant row may persist before final citation validation and trace persistence succeed. | The application flow keeps trace persistence inside `AnswerQuestion` and transcript append after the result returns. |

## Functional Requirements

- [x] RF-B01-01: The application layer exports a closed streamed-event union
  with the types `user_message_created`, `phase`, `source`, `answer_delta`,
  `done`, and `error`.
- [x] RF-B01-02: The `phase` vocabulary is closed to
  `retrieving_sources | generating_answer`.
- [x] RF-B01-03: The streamed error status vocabulary is closed to
  `generation_failed | generation_unavailable | document_not_found | document_not_focusable`.
- [x] RF-B01-04: `AnswerQuestion.executeStream(...)` shares the same focused
  validation, retrieval, related-term extraction, final citation validation,
  audit construction, and persisted run creation as `execute(...)`.
- [x] RF-B01-05: `AnswerQuestion.executeStream(...)` emits the final selected
  sources before generation begins and emits text deltas only through the
  callbacks it receives.
- [x] RF-B01-06: `StreamConversationMessage.execute(...)` persists the user row
  first, updates title/last-message bookkeeping, and emits
  `user_message_created` from the persisted row.
- [x] RF-B01-07: `StreamConversationMessage.execute(...)` emits
  `phase: "retrieving_sources"` before delegating to the streamed answer turn.
- [x] RF-B01-08: On success, `StreamConversationMessage.execute(...)` appends
  the assistant row, reloads the hydrated assistant trace, and emits `done`.
- [x] RF-B01-09: On `answered_no_evidence`, the streamed path emits `done`
  without sources or answer deltas and still persists the assistant row.
- [x] RF-B01-10: On focused rejection or safe generation failure after
  user-message persistence, the streamed path emits `error`, leaves the user
  row persisted, and does not append an assistant row.

## Module Contracts

```ts
export type StreamConversationMessageEvent =
  | {
      type: "user_message_created";
      userMessage: ConversationMessageResponse;
    }
  | {
      type: "phase";
      phase: "retrieving_sources" | "generating_answer";
    }
  | {
      type: "source";
      source: RagSource;
    }
  | {
      type: "answer_delta";
      textDelta: string;
    }
  | {
      type: "done";
      status: "answered" | "answered_no_evidence";
      assistantMessage: ConversationMessageResponse;
    }
  | {
      type: "error";
      status:
        | "generation_failed"
        | "generation_unavailable"
        | "document_not_found"
        | "document_not_focusable";
      errorCode:
        | "generation_failed"
        | "generation_unavailable"
        | "document_not_found"
        | "document_not_focusable";
    };
```

```ts
export type AnswerQuestionStreamCallbacks = {
  onSources?: (sources: RagSource[]) => Promise<void> | void;
  onGenerationStart?: () => Promise<void> | void;
  onAnswerDelta?: (textDelta: string) => Promise<void> | void;
};
```

```ts
export class StreamConversationMessage {
  constructor(deps: {
    conversations: Pick<
      ConversationRepository,
      "getDetail" | "touchLastMessageAt" | "updateTitleIfUnset"
    >;
    messages: Pick<
      ConversationMessageRepository,
      "append" | "listPreviousVisible"
    >;
    answerQuestion: Pick<AnswerQuestion, "executeStream">;
  }) {}

  execute(
    input: StreamConversationMessageInput,
    options: { onEvent: StreamConversationMessageListener },
  ): Promise<"completed" | "not_found">;
}
```

## Key Modules

- `src/application/rag/answer-question.ts`
- `src/application/rag/answer-question.test.ts`
- `src/application/rag/stream-conversation-message-events.ts`
- `src/application/rag/stream-conversation-message.ts`
- `src/application/rag/stream-conversation-message.test.ts`

## Tests First

- `src/application/rag/answer-question.test.ts`
  - `it("streams sources first, then text deltas, and validates citations after the final accumulated answer", ...)`
  - `it("persists a failed run when streamed generation fails after sources were selected", ...)`
- `src/application/rag/stream-conversation-message.test.ts`
  - `it("emits user, phase, source, delta, and done events in order and persists the assistant only on success", ...)`
  - `it("emits done directly for a no-evidence answer without sources or deltas", ...)`
  - `it("emits a focused-document error and does not create an assistant row", ...)`
  - `it("emits a generation failure after the user message and does not create an assistant row", ...)`

## Done When

- The streamed turn path reuses `AnswerQuestion` instead of introducing a
  chat-only retrieval/generation engine.
- Successful streamed turns persist the assistant row only after final trace
  persistence and citation validation.
- Focused rejection and generation failure branches emit safe `error` events
  without creating assistant transcript rows.
- Application tests covering event order, no-evidence, focused rejection,
  citation validation, and safe failure persistence all pass.
