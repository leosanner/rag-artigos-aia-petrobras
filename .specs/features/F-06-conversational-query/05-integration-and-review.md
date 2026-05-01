# F-06 Block 05 - Integration and Review

## Goal

Close F-06 as an implemented vertical after Blocks 01-04 land: verify
deterministic context construction, transcript persistence, turn-engine
reuse, assistant-to-trace linkage, `/query` conversation behavior, doc sync,
and the required independent-review handoff.

## Scope

**In scope:**

- Final closeout of F-06 as an implemented vertical: domain helpers,
  conversation schema/repositories, conversation turn orchestration,
  conversations API, and `/query`.
- End-to-end verification using real Postgres for repository behavior and
  fake providers where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Parent `spec.md` sync plus block-doc sync if implementation details shift
  during Blocks 01-04.
- Project-doc updates only if the F-06 contract changes materially during
  implementation.
- Review-packet preparation for the required independent review workflow.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- F-07 focused retrieval, streaming transport, or agentic workflows.
- Any new ask input controls beyond the F-04 request contract.

## Applicable Parent Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | `/query` remains the single operator surface. | Verification proves no new route was introduced. |
| RN-05 | Each successful or no-evidence assistant reply persists exactly one `rag_query_runs` record and exposes its `traceId`. | Verification proves transcript assistant rows match one persisted trace each. |
| RN-06 | Technical generation failures persist the failed query run but do not create an assistant transcript row. | Verification proves the failure branch leaves the user row in place and creates no assistant row. |
| RN-10 | Reloading `/query?conversation=<id>` must restore the persisted transcript. | Verification reloads a real conversation end-to-end. |
| RN-11 | Single-turn `POST /api/rag/ask` remains supported. | Verification proves the single-turn flow still works in regression. |
| RN-12 | F-06 must not weaken citation validation, audit visibility, or safe error responses. | Verification checks the safe-error DTO and per-message audit expansion. |
| INV-01 | `/query` must remain the only operator surface. | Verified in the route inventory. |
| INV-02 | Every persisted assistant transcript row must reference exactly one persisted trace record. | Verified by a direct schema assertion. |
| INV-03 | Technical failures must not create fake assistant transcript rows. | Verified by injecting a technical failure and inspecting the transcript. |
| INV-04 | Retrieval context for chat is limited to the newest user message plus the previous four stored messages. | Verified against the domain context builder tests and an integration probe. |
| INV-05 | Conversation mode preserves the same citation validation and safe error behavior as single-turn mode. | Verified with a shared assertion against F-05 DTOs. |
| INV-06 | F-06 must not depend on any agents framework. | Verified via dependency inspection (no agents import). |

## Functional Requirements

- [ ] RF-B05-01: The parent `spec.md` remains the authoritative contract and
  reflects any refinements discovered during Blocks 01-04.
- [ ] RF-B05-02: End-to-end verification exercises: create conversation →
  append user message → assistant reply with trace → reload
  `/query?conversation=<id>` → inject technical failure on next turn and
  confirm no assistant row is created.
- [ ] RF-B05-03: Single-turn `/api/rag/ask` is exercised in regression to
  prove chat did not displace it.
- [ ] RF-B05-04: The acceptance-criteria checklist from `spec.md` §Acceptance
  Criteria is mapped 1-to-1 to verification evidence.
- [ ] RF-B05-05: `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- [ ] RF-B05-06: `.specs/project/STATE.md` is updated only if a new AD is
  introduced during implementation (for example, a specific index choice or
  context-label convention worth recording).
- [ ] RF-B05-07: `.specs/project/CHANGELOG.md` is updated when any F-06 spec
  content changes materially.
- [ ] RF-B05-08: The review packet contains the git diff, the F-06 `spec.md`,
  and Blocks 01-05; it is handed to a brand-new Codex reviewer thread with no
  implementation-conversation context.

## Rule Traceability

| Spec requirement | Owning block |
|---|---|
| RN-01, RN-09, RN-10, RN-11, RN-12, INV-01, INV-05 | Block 04 |
| RN-02, RN-05, RN-06, INV-02, INV-03 | Block 02 (schema) + Block 03 (orchestration) |
| RN-03 | Block 01 (title) + Block 03 (first-message assignment) |
| RN-04, RN-11 | Block 03 |
| RN-07, RN-08, INV-04 | Block 01 |
| INV-06 | Blocks 01-04 (no agents dependency in any layer) |

## Verification Steps

1. Database schema inspection confirms the two new tables and the
   assistant-requires-trace constraint.
2. Repository tests (`pnpm vitest run src/repositories/conversation-*.test.ts`)
   pass against real Postgres.
3. Application tests (`pnpm vitest run src/application/rag/*conversation*.test.ts`)
   pass with fake providers.
4. Route tests (`pnpm vitest run src/app/api/rag/conversations/**/*.test.ts`)
   and page test pass.
5. Manual smoke: create conversation through the UI, send two turns, reload
   with `?conversation=<id>`, expand audit panels, trigger a simulated
   technical failure and confirm transcript state.
6. `pnpm lint`, `pnpm typecheck`, `pnpm test` green.
7. Single-turn regression: run one `/api/rag/ask` and one
   `/api/rag/audit/runs/:id` request unchanged.

## Review Handoff

- Follow-up note after F-08: the shared runtime now knows how to instantiate a
  reranker, but the public conversation request contract still rejects
  `retrievalSettings.strategy = "rerank"` in
  `src/application/rag/schemas.ts`. Conversation rerank adoption therefore
  remains a separate spec-sync and verification task; F-06 closeout must not
  claim that rerank is available on `POST /api/rag/conversations/:id/messages`
  yet.
- Reviewer: Codex via `codex:rescue` on a brand-new thread (CLAUDE.md
  "Extremely important: every review must use a brand-new reviewer
  agent/thread").
- Review inputs: git diff, `spec.md`, Blocks 01-05, verification summary.
- Review inputs must NOT include the implementation conversation history.
- The F-06 status is marked "reviewed" only after the independent reviewer
  confirms it or the user explicitly waives that requirement.

## Done When

- All verification steps pass.
- Rule traceability table accounts for every `RN-*` and `INV-*` from
  `spec.md`.
- Review packet has been handed off in a new reviewer thread.
