# Roadmap — AIA Insight

**Current Milestone:** M1 — Fundação de Dados e Ingestão
**Status:** Planning

> Cada fase do `starter.md` vira um milestone. Features dentro de um milestone são incrementos demo-áveis. Os três primeiros milestones entregam o DEMO funcional mínimo.

---

## M1 — Fundação de Dados e Ingestão

**Goal:** Um PDF colocado numa pasta do Google Drive termina persistido no Postgres com `raw_text`, `refined_text`, metadados de governança e status `processed`, apto para chunking. Todo o fluxo coberto por testes (TDD).
**Target:** Primeira entrega demonstrável do projeto.

### Features

**Setup inicial do repositório e infraestrutura** — PLANNED

- Next.js 15 + TypeScript strict + ESLint + Prettier
- Drizzle + migrations + conexão Neon/Postgres local com pgvector
- Vitest + estrutura de testes (unit / integration)
- Variáveis de ambiente e secrets (Service Account, DB URL)
- CI mínimo (lint + typecheck + testes em PR)

**Ingestão Documental (Fase 1)** — PLANNED

- Integração Google Drive via Service Account, pasta fixa
- Schema relacional com campos de governança (id, hash, origem, versão, timestamps, status)
- Extração de `raw_text` a partir do PDF
- Refinamento textual gerando `refined_text`
- Máquina de estados simples: `pending` → `processed` | `failed`
- Reprocessamento de documentos em `failed`
- Título inicial derivado do nome do arquivo; campos opcionais (DOI, autores, ano) editáveis manualmente

---

## M2 — RAG Base (Global + Focado)

**Goal:** Usuário consegue perguntar sobre o corpus inteiro OU sobre um documento específico e receber resposta com citações de trechos.

### Features

**Chunking + Embeddings (Fase 2)** — PLANNED

- Estratégia de chunking sobre `refined_text`
- Geração e armazenamento de embeddings em pgvector
- Indexação vetorial com metadados (doc_id, chunk_index, versão)

**RAG Global (Fase 3)** — PLANNED

- Endpoint de pergunta multi-documento
- Retrieval top-k + construção de contexto + geração
- Resposta com lista de fontes

**RAG Focado (Fase 4)** — PLANNED

- Filtro por documento específico na recuperação
- UI para seleção do documento alvo

---

## M3 — Explicabilidade e Observabilidade

**Goal:** Toda resposta é inspecionável e o sistema tem telemetria mínima para avaliar uso e custo.

### Features

**XAI mínimo (Fase 5)** — PLANNED

- Exibição, por resposta, de: documentos-fonte, chunks utilizados, scores de similaridade
- UI para inspeção de trechos recuperados

**Observabilidade básica (Fase 6)** — PLANNED

- Log de perguntas e respostas
- Métricas: tokens, custo estimado, latência
- Versão do modelo e do prompt registrada por requisição

---

## M4 — Agents (Prova Arquitetural)

**Goal:** Demonstrar a camada de agents rodando uma tarefa mais complexa que RAG simples.

### Features

**Decisão de framework de agents** — PLANNED

- PoC curto comparando 2–3 opções (Vercel AI SDK, Mastra, LangChain.js, LlamaIndex.TS)
- Critérios: integração com Next.js, observabilidade, custo de manutenção
- Registro da decisão em `.specs/project/STATE.md`

**Agent piloto** — PLANNED

- Escolher uma das tarefas do `starter.md` §3.6 (sumarização / comparação / extração de temas / relatório)
- Implementar end-to-end com explicabilidade e governança

---

## Future Considerations

- Interface interativa mais sofisticada (streaming de respostas, histórico de conversa)
- Integração com bases externas (ex.: Scielo, arXiv) além do corpus fixo
- Automação de análises recorrentes
- Expansão para domínios além de AIA
- Avaliação automatizada de qualidade de respostas (ragas/evals)
- Reprocessamento em lote com versionamento do pipeline
