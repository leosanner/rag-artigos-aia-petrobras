# Ingestão Documental (Fase 1) — Specification

## Problem Statement

Para que o RAG funcione com rastreabilidade, cada PDF precisa virar um **registro governado** no Postgres com seu texto extraído, refinado e seus metadados de governança consolidados — antes de qualquer operação de chunking, embeddings ou retrieval. Hoje não existe pipeline alguma: é necessário construir a camada de preparação e governança que serve de base para todas as fases seguintes do projeto.

Esta spec implementa a **Fase 1 — Estruturação dos Dados** conforme `regras_operacionais_pipeline_fase1 (1).md`.

---

## Goals

- [ ] Operador coloca PDF numa pasta fixa do Google Drive e, após executar a sincronização, encontra um registro com status `processed` no banco, contendo `raw_text` e `refined_text`.
- [ ] 100% dos registros têm os campos de governança mínimos preenchidos automaticamente (id interno, hash, origem, referência ao Drive, versão lógica, timestamps, status).
- [ ] Falhas em extração ou refino marcam o documento como `failed` sem corromper estado, e o documento é reprocessável sem intervenção manual no banco.
- [ ] Pipeline coberto por testes TDD: unitários nas unidades (extrator, refinador, state machine, repository) e ao menos um teste de integração E2E com um PDF real pequeno, hitting um Postgres real (não mock) com pgvector.

---

## Out of Scope

Explicitamente excluído desta Fase. Documentado para evitar scope creep.

| Feature                                                                   | Reason                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Detecção automática de duplicidade por hash                               | Decisão AD-004: controle manual pelo usuário na v1                                                |
| Busca automática de DOI                                                   | Decisão AD-005 / regras §7                                                                        |
| Extração automática de autores, ano de publicação, afiliação              | Decisão AD-005 / regras §6 — metadados bibliográficos são entrada manual                          |
| Chunking, embeddings, vector store                                        | Escopo da Fase 2                                                                                  |
| RAG, respostas, agents                                                    | Escopo das Fases 3+                                                                               |
| OAuth individual, multi-tenancy, login de usuário                         | Decisão AD-002 — DEMO usa Service Account                                                         |
| Upload manual de PDF via UI                                               | Origem única é o Drive na v1                                                                      |
| Suporte a formatos não-PDF                                                | Corpus inicial é 100% PDF                                                                         |
| Webhooks Google Drive (push notifications) ou processamento em tempo real | Sincronização é acionada via trigger explícito (endpoint/CLI) — simplicidade para DEMO            |
| Pipeline de reprocessamento em lote                                       | v1 permite reprocessamento de um documento por vez; lote fica para futuras iterações              |

---

## User Stories

### P1: Pipeline feliz de ingestão E2E ⭐ MVP

**User Story**: Como operador do DEMO, quero colocar um PDF numa pasta fixa do Google Drive e acionar a sincronização, para que o documento apareça no sistema com `raw_text`, `refined_text`, metadados de governança e status `processed`, pronto para chunking.

**Why P1**: É o fluxo mínimo que prova que a camada de governança de dados funciona. Sem ele, nenhuma fase seguinte pode existir.

**Acceptance Criteria**:

1. WHEN o operador dispara a sincronização E há PDFs na pasta fixa do Drive que ainda não existem no banco (match por `drive_file_id`) THEN o sistema SHALL criar um registro por PDF novo, com `status = pending`, `title` preenchido a partir do nome do arquivo, `drive_file_id`, `origin = 'google_drive'`, `file_hash` calculado, `pipeline_version` da versão corrente, `created_at` e `updated_at` preenchidos.
2. WHEN um documento entra com status `pending` THEN o sistema SHALL tentar extrair o texto do PDF e persistir o resultado no campo `raw_text`, atualizando `updated_at`.
3. WHEN `raw_text` foi persistido com sucesso THEN o sistema SHALL executar a etapa de refino, persistir o resultado em `refined_text`, atualizar `updated_at` e marcar o registro como `status = processed`.
4. WHEN todas as três etapas (criação, extração, refino) concluem sem erro para um documento THEN o registro final SHALL ter `raw_text != NULL`, `refined_text != NULL` e `status = 'processed'`, satisfazendo o critério de aptidão para chunking definido nas regras §12.
5. WHEN o operador aciona a sincronização e não há PDFs novos no Drive THEN o sistema SHALL concluir sem criar registros novos nem modificar registros existentes, retornando um relatório "0 novos / 0 atualizados".

**Independent Test**: Colocar um PDF conhecido numa pasta de teste do Drive, executar `POST /api/ingestion/sync` (ou comando equivalente), consultar o banco e verificar que existe exatamente 1 linha na tabela `documents` com `status = 'processed'` e os dois campos de texto preenchidos. Um teste de integração com um PDF pequeno fixture pode rodar o pipeline inteiro com Drive mockado e Postgres real.

---

### P1: Transições de status resilientes a falhas ⭐ MVP

**User Story**: Como operador, quero que falhas em extração ou refino sejam refletidas claramente no status do documento (`failed`) sem deixar o sistema em estado inconsistente, para que eu possa identificar e reprocessar documentos problemáticos.

**Why P1**: Sem tratamento de falha confiável, o pipeline vira caixa-preta. Regras §10, §11 e §13 tornam isto explícito.

**Acceptance Criteria**:

1. WHEN a extração de `raw_text` falha para um documento THEN o sistema SHALL marcar o registro como `status = failed`, persistir `last_error` com motivo legível, atualizar `updated_at` e NÃO avançar para a etapa de refino.
2. WHEN a extração obtém sucesso mas o refino falha THEN o sistema SHALL preservar o `raw_text` já persistido, marcar o registro como `status = failed`, persistir `last_error` e atualizar `updated_at`.
3. WHEN qualquer transição inválida é tentada (ex.: `processed` → `pending` sem ação explícita) THEN a state machine SHALL rejeitar a transição, lançando erro tipado, e o registro permanece inalterado.
4. WHEN o pipeline processa múltiplos documentos num ciclo e um deles falha THEN os documentos restantes SHALL continuar sendo processados; o relatório final SHALL sumarizar `processed` / `failed` por documento.

**Independent Test**: Simular um PDF corrompido (ou mockar o extrator para lançar) e verificar que (a) o registro fica com `status = failed` e `last_error` preenchido, (b) outros PDFs no mesmo ciclo chegam em `processed`, (c) o estado no banco está consistente.

---

### P2: Reprocessamento de documentos em falha

**User Story**: Como operador, quero poder reprocessar um documento com `status = failed` sem precisar removê-lo e inseri-lo novamente no Drive, para que eu possa se recuperar de erros transitórios ou ajustes de pipeline.

**Why P2**: Necessário para operação prática, mas o DEMO pode existir sem antes de uma primeira demo ao vivo, desde que tenhamos dados limpos de entrada. Regras §14 exige a possibilidade arquitetural.

**Acceptance Criteria**:

1. WHEN o operador aciona `POST /api/ingestion/reprocess/:documentId` em um documento com `status = failed` THEN o sistema SHALL resetar o status para `pending`, limpar `last_error`, rodar novamente o pipeline e chegar a `processed` ou `failed` ao fim.
2. WHEN o operador aciona reprocessamento em documento com `status = processed` THEN o sistema SHALL responder com erro 409 e NÃO alterar o registro (decisão conservadora para v1; reprocessamento de `processed` fica como Deferred Idea).
3. WHEN o reprocessamento está em curso THEN SHALL ficar claro no registro que há processamento ativo (via `status = pending`) e requisições concorrentes de reprocessamento sobre o mesmo documento SHALL ser rejeitadas com erro 409.

**Independent Test**: Forçar um documento a `failed`, corrigir condição de falha (ex.: ajustar mock do extrator), acionar reprocessamento e verificar que o registro chega a `processed` com os dois campos de texto preenchidos.

---

### P2: Edição manual de metadados bibliográficos

**User Story**: Como operador, quero poder editar `title`, `doi`, `authors`, `publication_year` e `notes` de um documento já ingerido, para que eu possa enriquecer os metadados que não foram inferidos automaticamente.

**Why P2**: Regras §5 e §6 exigem a possibilidade. Não bloqueia o DEMO inicial de ingestão, mas é esperado pela governança.

**Acceptance Criteria**:

1. WHEN o operador envia `PATCH /api/documents/:id` com campos válidos (validados por Zod) THEN o sistema SHALL atualizar apenas os campos bibliográficos e `updated_at`, preservando governança e textos.
2. WHEN o operador tenta alterar campos imutáveis (`id`, `file_hash`, `drive_file_id`, `origin`, `pipeline_version`, `raw_text`, `refined_text`, `status`) via este endpoint THEN o sistema SHALL rejeitar com 400 listando os campos inválidos.
3. WHEN o campo `publication_year` recebe valor fora do intervalo razoável (ex.: < 1900 ou > ano atual + 1) THEN o schema Zod SHALL rejeitar com mensagem clara.

**Independent Test**: Criar um documento, enviar PATCH com `{ doi, authors, publication_year, notes }`, consultar o registro e confirmar que os campos foram atualizados e nada mais foi tocado.

---

### P3: Listagem básica de documentos ingeridos

**User Story**: Como operador, quero ver uma lista dos documentos já ingeridos com seus status e metadados principais, para saber rapidamente o estado do corpus.

**Why P3**: Útil para o DEMO, mas não é pré-requisito para as fases subsequentes — o operador pode inspecionar via SQL enquanto isto não existe.

**Acceptance Criteria**:

1. WHEN o operador acessa `GET /api/documents` THEN o sistema SHALL retornar a lista paginada de documentos com: `id`, `title`, `status`, `doi`, `authors`, `publication_year`, `created_at`, `updated_at`, `last_error` (se houver).
2. WHEN há query param `?status=failed` THEN apenas documentos daquele status SHALL ser retornados.

---

## Edge Cases

- **PDF sem texto extraível (somente imagens):** WHEN a extração retorna texto vazio ou abaixo de um threshold mínimo configurável THEN o sistema SHALL marcar o documento como `failed` com `last_error = 'raw_text_empty'` — OCR fica como Deferred Idea.
- **PDF criptografado ou protegido por senha:** WHEN a extração lança erro de proteção THEN o sistema SHALL marcar como `failed` com `last_error = 'pdf_protected'`.
- **PDF muito grande (acima de um limite configurável):** WHEN o tamanho do arquivo excede o limite THEN o sistema SHALL marcar como `failed` com `last_error = 'pdf_too_large'` — evita OOM na função Vercel.
- **Arquivo renomeado no Drive:** WHEN um arquivo já ingerido (match por `drive_file_id`) é renomeado no Drive E a sincronização é acionada THEN o sistema SHALL ignorar a mudança de nome — `title` já foi definido no momento da inserção e pode ser editado manualmente (ver P2).
- **Arquivo deletado no Drive:** WHEN um arquivo que tem registro no banco deixa de existir no Drive THEN o sistema SHALL preservar o registro e seu conteúdo — deleções ficam fora do escopo da v1 (Deferred Idea: política de tombstone).
- **Dois arquivos com o mesmo conteúdo (mesmo hash) mas `drive_file_id` diferente:** WHEN ambos são sincronizados THEN dois registros distintos SHALL ser criados — decisão AD-004 (sem dedup automática).
- **Falha de rede ao baixar PDF do Drive:** WHEN o download falha THEN o sistema SHALL marcar como `failed` com `last_error = 'drive_download_failed'` e permitir reprocessamento.
- **Execução concorrente da sincronização:** WHEN duas sincronizações rodam em paralelo THEN a segunda SHALL ser rejeitada (lock simples) ou esperar, para evitar criação duplicada de registros.

---

## Requirement Traceability

| Requirement ID | Story                               | Phase  | Status  |
| -------------- | ----------------------------------- | ------ | ------- |
| INGEST-01      | P1: Pipeline E2E                    | Design | Pending |
| INGEST-02      | P1: Pipeline E2E — governança       | Design | Pending |
| INGEST-03      | P1: Pipeline E2E — status transitions feliz | Design | Pending |
| INGEST-04      | P1: Transições resilientes          | Design | Pending |
| INGEST-05      | P1: State machine rejeita inválidas | Design | Pending |
| INGEST-06      | P1: Falhas isoladas por documento   | Design | Pending |
| INGEST-07      | P2: Reprocessamento de `failed`     | -      | Pending |
| INGEST-08      | P2: Edição manual de metadados      | -      | Pending |
| INGEST-09      | P2: Imutabilidade de campos core    | -      | Pending |
| INGEST-10      | P3: Listagem de documentos          | -      | Pending |

**ID format:** `INGEST-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 10 total, 0 mapped to tasks, 10 unmapped ⚠️ (esperado — Tasks phase ainda não rodou)

---

## Success Criteria

Como sabemos que a Fase 1 está bem-feita:

- [ ] Um PDF pequeno (fixture) entra na pasta de testes e, em < 30s após disparar a sincronização local, está em `status = processed` com os dois campos de texto preenchidos.
- [ ] Suite de testes unitários e integração roda em < 60s localmente e em CI, com cobertura >80% nos módulos core (extrator, refinador, state machine, repository).
- [ ] Nenhum documento fica em estado inconsistente após falhas injetadas: toda linha no banco está sempre em um dos três estados válidos (`pending`, `processed`, `failed`) e satisfaz as invariantes (`processed` ⇒ `raw_text != NULL AND refined_text != NULL`).
- [ ] Campos de governança (`id`, `file_hash`, `drive_file_id`, `origin`, `pipeline_version`, `created_at`, `updated_at`, `status`) são populados em 100% dos registros criados pelo pipeline.
- [ ] O operador consegue executar um reprocessamento de um documento em `failed` sem tocar no banco manualmente.

---

## Open Questions (a resolver antes de `design.md`)

As decisões abaixo são gray areas da Fase 1 e serão tratadas em `.specs/features/ingestao-documental/context.md` (via discuss phase) ou respondidas diretamente pelo usuário:

1. **Estratégia de extração de PDF:** `unpdf` / `pdf-parse` / `pdfjs-dist`? Rodar benchmark com 3 PDFs representativos do corpus real antes de decidir?
2. **Estratégia de refino:** limpeza determinística (regex/normalização de espaços, junção de palavras hifenizadas, remoção de cabeçalho/rodapé) **vs** refino assistido por LLM (prompt para limpar o texto) **vs** híbrido (determinístico primeiro, LLM para casos difíceis)?
3. **Trigger de sincronização:** endpoint manual HTTP, CLI local, Vercel Cron diário, ou combinação?
4. **Execução do pipeline:** síncrono dentro da request (simples, mas risco de timeout em Vercel) **vs** enfileirado (background job com Inngest / Trigger.dev / QStash) **vs** chamar Node runtime longo localmente e só agendar em produção?
5. **Limite máximo de tamanho de PDF:** qual valor default? 20MB? 50MB?
6. **Storage do PDF original:** baixamos toda vez do Drive ou fazemos cache em object storage (Vercel Blob / S3)?
