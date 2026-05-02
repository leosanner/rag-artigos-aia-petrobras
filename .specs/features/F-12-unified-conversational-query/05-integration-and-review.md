# F-12 Block 05 — Integration and Review

## Goal

Prove the F-12 contract end-to-end across the four implementation blocks,
confirm backwards compatibility with pre-F-12 data, run an independent
review through Codex per `CLAUDE.md`, and close the feature.

## Scope

**In scope:**

- An end-to-end integration test sequence covering one conversation that
  exercises (in order): `standard` turn → `explore` turn → `rerank` turn
  → follow-up `standard` turn. Asserts that the follow-up does not see the
  explore turn in its prompt history (Block 01 + 03), that all three
  trace shapes are inline in `GET /api/rag/conversations/:id` (Block 02),
  and that the audit drawer renders each (Block 04).
- A backwards-compat integration test: seed a conversation with the
  pre-F-12 fixture (no rerank trace fields, no related-terms artifact),
  assert it loads through the page without runtime error, the next-turn
  selector defaults to `standard`, and submitting any new strategy works.
- A focused-mode rejection integration test: create a focused conversation,
  POST a turn with `strategy = "rerank"` and one with
  `strategy = "explore"`, assert both return the typed `invalid_request`
  shape.
- A run-preservation integration test: create conversation + 3 turns,
  delete the conversation, assert all three `query_runs` rows still exist
  and the projection helper from Block 02 marks them
  `conversation_archived: true`.
- Mark every functional requirement (RF-01..RF-13) checked in
  `spec.md` as the corresponding test passes.
- Hand the diff + the F-12 spec.md + the four block docs to a
  fresh `codex:rescue` thread for independent review per `CLAUDE.md`.
  The reviewer must use a brand-new agent thread with no implementation
  context.

**Out of scope:**

- New features beyond the F-12 contract.
- Re-running F-08 / F-10 reviews (those are tracked separately).

## Applicable Parent Rules

| Rule | Statement | This block |
|------|-----------|------------|
| All RFs / RNs / INVs | Spec contract. | Verified end-to-end. |
| AD-007 | Spec-first workflow with independent review. | Codex review run. |

## Tasks

1. Add the four integration tests above under
   `src/app/api/rag/`.
2. Tick functional requirements in `spec.md` as their tests land.
3. Update `.specs/project/STATE.md` `Last Updated` and `Current Work` to
   reflect the F-12 closeout once the review confirms.
4. Add a closeout entry to `.specs/project/CHANGELOG.md` summarizing the
   landed code (separate from the docs-only entry already there).
5. Trigger Codex review with the F-12 spec + the four block docs + the git
   diff. Wait for the review report. Address any blocking findings. Do
   not mark F-12 reviewed until the fresh reviewer confirms.
6. Update `Recent Decisions` in `STATE.md` with a new AD if the review
   forces a non-trivial divergence from the spec.

## Acceptance

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass on the
  F-12 branch.
- All RF checkboxes in `spec.md` are checked.
- Codex review report exists and any blocking findings are resolved or
  explicitly waived by the user.
- `STATE.md` and `CHANGELOG.md` carry the closeout entry.

## Out of band

If Codex review surfaces a finding that requires reopening one of the
prior blocks, do **not** edit this block's acceptance criteria to make the
finding go away. Reopen the block, address the finding, and return here.
