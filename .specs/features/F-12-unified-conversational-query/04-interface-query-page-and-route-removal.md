# F-12 Block 04 — Interface: `/query` Page Rewrite, Audit Drawer, Route Removal

## Goal

Restructure the `/query` page into a single conversational surface; add the
strategy selector, the "Avançado" disclosure, the per-message audit drawer;
delete `POST /api/rag/ask` and its associated UI/state; remove the global
runs index and per-run drawer from the page.

## Scope

**In scope:**

- Rewrite `src/app/query/page.tsx` to remove all single-turn state and UI:
  `singleTurnAskState`, `singleTurnResultState`, `singleTurnQuestion`,
  `singleTurnTopK`, `submitSingleTurnQuestion`, the `<section
  aria-labelledby="single-turn-query-title">` block, and any helper or
  effect tied exclusively to the single-turn flow.
- Add a strategy selector to the chat composer:
  - In `global` mode, options `standard | explore | rerank`.
  - In `focused` mode, only `standard` (other options hidden, not just
    disabled, to avoid mode-switch ghost selections).
  - An "i" icon adjacent to the selector opens an accessible tooltip with
    one short PT-BR sentence per strategy. Copy lives in
    `src/app/query/constants.ts`.
- Add an "Avançado" collapsible disclosure to the composer with:
  - `topK` numeric input/select (always visible inside the disclosure),
    default `6`, range `3..12` (reusing existing F-04 bounds).
  - `candidateTopK` numeric input (visible only when strategy =
    `rerank`), default `24`.
  - Disclosure open/closed state and override values are React state on
    the page; not persisted to URL, sessionStorage, or the server. Reset
    on remount.
- Add a per-assistant-message "Ver auditoria" action that opens a
  right-side drawer rendering the trace embedded in the conversation
  payload (sources, audit, related terms, rerank metadata). Drawer
  dismissible via close button, ESC, and outside click.
- Remove from the page: the runs history list (`/api/rag/runs` UI fetch
  and render), the run-detail drawer (`runDetailState`), and any URL
  params or buttons that opened them.
- Update `src/app/query/constants.ts`: prune copy strings exclusive to the
  single-turn panel; add strategy tooltip copy (PT-BR) and the audit
  drawer labels.
- Update `src/app/query/page.module.css`: remove single-turn-only classes;
  add drawer styling (or import an existing primitive) and tooltip
  styling.
- Delete `src/app/api/rag/ask/route.ts` (and its directory) and the
  associated route test files. Remove `ragAskSuccessResponseSchema`,
  `ragAskRequestSchema`, and any siblings exclusive to that endpoint
  from `src/application/rag/schemas.ts`. Keep schemas referenced by the
  conversation flow.
- Map rerank phase stream events (Block 03) to PT-BR status copy in the
  composer/transcript area: "Recuperando candidatos…", "Reordenando com
  Cohere…" (or generic "Reordenando candidatos…" when provider is
  abstracted), "Gerando resposta…".

**Out of scope:**

- Domain rules (Block 01), persistence (Block 02), schema/orchestrator
  changes (Block 03).
- Any change to `/api/rag/conversations*` route handlers beyond what
  Block 03 defines.
- Re-introducing a global runs view in any form.

## Applicable Parent Rules

| Rule | Statement | This block |
|------|-----------|------------|
| RN-01 | One execution surface on `/query`. | Single-turn UI deleted. |
| RF-01..RF-12 | All UI-facing functional requirements. | Implemented here. |
| INV-01 | No single-turn UI in any state. | Enforced by deletion. |
| INV-08 | Audit drawer never fetches a per-run endpoint. | Drawer reads inline trace. |
| INV-09 | UI in PT-BR; code in EN. | Copy in PT-BR; identifiers in EN. |

## Tasks (TDD-first)

1. Update `src/app/query/page.test.tsx`:
   - Delete tests covering the single-turn panel.
   - Add tests for: (a) strategy selector visibility per mode, (b)
     "Avançado" disclosure toggle and override behavior, (c)
     `candidateTopK` only visible for `rerank`, (d) "Ver auditoria"
     drawer open/close, (e) related-terms rendering for an explore turn,
     (f) rerank phase status copy during a rerank turn (mocked stream),
     (g) backwards-compat fixture: a pre-F-12 conversation loads and the
     next-turn selector defaults to `standard`.
2. Implement the page rewrite to make tests pass.
3. Delete `src/app/api/rag/ask` directory and its tests; verify
   `pnpm test` doesn't reference removed schemas.
4. Add an integration test asserting `POST /api/rag/ask` returns 404
   (Next.js routing).
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally.

## Acceptance

- All page tests pass; no test references single-turn ask state or global
  runs UI.
- Manual smoke (browser): create global conversation, run one turn per
  strategy, open "Ver auditoria" on the rerank turn, verify all trace
  fields render, switch to focused mode (new conversation), verify only
  `standard` is selectable.
- `pnpm build` succeeds with no unresolved imports.

## Out of band

If a drawer primitive does not yet exist in the codebase, build it as a
local component under `src/app/query/components/` rather than adding a
package dependency. Keep it minimal — overlay div + close button + focus
trap.
