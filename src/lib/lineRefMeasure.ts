/**
 * lineRefMeasure.ts
 *
 * 1. resolverRefs — mede em qual linha visual cada âncora (text_anchor) aparece
 *    e atualiza os nodes line_ref com "(linha N)" ou "(linhas N–M)".
 *    Usado no preview do editor de questões.
 *
 * 2. injectLineNumbers — injeta labels de numeração na margem de containers
 *    com data-numbered="true" (base_text ou poem), pulando .block-title e
 *    linhas vazias, numerando a cada STEP linhas (padrão: 5).
 *
 * 3. measureAnchors — mede em que linha cada [data-anchor-id] cai dentro de
 *    um container já renderizado. Usado pelos containers canônicos de medição
 *    no editor de textos base para persistir linhas por layout.
 */

/**
 * Mapa de linhas por âncora: { anchorId → número de linha 1-based }
 * Resultado de measureAnchors() para um único container (um layout).
 */
export type AnchorLineNumbers = Record<string, number>;

/**
 * Mapa canônico persistido junto do texto base.
 * Chaves: "2col" | "1col" | "acessivel"
 * Valores: { anchorId → número de linha }
 */
export type CanonicalLineMap = {
  "2col": AnchorLineNumbers;
  "1col": AnchorLineNumbers;
  "acessivel": AnchorLineNumbers;
};

/**
 * Mede em que linha VISUAL cada [data-anchor-id] cai dentro de `containerEl`.
 *
 * Usa contagem de Ys via getBoundingClientRect (palavra a palavra) — consistente
 * com o que o aluno vê na numeração injetada por injectLineNumbers.
 *
 * Retorna { anchorId → número 1-based }.
 */
export function measureAnchors(containerEl: HTMLElement): AnchorLineNumbers {
  const lineYs = buildLineYMap(containerEl, true);
  if (lineYs.length === 0) return {};

  const result: AnchorLineNumbers = {};

  containerEl.querySelectorAll<HTMLElement>("[data-anchor-id]").forEach((anchorEl) => {
    const id = anchorEl.getAttribute("data-anchor-id");
    if (!id) return;

    const range = document.createRange();
    range.selectNodeContents(anchorEl);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    if (rects.length === 0) return;

    result[id] = resolveLineNumber(rects[0].top, lineYs);
  });

  return result;
}

/**
 * Formata o número de linha para exibição na prova.
 * Sempre usa "~" para sinalizar que é referência aproximada.
 */
export function formatLineRef(line: number | undefined): string {
  if (line === undefined || line <= 0) return "(l. ~?)";
  return `(l. ~${line})`;
}

const TOLERANCIA_PX = 4;

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
  return first === last ? `(l. ~${first})` : `(ll. ~${first}–${last})`;
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildLineYMapForElements(
  elements: HTMLElement[],
  excludeTitles = false
): number[] {
  const lineYs: number[] = [];
  for (const el of elements) {
    for (const y of buildLineYMap(el, excludeTitles)) {
      if (!lineYs.some((existing) => Math.abs(existing - y) < TOLERANCIA_PX)) {
        lineYs.push(y);
      }
    }
  }
  return lineYs.sort((a, b) => a - b);
}

function buildAnchorMapForQuestion(
  questionEl: HTMLElement,
  debugAnchors?: Array<{
    qId: string;
    anchorId: string;
    scopeId: string | null;
    lineYsCount: number;
    rectCount: number;
    firstRectTop: number | null;
    lastRectTop: number | null;
    resolvedText: string | null;
  }>
): Map<string, string> {
  const anchorMap = new Map<string, string>();
  const scopeCache = new Map<string, number[]>();
  const qId = questionEl.getAttribute("data-q-id") ?? "";

  questionEl.querySelectorAll<HTMLElement>("[data-anchor-id]").forEach((anchorEl) => {
    const anchorId = anchorEl.getAttribute("data-anchor-id");
    if (!anchorId) return;

    const scopedAncestor = anchorEl.closest<HTMLElement>("[data-line-scope]");
    const scopeId = scopedAncestor?.getAttribute("data-line-scope");

    let lineYs: number[];
    if (scopeId) {
      if (!scopeCache.has(scopeId)) {
        const scopeNodes = Array.from(
          questionEl.querySelectorAll<HTMLElement>(
            `[data-line-scope="${escapeAttrValue(scopeId)}"]`
          )
        );
        scopeCache.set(scopeId, buildLineYMapForElements(scopeNodes, true));
      }
      lineYs = scopeCache.get(scopeId) ?? [];
    } else {
      const cacheKey = "__question__";
      if (!scopeCache.has(cacheKey)) {
        scopeCache.set(cacheKey, buildLineYMap(questionEl, true));
      }
      lineYs = scopeCache.get(cacheKey) ?? [];
    }

    if (lineYs.length === 0) {
      debugAnchors?.push({
        qId,
        anchorId,
        scopeId: scopeId ?? null,
        lineYsCount: 0,
        rectCount: 0,
        firstRectTop: null,
        lastRectTop: null,
        resolvedText: null,
      });
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(anchorEl);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    if (rects.length === 0) {
      debugAnchors?.push({
        qId,
        anchorId,
        scopeId: scopeId ?? null,
        lineYsCount: lineYs.length,
        rectCount: 0,
        firstRectTop: null,
        lastRectTop: null,
        resolvedText: null,
      });
      return;
    }

    const firstLine = resolveLineNumber(rects[0].top, lineYs);
    const lastLine = resolveLineNumber(rects[rects.length - 1].top, lineYs);
    const resolvedText = formatRef(firstLine, lastLine);
    anchorMap.set(anchorId, resolvedText);
    debugAnchors?.push({
      qId,
      anchorId,
      scopeId: scopeId ?? null,
      lineYsCount: lineYs.length,
      rectCount: rects.length,
      firstRectTop: rects[0].top,
      lastRectTop: rects[rects.length - 1].top,
      resolvedText,
    });
  });

  return anchorMap;
}

export function resolveMountedLineRefs(root: HTMLElement) {
  const measureWrappers = Array.from(
    root.querySelectorAll<HTMLElement>(".measure-layer .questao-item-wrapper[data-q-id]")
  );

  if (measureWrappers.length === 0) {
    return {
      debugAnchors: [],
      debugApplied: [],
    };
  }

  const anchorMapsByQId = new Map<string, Map<string, string>>();
  const baseMapsByParentId = new Map<string, Map<string, string>>();
  const debugAnchors: Array<{
    qId: string;
    anchorId: string;
    scopeId: string | null;
    lineYsCount: number;
    rectCount: number;
    firstRectTop: number | null;
    lastRectTop: number | null;
    resolvedText: string | null;
  }> = [];
  const debugApplied: Array<{
    qId: string;
    parentId: string | null;
    ownMap: Array<[string, string]>;
    mergedMap: Array<[string, string]>;
    lineRefs: Array<{ anchorId: string; text: string }>;
  }> = [];

  for (const wrapper of measureWrappers) {
    const qId = wrapper.getAttribute("data-q-id");
    if (!qId) continue;

    const anchorMap = buildAnchorMapForQuestion(wrapper, debugAnchors);
    anchorMapsByQId.set(qId, anchorMap);

    const parentId = wrapper.getAttribute("data-set-parent-id");
    if (parentId && wrapper.getAttribute("data-is-set-base") === "1") {
      baseMapsByParentId.set(parentId, anchorMap);
    }
  }

  root.querySelectorAll<HTMLElement>(".questao-item-wrapper[data-q-id]").forEach((wrapper) => {
    if (isInMeasureLayer(wrapper)) return;

    const qId = wrapper.getAttribute("data-q-id");
    if (!qId) return;

    const ownMap = anchorMapsByQId.get(qId) ?? new Map<string, string>();
    const mergedMap = new Map(ownMap);

    const parentId = wrapper.getAttribute("data-set-parent-id");
    if (parentId) {
      const baseMap = baseMapsByParentId.get(parentId);
      if (baseMap) {
        for (const [anchorId, text] of baseMap) {
          if (!mergedMap.has(anchorId)) mergedMap.set(anchorId, text);
        }
      }
    }

    wrapper.querySelectorAll<HTMLElement>("[data-line-ref]").forEach((refEl) => {
      const anchorId = refEl.getAttribute("data-line-ref");
      if (!anchorId) return;
      refEl.textContent = mergedMap.get(anchorId) ?? "l. ?";
    });

    debugApplied.push({
      qId,
      parentId,
      ownMap: Array.from(ownMap.entries()),
      mergedMap: Array.from(mergedMap.entries()),
      lineRefs: Array.from(wrapper.querySelectorAll<HTMLElement>("[data-line-ref]")).map((refEl) => ({
        anchorId: refEl.getAttribute("data-line-ref") ?? "",
        text: (refEl.textContent ?? "").trim(),
      })),
    });
  });

  if (typeof window !== "undefined") {
    (window as any).__PMEDITOR_LINE_REF_RUNTIME__ = {
      debugAnchors,
      debugApplied,
    };
  }

  return {
    debugAnchors,
    debugApplied,
  };
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
 * Numera linhas visuais de texto a cada `step` linhas.
 *
 * Conta linhas via rect.height / lineHeight (não usa mapa de Y).
 * Isso evita o problema de 2 colunas onde col1 e col2 têm o mesmo Y range
 * e os Ys seriam deduplicados, causando contagem errada.
 *
 * Para cada parágrafo: calcula quantas linhas ele ocupa, rastreia o acumulado
 * e marca com data-line-num + --ln-top quando um múltiplo de `step` cai nele.
 *
 * Nenhum nó é inserido no DOM → sem impacto em layout/paginação.
 * Agrupa por data-q-id para contagem contínua entre fragmentos.
 */
export function injectLineNumbers(
  provaContainer: HTMLElement,
  step = 5
): void {
  // Remove marcações anteriores
  provaContainer.querySelectorAll<HTMLElement>("p[data-line-num]").forEach((p) => {
    p.removeAttribute("data-line-num");
    p.style.removeProperty("--ln-top");
  });

  // Agrupa p[data-numbered] por qId para contagem contínua entre fragmentos
  const byQId = new Map<string, HTMLElement[]>();
  provaContainer.querySelectorAll<HTMLElement>("p[data-numbered='true']").forEach((p) => {
    if (isInMeasureLayer(p)) return;
    const wrapper = p.closest<HTMLElement>(".questao-item-wrapper");
    const qId = wrapper?.getAttribute("data-q-id") ?? "__no-id__";
    if (!byQId.has(qId)) byQId.set(qId, []);
    byQId.get(qId)!.push(p);
  });

  byQId.forEach((allPs) => {
    const nonEmpty = allPs.filter((p) => (p.textContent ?? "").trim().length > 0);
    if (nonEmpty.length === 0) return;

    // Line height do primeiro parágrafo (browser resolve "normal" para px)
    const lineHeight = parseFloat(getComputedStyle(nonEmpty[0]).lineHeight) || 14;

    let cumLines = 0; // total de linhas visuais já contadas

    for (const p of nonEmpty) {
      const rect = p.getBoundingClientRect();
      // Quantas linhas visuais este parágrafo ocupa
      const pLines = Math.max(1, Math.round(rect.height / lineHeight));

      const firstLine = cumLines + 1;  // primeira linha deste parágrafo (1-based)
      const lastLine  = cumLines + pLines;

      // Primeiro múltiplo de `step` que cai neste parágrafo
      const firstTarget = Math.ceil(firstLine / step) * step;
      if (firstTarget <= lastLine) {
        const lineNum = firstTarget;
        const lineIndexInPara = firstTarget - firstLine; // 0-based dentro do parágrafo
        const offsetPx = Math.round(lineIndexInPara * lineHeight);
        if (!p.hasAttribute("data-line-num")) {
          p.setAttribute("data-line-num", String(lineNum));
          p.style.setProperty("--ln-top", `${offsetPx}px`);
        }
      }

      cumLines += pLines;
    }
  });
}
