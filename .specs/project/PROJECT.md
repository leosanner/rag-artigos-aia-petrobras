# AIA Insight — Plataforma RAG para Avaliação de Impacto Ambiental

**Vision:** Plataforma inteligente de exploração documental que permite consultar um corpus inicial de 31 artigos científicos sobre aplicações de ML/DL/sensoriamento remoto em Avaliação de Impacto Ambiental (AIA), com respostas **rastreáveis, explicáveis e governadas**.

**For:** Analistas técnicos e gestores dentro da Petrobras interessados em apresentar um DEMO/POC do potencial de RAG + Agents + XAI + Governança para o domínio de AIA.

**Solves:** A leitura e a comparação manual de um corpus técnico denso é lenta e não-rastreável. Respostas geradas por LLMs "caixa-preta" não têm credibilidade em contextos corporativos. Este projeto demonstra um caminho em que cada resposta é acompanhada de **fontes, trechos e raciocínio auditáveis**.

---

## Goals

- **G1 — DEMO funcional end-to-end:** ingestão → chunking → RAG multi-doc → RAG single-doc → resposta com citações inspecionáveis, rodando em Vercel + Neon.
- **G2 — Rastreabilidade total:** 100% das respostas com vínculo a documentos-fonte, chunks usados e versão do pipeline que os gerou.
- **G3 — Qualidade via TDD:** cada camada (ingestão, refino, chunking, retrieval, geração) entregue com testes escritos antes da implementação. Meta inicial: >80% de cobertura nos módulos core.
- **G4 — Extensibilidade por padrões:** arquitetura pensada em camadas e com padrões de projeto (Strategy para extratores/refinadores, Repository para persistência, State Machine para status de documento) para permitir troca de implementações sem reescrita.

---

## Tech Stack

**Core:**

- Framework: Next.js 15 (App Router) + React 19
- Language: TypeScript 5.x (strict)
- Database: PostgreSQL + extensão `pgvector`
- ORM: Drizzle ORM
- Produção: Vercel (app) + Neon (Postgres serverless com pgvector)

**Key dependencies:**

- Validação: **Zod** (schemas runtime + tipos inferidos em todas as fronteiras)
- Testes: **Vitest** (TDD é crucial — ver Constraints)
- LLM/Embeddings: **Vercel AI SDK** (base comum para provedores)
- Agents: **em aberto** — decisão posterior entre Vercel AI SDK (nativo), Mastra, LangChain.js, ou LlamaIndex.TS, baseada em prova-de-conceito curta
- Google Drive: `googleapis` com **Service Account** (pasta fixa compartilhada)
- Extração de PDF: a decidir (`unpdf`, `pdf-parse`, ou `pdfjs-dist`) — benchmark comparativo antes da decisão

---

## Scope

**v1 (DEMO) inclui:**

- **Fase 1 — Ingestão Documental:** PDFs em pasta fixa do Drive → registro governado no Postgres → `raw_text` extraído → `refined_text` gerado → status `processed` apto para chunking
- **Fase 2 — Chunking + Embeddings:** chunking estratégico sobre `refined_text`, geração de embeddings, persistência em pgvector
- **Fase 3 — RAG Global:** perguntas sobre todo o corpus com retorno de fontes
- **Fase 4 — RAG Focado:** perguntas sobre um documento específico
- **Fase 5 — XAI mínimo:** toda resposta exibe documentos, chunks e scores utilizados
- **Fase 6 — Observabilidade básica:** log de perguntas, respostas, tokens, custo e latência
- **Fase 7 — Agent piloto:** um agent simples (ex.: sumarização ou comparação entre artigos) como prova da arquitetura agentica

**Explicitly out of scope (para o DEMO):**

- Autenticação de usuário final / multi-tenancy / RBAC — acesso é restrito ao operador do DEMO
- Tratamento automático de duplicidade de documentos — controle manual do usuário (ver `regras_operacionais_pipeline_fase1.md` §4)
- Busca automática de DOI ou extração automática de metadados bibliográficos — entrada manual opcional pelo usuário
- OAuth individual por usuário no Google Drive — usamos Service Account + pasta fixa
- Upload manual via UI — origem única é o Drive na v1
- Suporte a formatos não-PDF
- Internacionalização — interface em português

---

## Constraints

- **Timeline:** projeto em fase de organização/specs. Implementação começa após aprovação das specs. Sem deadline rígido, mas prioridade é mostrar a Fase 1 funcional com testes antes de avançar.
- **TDD é crucial:** nenhum módulo de lógica de negócio entra no repositório sem testes escritos *antes* da implementação. Código puramente de infraestrutura (glue) pode ser testado via testes de integração.
- **Padrões de projeto são requisito explícito:** cada decisão arquitetural deve poder ser justificada por um padrão conhecido ou por uma razão documentada. Over-engineering com padrões é rejeitado na mesma medida que código sem estrutura.
- **Governança desde o dia 1:** mesmo em DEMO, todo documento processado tem campos de governança (id interno, hash, origem, versão lógica, timestamps, status) — é parte do diferencial do produto.
- **Deploy-alvo é Vercel + Neon:** escolhas de arquitetura (edge vs node, connection pooling, background jobs) devem respeitar as restrições dessas plataformas.
