# F-06 Block 01 - Domain: Conversation Context and Message Types

## Goal

Build the pure business-logic foundation for F-06 before touching Drizzle
schema, route handlers, or `/query`. This block owns the deterministic
retrieval-context builder and the transcript-related vocabulary reused by
persistence and application code.

## Scope

**In scope:**

- Pure types for transcript roles, message content, and title derivation.
- `buildConversationRetrievalContext(input)` — deterministic concatenation of
  the latest user message plus up to four immediately preceding visible
  messages with explicit role labels.
- `deriveConversationTitle(content)` — trimmed, deterministic truncation of a
  first-user-message content down to 80 characters.
- Pure helpers and tests for the DTO shapes used by later layers.

**Out of scope:**

- Drizzle schema, migrations, or repository writes.
- Application orchestration (use cases, turn engine delegation).
- API request/response schemas, route handlers, and `/query`.
- Any retrieval strategy logic — F-04 owns `RetrievalSettings`; this block only
  imports its types.
- Any audited run persistence — F-05 owns `RagQueryRunStatus`/traces; this
  block only imports its types.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-03 | The first persisted user message sets the conversation title from trimmed content, truncated deterministically to 80 characters. | `deriveConversationTitle` owns the trim + 80-char truncation rule. |
| RN-07 | Conversation retrieval context uses the latest user message plus up to four immediately preceding visible stored messages, concatenated in display order with role labels. | `buildConversationRetrievalContext` is the sole producer of that string. |
| RN-08 | F-06 must not introduce hidden query rewriting, summarization, or any second retrieval query besides the explicit concatenated transcript context. | The builder is a pure projection — no LLM call, no rewriting path exists here. |
| INV-04 | Retrieval context for chat must be limited to the newest user message plus the previous four stored messages; no hidden rewriting step may be inserted. | The builder accepts at most four predecessors and truncates on excess without calling external services. |
| INV-06 | F-06 must not depend on any agents framework. | Domain code imports no agents runtime or planner abstraction. |

## Functional Requirements

- [ ] RF-B01-01: `ConversationMessageRole` is a closed union limited to
  `"user"` and `"assistant"`.
- [ ] RF-B01-02: `deriveConversationTitle(content)` trims whitespace and
  returns at most 80 characters from the normalized content; empty or
  whitespace-only inputs return `null`.
- [ ] RF-B01-03: `deriveConversationTitle` truncation is deterministic —
  identical inputs always produce identical outputs, with no ellipsis or
  provider-driven summarization.
- [ ] RF-B01-04: `buildConversationRetrievalContext(input)` accepts the newest
  user message plus zero-to-many previous stored messages and limits the
  predecessors used to the last four in display order.
- [ ] RF-B01-05: The concatenated context preserves display order and prefixes
  each segment with a stable role label (for example, `"User:"` and
  `"Assistant:"`).
- [ ] RF-B01-06: With zero previous messages, the builder returns a
  well-formed context containing only the newest user message and its label.
- [ ] RF-B01-07: With more than four predecessors, only the four closest to
  the newest message are used; earlier messages are dropped silently.
- [ ] RF-B01-08: Domain helpers remain pure and do not import Next.js,
  Drizzle, repositories, provider SDKs, or `process.env`.

## Module Contracts

```ts
export type ConversationMessageRole = "user" | "assistant";

export type ConversationMessageForContext = {
  role: ConversationMessageRole;
  content: string;
};

export type BuildConversationRetrievalContextInput = {
  latestUserMessage: string;
  previousStoredMessages: ConversationMessageForContext[];
};
```

```ts
export function buildConversationRetrievalContext(
  input: BuildConversationRetrievalContextInput,
): string;

export function deriveConversationTitle(content: string): string | null;
```

## Key Modules

- `src/domain/rag/conversation-context.ts`
- `src/domain/rag/conversation-title.ts`
- `src/domain/rag/index.ts`

## Tests First

- `src/domain/rag/conversation-context.test.ts`
- `src/domain/rag/conversation-title.test.ts`

The tests must cover deterministic context construction, the four-predecessor
cap, display order preservation, role label prefixes, the zero-predecessor
fallback, title trimming, 80-character truncation, and the empty/whitespace
input returning `null`.

## Done When

- Domain tests pass.
- Context builder and title helper remain pure and deterministic with no
  hidden rewriting or summarization path.
- Later persistence and application blocks can reuse the same message-role,
  context, and title vocabulary without reimplementing the rules.
