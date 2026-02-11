/**
 * Lógica de paginação para provas em formato A4
 * - allowPageBreak=false: mantém comportamento atual (questão atômica)
 * - allowPageBreak=true: permite fragmentar questão por blocos do DOM
 * - optimizeLayout=true: bin-packing (First Fit Decreasing) para otimizar espaço
 * - optimizeLayout=false: distribuição linear sequencial (comportamento original)
 */

export type LayoutItem =
  | { kind: "full"; q: number }
  | {
      kind: "frag";
      q: number;
      from: number; // 1-based (nth-child)
      to: number; // 1-based (nth-child)
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
  optimizeLayout?: boolean;
  /** Índices das questões que são __setBase (texto base de conjunto) */
  setBaseIndexes?: number[];
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
  return Math.max(0, pageHeight - occupiedHeight - safetyMargin );
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
function measureBlockHeight(el: HTMLElement): number {
  return Math.max(Math.ceil(el.getBoundingClientRect().height), 1);
}


function measureMargins(el: HTMLElement): { mt: number; mb: number } {
  const cs = window.getComputedStyle(el);
  const mt = parseFloat(cs.marginTop || "0") || 0;
  const mb = parseFloat(cs.marginBottom || "0") || 0;
  return { mt, mb };
}

export function measureQuestionHeights(measurementContainer: HTMLElement): number[] {
  const itemEls = Array.from(
    measurementContainer.querySelectorAll(".questao-item-wrapper")
  ) as HTMLDivElement[];

  return itemEls.map((el) => Math.max(measureOuterHeight(el), 10));
}

type SplitInfo = {
  prefixHeight: number; // tudo antes do container de blocos (inclui header/banners)
  suffixHeight: number; // margem/pós-conteúdo (ex.: margin-bottom do wrapper)
  blocksHeights: number[]; // alturas dos blocos (1:1 com nth-child)
};

function pickBlockElementsFromWrapper(wrapper: HTMLElement): HTMLElement[] {
  const conteudo = wrapper.querySelector(".questao-conteudo") as HTMLElement | null;
  if (!conteudo) return [];

  const qt = conteudo.querySelector(".question-text") as HTMLElement | null;
  if (qt) {
    const kids = Array.from(qt.children) as HTMLElement[];
    if (kids.length >= 1) {
      const blocks: HTMLElement[] = [...kids];

      const options = conteudo.querySelector(".question-options") as HTMLElement | null;
      if (options) blocks.push(options);

      return blocks;
    }
  }

  let blockContainer: HTMLElement = conteudo;
  let blockEls = Array.from(blockContainer.children) as HTMLElement[];

  if (blockEls.length === 1) {
    const only = blockEls[0] as HTMLElement;
    const innerChildren = Array.from(only.children) as HTMLElement[];
    if (innerChildren.length >= 2) {
      blockContainer = only;
      blockEls = innerChildren;
    } else {
      const innerQT = only.querySelector(".question-text") as HTMLElement | null;
      if (innerQT) {
        const innerKids = Array.from(innerQT.children) as HTMLElement[];
        if (innerKids.length >= 1) {
          const blocks: HTMLElement[] = [...innerKids];

          const options = conteudo.querySelector(".question-options") as HTMLElement | null;
          if (options) blocks.push(options);

          return blocks;
        }
      }
    }
  }

  return blockEls;
}

function measureSplitInfo(measurementContainer: HTMLElement, index: number): SplitInfo | null {
  const wrappers = Array.from(
    measurementContainer.querySelectorAll(".questao-item-wrapper")
  ) as HTMLElement[];

  const wrapper = wrappers[index];
  if (!wrapper) return null;

  const content = wrapper.querySelector(".questao-conteudo") as HTMLElement | null;
  if (!content) {
    const total = Math.max(measureOuterHeight(wrapper), 10);
    const { mb } = measureMargins(wrapper);
    return { prefixHeight: total, suffixHeight: mb, blocksHeights: [] };
  }

  const blockEls = pickBlockElementsFromWrapper(wrapper);
  const blocksHeights = blockEls.map((b) => measureBlockHeight(b));

  const contentBlocksSum = blocksHeights.reduce((a, b) => a + b, 0);

  const total = Math.max(measureOuterHeight(wrapper), 10);
  const { mb } = measureMargins(wrapper);

  // Prefix = tudo que não é blocos; mas tira a margem-bottom do wrapper
  // (para não "cobrar" essa margem em todo fragmento).
  const prefixHeight = Math.max(0, total - contentBlocksSum - mb);

  return { prefixHeight, suffixHeight: mb, blocksHeights };
}

function buildFragmentsForQuestion(
  qIndex: number,
  split: SplitInfo,
  capFirstFrag: number,
  capNextFrag: number
): { items: LayoutItem[]; heights: number[] } | null {
  const FIT_EPS = 100; // px de tolerância pra não quebrar cedo por arredondamento

  const { prefixHeight, suffixHeight, blocksHeights } = split;

  if (!blocksHeights.length) return null;

  const items: LayoutItem[] = [];
  const heights: number[] = [];

  let cursor = 0;
  let first = true;

  while (cursor < blocksHeights.length) {
    const cap = first ? capFirstFrag : capNextFrag;

    let used = first ? prefixHeight : 0;

   if (first && used >= cap + FIT_EPS) return null;

    const start = cursor;

    while (cursor < blocksHeights.length) {
      const h = blocksHeights[cursor];

      if (cursor === start) {
        if (used + h > cap + FIT_EPS) return null;
        used += h;
        cursor++;
        continue;
      }

if (used + h > cap + FIT_EPS) break;
      used += h;
      cursor++;
    }

    const from = start + 1;
    const to = cursor;

    items.push({ kind: "frag", q: qIndex, from, to, first });

    // Só "cobra" o suffix no ÚLTIMO fragmento — e só até o limite que ainda cabe,
    // para não quebrar mais cedo por causa de margem.
    if (cursor >= blocksHeights.length) {
      const room = Math.max(0, cap - used);
      const suffixCounted = Math.min(Math.max(0, suffixHeight || 0), room);
      heights.push(used + suffixCounted);
    } else {
      heights.push(used);
    }

    first = false;
  }

  return { items, heights };
}

/* ============================================================
   DISTRIBUIÇÃO LINEAR (comportamento original — manualOrder)
   ============================================================ */

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
  function isEmptyPage(p: PageLayout | null | undefined) {
  if (!p) return true;
  return (p.coluna1?.length ?? 0) === 0 && (p.coluna2?.length ?? 0) === 0;
}


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

    // ✅ só entra como "full" se realmente couber
    if (used + fullH <= cap) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    if (!allowPageBreak) {
      nextColumnOrPage();
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    if (used > 0) {
      nextColumnOrPage();
    }

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

    const capNextFrag = columns === 2 && col === "coluna1" ? capHere : otherPageCapacity;

    const frag = buildFragmentsForQuestion(i, split, capHere, capNextFrag);
    if (!frag) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k];
      const h = frag.heights[k];
      const capNow = getCap();

      if (used > 0 && used + h > capNow) {
        nextColumnOrPage();
      }

      page[col].push(item);
      used += h;

      if (k < frag.items.length - 1) {
        nextColumnOrPage();
      }
    }
  }

newPages.push(page);

// remove páginas vazias no início/fim (evita "cabeçalho sozinho")
while (newPages.length && isEmptyPage(newPages[0])) newPages.shift();
while (newPages.length && isEmptyPage(newPages[newPages.length - 1])) newPages.pop();

return newPages;

}

/* ============================================================
   BIN-PACKING (First Fit Decreasing) — optimizeLayout
   ============================================================

   Regras:
   - Questões __setBase + seus itens sequenciais formam um "grupo"
     que deve permanecer junto e na ordem interna.
   - Questões livres podem ser reposicionadas para otimizar espaço.
   - Fragmentação (allowPageBreak) continua funcionando.
   ============================================================ */

/** Um "slot" é uma coluna de uma página com espaço restante */
type Slot = {
  pageIndex: number;
  col: "coluna1" | "coluna2";
  remaining: number;
};

/**
 * Grupo de questões que devem permanecer juntas e em ordem.
 * Para questões livres, o grupo tem 1 elemento.
 * Para sets, o grupo é [baseIndex, item1Index, item2Index, ...].
 */
type QuestionGroup = {
  indexes: number[];        // índices em expandedQuestions
  totalHeight: number;      // soma das alturas
  isSet: boolean;           // é um grupo de set (base + itens)
};

function buildGroups(
  questionCount: number,
  questionHeights: number[],
  setBaseIndexes: number[]
): QuestionGroup[] {
  const setBaseSet = new Set(setBaseIndexes);
  const consumed = new Set<number>();
  const groups: QuestionGroup[] = [];

  for (let i = 0; i < questionCount; i++) {
    if (consumed.has(i)) continue;

    if (setBaseSet.has(i)) {
      // Coleta o base + todos os itens sequenciais seguintes
      // (itens do set vêm imediatamente após o base em expandedQuestions)
      const indexes = [i];
      consumed.add(i);

      let j = i + 1;
      while (j < questionCount && !setBaseSet.has(j)) {
        // Verifica se o próximo é um item "livre" ou parte deste set.
        // Na estrutura atual, após um __setBase vêm os itens do set,
        // e só para quando encontra outro __setBase ou uma questão sem __set.
        // Usamos a heurística: itens do set não são __setBase e vêm em sequência.
        // O page.tsx garante essa ordem em expandedQuestions.
        indexes.push(j);
        consumed.add(j);
        j++;

        // Se encontrou outro setBase ou acabou, para
        if (j < questionCount && setBaseSet.has(j)) break;
      }

      const totalHeight = indexes.reduce((sum, idx) => sum + (questionHeights[idx] ?? 0), 0);
      groups.push({ indexes, totalHeight, isSet: true });
    } else {
      consumed.add(i);
      groups.push({
        indexes: [i],
        totalHeight: questionHeights[i] ?? 0,
        isSet: false,
      });
    }
  }

  return groups;
}

export function distributeQuestionsOptimized(
  questionCount: number,
  questionHeights: number[],
  firstPageCapacity: number,
  otherPageCapacity: number,
  columns: 1 | 2,
  allowPageBreak: boolean,
  measureItemsRef: HTMLElement,
  setBaseIndexes: number[]
): PageLayout[] {
  const groups = buildGroups(questionCount, questionHeights, setBaseIndexes);

  // Separa sets (ordem fixa) e livres (otimizáveis)
  const setGroups = groups.filter((g) => g.isSet);
  const freeGroups = groups.filter((g) => !g.isSet);

  // Ordena livres por altura decrescente (FFD)
  freeGroups.sort((a, b) => b.totalHeight - a.totalHeight);

  // Ordem final: sets primeiro (na ordem original), depois livres (por altura desc)
  const orderedGroups = [...setGroups, ...freeGroups];

  // --- Alocação em slots ---
  // Estrutura de páginas com espaço restante por coluna
  type PageSlots = {
    coluna1: { items: LayoutItem[]; remaining: number };
    coluna2: { items: LayoutItem[]; remaining: number };
  };

  const pages: PageSlots[] = [];

  function newPage(idx: number): PageSlots {
    const cap = idx === 0 ? firstPageCapacity : otherPageCapacity;
    return {
      coluna1: { items: [], remaining: cap },
      coluna2: { items: [], remaining: cap },
    };
  }

  // Garante que pelo menos a primeira página existe
  pages.push(newPage(0));

  /**
   * Tenta colocar uma questão (por índice) num slot.
   * Retorna true se coube, false se não.
   */
  function tryPlaceInSlot(
    slot: PageSlots["coluna1"],
    qIndex: number,
    height: number
  ): boolean {
    if (height <= slot.remaining) {
      slot.items.push({ kind: "full", q: qIndex });
      slot.remaining -= height;
      return true;
    }
    return false;
  }

  /**
   * Encontra o melhor slot (First Fit) para uma questão/grupo.
   * Para grupos de set, precisa de espaço contíguo na mesma coluna.
   */
  function placeGroup(group: QuestionGroup): void {
    if (group.indexes.length === 1) {
      // Questão individual — tenta encaixar em qualquer slot existente
      const qIdx = group.indexes[0];
      const h = questionHeights[qIdx] ?? 0;

      // Tenta slots existentes (first fit)
      for (const page of pages) {
        if (tryPlaceInSlot(page.coluna1, qIdx, h)) return;
        if (columns === 2 && tryPlaceInSlot(page.coluna2, qIdx, h)) return;
      }

      // Não coube em nenhum slot — tenta fragmentação
      if (allowPageBreak && h > otherPageCapacity) {
        placeWithFragmentation(qIdx, h);
        return;
      }

      // Cria nova página
      const newP = newPage(pages.length);
      pages.push(newP);
      tryPlaceInSlot(newP.coluna1, qIdx, h);
      return;
    }

    // Grupo de set — coloca sequencialmente (sem reordenar internamente)
    // Cada item do grupo é colocado no próximo slot disponível,
    // mas tenta manter juntos na mesma coluna quando possível.
    for (const qIdx of group.indexes) {
      const h = questionHeights[qIdx] ?? 0;

      // Tenta o último slot usado (continuidade)
      const lastPage = pages[pages.length - 1];

      // Tenta coluna1 da última página
      if (tryPlaceInSlot(lastPage.coluna1, qIdx, h)) continue;

      // Tenta coluna2 da última página
      if (columns === 2 && tryPlaceInSlot(lastPage.coluna2, qIdx, h)) continue;

      // Tenta fragmentação se permitido e necessário
      if (allowPageBreak && h > otherPageCapacity) {
        placeWithFragmentation(qIdx, h);
        continue;
      }

      // Cria nova página e coloca lá
      const newP = newPage(pages.length);
      pages.push(newP);
      tryPlaceInSlot(newP.coluna1, qIdx, h);
    }
  }

  /**
   * Fragmentação: questão não cabe inteira em nenhum slot.
   * Usa a mesma lógica de buildFragmentsForQuestion.
   */
  function placeWithFragmentation(qIndex: number, fullH: number): void {
    const split = measureSplitInfo(measureItemsRef, qIndex);
    if (!split) {
      // Fallback: coloca inteira numa nova página
      const newP = newPage(pages.length);
      pages.push(newP);
      newP.coluna1.items.push({ kind: "full", q: qIndex });
      newP.coluna1.remaining -= fullH;
      return;
    }

    // Encontra o melhor slot para começar a fragmentação
    let targetPage = pages[pages.length - 1];
    let targetCol: "coluna1" | "coluna2" = "coluna1";
    let capHere = targetPage.coluna1.remaining;

    // Se coluna1 não tem espaço, tenta coluna2
    if (capHere <= 0 && columns === 2) {
      targetCol = "coluna2";
      capHere = targetPage.coluna2.remaining;
    }

    // Se nenhuma coluna tem espaço, nova página
    if (capHere <= 0) {
      targetPage = newPage(pages.length);
      pages.push(targetPage);
      targetCol = "coluna1";
      capHere = targetPage.coluna1.remaining;
    }

    const capNext = otherPageCapacity;
    const frag = buildFragmentsForQuestion(qIndex, split, capHere, capNext);

    if (!frag) {
      // Fallback
      const slot = targetCol === "coluna1" ? targetPage.coluna1 : targetPage.coluna2;
      slot.items.push({ kind: "full", q: qIndex });
      slot.remaining -= fullH;
      return;
    }

    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k];
      const h = frag.heights[k];

      if (k === 0) {
        const slot = targetCol === "coluna1" ? targetPage.coluna1 : targetPage.coluna2;
        slot.items.push(item);
        slot.remaining -= h;
      } else {
        // Fragmentos seguintes: tenta coluna2 ou nova página
        let placed = false;

        // Tenta coluna2 da página atual se disponível
        if (columns === 2) {
          const lastP = pages[pages.length - 1];
          if (lastP.coluna2.remaining >= h) {
            lastP.coluna2.items.push(item);
            lastP.coluna2.remaining -= h;
            placed = true;
          }
        }

        if (!placed) {
          const newP = newPage(pages.length);
          pages.push(newP);
          newP.coluna1.items.push(item);
          newP.coluna1.remaining -= h;
        }
      }
    }
  }

  // --- Executa alocação ---
  for (const group of orderedGroups) {
    placeGroup(group);
  }

  // --- Converte para PageLayout[] ---
  function isEmptyPage(p: PageSlots) {
    return p.coluna1.items.length === 0 && p.coluna2.items.length === 0;
  }

  const result: PageLayout[] = pages
    .filter((p) => !isEmptyPage(p))
    .map((p) => ({
      coluna1: p.coluna1.items,
      coluna2: p.coluna2.items,
    }));

  return result.length > 0 ? result : [{ coluna1: [], coluna2: [] }];
}

/* ============================================================
   ENTRY POINT — escolhe linear ou otimizado
   ============================================================ */

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

  if (config.optimizeLayout) {
    return distributeQuestionsOptimized(
      questionCount,
      questionHeights,
      firstPageCapacity,
      otherPageCapacity,
      config.columns,
      !!config.allowPageBreak,
      refs.measureItemsRef,
      config.setBaseIndexes ?? []
    );
  }

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