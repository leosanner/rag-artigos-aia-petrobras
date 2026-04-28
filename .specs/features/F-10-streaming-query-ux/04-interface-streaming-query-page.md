# F-10 Block 04 - Interface: Streaming `/query` Page

## Goal

Turn the conversation transcript on `/query` into a live operator surface:
show the persisted user turn immediately, show live source retrieval progress,
stream answer text into the active assistant bubble, and then hydrate the final
persisted assistant trace without losing the existing audit, history, focused,
and URL-sync behavior.

## Scope

**In scope:**

- SSE consumption on `/query` for conversation turns.
- A transient assistant bubble with phase labels, live sources, and streamed
  answer content.
- Final hydration of the persisted assistant message and its audit panel on
  `done`.
- Safe streamed failure UX reusing the existing PT-BR error messages.
- Page tests for live sources, live text, no-evidence, and safe failure paths.

**Out of scope:**

- Streaming on the single-turn ask flow.
- Inline citation click streaming, reconnect/resume semantics, or partial
  persistence of stream state.
- New history, audit, or focused-handoff APIs.
- Replacing the existing conversation reload model.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-05 | Only the final selected answer sources are shown live. | The page uses `source` events to build the transient source preview and keeps `citedInAnswer` hidden until the final persisted trace arrives. |
| RN-07 | The assistant row persists only after final validation and trace persistence. | The page treats the live assistant bubble as transient state and swaps it out for the persisted assistant message on `done`. |
| RN-10 | Mid-stream safe failures are emitted as SSE `error` events. | The page maps streamed `error` events to the existing safe PT-BR error messages without inventing a persisted assistant row. |
| RN-11 | PT-BR copy remains the UI language. | The transient assistant bubble uses `Consultando fontes...` and `Gerando resposta...`. |
| INV-03 | Live source previews must be limited to the final selected sources and keep order. | The page appends source previews strictly in the order the stream emits them. |
| INV-08 | Conversation reload relies on persisted transcript rows and traces only. | Streaming state is client-only and cleared on reload/new conversation/load conversation. |

## Functional Requirements

- [x] RF-B04-01: `/query` submits conversation turns with
  `Accept: text/event-stream, application/json`.
- [x] RF-B04-02: The page falls back to the previous JSON handling path when
  the route does not return SSE.
- [x] RF-B04-03: `user_message_created` appends the persisted user row
  immediately and clears the draft textarea.
- [x] RF-B04-04: `phase: "retrieving_sources"` renders a transient assistant
  bubble with `Consultando fontes...`.
- [x] RF-B04-05: Each `source` event appends one live source preview using the
  existing numbered-title-excerpt source-card rules as much as possible.
- [x] RF-B04-06: `phase: "generating_answer"` switches the transient assistant
  bubble to `Gerando resposta...`.
- [x] RF-B04-07: Each `answer_delta` event appends text to the same transient
  assistant bubble.
- [x] RF-B04-08: `done` replaces the transient assistant bubble with the final
  persisted assistant message and expands its audit view.
- [x] RF-B04-09: `error` clears the transient assistant state, keeps the user
  transcript row, and reuses the safe PT-BR error messaging already used by
  `/query`.
- [x] RF-B04-10: Starting a new conversation, reloading a conversation, or
  restoring URL state clears any stale transient streaming state.

## UI-State Contract

```ts
type StreamingAssistantState =
  | { status: "idle" }
  | {
      status: "streaming";
      phase: "retrieving_sources" | "generating_answer";
      content: string;
      sources: RagSource[];
    };
```

```ts
async function handleConversationEventStream(response: Response): Promise<void>;
```

## Key Modules

- `src/app/query/page.tsx`
- `src/app/query/page.module.css`
- `src/app/query/page.test.tsx`

## Tests First

- `src/app/query/page.test.tsx`
  - `it("streams sources first and then renders answer deltas live before hydrating the final assistant trace", ...)`
  - `it("keeps the streamed user message and shows a safe error when the SSE turn fails", ...)`
  - Plus existing `/query` tests that continue to cover JSON fallback,
    persisted history, focused mode, and source-card handoff.

## Done When

- `/query` shows a transient assistant bubble for the active streamed turn and
  swaps it to the persisted assistant row on completion.
- Live source previews appear before answer generation begins.
- Safe streamed failures preserve the user message and reuse the current safe
  PT-BR error UX.
- Existing history, audit, focused, and URL-sync behavior remain intact outside
  the active transient stream state.
- Page tests for live sources, live answer text, no-evidence, and safe
  streaming failure all pass.
