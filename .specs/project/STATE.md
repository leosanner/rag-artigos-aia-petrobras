# State

**Last Updated:** 2026-04-17
**Current Work:** Organização inicial do projeto — Specs de `M1 / Ingestão Documental (Fase 1)` em andamento

---

## Recent Decisions

### AD-001: Stack core — Next.js + TS + Drizzle + Vitest + Zod (2026-04-17)

**Decision:** Next.js 15 (App Router) + TypeScript strict, Drizzle ORM, Vitest para testes, Zod para validação. Deploy em Vercel + Neon (Postgres + pgvector).
**Reason:** Stack TypeScript-first coesa com o deploy-alvo. Drizzle tem suporte idiomático a pgvector; Prisma exigiria raw queries. Vitest é mais rápido e direto que Jest para TDD em TS/ESM.
**Trade-off:** Drizzle tem ecossistema menor que Prisma. Vercel AI SDK amarra à Vercel (aceitável — já é o provedor alvo).
**Impact:** Todo schema de DB passa por Drizzle; todas as fronteiras (request bodies, env vars, respostas externas) validadas com Zod; testes escritos antes da implementação.

### AD-002: Google Drive via Service Account + pasta fixa (2026-04-17)

**Decision:** Ingestão consome uma pasta compartilhada do Google Drive autenticada por Service Account. Sem OAuth individual.
**Reason:** Projeto é um DEMO interno; não há usuário final autenticado. Service Account simplifica drasticamente o fluxo.
**Trade-off:** Não suporta multi-tenancy ou múltiplos Drives. Aceitável enquanto o escopo for DEMO.
**Impact:** Secrets: um JSON de service account + ID da pasta. Sem fluxo de login no frontend para Drive.

### AD-003: Framework de agents em aberto (2026-04-17)

**Decision:** A escolha entre Vercel AI SDK (nativo), Mastra, LangChain.js, LlamaIndex.TS fica adiada até o milestone M4.
**Reason:** Premature lock-in sem caso de uso concreto. Fases 1–3 (ingestão + RAG base) não dependem de framework de agents.
**Trade-off:** Precisaremos de um PoC curto quando chegarmos em M4.
**Impact:** Código de RAG base não pode assumir APIs específicas de agents; a camada de geração fica atrás de uma interface própria.

### AD-004: Sem tratamento automático de duplicidade na v1 (2026-04-17)

**Decision:** Controle de arquivos repetidos é responsabilidade manual do usuário; o sistema não bloqueia ingestão por hash igual.
**Reason:** Explicitado em `regras_operacionais_pipeline_fase1 (1).md` §4 — reduz complexidade inicial.
**Trade-off:** Corpus pode conter duplicatas reais se o usuário não cuidar.
**Impact:** `hash` do arquivo é armazenado para governança/futura deduplicação, mas não é UNIQUE constraint obrigatória.

### AD-005: DOI e metadados bibliográficos são manuais (2026-04-17)

**Decision:** Não buscar DOI nem inferir autores/ano automaticamente. Título inicial = nome do arquivo no Drive; demais campos são opcionais e preenchidos pelo usuário depois.
**Reason:** Explicitado em `regras_operacionais_pipeline_fase1 (1).md` §5–7.
**Trade-off:** Menos rico em metadados out-of-the-box.
**Impact:** Schema precisa permitir NULLs em `doi`, `authors`, `publication_year`; endpoint de edição de metadados.

---

## Active Blockers

_Nenhum por enquanto._

---

## Lessons Learned

_A preencher conforme o projeto avança._

---

## Quick Tasks Completed

_Nenhum por enquanto._

---

## Deferred Ideas

- [ ] Avaliação automatizada de qualidade de respostas (ragas/evals) — Captured during: roadmap inicial
- [ ] Streaming de respostas no frontend — Captured during: roadmap inicial
- [ ] Reprocessamento em lote versionado por pipeline — Captured during: roadmap inicial
- [ ] Integração com fontes externas (Scielo, arXiv) — Captured during: roadmap inicial

---

## Todos

- [ ] Decidir biblioteca de extração de PDF (`unpdf` vs `pdf-parse` vs `pdfjs-dist`) via benchmark antes de começar Fase 1
- [ ] Definir estratégia concreta de refino textual (regras determinísticas vs LLM-assistido) na spec da Fase 1
- [ ] Dar nome definitivo ao projeto (placeholder atual: "AIA Insight")

---

## Preferences

**Model Guidance Shown:** never
