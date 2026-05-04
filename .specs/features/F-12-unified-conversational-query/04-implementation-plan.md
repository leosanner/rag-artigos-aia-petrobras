# F-12 Block 04 — Plano Incremental de Implementação

Quebra do [04-interface-query-page-and-route-removal.md](./04-interface-query-page-and-route-removal.md) em fatias pequenas, cada uma com edit + teste + verificação antes de seguir para a próxima. Um commit por fatia.

## Decisões de design (resolvidas no grilling)

- **Auditoria**: substituir o aside inline (`ConversationAuditAside`) pelo drawer lateral. Único caminho de auditoria por mensagem.
- **Drawer**: `<dialog>` HTML nativo via `showModal()` (ESC + focus trap built-in; backdrop click via listener). Componente local em `src/app/query/components/AuditDrawer.tsx`.
- **Strategy selector**: segmented buttons (`role="radiogroup"`) — `standard | explore | rerank` em `global`; só `standard` em `focused` (demais ocultos).
- **Tooltip "i"**: copy PT-BR em `src/app/query/constants.ts`.
- **"Avançado"**: `<details>` nativo. Estado open/closed DOM-driven (sem React state).
- **`candidateTopK`**: `<input type="number">` com `min={topK}` e `max=EXPLORE_RETRIEVAL_MAX_CANDIDATES` (=24). Default 24.
- **Strategy state**: state local da página, default `standard`, persiste durante a sessão, reseta on remount. Não observa metadata da conversa carregada.
- **Phase copy mapping** (PT-BR genérica, sem citar Cohere):
  - `retrieving_sources` → "Recuperando candidatos…"
  - `reranking` → "Reordenando candidatos…"
  - `generating_answer` → "Gerando resposta…"
- **URL params**: mantém `conversation`, `mode`, `documentId`, `mock`. Não há `runId` na URL hoje — só remove botões/handlers que abrem run-detail.
- **Schemas mortos a remover**: `ragAskRequestSchema`, `ragAskSuccessResponseSchema`, `ragAskErrorResponseSchema`, `ragAskResponseSchema`, `globalRagAskInputSchema`, `focusedRagAskInputSchema`. Os 3 integration tests que ainda usam `ragAskSuccessResponseSchema` migram para `ragAnsweredResponseSchema`.
- **API `/api/rag/query-runs`**: permanece viva (Block 02 preserva runs persistidos). Só removemos o fetch da UI.

## Fatias

### Fatia 1 — Remover painel single-turn

- [ ] Apagar em `src/app/query/page.tsx`:
  - `singleTurnAskState`, `singleTurnResultState`, `singleTurnQuestion`, `singleTurnTopK`
  - `submitSingleTurnQuestion`, helpers e effects exclusivos
  - `<section aria-labelledby="single-turn-query-title">` block
  - Imports de `ragAskSuccessResponseSchema` no `page.tsx` (ainda mantém schema vivo nesta fatia)
- [ ] Apagar testes em `src/app/query/page.test.tsx`:
  - L965 "submits the dedicated global single-turn rerank flow through /api/rag/ask"
  - L1614 "shows the no-evidence state…" (se for single-turn)
  - L1791 "shows safe ask errors…" (se for single-turn) — converter para conversation se necessário
- [ ] `pnpm vitest run src/app/query/page.test.tsx` verde.

### Fatia 2 — Remover histórico de runs

- [ ] Apagar em `page.tsx`:
  - `recentRunsState`, `selectedRunState`, `createInitialRecentRunsState`, `createInitialSelectedRunState`
  - `loadRunDetail`, fetch `/api/rag/query-runs`
  - Sidebar/UI das runs e botão de inspecionar run
- [ ] Apagar testes:
  - L1547 "starts a new focused conversation from a cited source card in persisted run detail"
  - L1646 "loads the recent history manually and inspects one persisted run on demand"
  - L1694 "clears persisted history…on 401 when refreshing history"
  - L1731 "clears persisted history…on 401 when loading run detail"
  - L1758 "renders a persisted failed run safely without leaking internals"
- [ ] `pnpm vitest run src/app/query/page.test.tsx` verde.

### Fatia 3 — Strategy selector no composer

- [ ] Adicionar `selectedStrategy` state (default `"standard"`) na page.
- [ ] Renderizar segmented buttons (`role="radiogroup"`, `aria-label="Estratégia"`) na composer:
  - `global`: 3 botões
  - `focused`: oculto (label estático informativo opcional)
- [ ] Adicionar copy PT-BR em `constants.ts`:
  - `STRATEGY_TOOLTIP_STANDARD`, `STRATEGY_TOOLTIP_EXPLORE`, `STRATEGY_TOOLTIP_RERANK`
- [ ] Botão "i" abre tooltip acessível (`aria-describedby` ou popover) com a copy.
- [ ] Wirar `selectedStrategy` no payload do submit (via conversation route, não ask).
- [ ] **Novo teste (a)**: visibilidade do selector por modo.
- [ ] CSS para segmented + tooltip em `page.module.css`.

### Fatia 4 — "Avançado" disclosure

- [ ] `<details>` nativo com `<summary>Avançado</summary>` na composer.
- [ ] Dentro: `topK` numeric (sempre visível, range 3..12, default 6).
- [ ] `candidateTopK` numeric (visível só se `selectedStrategy === "rerank"`, range `topK..24`, default 24).
- [ ] State: `topKOverride` e `candidateTopKOverride` na page; reset on remount.
- [ ] **Novos testes (b)** disclosure toggle e override **(c)** candidateTopK só em rerank.
- [ ] CSS do disclosure.

### Fatia 5 — AuditDrawer substitui o aside inline

- [ ] Criar `src/app/query/components/AuditDrawer.tsx`:
  - `<dialog>` controlado via `showModal()` / `close()`
  - Props: `open`, `onClose`, `trace` (sources + audit + relatedTerms + rerankMetadata)
  - Backdrop click fecha (listener no dialog `click` checando target)
  - ESC fecha (built-in)
  - Layout: lado direito, overlay, botão "Fechar"
- [ ] Cada `ConversationMessageItem` assistant ganha botão "Ver auditoria" que abre o drawer com o `trace` daquela mensagem.
- [ ] Remover/ajustar `ConversationAuditAside` (substituir o "expand inline" pelo drawer).
- [ ] **Atualizar teste L1379** ("expands assistant-message audit inside the transcript") para o novo fluxo do drawer.
- [ ] **Novo teste (d)**: drawer open/close (botão, ESC, outside click).
- [ ] Adicionar copy `RAG_AUDIT_DRAWER_*` em `constants.ts`.
- [ ] CSS para `dialog` + `dialog::backdrop` em `page.module.css`.

### Fatia 6 — Phase status PT-BR

- [ ] Mapear phase events para copy em `StreamingConversationMessageItem`:
  - `retrieving_sources` → "Recuperando candidatos…"
  - `reranking` → "Reordenando candidatos…"
  - `generating_answer` → "Gerando resposta…"
- [ ] Adicionar constantes `RAG_PHASE_COPY_*` em `constants.ts`.
- [ ] **Novos testes (e)** related-terms rendering em explore turn **(f)** rerank phase copy durante stream mockado.

### Fatia 7 — Backwards-compat fixture

- [ ] **Novo teste (g)**: carregar fixture pré-F-12 (sem `retrievalStrategy` em metadata?) e verificar que `selectedStrategy` no composer defaulta para `"standard"`.
- [ ] Se necessário: ajuste mínimo no parser do conversation payload para tolerar metadata legado.

### Fatia 8 — Cleanup `/api/rag/ask` e schemas

- [ ] Apagar `src/app/api/rag/ask/` (route.ts, handler.ts, handler.test.ts).
- [ ] Apagar de `src/application/rag/schemas.ts`:
  - `globalRagAskInputSchema`, `focusedRagAskInputSchema`, `ragAskRequestSchema`
  - `ragAskSuccessResponseSchema`, `ragAskErrorResponseSchema`, `ragAskResponseSchema`
  - Types `RagAskRequest`, `FocusedRagAskInput`, `GlobalRagAskInput`, `RagAskSuccessResponse`, `RagAskErrorResponse`, `RagAskResponse`
- [ ] Migrar imports em:
  - `src/app/api/rag/reranked-retrieval.integration.test.ts` (3 usos)
  - `src/app/api/rag/focused-rag.integration.test.ts` (2 usos)
  - `src/application/rag/schemas.test.ts` (apagar describes do ask)
  Substituir por `ragAnsweredResponseSchema`.
- [ ] Adicionar integration test: `POST /api/rag/ask` retorna 404.

### Fatia 9 — Run final

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual smoke (browser): conversa global, 1 turn por estratégia, abrir "Ver auditoria" no rerank, switch para focused (nova conversa), confirmar só `standard` selecionável.

## Convenções

- Cada fatia é um commit Conventional Commits (`feat(query): …`, `test(query): …`, `chore(rag): …`).
- Nunca pular `pnpm vitest run src/app/query/page.test.tsx` antes de avançar para a próxima fatia.
- Atualizar este documento marcando os checkboxes a cada fatia concluída.
