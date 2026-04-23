# F-04 - Query Controls and Explore

## Scope

**In scope:**
- Extend `POST /api/rag/ask` with optional retrieval controls:
  `retrieval?: { topK?: number; strategy?: "standard" | "explore" }`.
- Keep omitted retrieval settings backward-compatible with the F-03 default:
  top-k `6` and strategy `"standard"`.
- Allow the operator to adjust `topK` inside the inclusive range `3..12`.
- Add an explicit explore action on `/query` for broad questions.
- Implement explore-mode retrieval with `candidateTopK = min(24, topK * 3)`
  followed by deterministic diversified downselection.
- Add prompt behavior for explore mode so the answer returns `2..4` cited
  perspectives in a single response.
- Return the applied retrieval settings in success metadata.
- Add tests for validation, backward compatibility, diversified selection, and
  `/query` control states.

**Out of scope:**
- Persisting traces, tokens, costs, latency, or related terms; those belong to
  F-05.
- Conversations, message history, streaming, or transcript management; those
  belong to F-06.
- Focused single-document retrieval and document selectors; that remains F-07.
- Automatic detection of broad questions without an explicit user action.
- Reranking with a second model, learned diversification, or agentic planning.

## Context & Motivation

F-03 gives the operator a baseline global RAG page, but it keeps retrieval
behavior fixed at top-k `6` and has no deliberate path for broad exploratory
questions. The user wants more control over the global query experience before
the project invests in focused retrieval.

This feature is the first contract under
`.specs/project/query-experience-evolution.md`. It keeps the same route and the
same base RAG flow, but makes retrieval behavior operator-tunable and adds an
explicit explore mode for questions whose best answer is more varied than a
single narrow synthesis.

## Implementation Blocks

The feature should be implemented in the same small-block style used by F-01,
F-02, and F-03. Read this overview first, then open only the block document
needed for the current task:

- [01 - Domain: Retrieval Settings and Diversification](01-domain-retrieval-settings-and-diversification.md):
  pure logic for retrieval-setting normalization helpers, candidate-top-k
  calculation, and deterministic diversified downselection for explore mode.
- [02 - Persistence: Strategy-Aware Retrieval](02-persistence-strategy-aware-retrieval.md):
  repository/query behavior for standard and explore candidate fetches using
  the active indexing configuration.
- [03 - Application: Retrieval Controls and Prompting](03-application-retrieval-controls-and-prompting.md):
  `AnswerQuestion`, strategy-aware retrieval orchestration, metadata assembly,
  and prompt branching for standard versus explore generation.
- [04 - Interface: API and Query Page](04-interface-api-and-query-page.md):
  Zod request/response updates, `POST /api/rag/ask` handler behavior, and the
  PT-BR `/query` controls for top-k plus explicit explore reruns.
- [05 - Integration and Review](05-integration-and-review.md):
  end-to-end verification, doc sync, closeout checks, and the required
  independent-review handoff packet.

## Business Rules

- RN-01: `POST /api/rag/ask` accepts an optional `retrieval` object only in the
  shape `{ topK?: number; strategy?: "standard" | "explore" }`.
- RN-02: Omitting `retrieval` is equivalent to
  `{ topK: 6, strategy: "standard" }`.
- RN-03: `topK` must be an integer in the inclusive range `3..12`.
- RN-04: `strategy` defaults to `"standard"`.
- RN-05: `"standard"` preserves the F-03 retrieval-selection behavior except
  for reporting the applied retrieval settings in the response metadata.
- RN-06: `"explore"` is operator-driven and must never be activated by a hidden
  classifier or prompt heuristic.
- RN-07: Explore mode computes `candidateTopK = min(24, topK * 3)`.
- RN-08: Explore mode first retrieves `candidateTopK` candidates ordered by
  descending score, then diversifies the selected context deterministically.
- RN-09: Diversification must enforce a cap of two chunks per document while
  other documents still have unselected candidates; if that cap would leave the
  final context shorter than `topK`, the remaining highest-scoring candidates
  may fill the rest of the selection.
- RN-10: Explore-mode generation must ask for `2..4` cited perspectives or
  answer facets in one response rather than one narrow synthesis.
- RN-11: Explore mode must keep the same citation validation rules and safe
  error behavior already defined by F-03.
- RN-12: F-04 does not persist traces or add chat behavior.

## Functional Requirements

- [ ] RF-01: `ragAskRequestSchema` accepts the new optional `retrieval` object
  and rejects unknown retrieval fields.
- [ ] RF-02: Invalid `topK` values outside `3..12` return
  `{ error: "invalid_request" }`.
- [ ] RF-03: The application layer normalizes omitted retrieval settings to
  `{ topK: 6, strategy: "standard" }`.
- [ ] RF-04: Standard mode retrieves exactly `topK` chunks from the active
  indexing configuration and does not run the diversification step.
- [ ] RF-05: Explore mode retrieves `candidateTopK = min(24, topK * 3)`
  candidates before downselection.
- [ ] RF-06: Explore-mode downselection is deterministic and caps selection at
  two chunks per document while alternative documents remain available.
- [ ] RF-07: Success metadata includes the applied `topK`, applied `strategy`,
  and `candidateTopK`.
- [ ] RF-08: The generation provider receives a prompt variant that requests
  `2..4` cited perspectives when `strategy = "explore"`.
- [ ] RF-09: `/query` exposes a PT-BR control for `topK`.
- [ ] RF-10: `/query` exposes an explicit PT-BR explore action distinct from
  the default standard submission path.
- [ ] RF-11: The operator can rerun the same question in explore mode without
  retyping the secret.
- [ ] RF-12: Existing clients that send only `{ question, mode: "global" }`
  continue to work and receive the same default retrieval behavior.
- [ ] RF-13: F-04 response bodies remain free of secrets, stack traces, raw
  prompts, and provider internals.

## System Flow

1. The operator opens `/query`.
2. The page renders the existing global question flow plus controls for `topK`
   and an explicit explore action.
3. In standard mode, the page sends
   `{ question, mode: "global", retrieval: { topK, strategy: "standard" } }`.
4. In explore mode, the page sends
   `{ question, mode: "global", retrieval: { topK, strategy: "explore" } }`.
5. The route validates the request body, normalizes omitted retrieval settings,
   and delegates to the application service.
6. The retrieval service embeds the question using the active embedding-model
   contract already defined by F-02/F-03.
7. If the strategy is `"standard"`, the repository searches top-k directly.
8. If the strategy is `"explore"`, the repository searches
   `candidateTopK = min(24, topK * 3)` candidates.
9. Explore mode applies deterministic diversified downselection to the
   candidate list until `topK` matches remain.
10. The context assembler preserves source numbering after the final selection.
11. The generation provider receives the selected context plus the strategy so
    the prompt can request either a standard synthesis or `2..4` perspectives.
12. Citation validation runs exactly as in F-03.
13. On success, the API returns the answer, sources, and metadata with the
    applied retrieval settings.
14. `/query` renders the answer and sources while keeping the operator controls
    available for a rerun.

## Invariants / Non-negotiables

- INV-01: F-04 must never retrieve from `documents.raw_text`.
- INV-02: F-04 must never activate explore mode automatically.
- INV-03: F-04 must never request more than `24` retrieval candidates.
- INV-04: Standard mode must preserve F-03 default behavior when `retrieval` is
  omitted.
- INV-05: Explore mode must not weaken citation validation or safe error
  handling.
- INV-06: F-04 must not add persistence, observability tables, or chat state.
- INV-07: F-04 must not depend on any agents framework.

## Technical Design

### Entities / Models

| Model | Key fields | Notes |
|-------|------------|-------|
| `RagRetrievalSettings` | `topK`, `strategy` | Optional request-level retrieval controls; defaults applied in the application layer. |
| `GlobalRagAskRequest` | `question`, `mode`, optional `retrieval` | Extends the F-03 ask request without changing the route. |
| `RagAnswerMetadata` | `mode`, `topK`, `retrievalStrategy`, `candidateTopK`, `promptVersion`, `generationModel`, `embeddingModel` | Stable success metadata for the current answer. |
| `RetrievedChunkMatch` | existing retrieval fields plus score | Explore mode reuses the same repository DTO before diversification. |

### Endpoints / Interfaces (if applicable)

| Method | Route / Signature | Description |
|--------|-------------------|-------------|
| `GET` | `/query` | Global RAG page with retrieval controls and an explicit explore action. |
| `POST` | `/api/rag/ask` | Accepts the optional `retrieval` object and returns the applied retrieval settings in success metadata. |
| Function | `AnswerQuestion.execute(input)` | Normalizes retrieval settings and selects the standard or explore path. |
| Function | `RetrieveChunks.search(input)` | Accepts the question plus normalized retrieval settings. |
| Function | `selectDiversifiedMatches(input)` | Deterministic explore-mode downselection helper. |

### Key Modules

- `src/application/rag/schemas.ts` - request/response schema updates for
  retrieval controls.
- `src/application/rag/answer-question.ts` - retrieval-setting normalization
  and strategy-aware orchestration.
- `src/application/rag/retrieve-chunks.ts` - strategy-aware retrieval input and
  candidate fetch behavior.
- `src/domain/rag/*` - deterministic explore-mode diversification helper and
  any prompt-selection helpers.
- `src/app/api/rag/ask/*` - handler validation and response-shape updates.
- `src/app/query/page.tsx` - PT-BR retrieval controls and explicit explore UI.

## Dependencies

- **Prerequisite features:** F-02 Chunking and Embeddings; F-03 Global RAG.
- **External packages added:** None.
- **External services:** Postgres/pgvector, OpenAI API through the existing
  F-03 provider boundary.
- **Environment variables:** Same as F-03: `OPENAI_API_KEY`,
  `RAG_EMBEDDING_MODEL`, and `RAG_GENERATION_MODEL`.

## Acceptance Criteria

1. `POST /api/rag/ask` still accepts `{ question, mode: "global" }` and
   applies `topK = 6`, `strategy = "standard"` by default.
2. `POST /api/rag/ask` rejects `topK < 3`, `topK > 12`, non-integer `topK`, or
   unknown retrieval fields with `{ error: "invalid_request" }`.
3. Standard mode retrieves exactly the requested `topK` chunks and preserves
   the F-03 retrieval-selection behavior.
4. Explore mode retrieves `candidateTopK = min(24, topK * 3)` candidates before
   deterministic diversification.
5. Explore-mode diversification returns at most two chunks per document while
   alternative documents remain available.
6. Explore-mode answers contain `2..4` cited perspectives in one response.
7. `/query` lets the operator adjust `topK`, run a standard query, and rerun
   the same question via an explicit explore action.
8. Success responses include applied retrieval metadata and no secrets, raw
   prompts, stack traces, or provider internals.
9. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after implementation.

## Decisions

| Decision | Alternatives considered | Rationale |
|----------|-------------------------|-----------|
| Keep one `POST /api/rag/ask` route and add optional `retrieval` settings | Create a separate explore endpoint; store controls only in the UI | One route keeps the contract stable and lets later features reuse the same turn surface. |
| Make explore mode explicit | Hidden broad-question detection; prompt-only instructions | The operator should know when the system is trading narrow precision for variety. |
| Use `candidateTopK = min(24, topK * 3)` | Fixed candidate count; unbounded candidate retrieval | The formula scales with operator intent while keeping pgvector and prompt costs bounded. |
| Deterministic rule-based diversification | LLM-based reranking; stochastic sampling | The feature needs an auditable and testable selection path. |

## Reviewer Checklist

- [ ] What problem does this feature solve, and for whom?
- [ ] What is explicitly out of scope?
- [ ] Which invariants must hold at all times?
- [ ] What is the end-to-end flow, and which module owns each step?
- [ ] What external systems or prerequisite features does it depend on?
- [ ] How will we know the feature is complete?
- [ ] Which decisions were deliberate, and what was rejected?
