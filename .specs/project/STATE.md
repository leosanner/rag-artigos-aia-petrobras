# State

**Last Updated:** 2026-04-17
**Current Work:** Initial project organization — specs for `M1 / Document Ingestion (Phase 1)` in progress

---

## Recent Decisions

### AD-001: Core stack — Next.js + TS + Drizzle + Vitest + Zod (2026-04-17)

**Decision:** Next.js 15 (App Router) + TypeScript strict, Drizzle ORM, Vitest for tests, Zod for validation. Deployed on Vercel + Neon (Postgres + pgvector).
**Reason:** A cohesive TypeScript-first stack that matches the target deployment. Drizzle has idiomatic pgvector support; Prisma would require raw queries. Vitest is faster and more direct than Jest for TDD in TS/ESM.
**Trade-off:** Drizzle has a smaller ecosystem than Prisma. The Vercel AI SDK ties us to Vercel (acceptable — it is already the target provider).
**Impact:** All DB schemas go through Drizzle; all boundaries (request bodies, env vars, external responses) are validated with Zod; tests are written before the implementation.

### AD-002: Google Drive via Service Account + fixed folder (2026-04-17)

**Decision:** Ingestion consumes a shared Google Drive folder authenticated via a Service Account. No per-user OAuth.
**Reason:** The project is an internal DEMO with no end-user authentication. A Service Account drastically simplifies the flow.
**Trade-off:** Does not support multi-tenancy or multiple Drives. Acceptable while the scope is DEMO.
**Impact:** Secrets: one Service Account JSON + the folder ID. No Drive login flow in the frontend.

### AD-003: Agents framework left open (2026-04-17)

**Decision:** The choice between Vercel AI SDK (native), Mastra, LangChain.js, LlamaIndex.TS is deferred until milestone M4.
**Reason:** Avoid premature lock-in without a concrete use case. Phases 1–3 (ingestion + base RAG) do not depend on an agents framework.
**Trade-off:** We will need a short PoC when we reach M4.
**Impact:** Base RAG code must not assume agent-framework-specific APIs; the generation layer stays behind its own interface.

### AD-004: No automatic duplicate handling in v1 (2026-04-17)

**Decision:** Control over duplicate files is the user's manual responsibility; the system does not block ingestion when hashes match.
**Reason:** Made explicit in `phase1_pipeline_rules.md` §4 — reduces initial complexity.
**Trade-off:** The corpus may contain real duplicates if the user is careless.
**Impact:** The file `hash` is stored for governance / future dedup, but is not required as a UNIQUE constraint.

### AD-005: DOI and bibliographic metadata are manual (2026-04-17)

**Decision:** Do not look up DOI, nor infer authors/year automatically. Initial title = file name in Drive; remaining fields are optional and filled in by the user later.
**Reason:** Made explicit in `phase1_pipeline_rules.md` §5–7.
**Trade-off:** Less rich metadata out of the box.
**Impact:** Schema must allow NULLs in `doi`, `authors`, `publication_year`; a metadata-edit endpoint is required.

---

## Active Blockers

_None for now._

---

## Lessons Learned

_To be filled in as the project evolves._

---

## Quick Tasks Completed

_None for now._

---

## Deferred Ideas

- [ ] Automated answer-quality evaluation (ragas/evals) — Captured during: initial roadmap
- [ ] Streaming answers in the frontend — Captured during: initial roadmap
- [ ] Pipeline-versioned batch reprocessing — Captured during: initial roadmap
- [ ] Integration with external sources (Scielo, arXiv) — Captured during: initial roadmap

---

## Todos

- [ ] Decide PDF-extraction library (`unpdf` vs `pdf-parse` vs `pdfjs-dist`) via benchmark before starting Phase 1
- [ ] Define concrete text-refinement strategy (deterministic rules vs LLM-assisted) in the Phase 1 spec
- [ ] Choose a definitive project name (current placeholder: "AIA Insight")

---

## Preferences

**Model Guidance Shown:** never
