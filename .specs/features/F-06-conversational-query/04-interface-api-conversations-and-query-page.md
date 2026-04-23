# F-06 Block 04 - Interface: Conversations API and `/query` Page

## Goal

Expose the Block 03 use cases over HTTP and evolve `/query` into a
conversation-first operator surface without creating a separate chat page or
weakening the F-05 audit presentation.

## Scope

**In scope:**

- Route handlers at `src/app/api/rag/conversations/*` for create, get, and
  append-message.
- Zod request/response schemas for each endpoint, aligned with the safe
  trace/error contract from F-05.
- Bearer-secret authentication reused from `/api/rag/ask` and
  `/api/rag/audit/*`.
- `/query` UI evolution: URL sync for `?conversation=<id>`, new-thread
  control, transcript rendering with per-assistant audit expansion, and F-04
  retrieval controls per turn.
- Route-level and page-level tests.

**Out of scope:**

- Use-case implementations and repository SQL (Blocks 02, 03).
- Context builder and title derivation rules (Block 01).
- Streaming transport, typing indicators, partial token rendering.
- Focused-retrieval selectors and document-level toggles (reserved for F-07).

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | `/query` remains the single operator surface; there is no separate chat page. | The page keeps its current route; conversation mode is layered onto it. |
| RN-09 | Conversation endpoints require the same operator bearer secret pattern used by the existing ask and audit endpoints. | All three routes reuse the shared bearer guard. |
| RN-10 | Reloading `/query?conversation=<id>` must restore the persisted transcript for that conversation. | The page reads the URL param on mount and calls the GET endpoint. |
| RN-12 | F-06 must not weaken citation validation, audit visibility, or safe error responses. | Response schemas reuse the F-05 safe DTOs; errors never include prompt text, secrets, stack traces, or raw provider bodies. |
| INV-01 | `/query` must remain the only operator surface for both single-turn and conversational querying. | Conversation UI lives inside `src/app/query/page.tsx`; no new route is added. |
| INV-05 | Conversation mode must preserve the same citation validation and safe error behavior as single-turn mode. | Assistant rendering reuses the F-05 citation/source/related-term components. |

## Functional Requirements

- [ ] RF-B04-01: `POST /api/rag/conversations` validates an empty body,
  requires the operator bearer secret, and returns the created conversation
  DTO (`id`, nullable `title`, timestamps).
- [ ] RF-B04-02: `GET /api/rag/conversations/:id` requires the bearer secret
  and returns the conversation with its ordered messages and hydrated
  assistant traces, or a 404 for unknown ids.
- [ ] RF-B04-03: `POST /api/rag/conversations/:id/messages` validates the
  user message content plus optional F-04 retrieval settings, requires the
  bearer secret, and returns the transcript slice produced by
  `AppendConversationMessage`.
- [ ] RF-B04-04: On technical failure the messages endpoint returns the safe
  F-05 error DTO and does not include stack traces or raw provider bodies.
- [ ] RF-B04-05: All three endpoints share the bearer-secret guard used by
  `/api/rag/ask` and `/api/rag/audit/*`.
- [ ] RF-B04-06: `/query` loads an existing conversation when the URL carries
  `?conversation=<id>` and renders the persisted transcript.
- [ ] RF-B04-07: `/query` exposes a "new conversation" control that calls the
  POST endpoint and syncs the returned id into the URL.
- [ ] RF-B04-08: `/query` submits additional messages in the same thread via
  the messages endpoint, preserving the F-04 retrieval controls per turn.
- [ ] RF-B04-09: Each assistant message in the transcript is expandable to
  show its citations, source snapshots, related terms, usage, latency, and
  cost, reusing the F-05 inspection components.
- [ ] RF-B04-10: `/query` continues to support single-turn audit visibility
  (recent runs, run detail) without regression.

## Module Contracts

```ts
export const CreateConversationResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMessageAt: z.string().datetime().nullable(),
});

export const AppendConversationMessageRequestSchema = z.object({
  content: z.string().min(1),
  retrievalSettings: RetrievalSettingsRequestSchema.optional(),
});
```

```ts
export const ConversationDetailResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMessageAt: z.string().datetime().nullable(),
  messages: z.array(ConversationMessageResponseSchema),
});
```

## Key Modules

- `src/app/api/rag/conversations/route.ts`
- `src/app/api/rag/conversations/[id]/route.ts`
- `src/app/api/rag/conversations/[id]/messages/route.ts`
- `src/app/query/page.tsx` (evolution, not rewrite)
- Reused F-05 inspection components for per-assistant audit expansion.

## Tests First

- `src/app/api/rag/conversations/route.test.ts`
- `src/app/api/rag/conversations/[id]/route.test.ts`
- `src/app/api/rag/conversations/[id]/messages/route.test.ts`
- `src/app/query/page.test.tsx` (conversation reload, new-thread control,
  per-turn retrieval settings, single-turn regression)

Route tests must cover: bearer-secret enforcement, Zod validation errors,
successful DTOs, 404 for unknown conversation, safe failure shape for
technical errors after validation. Page tests must cover URL-driven reload,
transcript rendering, and assistant audit expansion.

## Done When

- Route and page tests pass.
- `/query` stays the single operator surface for both single-turn and
  conversational modes.
- Safe error contract and F-05 audit visibility remain intact under
  conversation mode.
