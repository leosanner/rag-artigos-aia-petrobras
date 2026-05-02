# F-12 — Unified Conversational Query

## Scope

**In scope:**
- Collapse the `/query` page into a single execution surface: the multi-turn
  conversational chat established by F-06. Remove the parallel single-turn ask
  panel, its composer, its result block, and its UI state.
- Promote per-turn retrieval strategy selection (`standard` | `explore` |
  `rerank`) into the chat composer via a single selector with an inline help
  affordance ("i" tooltip) describing each strategy.
- Render `explore` turns as a deterministic related-terms block authored by the
  retrieval pipeline (no LLM-narrated answer) and exclude those turns from the
  prompt history of subsequent turns.
- Reduce the strategy selector to `standard` only when the active conversation
  is in `focused` mode. `explore` and `rerank` are hidden/disabled with a
  tooltip explaining why.
- Retire `POST /api/rag/ask`. Remove the route, its Zod schemas
  (`ragAskSuccessResponseSchema` and siblings), its tests, and the page state
  that depends on it. All execution flows through the conversations transport.
- Default retrieval controls (`topK`, `candidateTopK`) remain hidden in the
  base composer. A collapsible "Advanced" panel exposes per-turn overrides;
  `candidateTopK` only appears when the selected strategy is `rerank`. Advanced
  state is sticky for the UI session and resets on reload — it is never
  persisted server-side.
- Replace the global runs index and the cross-conversation run drawer with a
  per-message "Ver auditoria" action. The action opens a right-side drawer
  rendering the trace already carried by the conversation payload.
- Extend the conversation streaming event vocabulary
  (`ragConversationStreamEventSchema`) so reranked turns surface an explicit
  rerank phase ("Recuperando candidatos…", "Reordenando com Cohere…",
  "Gerando resposta…"). Non-rerank turns omit the phase entirely.
- Mark F-04, F-06, and F-08 as superseded by F-12 with a pointer at the top of
  each `spec.md`. Keep F-10 active as the streaming transport contract.

**Out of scope:**
- Adding rerank or explore to focused-mode conversations. Focused remains
  `standard` only in F-12 and beyond unless a future feature reopens it.
- Automatic strategy selection, query classification, or hidden rerank.
- Changing the underlying retrieval/rerank/generation algorithms; F-12 only
  reshapes the surface and the persistence/transport contracts that feed it.
- Agentic tool-call loops; F-11 builds on top of F-12 and owns that surface.
- Internationalization. UI copy stays PT-BR; code, schemas, commits, and PR
  descriptions stay EN, per `CLAUDE.md`.
- Migrating the visual mock (`?mock=1`) into a permanent feature; the mock can
  be deleted or reshaped freely as long as production paths are unaffected.
- New telemetry beyond what F-08 (rerank cost/latency) and F-10 (stream event
  cost/latency) already define.

## Context & Motivation

`/query` currently exposes two parallel execution paths in the same page:
the conversational chat (F-06, streamed via F-10) and a single-turn ask form
(F-04 + F-08) where rerank lives. The split was an artifact of incremental
delivery, not a designed product surface. It produces three concrete problems:

1. **Strategy fragmentation.** Rerank only exists in the single-turn path;
   the chat has no way to invoke it. Operators can either get conversation
   continuity or rerank, never both.
2. **Audit duplication.** The page renders trace data inline on chat messages
   and also exposes a separate runs list + run-detail drawer fetched from
   `/api/rag/query-runs`. Two independent UI surfaces describe the same
   `query_run` rows, with diverging shapes.
3. **Agentic blocker.** F-11 (agentic conversational RAG) presumes a single
   conversational loop as the only execution surface. Keeping
   `/api/rag/ask` alive forces F-11 to either ignore it (creating dead code)
   or duplicate every tool path through both transports.

F-12 unifies the surface around the conversational transport, lifts rerank
into per-turn granularity in that surface, and replaces the global audit list
with per-message audit access. It is the prerequisite contract that F-11 will
build on.

Decisions live in `.specs/project/STATE.md` (AD-019…AD-022, registered with
this feature). Roadmap context is in `.specs/project/ROADMAP.md`.

## Business Rules

- RN-01: `/query` exposes exactly one execution surface — the conversational
  chat. There is no parallel single-turn UI.
- RN-02: Retrieval strategy is selected per user turn, not per conversation.
  A single conversation may contain turns with mixed strategies.
- RN-03: In `focused` mode, the only valid strategy is `standard`. Submitting
  any other strategy in focused must be rejected at the application boundary,
  not silently rewritten.
- RN-04: A conversation's `mode` (`global` | `focused`) and, when focused, its
  `documentId` are immutable for the lifetime of the conversation. Switching
  scope requires creating a new conversation.
- RN-05: `explore` turns produce a deterministic related-terms artifact, not
  an LLM-generated narrative answer. The artifact is persisted as the turn's
  `assistant message` content payload and is recoverable from the trace.
- RN-06: `explore` turns are excluded from the prompt history passed to the
  LLM in subsequent `standard`/`rerank` turns of the same conversation. They
  remain visible to the user in the chat transcript.
- RN-07: Default retrieval parameters are `topK = 6` and, when rerank applies,
  `candidateTopK = 24`. Advanced overrides are per-turn inputs; they do not
  mutate any conversation-level state and they do not persist across reloads.
- RN-08: A `query_run` is always the child of an `assistant message` inside a
  `conversation`. There are no orphan runs created via a non-conversational
  path.
- RN-09: Deleting a conversation does **not** cascade to its `query_runs`.
  Affected runs surface a derived `conversation_archived` flag in any
  audit-facing payload but remain queryable for governance/observability.
- RN-10: The trace payload required to render the per-message audit drawer is
  carried inline in `GET /api/rag/conversations/:id`. The audit UI does not
  fetch a per-run detail endpoint.

## Functional Requirements

- [ ] RF-01: `/query` renders only the conversation surface (sidebar of
  conversations + active chat + composer). The single-turn ask panel and its
  result block are removed.
- [ ] RF-02: The chat composer exposes a strategy selector with three options
  (`standard`, `explore`, `rerank`) when the conversation is in `global`
  mode, and one option (`standard`) when in `focused` mode.
- [ ] RF-03: An "i" affordance next to the selector reveals a tooltip with one
  short PT-BR sentence per strategy describing intent and trade-off.
- [ ] RF-04: The composer's "Avançado" disclosure exposes `topK` (always) and
  `candidateTopK` (only when strategy = `rerank`). Both default to F-08's
  documented values. The disclosure remembers its open/closed state and the
  override values for the duration of the page session.
- [ ] RF-05: Submitting a `standard` or `rerank` turn streams the standard
  conversational response. Submitting an `explore` turn streams a related-
  terms artifact and renders it as the assistant message body without LLM
  narration.
- [ ] RF-06: `ragConversationStreamEventSchema` carries explicit phase events
  for rerank turns: at minimum a `rerank_started` and `rerank_completed`
  event (or a single `phase` event with discriminated values), enough for the
  UI to render the three-step status copy. Non-rerank turns emit no rerank
  phase events.
- [ ] RF-07: Each assistant message in the chat transcript exposes a "Ver
  auditoria" action that opens a right-side drawer with the run's trace
  (metadata + audit + sources + related terms when applicable). The drawer
  is dismissible via close button, ESC key, and outside click.
- [ ] RF-08: The conversation payload returned by
  `GET /api/rag/conversations/:id` carries the trace fields the audit drawer
  needs, with no extra round-trip.
- [ ] RF-09: `POST /api/rag/ask` is removed. Hitting the route returns 404
  via the Next.js routing layer (no custom handler).
- [ ] RF-10: Conversations created before F-12 load and render without error.
  The strategy selector for the next turn defaults to `standard`, regardless
  of the strategies used by historical turns.
- [ ] RF-11: Deleting a conversation does not delete its `query_runs`. A
  governance-facing query (script or future admin surface) can still list
  those runs and identify them as belonging to an archived conversation.
- [ ] RF-12: The global runs index UI and the cross-conversation run-detail
  drawer are removed from `/query`. No navigation entry points remain.
- [ ] RF-13: A `focused` conversation that attempts to submit a turn with
  strategy `explore` or `rerank` is rejected by the API with a typed
  validation error matching the existing invalid-request shape.

## System Flow

Entry point: `/query` page (Next.js App Router client component) +
`POST /api/rag/conversations` and `POST /api/rag/conversations/:id/messages`
API routes (existing, F-06).

1. **Page load.**
   - Client reads URL state (`?conversation=...`, `?mode=...`, `?document=...`).
   - If `conversation` present, fetch `GET /api/rag/conversations/:id` —
     payload includes messages with embedded trace data (RN-10).
   - Sidebar lists conversations via existing endpoint.
   - The page no longer renders the single-turn panel.

2. **Composer state.**
   - Strategy selector defaults to `standard`. Options filtered by conversation
     `mode` (RN-03).
   - "Avançado" disclosure is collapsed by default; values are
     `topK = 6`, `candidateTopK = 24` until the user overrides them.
   - Override values are stored in React state only; they are not written to
     URL, sessionStorage, or the server (RN-07).

3. **Submitting a turn.**
   - Client posts to `POST /api/rag/conversations/:id/messages` with
     `{ question, strategy, topK?, candidateTopK? }`. If no conversation
     exists yet, client first creates one via `POST /api/rag/conversations`
     with `{ mode, documentId? }` (immutable per RN-04).
   - Application layer (`src/application/rag/conversation/...`) validates the
     strategy/mode pair (RN-03), resolves retrieval parameters (RN-07), and
     calls the existing retrieval/rerank/generation orchestrator.
   - `explore` runs invoke the deterministic related-terms producer (already
     owned by F-04). The orchestrator records the related-terms artifact as
     the turn's content payload and skips LLM generation (RN-05).

4. **Streaming back.**
   - For `standard` and `rerank`, the existing stream events fire
     (`message_started`, token deltas, `message_completed`).
   - For `rerank`, additional phase events surface the rerank lifecycle
     (RF-06). The UI maps phase events to PT-BR status copy.
   - For `explore`, the stream emits a single `related_terms` event carrying
     the artifact, followed by completion. No token deltas.

5. **Persistence.**
   - The application layer persists `message`, `query_run`, source rows, and
     rerank trace exactly as F-06/F-08 already define. The `query_run` always
     hangs off a `message` (RN-08).

6. **Audit access.**
   - The user clicks "Ver auditoria" on an assistant message. The drawer
     reads the trace embedded in the conversation payload (RN-10) — no
     additional fetch.

7. **Conversation deletion.**
   - Existing conversation-delete path removes the `conversation` row and its
     `messages`. `query_runs` rows are preserved (RN-09). Any payload that
     surfaces those runs in a future admin/governance view derives a
     `conversation_archived` flag from the absence of the parent conversation.

8. **Failure branches.**
   - `focused` + non-`standard` strategy → typed `invalid_request` response
     (RF-13).
   - Rerank provider failure → existing F-08 failure codes
     (`reranking_failed`, `reranking_unavailable`) bubble through the stream
     and the chat renders the standard error chip.
   - Generation failure → existing F-06/F-10 error events.

## Invariants / Non-negotiables

- INV-01: `/query` never renders the single-turn ask UI in any browser state,
  feature flag, or query parameter.
- INV-02: A `query_run` is never written outside the context of an
  `assistant message`. There is no API path that produces a run without a
  parent message after F-12 ships.
- INV-03: `focused` conversations never execute `rerank` or `explore`. This
  is enforced at the application boundary, not just in the UI.
- INV-04: A conversation's `mode` and `documentId` are never mutated after
  creation. The schema and service layer reject any update that would change
  them.
- INV-05: `explore` turns never trigger LLM generation, never consume
  generation tokens, and never appear in the prompt history of subsequent
  turns of the same conversation.
- INV-06: Default retrieval parameters (`topK = 6`, `candidateTopK = 24`)
  match the values F-08 documents. Any drift requires a new AD.
- INV-07: Deleting a conversation never deletes a `query_run`. Cascade rules
  on the relevant FKs explicitly forbid it.
- INV-08: The audit drawer never fetches a per-run endpoint. Trace data is
  always served inline by the conversation payload.
- INV-09: PT-BR is the UI language; no translated copy ships in EN. Code,
  schemas, identifiers, commit messages, and PR descriptions remain EN per
  `CLAUDE.md`.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `conversation` | `id`, `mode`, `documentId?`, `title`, timestamps | Existing F-06 entity. F-12 enforces immutability of `mode` + `documentId` (RN-04, INV-04). |
| `message` | `id`, `conversationId`, `role`, `content`, `createdAt` | Existing F-06 entity. `assistant` rows now also represent `explore` artifacts as content (RN-05). |
| `query_run` | `id`, `messageId`, `strategy`, `topK`, `candidateTopK?`, audit fields, sources, related terms | Existing F-04/F-06/F-08 entity. F-12 forbids cascade-delete with conversation (RN-09, INV-07). |
| Conversation API payload | embeds `message.trace` for every assistant message | Already partially carried; F-12 makes it the canonical audit source (RN-10, INV-08). |

No new tables. No new columns. The `conversation_archived` signal in
RN-09/RF-11 is **derived** at query time from the absence of the parent
`conversation` row, not stored.

### Endpoints / Interfaces

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| DELETE | `POST /api/rag/ask` | Removed. Returns 404 via routing (RF-09). |
| POST | `POST /api/rag/conversations` | Existing F-06 endpoint. Accepts `{ mode, documentId? }`. |
| POST | `POST /api/rag/conversations/:id/messages` | Existing F-06 endpoint. Accepts `{ question, strategy, topK?, candidateTopK? }`. F-12 tightens validation per RN-03/RF-13. |
| GET | `GET /api/rag/conversations/:id` | Existing F-06 endpoint. F-12 ensures every assistant message carries the full trace inline (RN-10). |
| GET | `GET /api/rag/query-runs/:id` | Removed from `/query` consumption. Endpoint may stay for tooling but the UI never calls it (INV-08). Decision recorded as AD-022. |
| Stream event | `ragConversationStreamEventSchema` (extension) | Adds rerank phase event(s) (RF-06). Backward-compatible: clients that ignore unknown events still work. |

### Key Modules

- `src/app/query/page.tsx` — major restructure. Drop single-turn state, single-
  turn submit handlers, and global runs/drawer UI. Add strategy selector,
  tooltip, "Avançado" disclosure, per-message "Ver auditoria" trigger, and
  audit drawer.
- `src/app/query/page.module.css` — adapt layout to remove the single-turn
  panel; introduce drawer styles (or reuse an existing drawer primitive).
- `src/app/query/constants.ts` — prune copy strings tied to single-turn ask;
  add strategy-tooltip copy in PT-BR.
- `src/app/api/rag/ask/*` — delete the route handler, its tests, and Zod
  schemas (`ragAskSuccessResponseSchema`, et al.) wherever they are not
  reused by the conversation transport.
- `src/application/rag/schemas.ts` — remove single-turn-only schemas; tighten
  conversation message request schema to enforce RN-03 / RF-13.
- `src/application/rag/conversation/*` — extend stream event vocabulary
  (RF-06); confirm trace is fully embedded in conversation reads (RN-10).
- `src/application/rag/explore/*` — confirm `explore` artifact is recorded
  as the assistant message content and that subsequent prompt assembly skips
  these turns (INV-05).
- `src/db/schema.ts` — review FK definitions on `query_runs` to guarantee
  RN-09 / INV-07. Add migration only if the current cascade rule violates
  the invariant.
- `src/app/query/page.test.tsx` — replace single-turn test suites with chat
  coverage that exercises strategy switching, focused-mode reduction,
  advanced overrides, audit drawer, explore rendering, and rerank phase
  copy.
- `.specs/features/F-04-query-controls-and-explore/spec.md`,
  `.specs/features/F-06-conversational-query/spec.md`,
  `.specs/features/F-08-reranked-retrieval/spec.md` — add a "Superseded by
  F-12" banner at the top.
- `.specs/project/STATE.md` — register AD-019…AD-022 (see Decisions).
- `.specs/project/CHANGELOG.md` — F-12 entry.

## Dependencies

- **Prerequisite features:** F-04 (query controls + explore), F-06
  (conversational query), F-08 (reranked retrieval), F-10 (streaming UX).
  F-12 supersedes F-04/F-06/F-08 contract-wise but builds on their code.
- **External packages added:** none anticipated. If a new drawer/disclosure
  primitive is introduced, it must be a project-local component, not a new
  dependency.
- **External services:** unchanged from F-08 (Cohere reranker) and F-10
  (LLM/embedding providers via Vercel AI SDK).
- **Environment variables:** unchanged. F-12 does not introduce new env
  inputs.

## Acceptance Criteria

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass on the
   F-12 branch with the new tests included.
2. `src/app/query/page.tsx` no longer references `singleTurnAskState`,
   `singleTurnResultState`, `submitSingleTurnQuestion`, or any
   `ragAskSuccessResponseSchema`-derived type.
3. `src/app/api/rag/ask` is deleted; a request to `POST /api/rag/ask` returns
   a Next.js 404, verified by an integration test.
4. The conversation composer test asserts: (a) `global` shows 3 strategies,
   (b) `focused` shows only `standard`, (c) "Avançado" toggles, (d)
   `candidateTopK` only renders for `rerank`, (e) overrides reset on remount.
5. A streaming integration test for a `rerank` turn observes the rerank
   phase events in the documented order, and a `standard` turn observes none.
6. A streaming integration test for an `explore` turn observes the
   related-terms event, no token deltas, and persists the artifact as the
   assistant message content.
7. A unit/integration test asserts that prompt assembly for a follow-up
   `standard` or `rerank` turn skips prior `explore` turns (INV-05).
8. An API test asserts that `POST /api/rag/conversations/:id/messages` with
   `mode = focused` and `strategy ∈ { explore, rerank }` returns the
   `invalid_request` error shape (RF-13, INV-03).
9. An API test asserts that `GET /api/rag/conversations/:id` returns trace
   fields inline for every assistant message — sources, related terms (when
   applicable), rerank metadata, and cost/latency audit (RN-10).
10. A schema/migration test asserts that deleting a conversation row leaves
    its child `query_runs` intact (RN-09, INV-07).
11. A page-level test asserts the per-message "Ver auditoria" action opens a
    drawer rendering the message's trace, dismissible via close button and
    ESC.
12. A backwards-compat test loads a fixture conversation built with pre-F-12
    data (mixed strategies, no rerank trace fields) and renders it without
    runtime error; the next-turn strategy selector defaults to `standard`
    (RF-10).
13. F-04, F-06, and F-08 `spec.md` files carry a "Superseded by F-12" header
    pointing at this document.
14. `.specs/project/STATE.md` contains AD-019, AD-020, AD-021, AD-022 with
    the bodies described under Decisions.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| AD-019: Retire `POST /api/rag/ask` in favor of the conversation transport. | Keep `/ask` as a thin public API; refactor `/ask` into an internal wrapper around the conversation flow. | DEMO has no external API consumers. Two transports duplicate audit shapes and force F-11 to either ignore one or double-implement every tool path. A one-turn conversation covers the "quick query" use case at zero new cost. |
| AD-020: Strategy is selected per-turn inside the chat composer. | Strategy fixed per conversation; strategy auto-selected by query classifier; rerank always-on. | `query_run.strategy` is already per-run in the schema. Per-conversation breaks the natural mix of `explore`/`rerank`/`standard` turns. Always-on rerank charges Cohere on trivial follow-ups; classifiers introduce hidden behavior incompatible with the project's traceability bar. |
| AD-021: `explore` turns render as a deterministic related-terms block and are excluded from prompt history. | Synthesize a narrative paragraph from the related terms; drop `explore` from the chat surface entirely. | `explore` is intentionally non-generative (F-04). Synthesizing narration reintroduces hallucination risk the strategy was designed to avoid. Dropping it loses an established product surface. Excluding from prompt history keeps the conversational context coherent. |
| AD-022: Audit is per-message and inline; the global runs list and per-run drawer are removed. | Keep both surfaces; remove the inline drawer and keep the global list; lazy-fetch the per-run detail. | XAI/observability value is preserved by the per-message drawer, which is a strict subset of what the global list offered for an active conversation. Inlining trace data avoids round-trips and keeps the audit shape canonical to the conversation payload. A future admin/governance view can rehydrate a global view without re-introducing the duplicated UI. |
| Run preservation on conversation delete. | Cascade delete; archive-only (forbid delete). | Soft preservation matches the project's "failures and history are first-class" stance. Cascade discards governance evidence; archive-only blocks UX cleanup. Derived `conversation_archived` flag is cheap and avoids a schema change. |
| Audit drawer placement. | Split-view; modal. | Right drawer matches the page's existing visual idiom (sidebar + contextual panels), is keyboard-dismissible, and does not impose split layout on small screens. |
| Legacy conversations default the next strategy selector to `standard`. | Inherit the last turn's strategy. | Default explicit beats implicit; long pre-F-12 conversations would surprise the user otherwise. |
| Mode/documentId immutable per conversation. | Allow per-turn mode switching with strategy reset. | Coherent narrative requires a stable subject. Mode is already an entity-level property; changing it mid-conversation breaks the F-09 source-card-focused-handoff invariant that focus is a conversation-defining act. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom? (Operators on
  `/query`: one execution surface instead of two; rerank reachable in
  chat; audit consolidated to per-message drawer.)
- [ ] What is explicitly out of scope? (Rerank/explore in focused mode;
  agentic loops; new telemetry; i18n; algorithm changes.)
- [ ] Which invariants must hold at all times? (See Invariants section,
  INV-01…INV-09.)
- [ ] What is the end-to-end flow, and which module owns each step? (See
  System Flow + Key Modules.)
- [ ] What external systems or prerequisite features does it depend on?
  (F-04/F-06/F-08/F-10; Cohere via F-08; Vercel AI SDK via F-10.)
- [ ] How will we know the feature is complete? (Acceptance Criteria
  1–14, all automatable.)
- [ ] Which decisions were deliberate, and what was rejected? (See
  Decisions table; AD-019…AD-022 also recorded in `STATE.md`.)
