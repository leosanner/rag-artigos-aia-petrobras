# F-11 Block 05 — Integration and Review

## Goal

Close F-11 as an implemented vertical after Blocks 01–04 land: prove the
agentic path works end to end against a real database, prove every
preserved contract from F-05 / F-06 / F-08 / F-10 still holds, sync
project documentation, and prepare the fresh-reviewer handoff required
by the repo workflow.

## Scope

**In scope:**

- End-to-end verification of the agentic conversation turn using a real
  Postgres for governance/audit and faked LLM/tool boundaries where
  business-logic proof is sufficient.
- Final regression of `pnpm lint`, `pnpm typecheck`, `pnpm test`, and a
  manual `pnpm dev` walkthrough on `/query`.
- `spec.md` and Block-doc sync if implementation diverged from the
  contract during Blocks 01–04.
- Project-doc updates required by the new contract:
  - `.specs/project/STATE.md`: append AD-### entry recording the Mastra
    adoption decision (runtime only; no working memory; no
    `PostgresStore`), and add a new “Todos” line for any deferred
    sub-decision.
  - `.specs/project/ROADMAP.md`: insert F-11 in the M3/M4 bridge with
    its status.
  - `.specs/project/CHANGELOG.md`: entry for F-11.
  - `CLAUDE.md`: short note that Mastra is used only as agent runtime,
    not as governance store, and that any new agent code must go behind
    `RagAgentRuntime`.
- Review-packet preparation for the fresh-reviewer handoff:
  - Diff scoped to F-11 changes.
  - Bundle: `spec.md`, Blocks 01..05, AD-### excerpt, list of files
    touched.
  - Handoff to `codex:rescue` (per CLAUDE.md “Review” step).

**Out of scope:**

- New product behavior beyond what Blocks 01–04 already implement.
- Streaming on `POST /api/rag/ask`.
- M4 piloting of an actual non-RAG agent task. F-11 only proves the
  framework boundary on conversational RAG; the M4 pilot agent remains
  PLANNED in `ROADMAP.md`.

## Verification Walkthrough

Run on a clean checkout with the F-11 branch.

1. `pnpm install` — confirms Mastra dependencies resolve.
2. `pnpm db:generate && pnpm db:migrate` — applies the new migration.
   Inspect `psql` to confirm schema:
   - `\d rag_query_runs` shows `execution_mode`, `agent_steps`,
     `agent_stopped_reason`.
   - `\d rag_query_run_tool_calls` matches Block 02’s sketch.
3. `pnpm test` — all unit and integration tests pass.
4. `pnpm typecheck && pnpm lint`.
5. `pnpm dev`. Open `/query` and run the four cases below against a
   single conversation thread:
   - **Case A — substantive RAG:** “What do the articles say about
     random forests applied to EIA?” → SSE order matches RN-11 of
     `spec.md`; sidebar shows recovered sources; `rag_query_runs.execution_mode = 'agentic'`,
     ≥ 1 row in `rag_query_run_tool_calls` with
     `tool_name = 'search_corpus'`; assistant message has citations
     resolving against returned matches.
   - **Case B — meta-conversational (regression of the reported bug):**
     immediately after Case A, ask “What was my first question?” → no
     `tool_call` events, no `source` events, assistant answers from
     transcript with empty citations; trace has
     `agent_steps = 1`, `agent_stopped_reason = 'finished'`, zero
     `rag_query_run_tool_calls` rows.
   - **Case C — focused tool:** “In the article ‘Deep Learning for Land
     Cover Mapping’, what metric is used?” → trace contains
     `tool_name = 'search_document'`. A follow-up using a wrong
     `documentId` (forced via prompt phrasing) produces a
     `tool_result` with `ok: false`, the agent recovers, and the turn
     still ends with a valid assistant message.
   - **Case D — max steps:** prompt designed to force three tool
     calls. Verify `rag_query_runs.agent_stopped_reason = 'max_steps'`
     and the assistant message’s citations are limited to recovered
     chunks. Confirm the forced final step produced text.
6. Confirm `POST /api/rag/ask` (separate cURL call) still returns the
   pre-F-11 JSON shape, writes `execution_mode = 'single_shot'`, and
   produces zero `rag_query_run_tool_calls` rows.

## Doc Sync Checklist

- [ ] `spec.md` matches the implementation. Adjust if scope shifted.
- [ ] Each Block 01..04 doc reflects the final file paths and
      acceptance evidence.
- [ ] AD-### added to `.specs/project/STATE.md` with: decision,
      alternatives rejected, rationale, scope (runtime only), and a
      pointer to this feature folder.
- [ ] `ROADMAP.md` updated.
- [ ] `CHANGELOG.md` updated.
- [ ] `CLAUDE.md` updated with the Mastra boundary note.
- [ ] All checkboxes in `spec.md` Functional Requirements are ticked.

## Independent-Reviewer Handoff

Per the workflow in `CLAUDE.md` (“Review” step), F-11 must be reviewed
by a fresh agent that has no implementation context. Bundle for the
reviewer:

- Git diff for the F-11 branch (full, not summarized).
- `.specs/features/F-11-agentic-conversational-rag/spec.md` and Blocks
  01..05.
- The new AD-### excerpt from `STATE.md`.
- The four verification cases above (A–D), so the reviewer can
  reproduce them.

The reviewer’s required checks:

1. No Mastra import outside `src/infrastructure/ai/`.
2. INV-02 (1 trace ↔ 1 assistant message) preserved.
3. INV-04 (zero-tool turn ⇒ no citations / no sources) preserved.
4. INV-05 (governed `question` is the raw user message, never an agent
   rewrite) preserved.
5. INV-06 (`/api/rag/ask` byte-compatible) preserved.
6. Citation validator runs against the union of `tool_result` matches.
7. Migration is purely additive; no F-05/F-06/F-08/F-10 column was
   altered.

Mark F-11 as “reviewed” only after this independent reviewer signs off,
or after an explicit user waiver, per the CLAUDE.md rule.

## Exit Criteria

- All `spec.md` Functional Requirements checked.
- All Acceptance Criteria from Blocks 01–04 met.
- Doc sync checklist above complete.
- Independent reviewer signed off (or user waived).
- Conventional Commit messages, CI green, branch ready for merge.
