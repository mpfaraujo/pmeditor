---
name: Plano de melhorias de cursor/caret — ProseMirror
description: Análise de risco e plano de implementação para corrigir cursor sumindo, texto pulando e perda de seleção no QuestionEditor
type: project
---

## Sintomas confirmados pelo usuário

1. **Cursor some** durante a edição
2. **Texto pula** durante a digitação
3. **Seleção com mouse falha** — perde a capacidade de selecionar de hora em hora

---

## Mapa dos nós atômicos do schema e seu comportamento atual

O schema tem 4 nós com `atom: true` (ProseMirror os trata como um único caractere indivisível):

| Nó | Tipo | inline | NodeView | contentEditable |
|----|------|--------|----------|-----------------|
| `math_inline` | átomo | sim | `MathInlineView` (KaTeX) | `"false"` explícito |
| `image` | átomo | sim | nenhum — usa `toDOM: ["img", attrs]` | herdado (imgs são não-editáveis) |
| `math_block` | átomo | não (bloco) | nenhum — usa `toDOM: ["div", ...]` | herdado |
| `line_ref` | átomo | sim | nenhum — usa `toDOM: ["span", ..., "l. ?"]` | herdado |

E um nó com `isolating: true`:

| Nó | isolating | Efeito |
|----|-----------|--------|
| `table` | sim | seleção não atravessa a fronteira da tabela |

---

## Diagnóstico concreto — por que cada sintoma acontece

### Sintoma 1 — Cursor some

**Causa raiz: `caret-color: transparent` + `cursorPlugin` que falha em vários contextos.**

O CSS esconde o caret nativo:
```css
.ProseMirror { caret-color: transparent; }
```

O `cursorPlugin` cria uma decoração visual `<span class="pm-custom-caret">` **somente quando**:
```typescript
selection instanceof TextSelection && selection.empty
```

O cursor some (decoração não é criada) nos seguintes cenários reais do editor:

**a) Clicar em ou perto de `math_inline`:**
O browser às vezes coloca o cursor dentro do `<span contentEditable="false">` do KaTeX. O browser
então corrige para a posição de texto mais próxima, mas durante esse instante o ProseMirror
pode ter criado uma `NodeSelection` (nó selecionado). Com `NodeSelection`, `selection.empty`
é `false` → decoração não criada → cursor invisível momentaneamente. Em alguns browsers isso
dura tempo suficiente para o usuário perceber.

**b) Clicar em `image`:**
Imagens inline com `atom: true` recebem `NodeSelection` quando clicadas. Seleção não é vazia
→ `cursorPlugin` não cria decoração → cursor some enquanto o nó está selecionado.

**c) Selecionar texto com mouse (drag):**
Durante o drag, a seleção nunca é `empty` (`selection.empty = false`) → `cursorPlugin` retorna
`DecorationSet.empty` em toda transação durante o arrasto → nenhum caret visual. O caret nativo
está escondido por CSS. Resultado: o usuário não vê cursor durante a seleção, o que pode fazer
parecer que o editor "travou".

**d) Navegar com seta por cima de `math_inline` ou `line_ref`:**
O ProseMirror pode criar brevemente uma `NodeSelection` para o nó átomico ao navegar com seta.
Mesmo que dure 1 frame, o cursor some.

**e) `math_block` no fim de um container (sem parágrafo após):**
Se o documento termina com um `math_block`, não há posição de texto disponível após ele.
O cursor fica "preso" antes do bloco. Sem gapcursor, o usuário não consegue posicionar o
cursor após um `math_block` que está no final.

---

### Sintoma 2 — Texto pula

**Causa raiz: `force((n) => n + 1)` no `dispatchTransaction`.**

```typescript
dispatchTransaction(tr) {
  const ns = ev.state.apply(tr);
  ev.updateState(ns);       // ← correto e síncrono
  // ...
  recompute(ev);            // ← recalcula algo (possivelmente alturas/paginação)
  force((n) => n + 1);     // ← força re-render React em CADA transação
}
```

Cada tecla pressionada → transação → `force()` → React re-renderiza `QuestionEditor` → toolbar,
barra de metadados e componentes ao redor re-renderizam → possíveis mudanças de layout →
deslocamento visual do editor.

O `recompute(ev)` agrava: se recalcula alturas para paginação (comportamento provável dado
o contexto do projeto), qualquer reflow durante a digitação pode deslocar o cursor visualmente.

---

### Sintoma 3 — Perda de seleção com mouse

**Causa raiz: `force()` interrompe o drag de seleção.**

Durante um drag com mouse:
1. ProseMirror dispara `selectionchange` a cada pixel de movimento
2. Cada `selectionchange` gera uma transação → `dispatchTransaction` → `force()`
3. `force()` agenda um re-render React
4. O re-render pode acontecer enquanto o mouse ainda está pressionado
5. Se componentes pai mudam de tamanho ou posição, o evento de mouse pode "escapar" do editor
6. O browser cancela o drag → seleção perdida

Adicionalmente: `image` e `math_inline` inline sem gapcursor criam "buracos" onde o cursor
não consegue entrar. Se o usuário tentar selecionar *através* desses nós com o mouse, o
ProseMirror pode não conseguir mapear todas as posições e a seleção "trava".

---

## As melhorias e seus riscos concretos

---

### Melhoria 1 — Adicionar `prosemirror-gapcursor`

**O que resolve:**
- Cursor pode posicionar antes/depois de `image` inline
- Cursor pode posicionar antes/depois de `math_block` no final de container
- Cursor pode posicionar entre dois `math_inline` consecutivos
- Cursor pode posicionar antes/depois de `line_ref` em extremidades
- Navegação por teclado (setas) passa *por* nós atômicos em vez de pular sobre eles

**O que fazer:**
```typescript
// onde os plugins são montados
import { gapCursor } from "prosemirror-gapcursor";
import "prosemirror-gapcursor/style/gapcursor.css";

// adicionar na lista de plugins — antes do baseKeymap
gapCursor()
```

**Riscos:**
- **Quase zero.** Plugin oficial, mantido pela equipe do ProseMirror.
- **Único cuidado:** o CSS **precisa** ser importado. Sem ele, o cursor de gap existe mas
  é invisível — parece que não funciona. Confirmar que o bundler (Next.js) inclui o CSS.
- **Interação com `table`:** tabelas têm `isolating: true`. O gapcursor funciona
  corretamente em nós isolantes — o cursor artificial aparece na borda da tabela, não dentro.
- **Interação com `cursorPlugin`:** os dois coexistirão, mas o gapcursor renderiza seu próprio
  cursor via CSS (classe `ProseMirror-gapcursor`) quando ativo, enquanto o `cursorPlugin`
  não renderiza nada nessa posição (não é TextSelection). Sem conflito visual, mas o gapcursor
  terá estilo diferente do `pm-custom-caret`. Resolver junto com a Melhoria 2.

**Risco geral: zero. Pode ir em produção sozinho.**

---

### Melhoria 2 — Remover `cursorPlugin` e restaurar caret nativo

**O que resolve:**
- Cursor visível em *todos* os contextos: TextSelection, NodeSelection, seleção em andamento,
  qualquer estado
- Seleção com mouse tem cursor visível durante o drag
- Cursor visível ao selecionar `image` ou `math_inline`

**O que fazer:**
1. Remover `cursorPlugin` da lista de plugins
2. No `prosemirror.css`:
   - Remover `caret-color: transparent` do `.ProseMirror`
   - Substituir por `caret-color: #1a6680` (mesma cor do plugin)
   - Remover `.pm-custom-caret` e `@keyframes pm-caret-blink`
3. Opcional: ajustar `caret-width` se suportado pelo browser alvo

**Por que o plugin existe:**
Provavelmente criado para controlar cor e animação do cursor de forma consistente entre
browsers, dado que o CSS documenta explicitamente a motivação:
```css
/* Caret via decorator: display:inline + border-left.
   Inline elements com apenas border-left não têm dimensão vertical própria */
```
A motivação era visual (cor `#1a6680` e animação customizada), não correção de bug.

**Riscos:**
- **Visual:** o caret nativo tem espessura e comportamento diferentes entre browsers.
  Chrome, Firefox e Safari renderizam o caret de formas ligeiramente distintas. A animação
  de piscar será a padrão do browser (normalmente 1s, não 1.1s como no plugin).
- **Cor:** `caret-color: #1a6680` funciona em todos os browsers modernos. Sem risco técnico.
- **Firefox e nós atômicos:** o Firefox tem bugs históricos (Issue #1113) onde o caret
  some ao navegar próximo a elementos `contenteditable="false"`. Com o gapcursor (Melhoria 1)
  instalado, esses casos ficam cobertos — o gap cursor cobre exatamente as posições onde
  o Firefox falha. Instalar Melhoria 1 antes de aplicar esta.
- **`math_inline` e KaTeX:** o `MathInlineView` renderiza KaTeX dentro de um span com
  `contentEditable="false"`. O caret nativo nunca entra dentro do span (correto). O caret
  aparece antes e depois do span normalmente. Sem problema.

**Risco geral: baixo. Instalar após a Melhoria 1.**

---

### Melhoria 3 — Remover ou isolar `force((n) => n + 1)` do `dispatchTransaction`

**O que resolve:**
- Texto para de "pular" durante digitação
- Re-renders do React não interrompem drag de seleção

**O que precisa ser auditado antes:**
O `force()` provavelmente existe para atualizar o estado visual da toolbar (botões
"negrito ativo", "itálico ativo", etc.). Verificar como `QuestionEditor` passa o estado
atual para a toolbar:

- Se a toolbar lê `view.state` diretamente via uma referência estável → `force()` pode ser
  removido sem impacto visual
- Se a toolbar lê via uma prop `activeMarks` que só é atualizada pelo re-render → remover
  `force()` vai "congelar" o estado visual dos botões

**Estratégia segura (sem risco):**
Em vez de re-renderizar o componente inteiro, extrair apenas o estado necessário (marks ativas,
tipo do nó atual) e colocar num `useState` separado atualizado cirurgicamente:

```typescript
dispatchTransaction(tr) {
  const ns = ev.state.apply(tr);
  ev.updateState(ns);
  recompute(ev);
  // Só atualiza o estado da toolbar, não força re-render completo
  setToolbarState(computeToolbarState(ns));
  // force((n) => n + 1);  ← remover
}
```

**Risco geral: médio. Requer auditoria da toolbar antes de remover.**

---

### Melhoria 4 — `useState<EditorView>` → `useRef<EditorView>` no `QuestionEditor`

O `RichTextMiniEditor` já usa `useRef` — padrão correto. O `QuestionEditor` usa `useState`,
o que provoca um re-render extra quando a view é criada (`setView(ev)` agenda re-render).

**Riscos:**
- Todo código que lê `view` (do state) para checar se o editor está pronto vai precisar
  trocar para `viewRef.current`
- Componentes filhos que recebem `view` como prop não re-renderizam automaticamente
  quando a view é criada — precisaria de um `useState<boolean>` separado para sinalizar
  "editor pronto"
- Mudança invasiva

**Risco geral: médio-alto. Deixar por último — as melhorias 1-3 já resolvem os sintomas.**

---

## Ordem de implementação

| Ordem | Melhoria | Resolve | Risco |
|-------|----------|---------|-------|
| 1º | GapCursor | cursor travado em `image`, `math_block`, `line_ref`, `math_inline` consecutivos | zero |
| 2º | Remover `cursorPlugin` + `caret-color` nativo | cursor some, cursor ausente durante seleção | baixo |
| 3º | Isolar/remover `force()` | texto pulando, seleção interrompida | médio |
| 4º | `useState` → `useRef` | re-render extra na criação | médio-alto |

**Regra:** testar cada melhoria em isolamento antes de passar para a próxima.
As melhorias 1 e 2 andam juntas — não faz sentido ter gapcursor com estilo diferente do
caret customizado. Implementar no mesmo commit.

---

## O que NÃO fazer

- **Não criar versão mais complexa do `cursorPlugin`** tratando NodeSelection, AllSelection etc.
  A decoração sempre terá edge cases. O caret nativo resolve todos por definição.
- **Não criar "ilhas contenteditable"** — nenhum NodeView deve ter `contentEditable="false"`
  no `dom` E um `contentDOM` interno. A implementação atual (`MathInlineView` sem `contentDOM`)
  está correta.
- **Não adicionar NodeViews desnecessários** para `image`, `math_block` ou `line_ref` apenas
  para controlar o comportamento do cursor — o gapcursor resolve sem NodeViews.
