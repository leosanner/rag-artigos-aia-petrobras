# F-05 Block 04 - Interface: API Audit Endpoints and Query Page

## Goal

Expose F-05 audit data through validated API contracts and a PT-BR `/query`
experience while keeping persistence, related-term extraction, and usage/cost
calculation in the application layer.

## Scope

**In scope:**

- Zod schema updates for the expanded `POST /api/rag/ask` success shape.
- `GET /api/rag/query-runs` and `GET /api/rag/query-runs/:id` route-handler
  behavior and wiring.
- Bearer authorization for audit reads using the same secret pattern already
  used by the ask route.
- PT-BR `/query` audit UI for the current answer plus persisted-run browsing.
- Handler and page tests.

**Out of scope:**

- Schema/repository implementation and application orchestration.
- New auth flows, new secrets, pagination/product search beyond recent runs.
- Conversations, focused retrieval, streaming, and agents.

## Business Rules

- RN-B04-01: `POST /api/rag/ask` keeps the F-04 request shape and expands only
  the success response with `traceId`, `relatedTerms`, and `audit`.
- RN-B04-02: Unauthorized or invalid ask requests remain unpersisted and return
  the same sanitized `401` or `400` response shapes as before.
- RN-B04-03: Safe generation failures remain limited to `502
  generation_failed` and `503 generation_unavailable`, without exposing trace
  storage internals.
- RN-B04-04: `GET /api/rag/query-runs` requires the same bearer secret pattern
  as `/api/rag/ask`; unauthorized reads return 401 before calling the
  application service.
- RN-B04-05: `GET /api/rag/query-runs/:id` requires the same bearer secret,
  validates the id as a UUID, returns 400 for invalid ids, and 404 when the run
  does not exist.
- RN-B04-06: All API response bodies are validated with Zod before
  serialization and remain free of secrets, raw prompts, stack traces, or raw
  provider payloads.
- RN-B04-07: `/query` copy remains PT-BR by default.
- RN-B04-08: `/query` renders the current-answer audit panel from the ask
  success payload itself and does not refetch that same run immediately after a
  successful ask.
- RN-B04-09: `/query` can request recent runs and inspect one persisted run
  detail on demand without rebuilding it from browser state.

## Functional Requirements

- [ ] RF-B04-01: `ragAskSuccessResponseSchema` extends the F-04 success shape
  with `traceId`, `relatedTerms`, and `audit`.
- [ ] RF-B04-02: Related-term response schemas cover `rank`, `term`,
  `ngramSize`, `frequency`, and `sourceCoverageCount`.
- [ ] RF-B04-03: Audit schemas cover latency plus embedding/generation
  usage/cost breakdown and total estimated cost.
- [ ] RF-B04-04: Error response schemas remain limited to sanitized
  `invalid_request`, `unauthorized`, `generation_failed`, and
  `generation_unavailable` shapes for the ask endpoint.
- [ ] RF-B04-05: `createRagAskHandler` returns the expanded success body on 200
  and preserves existing safe status mapping on 400, 401, 502, and 503.
- [ ] RF-B04-06: `GET /api/rag/query-runs` returns recent run summaries in
  reverse chronological order on 200 and returns 401 on missing or invalid
  bearer auth.
- [ ] RF-B04-07: `GET /api/rag/query-runs/:id` returns 200 with one run detail,
  400 for invalid ids, 401 for missing or invalid bearer auth, and 404 for
  missing runs.
- [ ] RF-B04-08: `/query` renders the current answer, current related terms,
  and current audit metrics immediately from the successful ask response.
- [ ] RF-B04-09: `/query` renders a recent-runs list and can load a persisted
  run detail view with its sources, related terms, usage, latency, and cost.
- [ ] RF-B04-10: `/query` continues to show safe PT-BR error messages and never
  renders raw provider or storage internals.

## Module Contracts

```ts
export type RagAskSuccessResponse = {
  traceId: string;
  answer: string;
  mode: "global";
  sources: RagSource[];
  relatedTerms: RelatedTerm[];
  metadata: RagAnswerMetadata;
  audit: RagAnswerAudit;
};
```

```ts
export type RagQueryRunSummaryResponse = {
  id: string;
  question: string;
  status: RagQueryRunStatus;
  topK: number;
  retrievalStrategy: "standard" | "explore";
  latencyMs: number;
  totalCostUsd: number;
  createdAt: string;
};

export type RagRunSourceResponse = RagSource & {
  citedInAnswer: boolean;
};

export type RagQueryRunDetailResponse = {
  id: string;
  question: string;
  answer: string | null;
  mode: "global";
  status: RagQueryRunStatus;
  errorCode: RagQueryRunErrorCode | null;
  sources: RagRunSourceResponse[];
  relatedTerms: RelatedTerm[];
  metadata: RagAnswerMetadata;
  audit: RagAnswerAudit;
  createdAt: string;
};
```

## Key Modules

- `src/application/rag/schemas.ts`
- `src/app/api/rag/ask/handler.ts`
- `src/app/api/rag/ask/route.ts`
- `src/app/api/rag/query-runs/handler.ts`
- `src/app/api/rag/query-runs/route.ts`
- `src/app/api/rag/query-runs/[id]/handler.ts`
- `src/app/api/rag/query-runs/[id]/route.ts`
- `src/app/query/page.tsx`
- `src/app/query/constants.ts`
- `src/app/query/page.test.tsx`

## Tests First

- `src/app/api/rag/ask/handler.test.ts`
- `src/app/api/rag/query-runs/handler.test.ts`
- `src/app/api/rag/query-runs/[id]/handler.test.ts`
- `src/app/query/page.test.tsx`

API tests must prove auth, validation, status mapping, and response-schema
coverage. Page tests must prove current-answer audit rendering, recent-run
loading, persisted-run inspection, and safe PT-BR error handling.

## Done When

- API and page tests pass.
- The ask route remains the single-turn write entrypoint, now with audit data
  attached on success.
- Audit history is inspectable through dedicated read endpoints and the shared
  `/query` page without leaking business logic into the UI layer.
