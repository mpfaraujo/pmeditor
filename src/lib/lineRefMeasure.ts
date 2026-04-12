/**
 * lineRefMeasure.ts
 *
 * Duas funções principais:
 *
 * 1. resolverRefs — mede em qual linha visual cada âncora (text_anchor) aparece
 *    e atualiza os nodes line_ref com "(linha N)" ou "(linhas N–M)".
 *
 * 2. injectLineNumbers — injeta labels de numeração na margem de containers
 *    com data-numbered="true" (base_text ou poem), pulando .block-title e
 *    linhas vazias, numerando a cada STEP linhas (padrão: 5).
 *
 * Chamado por useEffect em montar/page.tsx após qualquer mudança de layout.
 */

const TOLERANCIA_PX = 4;
const LINE_NUMBER_CLASS = "line-number-label";

// ─── Utilitários compartilhados ───────────────────────────────────────────────

/**
 * Constrói lista ordenada de Y (viewport) das linhas com conteúdo de texto
 * dentro de `container`, excluindo filhos diretos com classe `.block-title`.
 * Varre palavra a palavra (mais rápido que char-a-char).
 */
function buildLineYMap(
  container: HTMLElement,
  excludeTitles = false
): number[] {
  const lineYs: number[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!excludeTitles) return NodeFilter.FILTER_ACCEPT;
      // Rejeita text nodes que estão dentro de .block-title
      let el: Node | null = node.parentNode;
      while (el && el !== container) {
        if ((el as HTMLElement).classList?.contains("block-title"))
          return NodeFilter.FILTER_REJECT;
        el = el.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    let pos = 0;
    for (const word of text.split(/(\s+)/)) {
      if (word.length > 0 && word.trim().length > 0) {
        try {
          range.setStart(node, pos);
          range.setEnd(node, Math.min(pos + word.length, node.length));
          const rects = range.getClientRects();
          for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            if (
              r.width > 0 &&
              !lineYs.some((y) => Math.abs(y - r.top) < TOLERANCIA_PX)
            ) {
              lineYs.push(r.top);
            }
          }
        } catch {
          // range inválido — ignora
        }
      }
      pos += word.length;
    }
  }

  return lineYs.sort((a, b) => a - b);
}

/**
 * Dado um Y absoluto (viewport) e o mapa de Ys, retorna o número de linha
 * 1-based dentro do mapa fornecido (que já excluiu títulos/vazios).
 */
function resolveLineNumber(top: number, lineYs: number[]): number {
  const idx = lineYs.findIndex((y) => Math.abs(y - top) < TOLERANCIA_PX);
  return idx >= 0 ? idx + 1 : lineYs.length + 1;
}

function formatRef(first: number, last: number): string {
  return first === last ? `l. ${first}` : `ll. ${first}–${last}`;
}

// ─── 1. resolverRefs ──────────────────────────────────────────────────────────

/**
 * Procura todos os `.base-text` dentro de `provaContainer`,
 * calcula os números de linha de cada `[data-anchor-id]` e
 * injeta o texto nos `[data-line-ref]` correspondentes.
 */
/** Verifica se um elemento está dentro da camada de medição invisível. */
function isInMeasureLayer(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur) {
    if (cur.classList.contains("measure-layer")) return true;
    cur = cur.parentElement;
  }
  return false;
}

/**
 * Encontra o container de medição para uma âncora:
 * - .base-text mais próximo (prioridade — texto base de conjunto)
 * - .statement mais próximo (texto digitado na própria questão)
 * - .question-readonly-root mais próximo (questão sem base-text)
 * - Fallback: o próprio provaContainer
 */
function findAnchorContainer(
  anchorEl: HTMLElement,
  provaContainer: HTMLElement
): HTMLElement {
  let el: HTMLElement | null = anchorEl.parentElement;
  while (el && el !== provaContainer) {
    if (el.classList.contains("base-text")) return el;
    if (el.classList.contains("statement")) return el;
    el = el.parentElement;
  }
  el = anchorEl.parentElement;
  while (el && el !== provaContainer) {
    if (el.classList.contains("question-readonly-root")) return el;
    el = el.parentElement;
  }
  return provaContainer;
}

export function resolverRefs(provaContainer: HTMLElement): void {
  const anchorMap = new Map<string, string>();

  provaContainer.querySelectorAll<HTMLElement>("[data-anchor-id]").forEach((anchorEl) => {
    // Ignora âncoras na camada de medição invisível
    if (isInMeasureLayer(anchorEl)) return;

    const id = anchorEl.getAttribute("data-anchor-id");
    if (!id) return;

    const container = findAnchorContainer(anchorEl, provaContainer);
    const lineYs = buildLineYMap(container, true);
    if (lineYs.length === 0) return;

    const range = document.createRange();
    range.selectNodeContents(anchorEl);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    if (rects.length === 0) return;

    const firstLine = resolveLineNumber(rects[0].top, lineYs);
    const lastLine = resolveLineNumber(rects[rects.length - 1].top, lineYs);
    anchorMap.set(id, formatRef(firstLine, lastLine));
  });

  // Ignora line_refs na measure-layer também
  provaContainer.querySelectorAll<HTMLElement>("[data-line-ref]").forEach((refEl) => {
    if (isInMeasureLayer(refEl)) return;
    const anchorId = refEl.getAttribute("data-line-ref");
    if (!anchorId) return;
    const texto = anchorMap.get(anchorId);
    refEl.textContent = texto ?? "l. ?";
  });
}

// ─── 2. injectLineNumbers ─────────────────────────────────────────────────────

/**
 * Remove labels de numeração injetados anteriormente num container.
 */
function clearLineNumbers(container: HTMLElement): void {
  container
    .querySelectorAll(`.${LINE_NUMBER_CLASS}`)
    .forEach((el) => el.remove());
}

/**
 * Injeta labels de numeração de linha na margem esquerda de `container`.
 * Pula .block-title e linhas vazias.
 * Numera a cada `step` linhas (ex: 5 → exibe 5, 10, 15...).
 * `containerRect` é o bounding rect do container (para posicionamento relativo).
 */
function injectLabels(
  container: HTMLElement,
  lineYs: number[],
  step: number
): void {
  const containerRect = container.getBoundingClientRect();

  lineYs.forEach((y, idx) => {
    const lineNum = idx + 1;
    if (lineNum % step !== 0) return;

    const label = document.createElement("span");
    label.className = LINE_NUMBER_CLASS;
    label.setAttribute("data-line-number", String(lineNum));
    label.setAttribute("aria-hidden", "true");
    // Posicionado relativamente ao container
    label.style.top = `${y - containerRect.top}px`;
    container.appendChild(label);
  });
}

/**
 * Ponto de entrada para numeração de linhas.
 * Procura todos os containers com data-numbered="true" dentro de `provaContainer`
 * (tanto .base-text quanto .poem) e injeta os labels na margem.
 */
export function injectLineNumbers(
  provaContainer: HTMLElement,
  step = 5
): void {
  provaContainer
    .querySelectorAll<HTMLElement>("[data-numbered='true']")
    .forEach((container) => {
      // Remove labels anteriores para evitar duplicatas
      clearLineNumbers(container);

      // Garante position:relative para posicionamento absoluto dos labels
      const pos = getComputedStyle(container).position;
      if (pos === "static") container.style.position = "relative";

      const lineYs = buildLineYMap(container, true);
      if (lineYs.length === 0) return;

      injectLabels(container, lineYs, step);
    });
}
