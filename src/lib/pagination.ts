/**
 * Lógica de paginação para provas em formato A4
 * - Permite fragmentar questão por blocos do DOM quando não cabe inteira
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
      /** Quantos blocos vêm de .question-text (o resto são opções individuais) */
      textBlockCount?: number;
    };

export type PageLayout = {
  coluna1: LayoutItem[];
  coluna2: LayoutItem[];
  /** Espaço restante na página (px) — usado para posicionar o footer */
  remainingHeight: number;
  /** Espaço livre por coluna — usado para limitar spacers arrastáveis */
  col1Remaining?: number;
  col2Remaining?: number;
};

/** Grupo explícito: texto base + seus itens (por parentId) */
export type SetGroupDef = {
  baseIndex: number;
  itemIndexes: number[];
};

export interface PaginationConfig {
  pageHeight: number;
  safetyMargin: number;
  columns: 1 | 2;
  optimizeLayout?: boolean;
  /** Grupos explícitos de set_questions (base + itens pelo parentId) */
  setGroups?: SetGroupDef[];
  /** Spacers arrastáveis: "q${i}" → px extras adicionados à altura da questão i */
  spacers?: Map<string, number>;
}

// Altura reservada para o footer (margin + padding + texto): ~1.1cm = 31px
const FOOTER_HEIGHT = 35;

export function calculateFirstPageCapacity(
  firstPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const pageRect = firstPageElement.getBoundingClientRect();
  const questionsRect = questionsContainerElement.getBoundingClientRect();
  const occupiedHeight = questionsRect.top - pageRect.top;
  return Math.floor(Math.max(0, pageHeight - occupiedHeight - safetyMargin - FOOTER_HEIGHT));
}

export function calculateOtherPageCapacity(
  otherPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const pageRect = otherPageElement.getBoundingClientRect();
  const questionsRect = questionsContainerElement.getBoundingClientRect();
  const occupiedHeight = questionsRect.top - pageRect.top;
  return Math.floor(Math.max(0, pageHeight - occupiedHeight - safetyMargin - FOOTER_HEIGHT));
}

function px(n: number) {
  return Math.max(0, n || 0);
}

function measureOuterHeight(el: HTMLElement): number {
  const cs = window.getComputedStyle(el);
  const mt = parseFloat(cs.marginTop || "0") || 0;
  const mb = parseFloat(cs.marginBottom || "0") || 0;
  return Math.ceil(px(el.offsetHeight + mt + mb));
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
  textBlockCount?: number; // quantos blocos são de .question-text (o resto são opções)
};

type PickResult = { blocks: HTMLElement[]; textBlockCount?: number };

/**
 * expandOptions=false (padrão): .question-options é 1 bloco atômico
 * expandOptions=true (fallback): cada opção vira bloco separado
 */
function pickBlockElementsFromWrapper(
  wrapper: HTMLElement,
  expandOptions = false
): PickResult {
  const conteudo = wrapper.querySelector(".questao-conteudo") as HTMLElement | null;
  if (!conteudo) return { blocks: [] };

  function appendOptions(blocks: HTMLElement[], root: HTMLElement): number | undefined {
    const options = root.querySelector(".question-options") as HTMLElement | null;
    if (!options) return undefined;

    if (expandOptions) {
      const optKids = Array.from(options.children) as HTMLElement[];
      if (optKids.length > 1) {
        const textCount = blocks.length;
        blocks.push(...optKids);
        return textCount;
      }
    }
    blocks.push(options);
    return undefined;
  }

  const qt = conteudo.querySelector(".question-text") as HTMLElement | null;
  if (qt) {
    const kids = Array.from(qt.children) as HTMLElement[];
    if (kids.length >= 1) {
      const blocks: HTMLElement[] = [...kids];
      const textBlockCount = appendOptions(blocks, conteudo);
      return { blocks, textBlockCount };
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
          const textBlockCount = appendOptions(blocks, conteudo);
          return { blocks, textBlockCount };
        }
      }
    }
  }

  return { blocks: blockEls };
}

function measureSplitInfo(
  measurementContainer: HTMLElement,
  index: number,
  expandOptions = false
): SplitInfo | null {
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

  const { blocks: blockEls, textBlockCount } = pickBlockElementsFromWrapper(wrapper, expandOptions);
  const blocksHeights = blockEls.map((b) => measureBlockHeight(b));

  const contentBlocksSum = blocksHeights.reduce((a, b) => a + b, 0);

  const total = Math.max(measureOuterHeight(wrapper), 10);
  const { mb } = measureMargins(wrapper);

  // Prefix = tudo que não é blocos; mas tira a margem-bottom do wrapper
  // (para não "cobrar" essa margem em todo fragmento).
  const prefixHeight = Math.max(0, total - contentBlocksSum - mb);

  return { prefixHeight, suffixHeight: mb, blocksHeights, textBlockCount };
}

function buildFragmentsForQuestion(
  qIndex: number,
  split: SplitInfo,
  capFirstFrag: number,
  capNextFrag: number
): { items: LayoutItem[]; heights: number[] } | null {
  const FIT_EPS = 10; // px de tolerância pra não quebrar cedo por arredondamento

  const { prefixHeight, suffixHeight, blocksHeights, textBlockCount } = split;

  if (!blocksHeights.length) return null;

  // Se não tem textBlockCount (opções não expandidas), não fragmenta
  // Retorna null para forçar fallback com opções expandidas
  if (textBlockCount === undefined && blocksHeights.length > 1) {
    return null;
  }

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

    items.push({ kind: "frag", q: qIndex, from, to, first, textBlockCount });

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
  measureItemsRef: HTMLElement
): PageLayout[] {
  const newPages: PageLayout[] = [];
  let page: PageLayout = { coluna1: [], coluna2: [], remainingHeight: 0 };

  let col: "coluna1" | "coluna2" = "coluna1";
  let used = 0;
  let usedCol1 = 0;
  let usedCol2 = 0;
  let pageIndex = 0;
  function isEmptyPage(p: PageLayout | null | undefined) {
  if (!p) return true;
  return (p.coluna1?.length ?? 0) === 0 && (p.coluna2?.length ?? 0) === 0;
}


  const getCap = () => (pageIndex === 0 ? firstPageCapacity : otherPageCapacity);

  const pushNewPage = () => {
    const cap = getCap();
    const maxUsed = columns === 2 ? Math.max(usedCol1, usedCol2) : usedCol1;
    page.remainingHeight = Math.max(0, cap - maxUsed);
    page.col1Remaining = Math.max(0, cap - usedCol1);
    page.col2Remaining = columns === 2 ? Math.max(0, cap - usedCol2) : 0;
    newPages.push(page);
    pageIndex++;
    page = { coluna1: [], coluna2: [], remainingHeight: 0 };
    col = "coluna1";
    used = 0;
    usedCol1 = 0;
    usedCol2 = 0;
  };

  const nextColumnOrPage = () => {
    if (columns === 2 && col === "coluna1") {
      usedCol1 = used;
      col = "coluna2";
      used = 0;
      return;
    }
    if (col === "coluna1") usedCol1 = used;
    else usedCol2 = used;
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

    // Tenta fragmentar aproveitando o espaço restante na coluna atual
    const remaining = cap - used;
    const capFirstFrag = remaining > 0 ? remaining : getCap();

    // Se não há espaço restante, avança para coluna/página limpa
    if (remaining <= 0 && used > 0) {
      nextColumnOrPage();
    }

    const capHere = remaining > 0 ? remaining : getCap();

    // Se cabe inteira numa coluna limpa, coloca como full
    if (used === 0 && fullH <= capHere) {
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    let split = measureSplitInfo(measureItemsRef, i);
    if (!split) {
      if (used > 0) nextColumnOrPage();
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    // capNextFrag: capacidade do próximo slot (coluna2 mesma pag, ou nova pag)
    const capNextFrag = columns === 2 && col === "coluna1" ? getCap() : otherPageCapacity;

    let frag = buildFragmentsForQuestion(i, split, capHere, capNextFrag);

    // Fallback: se não fragmentou, tenta expandindo opções individuais
    if (!frag) {
      const splitExpanded = measureSplitInfo(measureItemsRef, i, true);
      if (splitExpanded) {
        frag = buildFragmentsForQuestion(i, splitExpanded, capHere, capNextFrag);
      }
    }

    if (!frag) {
      if (used > 0) nextColumnOrPage();
      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k];
      const h = frag.heights[k];

      if (k > 0) {
        // Fragmentos seguintes: avança coluna/página
        nextColumnOrPage();
      }

      page[col].push(item);
      used += h;
    }
  }

// Fecha a última página com remaining calculado
if (col === "coluna1") usedCol1 = used;
else usedCol2 = used;
const capFinal = getCap();
const maxUsedFinal = columns === 2 ? Math.max(usedCol1, usedCol2) : usedCol1;
page.remainingHeight = Math.max(0, capFinal - maxUsedFinal);
page.col1Remaining = Math.max(0, capFinal - usedCol1);
page.col2Remaining = columns === 2 ? Math.max(0, capFinal - usedCol2) : 0;
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
   - Fragmentação continua funcionando quando questão não cabe inteira.
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
  setGroups: SetGroupDef[]
): QuestionGroup[] {
  const consumed = new Set<number>();
  const groups: QuestionGroup[] = [];

  // Mapeia baseIndex → SetGroupDef para lookup rápido
  const baseMap = new Map<number, SetGroupDef>();
  for (const sg of setGroups) {
    baseMap.set(sg.baseIndex, sg);
  }

  for (let i = 0; i < questionCount; i++) {
    if (consumed.has(i)) continue;

    const sg = baseMap.get(i);
    if (sg) {
      // Grupo explícito: base + itens pelo parentId
      const indexes = [sg.baseIndex, ...sg.itemIndexes];
      for (const idx of indexes) consumed.add(idx);

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
  measureItemsRef: HTMLElement,
  setGroups: SetGroupDef[]
): PageLayout[] {
  const groups = buildGroups(questionCount, questionHeights, setGroups);

  // Separa sets (ordem fixa) e livres (otimizáveis)
  const fixedGroups = groups.filter((g) => g.isSet);
  const freeGroups = groups.filter((g) => !g.isSet);

  // Ordena livres por altura decrescente (FFD)
  freeGroups.sort((a, b) => b.totalHeight - a.totalHeight);

  // Ordem final: sets primeiro (na ordem original), depois livres (por altura desc)
  const orderedGroups = [...fixedGroups, ...freeGroups];

  // --- Alocação em slots ---
  // Estrutura de páginas com espaço restante por coluna
  type PageSlots = {
    coluna1: { items: LayoutItem[]; remaining: number; usedHeight: number };
    coluna2: { items: LayoutItem[]; remaining: number; usedHeight: number };
  };

  const pages: PageSlots[] = [];

  function newPage(idx: number): PageSlots {
    const cap = idx === 0 ? firstPageCapacity : otherPageCapacity;
    return {
      coluna1: { items: [], remaining: cap, usedHeight: 0 },
      coluna2: { items: [], remaining: cap, usedHeight: 0 },
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
      slot.usedHeight += height;
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
      if (h > otherPageCapacity) {
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
    // Quando o set muda de coluna/página, fecha o espaço restante da coluna
    // anterior pra que questões livres não entrem no meio do set.
    let setCol: "coluna1" | "coluna2" = "coluna1";
    let setPageIdx = pages.length - 1;

    for (const qIdx of group.indexes) {
      const h = questionHeights[qIdx] ?? 0;

      const lastPage = pages[pages.length - 1];
      const lastPageIdx = pages.length - 1;

      // Tenta coluna atual da última página
      if (tryPlaceInSlot(lastPage[setCol], qIdx, h)) continue;

      // Não coube — precisa mudar de coluna ou página
      // Fecha o espaço restante da coluna atual pra proteger o set
      lastPage[setCol].remaining = 0;

      if (columns === 2 && setCol === "coluna1") {
        // Tenta coluna2 da mesma página
        setCol = "coluna2";
        if (tryPlaceInSlot(lastPage.coluna2, qIdx, h)) continue;

        // Não coube na col2 também — fecha e cria nova página
        lastPage.coluna2.remaining = 0;
      }

      // Tenta fragmentação se necessário
      if (h > otherPageCapacity) {
        placeWithFragmentation(qIdx, h);
        setCol = "coluna1";
        continue;
      }

      // Cria nova página e coloca lá
      const newP = newPage(pages.length);
      pages.push(newP);
      setCol = "coluna1";
      tryPlaceInSlot(newP.coluna1, qIdx, h);
    }

  }

  /**
   * Fragmentação: questão não cabe inteira em nenhum slot.
   * Usa a mesma lógica de buildFragmentsForQuestion.
   */
  function placeWithFragmentation(qIndex: number, fullH: number): void {
    let split = measureSplitInfo(measureItemsRef, qIndex);
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

    // capNext = capacidade garantida do próximo fragmento (sempre pode ir pra nova página)
    const capNext = otherPageCapacity;

    let frag = buildFragmentsForQuestion(qIndex, split, capHere, capNext);

    // Fallback: se não fragmentou, tenta expandindo opções individuais
    if (!frag) {
      const splitExpanded = measureSplitInfo(measureItemsRef, qIndex, true);
      if (splitExpanded) {
        frag = buildFragmentsForQuestion(qIndex, splitExpanded, capHere, capNext);
      }
    }

    if (!frag) {
      // Fallback
      const slot = targetCol === "coluna1" ? targetPage.coluna1 : targetPage.coluna2;
      slot.items.push({ kind: "full", q: qIndex });
      slot.remaining -= fullH;
      slot.usedHeight += fullH;
      return;
    }

    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k];
      const h = frag.heights[k];

      if (k === 0) {
        const slot = targetCol === "coluna1" ? targetPage.coluna1 : targetPage.coluna2;
        slot.items.push(item);
        slot.remaining -= h;
        slot.usedHeight += h;
      } else {
        // Fragmentos seguintes: tenta coluna2 ou nova página
        let placed = false;

        // Tenta coluna2 da página atual se disponível
        if (columns === 2) {
          const lastP = pages[pages.length - 1];
          if (lastP.coluna2.remaining >= h) {
            lastP.coluna2.items.push(item);
            lastP.coluna2.remaining -= h;
            lastP.coluna2.usedHeight += h;
            placed = true;
          }
        }

        if (!placed) {
          const newP = newPage(pages.length);
          pages.push(newP);
          newP.coluna1.items.push(item);
          newP.coluna1.remaining -= h;
          newP.coluna1.usedHeight += h;
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
    .map((p, idx) => {
      const cap = idx === 0 ? firstPageCapacity : otherPageCapacity;
      const maxUsed = columns === 2
        ? Math.max(p.coluna1.usedHeight, p.coluna2.usedHeight)
        : p.coluna1.usedHeight;
      return {
        coluna1: p.coluna1.items,
        coluna2: p.coluna2.items,
        remainingHeight: Math.max(0, cap - maxUsed),
        col1Remaining: Math.max(0, p.coluna1.remaining),
        col2Remaining: Math.max(0, p.coluna2.remaining),
      };
    });

  return result.length > 0 ? result : [{ coluna1: [], coluna2: [], remainingHeight: 0 }];
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

  const rawHeights = measureQuestionHeights(refs.measureItemsRef);
  const questionHeights = config.spacers
    ? rawHeights.map((h, i) => h + (config.spacers!.get(`q${i}`) ?? 0))
    : rawHeights;

  // Reserva que foi descontada da capacidade (safety + footer)
  // Adicionamos de volta ao remainingHeight pra que o spacer preencha
  // todo o espaço entre o conteúdo e o footer real
  const reserved = config.safetyMargin + FOOTER_HEIGHT;

  const adjustRemaining = (pages: PageLayout[]) => {
    for (const p of pages) {
      p.remainingHeight += reserved;
    }
    return pages;
  };

  if (config.optimizeLayout) {
    return adjustRemaining(distributeQuestionsOptimized(
      questionCount,
      questionHeights,
      firstPageCapacity,
      otherPageCapacity,
      config.columns,
      refs.measureItemsRef,
      config.setGroups ?? []
    ));
  }

  return adjustRemaining(distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity,
    config.columns,
    refs.measureItemsRef
  ));
}