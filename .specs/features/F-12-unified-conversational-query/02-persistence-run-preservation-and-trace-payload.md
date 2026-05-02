# F-12 Block 02 — Persistence: Run Preservation on Delete and Inline Trace Payload

## Goal

Guarantee at the persistence layer that (1) deleting a conversation never
deletes its `query_runs`, and (2) `GET /api/rag/conversations/:id` carries
the full trace data the per-message audit drawer needs without any
additional round-trip. No new tables, no new columns; the goal is to
review existing FK cascade rules and read projections, and tighten them if
they violate the F-12 invariants.

## Scope

**In scope:**

- Audit `src/db/schema.ts` for the FK relationship between `query_runs` and
  the `messages` / `conversations` tables. If the current schema cascades a
  conversation delete down to `query_runs`, replace the cascade with `SET
  NULL` (or equivalent leaving the run row intact) on the path that ties a
  run to its parent conversation.
- If a migration is needed, add a Drizzle migration under `drizzle/` that
  alters the FK without dropping data. Verify under
  `docker compose up -d` + `pnpm db:migrate`.
- Extend (or confirm) the conversation read repository so the payload
  returned by `GET /api/rag/conversations/:id` contains, for every assistant
  message, the trace fields the audit drawer renders: run metadata,
  audit (latency/tokens/cost), sources (with rerank score when applicable),
  related terms (when applicable), and rerank metadata.
- Add a derived projection helper `projectRunWithConversationStatus(run)`
  that surfaces `conversation_archived: boolean` based on whether the
  parent conversation row still exists. Used only by future
  governance/admin views; F-12 does not yet expose it in any UI.

**Out of scope:**

- Application orchestration, prompt assembly, stream events — Block 03.
- New schema fields. RN-09 specifies a **derived** flag, not a stored
  column.
- UI changes — Block 04.

## Applicable Parent Rules

| Rule | Statement | This block |
|------|-----------|------------|
| RN-08 | Runs are always children of an assistant message. | Confirmed by schema audit, no change needed. |
| RN-09 | Conversation delete does not cascade to runs. | FK cascade rule changed if needed. |
| RN-10 | Trace data is inline in the conversation read. | Read projection extended/confirmed. |
| INV-07 | Schema explicitly forbids cascade-delete of runs. | Encoded in FK definition + integration test. |
| INV-08 | Audit drawer never fetches a per-run endpoint. | Read projection completeness is the contract. |

## State at start of block

FK audit on `src/db/schema.ts` (commit `d9a3f22`):

- `rag_conversation_messages.conversation_id → rag_conversations.id`
  uses `ON DELETE CASCADE`. Deleting a conversation removes its
  messages — expected.
- `rag_conversation_messages.trace_id → rag_query_runs.id` has **no**
  `ON DELETE` clause (Postgres default `NO ACTION`). The reference is
  one-way *message → run*; `rag_query_runs` has no FK back into
  conversations or messages.
- Conclusion: deleting a conversation cascades only to messages —
  `rag_query_runs` rows are preserved by construction. **INV-07 is
  already satisfied; no migration is required for this block.**
- Other FKs touching runs were also audited and are consistent with
  the spec: `rag_query_run_sources.run_id` and
  `rag_query_run_related_terms.run_id` cascade with the parent run
  (intentional — child rows belong to the run); `rag_query_runs.document_id`
  uses `ON DELETE SET NULL` (orphans the run from a deleted document
  without losing audit data).
- Read projection: `ConversationRepository.getDetail` already calls
  `RagQueryRunsRepository.getById` per assistant message and returns
  `sources`, `relatedTerms`, `metadata`, and `audit` (including
  `reranking`) inline — RN-10 / INV-08 already satisfied at the
  application layer. Block 02 adds the integration test that pins the
  contract.

## Tasks (TDD-first)

1. ~~Inspect current `query_runs` FK definitions~~ — done above. No
   migration needed; tasks 3 collapses to "no-op" for this block.
2. Write integration test
   `src/app/api/rag/conversation-delete-preserves-runs.integration.test.ts`
   asserting: insert conversation + message + run; delete conversation;
   run row still exists; orphan-status helper returns
   `conversation_archived: true`.
3. Adjust FK rules / write migration if the test fails.
4. Write integration test
   `src/app/api/rag/conversation-read-trace-completeness.integration.test.ts`
   asserting: for a conversation with one `standard`, one `explore`, and
   one `rerank` assistant message, the response from
   `GET /api/rag/conversations/:id` contains every trace field the audit
   drawer needs (sources, audit cost/latency, rerank metadata, related
   terms — each on the right message).
5. Adjust the read projection if needed.

## Acceptance

- New integration tests pass under `pnpm test` against a real Postgres
  (`docker compose up -d` + `pnpm db:migrate`).
- `pnpm db:generate` clean (no schema drift if no change was needed).
- `pnpm typecheck` clean.

## Out of band

If the FK audit reveals other unexpected cascade paths (e.g., source rows
cascading independently), surface them before changing scope.
