# DESIGN — AIA Insight

Contrato visual do projeto. Toda nova UI deve ser justificável por este documento. Decisões que conflitem com o que está aqui precisam ser registradas como AD em [STATE.md](./STATE.md) antes de irem para código.

Idioma da UI: **PT-BR** por padrão. Exceções deliberadas (ex.: `/ingestion`) vivem na spec da feature.

---

## 1. Princípios

1. **Rastreabilidade visível.** Metadados, IDs, status e contagens são primeira classe — nunca tooltips só. Use mono uppercase quando o conteúdo é "do sistema".
2. **Sobriedade científica.** A interface acompanha leitura longa de artigos e auditoria. Não compete com o conteúdo: sem sombras espessas, sem decoração que não carregue informação.
3. **Hierarquia por estrutura, não por sombra.** Profundidade vem de bordas pretas 2px e variação de fundo (`--paper` / `--paper-deep`). Sombras offset estão proibidas.
4. **Governança como elemento de UI.** Status (`pending` / `processed` / `failed`), versão de pipeline, top-k, modelo usado — tudo aparece em badges/chips persistentes, não em logs escondidos.
5. **PT-BR primeiro.** Microcopy clara, técnica, sem marketing. Termos de domínio (chunk, embedding, top-k, citação) ficam em PT-BR quando há tradução natural; permanecem em inglês quando o termo é o consagrado (ex.: *embedding*).
6. **Performance e movimento contido.** Animações ≤ 240ms; `@media (prefers-reduced-motion: reduce)` desliga toda transição/animação na superfície.

---

## 2. Tom de voz

| Contexto | Tipografia | Tratamento |
|---|---|---|
| Títulos editoriais (página, seção principal) | `Fraunces`, peso 600–700, tracking levemente negativo | Frases curtas; uma ideia por título. |
| Corpo de leitura (resposta, descrição, copy) | `IBM Plex Sans` 1rem / line-height 1.6–1.7 | PT-BR direto; evita gerundismo e jargão de marketing. |
| Metadados, labels, status, badges, IDs | `IBM Plex Mono`, uppercase, `letter-spacing: 0.14–0.22em` | Sempre tratado como "voz do sistema". |
| Rótulos de campos | Mono, uppercase, font-size ~0.7rem | Nunca frases — sempre rótulos curtos (`PERGUNTA`, `MODO`, `TOP-K`). |

Microcopy de erro: começa pela causa observável e oferece ação. Ex.: "Pergunta vazia. Escreva pelo menos 3 caracteres antes de enviar." — não "Algo deu errado".

---

## 3. Tokens canônicos

Todos os tokens são CSS Variables. Por enquanto vivem no escopo de cada `*.module.css` da página; quando ≥ 2 surfaces consumirem o mesmo conjunto, extrair para `src/styles/tokens.css` (decisão a ser registrada como AD).

### 3.1 Cor — papéis semânticos rígidos

| Token | Hex | Papel único | Onde **não** usar |
|---|---|---|---|
| `--ink` | `#0a0a0a` | Texto principal, bordas, fundo de slabs de "voz do sistema". | Como cor de ação primária (use `--blue`). |
| `--paper` | `#fafaf7` | Fundo padrão de página/superfície. | — |
| `--paper-deep` | `#f0efe7` | Fundo de painel secundário, contraste leve dentro de cards. | Como cor de input ativo. |
| `--blue` | `#2b4bff` | **Ação primária**: botão de envio, foco/seleção, badge de modo selecionado, links primários. | Como cor de status positivo (use `--lime`). |
| `--lime` | `#c2f04a` | **Estado positivo / destaque do usuário**: bolha do usuário no transcript, indicador "ativo/online", chips de termo encontrado/aceito. | Como cor de ação primária. Como cor de input vazio. |
| `--yellow` | `#ffd60a` | **Atenção / aviso não-bloqueante**: alertas de validação, badge de "carregando", chamadas numéricas (top-k). | Como cor de erro (use `--danger`). |
| `--danger` | `#ff4d3d` | **Erro / falha bloqueante**: alertas de não-autorizado, status `failed`, botões destrutivos. | Como cor de aviso simples (use `--yellow`). |

Variantes mais escuras (`--lime-deep`, `--blue-deep`) existem só como hover/pressed dos próprios papéis, nunca para ampliar a paleta semântica.

### 3.2 Tipografia

```
--font-display : Fraunces   (h1, títulos editoriais, numerais decorativos em fontes citadas)
--font-body    : IBM Plex Sans   (corpo, parágrafos, botões textuais)
--font-mono    : IBM Plex Mono   (labels, badges, IDs, metadados, status)
```

Escala (rem):

| Uso | Tamanho | Line-height |
|---|---|---|
| Display H1 | `clamp(2.8, 6vw, 4.4)` | 0.94 |
| H2 painel | 1.65 | 1.05 |
| H3 resposta | 1.4 | 1.2 |
| Corpo | 1.0–1.08 | 1.6–1.72 |
| Label/badge | 0.66–0.78 | 1.2 |
| Microbadge | 0.62–0.66 | 1 |

### 3.3 Espaçamento

Escala única (px): **4 · 8 · 12 · 16 · 20 · 24 · 32 · 48**. Qualquer valor fora dessa escala precisa de comentário no CSS justificando.

Padding interno padrão de cards: 18–24px. Gap padrão entre seções: 24–32px.

### 3.4 Bordas

- **Padrão único:** `2px solid var(--ink)`.
- Empty/placeholder: `2px dashed var(--ink)`.
- **Proibido:** bordas > 2px no fluxo principal.

### 3.5 Raios

- Padrão: `0` (cantos vivos — assinatura do brutalismo).
- `2px` para indicadores decorativos (ex.: marcador `::before` de termo).

### 3.6 Sombras

**Removidas do sistema.** Não existe `--shadow-*`. Profundidade = borda 2px + variação de fundo.

Exceção: foco de teclado, ver §3.8.

### 3.7 Motion

| Token | Duração | Uso |
|---|---|---|
| Curto | 110ms | Hover de botão, mudança de fundo. |
| Médio | 160ms | Transição de cor de borda, feedback de input. |
| Longo | 240ms | Reveal de painel, troca de layout (grid). |

`prefers-reduced-motion: reduce` **deve** zerar `animation` e `transition` na superfície. Padrão obrigatório no fim de cada arquivo de página:

```css
@media (prefers-reduced-motion: reduce) {
  .page *, .page *::before, .page *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

### 3.8 Foco de teclado

Todo elemento interativo expõe foco por **outline azul**, não por translate+sombra:

```css
:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
```

Em inputs/textarea/select, o foco também muda `border-color` para `--blue` (sem outline-offset, porque a borda já é grossa).

---

## 4. Componentes

Para cada componente: **anatomia → estados**. Estados sempre cobertos: `default · hover · focus-visible · active · disabled · loading · error` (quando aplicável).

### 4.1 Button

Anatomia: container com borda 2px ink, padding `14px 22px`, mono uppercase, ícone opcional como pseudo-elemento `::before`.

Variantes:

| Variante | Background | Cor texto | Quando usar |
|---|---|---|---|
| `primary` | `--blue` | `--paper` | Ação principal de uma tela (uma por contexto). |
| `secondary` | `--paper` | `--ink` | Ações alternativas. |
| `explore` | `--lime` | `--ink` | Ações ligadas ao usuário/positivas (ex.: "Explorar fonte"). |
| `loading` | `--yellow` | `--ink` | Estado em andamento, com `::before` piscando. |
| `danger` | `--danger` | `--paper` | Destrutivas (deletar, cancelar irreversível). |

Estados:
- `hover`: `border-color` muda para variante mais escura (ex.: `--blue-deep`); fundo escurece levemente. **Sem deslocamento, sem sombra.**
- `focus-visible`: outline azul 2px (§3.8).
- `active`: fundo aplica `--ink` overlay sutil (filter: brightness(0.92)) — sem `translate`.
- `disabled`: `opacity: 0.45; cursor: not-allowed`.
- `loading`: troca para variante `loading` automaticamente; `::before` é um quadrado piscando (animação `blink`).

### 4.2 Input / Textarea / Select

Anatomia: 100% width, padding `14px 16px`, fundo `--paper`, borda 2px ink, fonte mono para `input` (IDs/segredos), sans para textarea (texto longo) e select.

Estados:
- `default`: borda ink.
- `hover`: borda escurece (sem mudança de fundo).
- `focus-visible`: `border-color: var(--blue)` + sem outline adicional (a borda já é grossa).
- `disabled`: `opacity: 0.5; background: var(--paper-deep)`.
- `error`: `border-color: var(--danger)` + mensagem de erro abaixo, mono, cor `--danger`.
- Placeholder: `--ink` com `opacity: 0.32`.

### 4.3 Card / Panel

Anatomia: superfície com borda 2px ink, fundo `--paper` (card) ou `--paper-deep` (painel/seção). Header opcional em slab `--ink` com texto `--paper` mono uppercase.

Estados:
- `default`: estático.
- `hover` (quando o card é interativo, ex.: history): muda fundo para `--paper-deep`. Sem deslocamento.
- `selected/active` (history): fundo `--lime`.

### 4.4 Badge / Chip

Anatomia: pílula retangular (raio 0), padding `3–6px 10–12px`, mono uppercase, font-size 0.62–0.78rem.

Variantes:
- **Status do sistema** (`processed`, `pending`, `failed`): fundo seguindo papel semântico (`--lime`, `--paper-deep`, `--danger`).
- **Modo selecionado** (`global`, `focado`): fundo `--blue`, texto `--paper`.
- **Numérica** (top-k, total): fundo `--ink`, texto `--paper`.
- **Decorativa de seção** (`MODE`, `FOCUS`, `TOP-K`, `ENCRYPTED`): fundo da cor semântica que representa, posicionada como `::after` no canto do campo.

### 4.5 Alert

Anatomia: faixa horizontal com badge quadrado à esquerda + mensagem à direita, borda 2px ink, padding `18px 22px`, mono.

Variantes:
- `invalid`: fundo `--yellow`, texto ink. Validação não bloqueante.
- `unauthorized`: fundo `--danger`, texto paper. Acesso/permissão.
- `technical`: fundo `--paper`, texto ink. Erros técnicos genéricos.

Animação de entrada: deslocamento vertical sutil `220ms`, sem "slam" sonoro.

### 4.6 Transcript bubble

Anatomia: bloco com borda 2px ink, padding 18px, max-width ~760px.

Variantes:
- `assistant`: fundo `--paper`, alinhado à esquerda.
- `user`: fundo `--lime`, alinhado à direita.

Cabeçalho mono uppercase com identificador (ASSISTENTE / VOCÊ) e timestamp. Texto em sans, `white-space: pre-wrap`.

### 4.7 Empty state

Anatomia: bloco com `2px dashed var(--ink)`, fundo `--paper`, mono, texto centralizado, `opacity: 0.78`.

Sempre traz: o que está vazio + por quê + ação opcional. Ex.: "Nenhuma fonte recuperada para esta pergunta. Tente reformular ou ampliar o top-k."

---

## 5. Layout e responsividade

- Container central: `max-width: 1320px`, margem horizontal automática (16px lateral).
- Grid principal: 1 coluna por padrão; vira 2 colunas (`auditAside` à esquerda, conteúdo à direita) quando há auditoria aberta, em viewports ≥ 1024px.
- Breakpoints: **720px** (composer/toolbar empilham), **860px** (header empilha, source cards perdem coluna do numeral), **1024px** (audit aside vira topo em vez de lateral).
- Sticky: o composer (`.composerWrap`) permanece sticky no rodapé do chat; aside de auditoria sticky no topo (24px de offset).

---

## 6. Não-fazer

1. **Sem sombras offset** (`Npx Npx 0 0 ink`). Profundidade = borda + fundo.
2. **Sem bordas > 2px** no fluxo principal. 3px e 4px ficam apenas em referências históricas (a serem migradas).
3. **Sem usar `--lime` como ação primária** ou em input vazio. Lime = positivo/usuário.
4. **Sem `--yellow` para erro** e sem `--danger` para aviso comum. Os papéis são rígidos.
5. **Sem traduzir termos consagrados** (embedding, top-k, chunk) só por purismo PT-BR.
6. **Sem tooltips como único canal** para metadados de governança (status, versão, IDs). Eles são primeira classe.
7. **Sem animações > 240ms** no fluxo principal. `prefers-reduced-motion: reduce` deve zerar tudo.

---

## 7. Histórico de aplicação

- Aplicação inicial em `/query`: ver entrada correspondente em [CHANGELOG.md](./CHANGELOG.md) quando concluída.
- `/` (home), `/ingestion`, `/indexing`: pendentes — serão migrados em iterações próprias.
