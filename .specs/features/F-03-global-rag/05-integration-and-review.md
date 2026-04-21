# F-03 Block 05 - Integration and Review

## Goal

Close F-03 as an implemented vertical after Blocks 01-04 land: verify active-
config retrieval, citation validation, safe failure mapping, API/UI behavior,
spec sync, changelog sync, and the required independent-review handoff.

## Scope

**In scope:**

- Final closeout of F-03 as an implemented vertical: retrieval, query
  embedding, generation, ask route, and `/consulta`.
- End-to-end verification using real Postgres for retrieval and fake providers
  where business-logic proof is enough.
- Final verification using `pnpm lint`, `pnpm typecheck`, `pnpm test`, and a
  build with non-empty `OPENAI_API_KEY` plus non-empty
  `RAG_GENERATION_MODEL`.
- Parent `spec.md` sync plus block-doc sync if implementation details shift
  during Blocks 01-04.
- `.specs/project/CHANGELOG.md` update for the closeout/spec-sync work.
- Review-packet preparation for the required independent review workflow.

**Out of scope:**

- New product behavior beyond what Blocks 01-04 already implement.
- Focused retrieval, document selector UI, or `GET /api/rag/documents`; those
  remain F-04.
- M3 observability, answer persistence, streaming, and agents.

## Business Rules

- RN-B05-01: Block 05 uses the implemented code and tests as the source of
  truth for F-03. It does not add new product behavior.
- RN-B05-02: Verification must explicitly prove retrieval uses only the active
  indexing configuration and never reads `documents.raw_text`.
- RN-B05-03: Verification must explicitly prove invalid or citation-less
  generated output fails safely with `generation_failed`.
- RN-B05-04: Verification must explicitly prove technical provider failures map
  to sanitized `502` or `503` responses with no `sources`.
- RN-B05-05: The closeout must record the build prerequisites: non-empty
  `OPENAI_API_KEY` and non-empty `RAG_GENERATION_MODEL`.
- RN-B05-06: The independent reviewer must receive a fresh thread with only the
  current diff, the F-03 docs, and the verification summary, not the
  implementation conversation history.

## Functional Requirements

- [ ] RF-B05-01: Integration and repository tests prove global retrieval uses
  top-k `6`, active-config filtering, descending scores, and no `raw_text`
  access.
- [ ] RF-B05-02: Application tests prove the no-chunk path returns the
  Portuguese insufficient-evidence answer without calling generation.
- [ ] RF-B05-03: Application or route tests prove missing, malformed, or
  out-of-range citation markers fail with `generation_failed`.
- [ ] RF-B05-04: Route and UI tests prove `generation_failed` maps to `502`,
  `generation_unavailable` maps to `503`, and technical error bodies contain no
  `sources`.
- [ ] RF-B05-05: UI tests prove `/consulta` renders answers plus numbered
  sources and only truncates excerpts visually.
- [ ] RF-B05-06: The parent `spec.md` and all F-03 block docs are synced to the
  implemented behavior before the feature is considered complete.
- [ ] RF-B05-07: `.specs/project/CHANGELOG.md` records the F-03 closeout and
  spec-sync work.
- [ ] RF-B05-08: The closeout records the exact verification commands and any
  environment-specific caveats discovered during final checks.
- [ ] RF-B05-09: The review handoff defines a reviewer prompt focused on
  active-config retrieval, citation validation, safe provider failures, no
  `raw_text` access, and no F-04 leakage.

## Verification Plan

### Prerequisites

- Local Postgres must be running on `127.0.0.1:5432`.
- Non-test builds require a non-empty `OPENAI_API_KEY`.
- Non-test builds require a non-empty `RAG_GENERATION_MODEL`.

### Commands To Run During Closeout

```bash
pnpm lint
pnpm typecheck
pnpm test
OPENAI_API_KEY=test-openai-api-key RAG_GENERATION_MODEL=test-model pnpm build
```

## Reviewer Handoff Packet

Provide the reviewer with:

- The current git diff for F-03.
- `.specs/features/F-03-global-rag/spec.md`
- `.specs/features/F-03-global-rag/01-domain-context-citations-and-answer-rules.md`
- `.specs/features/F-03-global-rag/02-persistence-global-retrieval.md`
- `.specs/features/F-03-global-rag/03-application-retrieval-and-generation.md`
- `.specs/features/F-03-global-rag/04-interface-api-and-page.md`
- `.specs/features/F-03-global-rag/05-integration-and-review.md`
- A short verification summary listing the exact commands run and their results.

Suggested reviewer prompt:

> Review the current F-03 / Global RAG implementation against the attached git
> diff plus `spec.md` and blocks 01-05 only. Prioritize invariant compliance
> for active-config retrieval, no `raw_text` access, citation validation,
> sanitized `502`/`503` failures, and whether any F-04-focused scope leaked
> into F-03. Flag any mismatch between the implementation and the synced docs.
