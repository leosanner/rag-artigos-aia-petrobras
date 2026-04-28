# F-10 Block 03 - Interface: SSE Conversation Route

## Goal

Upgrade the existing conversation-message route to dual-mode transport: keep
the current JSON response path intact while adding SSE on the same URL for
clients that explicitly request streaming.

## Scope

**In scope:**

- Content negotiation on `POST /api/rag/conversations/:id/messages`.
- Pre-stream validation and safe JSON failure responses.
- Zod-backed streamed event DTOs and SSE serialization.
- Safe mid-stream `error` events under HTTP 200.
- Route tests covering JSON fallback, stream success ordering, and stream
  failure mapping.

**Out of scope:**

- Streamed application orchestration; that belongs to Block 01.
- Provider streaming implementation; that belongs to Block 02.
- `/query` client rendering; that belongs to Block 04.
- Any new endpoint, reconnect token, or keepalive heartbeat protocol.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-02 | The conversation route must keep the current JSON response contract for non-stream clients. | The handler branches by `Accept` and preserves the existing JSON execution path. |
| RN-03 | SSE is enabled only when `Accept` includes `text/event-stream`. | `wantsEventStream(...)` performs explicit content negotiation. |
| RN-10 | Pre-stream failures stay JSON; mid-stream failures become SSE `error` events under HTTP 200. | The handler validates auth/id/body first, performs a conversation preflight in SSE mode, then serializes streamed errors only after the stream starts. |
| INV-04 | Pre-stream failures are HTTP JSON failures; mid-stream failures are SSE `error` events under HTTP 200. | The handler keeps `400`/`401`/`404` JSON bodies before starting the stream and uses `error` events after startup. |
| INV-07 | Stream payloads must not expose raw provider internals. | All streamed payloads pass through Zod-backed DTOs built from application-safe event types. |

## Functional Requirements

- [x] RF-B03-01: The route accepts the same request body in both JSON and SSE
  modes.
- [x] RF-B03-02: Authorized clients requesting `text/event-stream` receive
  `Content-Type: text/event-stream; charset=utf-8`,
  `Cache-Control: no-store`, `Connection: keep-alive`, and
  `X-Accel-Buffering: no`.
- [x] RF-B03-03: Unauthorized, malformed, invalid-id, and unknown-conversation
  failures remain safe JSON responses before any stream starts.
- [x] RF-B03-04: SSE payloads are validated through a Zod union covering
  `user_message_created`, `phase`, `source`, `answer_delta`, `done`, and
  `error`.
- [x] RF-B03-05: Stream serialization uses `event: <type>` plus JSON `data:`
  frames for each event.
- [x] RF-B03-06: Mid-stream safe failures are serialized as `error` events
  under HTTP 200 and do not fall back to JSON once the stream has started.
- [x] RF-B03-07: The JSON conversation path remains the stable fallback and
  regression oracle for non-stream clients.

## Module Contracts

```ts
export const ragConversationStreamEventSchema = z.discriminatedUnion("type", [
  ragConversationStreamUserMessageCreatedEventSchema,
  ragConversationStreamPhaseEventSchema,
  ragConversationStreamSourceEventSchema,
  ragConversationStreamAnswerDeltaEventSchema,
  ragConversationStreamDoneEventSchema,
  ragConversationStreamErrorEventSchema,
]);
```

```ts
export function toConversationStreamEventHttpResponse(
  event: StreamConversationMessageEvent,
): RagConversationStreamEvent;
```

```ts
export function createRagConversationMessagesHandler(deps: {
  appendMessage: Pick<AppendConversationMessage, "execute">;
  getConversationDetail: Pick<GetConversationDetail, "execute">;
  streamMessage: Pick<StreamConversationMessage, "execute">;
  secret: string;
}): (
  request: Request,
  context: RagConversationMessagesRouteContext,
) => Promise<Response>;
```

## Key Modules

- `src/application/rag/schemas.ts`
- `src/app/api/rag/conversations/dto.ts`
- `src/app/api/rag/conversations/[id]/messages/handler.ts`
- `src/app/api/rag/conversations/[id]/messages/route.ts`
- `src/app/api/rag/conversations/[id]/messages/handler.test.ts`

## Tests First

- `src/app/api/rag/conversations/[id]/messages/handler.test.ts`
  - `it("returns an SSE stream when the client requests text/event-stream", ...)`
  - `it("keeps unknown conversations as a pre-stream 404 in SSE mode", ...)`
  - `it("serializes safe mid-stream errors as SSE events under HTTP 200", ...)`
  - Plus the existing JSON fallback tests that still assert the non-stream path.

## Done When

- The route negotiates JSON vs SSE on the same URL without breaking the
  existing JSON contract.
- Pre-stream validation failures remain safe JSON responses.
- Mid-stream safe failures serialize as SSE `error` events under HTTP 200.
- Route tests prove headers, event order, JSON fallback preservation, and safe
  error mapping.
