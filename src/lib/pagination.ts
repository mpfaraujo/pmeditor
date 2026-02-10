/**
 * Lógica de paginação para provas em formato A4
 * - allowPageBreak=false: mantém comportamento atual (questão atômica)
 * - allowPageBreak=true: permite fragmentar questão por blocos do DOM
 */

export type LayoutItem =
  | { kind: "full"; q: number }
  | {
      kind: "frag";
      q: number;
      from: number; // 1-based (nth-child)
      to: number;   // 1-based (nth-child)
      first: boolean;
    };

export type PageLayout = {
  coluna1: LayoutItem[];
  coluna2: LayoutItem[];
};

export interface PaginationConfig {
  pageHeight: number;
  safetyMargin: number;
  columns: 1 | 2;
  allowPageBreak?: boolean;
}

export function calculateFirstPageCapacity(
  firstPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const questionsTop = questionsContainerElement.offsetTop;
  const firstPageTop = firstPageElement.offsetTop;
  const occupiedHeight = questionsTop - firstPageTop;
  return Math.max(0, pageHeight - occupiedHeight - safetyMargin * 1.5);
}

export function calculateOtherPageCapacity(
  otherPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const questionsTop = questionsContainerElement.offsetTop;
  const otherPageTop = otherPageElement.offsetTop;
  const occupiedHeight = questionsTop - otherPageTop;
  return Math.max(0, pageHeight - occupiedHeight - safetyMargin);
}

function px(n: number) {
  return Math.max(0, n || 0);
}

function measureOuterHeight(el: HTMLElement): number {
  const cs = window.getComputedStyle(el);
  const mt = parseFloat(cs.marginTop || "0") || 0;
  const mb = parseFloat(cs.marginBottom || "0") || 0;
  return px(el.offsetHeight + mt + mb);
}

export function measureQuestionHeights(measurementContainer: HTMLElement): number[] {
  const itemEls = Array.from(
    measurementContainer.querySelectorAll(".questao-item-wrapper")
  ) as HTMLDivElement[];

  return itemEls.map((el) => Math.max(measureOuterHeight(el), 10));
}

type SplitInfo = {
  prefixHeight: number;     // tudo antes do .questao-conteudo (inclui header)
  blocksHeights: number[];  // alturas dos filhos diretos de .questao-conteudo (1:1 com nth-child)
};

function measureSplitInfo(measurementContainer: HTMLElement, index: number): SplitInfo | null {
  const wrappers = Array.from(
    measurementContainer.querySelectorAll(".questao-item-wrapper")
  ) as HTMLElement[];

  const wrapper = wrappers[index];
  if (!wrapper) return null;

  const content = wrapper.querySelector(".questao-conteudo") as HTMLElement | null;
  if (!content) {
    return { prefixHeight: measureOuterHeight(wrapper), blocksHeights: [] };
  }

  // blocos padrão: filhos diretos
  let blockContainer: HTMLElement = content;
  let blockEls = Array.from(blockContainer.children) as HTMLElement[];

  // SE só tiver 1 wrapper interno, usar os filhos dele como blocos reais
  if (blockEls.length === 1) {
    const only = blockEls[0] as HTMLElement;
    const innerChildren = Array.from(only.children) as HTMLElement[];
    if (innerChildren.length >= 2) {
      blockContainer = only;
      blockEls = innerChildren;
    }
  }

  const blocksHeights = blockEls.map((b) => Math.max(measureOuterHeight(b), 1));
  const contentBlocksSum = blocksHeights.reduce((a, b) => a + b, 0);

  const total = Math.max(measureOuterHeight(wrapper), 10);
  const prefixHeight = Math.max(10, total - contentBlocksSum);

  return { prefixHeight, blocksHeights };
}


function buildFragmentsForQuestion(
  qIndex: number,
  split: SplitInfo,
  capFirstFrag: number,
  capNextFrag: number
): { items: LayoutItem[]; heights: number[] } | null {
  const { prefixHeight, blocksHeights } = split;

  // sem blocos -> não dá pra fatiar, mantém como full
  if (!blocksHeights.length) return null;

  const items: LayoutItem[] = [];
  const heights: number[] = [];

  let cursor = 0; // 0-based in blocksHeights
  let first = true;

  while (cursor < blocksHeights.length) {
    const cap = first ? capFirstFrag : capNextFrag;

    // prefix só na primeira parte
    let used = first ? prefixHeight : 0;

    // se nem o prefix cabe, não tem como fatiar com segurança
    if (first && used >= cap) return null;

    const start = cursor;
    while (cursor < blocksHeights.length) {
      const h = blocksHeights[cursor];
      if (cursor === start) {
        // pelo menos 1 bloco precisa caber
        if (used + h > cap) {
          // bloco sozinho não cabe -> não fragmenta (senão some)
          return null;
        }
        used += h;
        cursor++;
        continue;
      }

      if (used + h > cap) break;
      used += h;
      cursor++;
    }

    const from = start + 1;      // 1-based
    const to = cursor;          // 1-based (cursor já aponta pro próximo)
    items.push({ kind: "frag", q: qIndex, from, to, first });
    heights.push(used);

    first = false;
  }

  return { items, heights };
}

/**
 * Distribuição:
 * - allowPageBreak=false: igual ao atual
 * - allowPageBreak=true:
 *   - se uma questão estoura, tenta fragmentar por blocos de .questao-conteudo
 *   - cada fragmento vira um LayoutItem que pode ir para a próxima coluna/página
 */
export function distributeQuestionsAcrossPages(
  questionCount: number,
  questionHeights: number[],
  firstPageCapacity: number,
  otherPageCapacity: number,
  columns: 1 | 2,
  allowPageBreak: boolean,
  measureItemsRef: HTMLElement
): PageLayout[] {
  const newPages: PageLayout[] = [];
  let page: PageLayout = { coluna1: [], coluna2: [] };

  let col: "coluna1" | "coluna2" = "coluna1";
  let used = 0;
  let pageIndex = 0;

  const getCap = () => (pageIndex === 0 ? firstPageCapacity : otherPageCapacity);

  const pushNewPage = () => {
    newPages.push(page);
    pageIndex++;
    page = { coluna1: [], coluna2: [] };
    col = "coluna1";
    used = 0;
  };

  const nextColumnOrPage = () => {
    if (columns === 2 && col === "coluna1") {
      col = "coluna2";
      used = 0;
      return;
    }
    pushNewPage();
  };

  for (let i = 0; i < questionCount; i++) {
    const fullH = questionHeights[i] ?? 0;
    const cap = getCap();

    // cabe inteira aqui
    if (!(used > 0 && used + fullH > cap)) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    // não cabe inteira -> tenta mover pra próxima coluna/página
    // (mantém seu comportamento atual)
    if (!allowPageBreak) {
      nextColumnOrPage();
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    // allowPageBreak=true:
    // 1) se já tem algo na coluna e não cabe, vai pra próxima coluna/página
    if (used > 0) {
      nextColumnOrPage();
    }

    // 2) agora estamos no topo de uma coluna vazia: se ainda não cabe, tenta fragmentar
    const capHere = getCap();
    if (fullH <= capHere) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    const split = measureSplitInfo(measureItemsRef, i);
    if (!split) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    const frag = buildFragmentsForQuestion(i, split, capHere, otherPageCapacity);
    if (!frag) {
      // fallback seguro: coloca inteira (vai “estourar”, mas não some)
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    // distribui fragmentos sequencialmente, respeitando colunas/páginas
    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k];
      const h = frag.heights[k];
      const capNow = getCap();

      if (used > 0 && used + h > capNow) {
        nextColumnOrPage();
      }

      page[col].push(item);
      used += h;

      // próximo fragmento sempre pode ir para próxima coluna/página
      if (k < frag.items.length - 1) {
        nextColumnOrPage();
      }
    }
  }

  newPages.push(page);
  return newPages;
}

export function calculatePageLayout(
  config: PaginationConfig,
  refs: {
    firstPageRef: HTMLElement | null;
    firstQuestoesRef: HTMLElement | null;
    otherPageRef: HTMLElement | null;
    otherQuestoesRef: HTMLElement | null;
    measureItemsRef: HTMLElement | null;
  },
  questionCount: number
): PageLayout[] | null {
  if (
    !refs.firstPageRef ||
    !refs.firstQuestoesRef ||
    !refs.otherPageRef ||
    !refs.otherQuestoesRef ||
    !refs.measureItemsRef
  ) {
    return null;
  }

  if (refs.firstPageRef.offsetHeight === 0 || refs.measureItemsRef.offsetHeight === 0) {
    return null;
  }

  const firstPageCapacity = calculateFirstPageCapacity(
    refs.firstPageRef,
    refs.firstQuestoesRef,
    config.pageHeight,
    config.safetyMargin
  );

  const otherPageCapacity = calculateOtherPageCapacity(
    refs.otherPageRef,
    refs.otherQuestoesRef,
    config.pageHeight,
    config.safetyMargin
  );

  if (firstPageCapacity <= 0 || otherPageCapacity <= 0) return null;

  const questionHeights = measureQuestionHeights(refs.measureItemsRef);

  return distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity,
    config.columns,
    !!config.allowPageBreak,
    refs.measureItemsRef
  );
}
