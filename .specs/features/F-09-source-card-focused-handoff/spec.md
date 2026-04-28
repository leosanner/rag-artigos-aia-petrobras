# F-09 - Source Card Focused Handoff

## Scope

**In scope:**
- Add a first-cut focused handoff from global-answer source cards on `/query`.
- Let the operator start a brand-new focused conversation from a cited article.
- Reuse the existing focused-mode toolbar, selectable-documents endpoint, and
  conversation transport without adding any new server API contract.
- Persist the focused draft in the `/query` URL with `conversation`, `mode`,
  and `documentId`.

**Out of scope:**
- Inline clickable citation markers such as `[1]` and `[2]`.
- Automatic submission of a follow-up question after the handoff.
- In-place conversion of the active transcript from global to focused mode.
- Changes to `POST /api/rag/ask`, `POST /api/rag/conversations/:id/messages`,
  or `GET /api/rag/documents`.

## Context

F-07 already delivers explicit focused mode on `/query`, but it still requires
the operator to switch modes and manually choose the target article. This
follow-up closes the last interaction gap for citation-driven exploration:
while reading a global answer, the operator can jump from a cited article into
the existing focused flow with one explicit action on the source card.

The first cut deliberately uses the numbered source cards as the only entry
point. Inline citation clicks remain deferred until the card-based handoff is
stable.

## Functional Requirements

- [x] RF-01: Only source cards explicitly marked as cited in a global answer
  expose the CTA `Conversar apenas sobre este artigo`.
- [x] RF-02: Focused source cards do not render that CTA.
- [x] RF-03: Clicking the CTA reuses `GET /api/rag/documents` to validate that
  the cited article is still selectable for focused RAG before any conversation
  is created.
- [x] RF-04: When the cited article is still selectable, `/query` creates a
  brand-new conversation, switches the toolbar to focused mode, preselects the
  article, preserves the current draft question and top-k value, and does not
  auto-submit a message.
- [x] RF-05: The handoff works from both existing `SourcesBlock` surfaces:
  conversation audit cards and persisted run detail cards.
- [x] RF-06: `/query` syncs the focused draft into the URL with
  `conversation=<uuid>&mode=focused&documentId=<uuid>` and restores that draft
  on reload when the operator secret is available.
- [x] RF-07: If the cited article is no longer selectable, the handoff aborts
  safely, creates no new conversation, and keeps the current conversation view
  intact.
- [x] RF-08: Unauthorized and technical failures during the handoff reuse the
  current safe `/query` error UX.

## System Flow

1. The operator reads a global answer on `/query`.
2. The operator opens the audit sources and clicks
   `Conversar apenas sobre este artigo` on one cited source card.
3. The page loads `GET /api/rag/documents` and confirms the cited
   `documentId` is still selectable.
4. If the document is selectable, the page creates a new empty conversation via
   `POST /api/rag/conversations`.
5. The toolbar switches to focused mode, preselects the cited article, and
   keeps the operator draft untouched for the next manual question.
6. The URL is updated with `conversation`, `mode`, and `documentId` so the
   focused draft survives refresh.

## Acceptance Notes

- Verified by `src/app/query/page.test.tsx`, including:
  cited-only CTA visibility, conversation-audit handoff, persisted-run handoff,
  URL restoration for populated and empty focused drafts, unavailable-document
  abort without clearing the current focused draft selection, and safe 401/500
  paths across both handoff steps.
