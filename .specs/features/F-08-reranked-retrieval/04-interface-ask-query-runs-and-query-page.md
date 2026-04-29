# F-08 Block 04 - Interface: Ask, Query Runs, and Query Page

## Goal

Expose the rerank contract through validated API DTOs and the shared PT-BR
`/query` page while keeping rerank orchestration, persistence, and provider
details below the interface boundary.

## Scope

**In scope:**

- Zod request and response updates for `POST /api/rag/ask`.
- `GET /api/rag/query-runs` and `GET /api/rag/query-runs/:id` DTO updates for
  rerank-aware metadata, audit, and source score evidence.
- Ask-handler safe status mapping for rerank failures.
- The global single-turn rerank control and rerank audit rendering on the
  shared `/query` shell.
- Handler and page tests.

**Out of scope:**

- Conversation-route request bodies or response DTOs.
- SSE event payloads on `POST /api/rag/conversations/:id/messages`.
- Focused-mode selector behavior or focused rerank verification.
- Concrete reranker adapter wiring, new secrets, or any new operator route.

## Business Rules

| Rule | Statement | This block |
|---|---|---|
| RN-01 | The shared retrieval request shape accepts `strategy: "rerank"`. | Extends the ask request Zod schema and DTO typing. |
| RN-08 | The final reranked selection preserves chunk identity and size rules. | Success DTOs expose the reranked source list exactly as persisted by the application. |
| RN-11 | Successful reranked answers and persisted runs expose reranker metadata and reranking audit data. | Extends success and run-detail response schemas. |
| RN-12 | Source audit data must expose `retrievalScore` and nullable `rerankScore`. | Replaces the old interface `score` field everywhere sources are serialized. |
| RN-14 | Safe reranking failures return sanitized API errors. | Adds rerank-safe HTTP status mapping on the ask route. |
| RN-15 | Response bodies and UI must not expose raw provider payloads. | DTOs serialize only normalized metadata and audit fields. |
| RN-16 | F-08 stays global single-turn only. | `/query` rerank controls apply only to the global single-turn path; conversation and streaming routes stay unchanged here. |
| INV-06 | Source audit data must never collapse first-pass and rerank evidence into one score field. | The interface source schemas remove `score`. |
| INV-07 | F-08 must not expose raw reranker payloads, secrets, or stack traces. | Ask/query-run responses stay sanitized; UI shows only safe fields. |

## Functional Requirements

- [ ] RF-B04-01: `ragAskRequestSchema` accepts
  `retrieval.strategy = "rerank"` while preserving the existing
  `standard`/`explore` validation and defaulting behavior.
- [ ] RF-B04-02: `ragSourceSchema` and `ragRunSourceResponseSchema` replace
  `score` with `retrievalScore` and nullable `rerankScore`.
- [ ] RF-B04-03: `ragAnswerMetadataSchema` adds nullable `rerankerProvider`
  and `rerankerModel`.
- [ ] RF-B04-04: `ragAnswerAuditSchema` adds nullable `reranking`, which uses
  the normalized reranking audit DTO shape.
- [ ] RF-B04-05: `RagQueryRunSummaryResponse` keeps the same summary shape
  except that `retrievalStrategy` now accepts `"rerank"`.
- [ ] RF-B04-06: `RagQueryRunDetailResponse` exposes rerank-aware source
  scores, reranker metadata, and nullable reranking audit data.
- [ ] RF-B04-07: `createRagAskHandler` maps
  `reranking_failed -> 502 { error: "reranking_failed" }` and
  `reranking_unavailable -> 503 { error: "reranking_unavailable" }`, while
  preserving existing `generation_*` and sanitized `technical_error` mapping.
- [ ] RF-B04-08: `/query` exposes a dedicated PT-BR rerank control for the
  global single-turn path, distinct from the existing standard and explore
  actions.
- [ ] RF-B04-09: `/query` renders reranking evidence for the current answer and
  for persisted run detail views, including `retrievalScore`, nullable
  `rerankScore`, and reranking metadata or audit when present.
- [ ] RF-B04-10: Conversation handlers and streaming SSE DTOs remain unchanged
  in F-08; later F-06/F-10 follow-up sync will consume the shared rerank
  contract after the global path lands.

## Module Contracts

```ts
export const ragSourceSchema = z.object({
  sourceNumber: z.number().int().positive(),
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  excerpt: z.string(),
  retrievalScore: z.number(),
  rerankScore: z.number().nullable(),
  documentPipelineVersion: z.string().min(1),
  chunkingVersion: z.string().min(1),
  embeddingModel: z.string().min(1),
});

export const ragAnswerMetadataSchema = z.object({
  mode: z.enum(["global", "focused"]),
  documentId: z.string().uuid().nullable(),
  topK: z.number().int(),
  retrievalStrategy: z.enum(["standard", "explore", "rerank"]),
  candidateTopK: z.number().int().positive(),
  promptVersion: z.string().min(1),
  generationModel: z.string().min(1),
  embeddingModel: z.string().min(1),
  rerankerProvider: z.string().min(1).nullable(),
  rerankerModel: z.string().min(1).nullable(),
});
```

```ts
export const ragRerankingAuditSchema = z.object({
  latencyMs: z.number().int().nonnegative(),
  candidatesEvaluated: z.number().int().positive(),
  inputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});

export const ragAnswerAuditSchema = z.object({
  latencyMs: z.number().int().nonnegative(),
  embedding: embeddingUsageSchema,
  generation: generationUsageSchema.nullable(),
  reranking: ragRerankingAuditSchema.nullable(),
  totalCostUsd: z.number().nonnegative(),
});
```

## Key Modules

- `src/application/rag/schemas.ts`
- `src/app/api/rag/ask/handler.ts`
- `src/app/api/rag/query-runs/handler.ts`
- `src/app/api/rag/query-runs/[id]/handler.ts`
- `src/app/query/page.tsx`
- `src/app/query/page.test.tsx`

## Tests First

- `src/app/api/rag/ask/handler.test.ts`
- `src/app/api/rag/query-runs/handler.test.ts`
- `src/app/api/rag/query-runs/[id]/handler.test.ts`
- `src/app/query/page.test.tsx`

API tests must prove request validation, rerank-safe status mapping, and DTO
shape coverage. Page tests must prove the dedicated rerank control and the
rendering of split score evidence plus reranking metadata or audit without
touching conversation or streaming surfaces.

## Done When

- The ask route and query-run endpoints serialize rerank-aware DTOs with Zod
  validation and safe error mapping.
- `/query` exposes rerank as an explicit operator choice on the global
  single-turn path and renders reranking evidence without leaking provider
  internals.
- Conversation and streaming routes remain intentionally unchanged in this
  feature.
