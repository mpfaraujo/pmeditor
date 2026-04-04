/**
 * Lógica de paginação para provas em formato A4
 * - Permite fragmentar questão por blocos do DOM quando não cabe inteira
 * - optimizeLayout=true: bin-packing (First Fit Decreasing) para otimizar espaço
 * - optimizeLayout=false: distribuição linear sequencial (comportamento original)
 *
 * ════════════════════════════════════════════════════════════════════════
 * DECISÕES DE DESIGN CRÍTICAS — leia antes de alterar qualquer coisa
 * ════════════════════════════════════════════════════════════════════════
 *
 * 1. FRAGMENTAÇÃO vs. NOVA PÁGINA (o bug que custou 5 sessões)
 * ─────────────────────────────────────────────────────────────
 * Quando h > firstPageCapacity mas h <= otherPageCapacity, NÃO se deve
 * simplesmente criar uma nova página e colocar a questão lá como "full".
 *
 * Por quê: o bin-packing filtra páginas vazias ao final. Se a página 0
 * ficou vazia (porque nenhuma questão coube nela), ela é removida. A
 * página 1 — que foi alocada com otherPageCapacity (ex: 931px) — vira a
 * página renderizada 0 e recebe o cabeçalho da prova. O cabeçalho reduz
 * o espaço disponível para firstPageCapacity (ex: 742px). Conteúdo de
 * 931px numa área de 742px → overflow visual invadindo o footer.
 *
 * Solução (em placeGroup): se a página atual ainda está VAZIA e
 * h > firstPageCapacity, chama placeWithFragmentation ANTES de fechar a
 * coluna. Isso usa o espaço restante (742px) como capHere, dividindo a
 * questão entre a página atual e a próxima. A página 0 deixa de ser
 * vazia e não é removida.
 *
 * Restrição importante: só fragmenta quando currentPageEmpty === true.
 * Sem essa restrição, qualquer questão com h > firstPageCapacity em
 * qualquer página intermediária seria fragmentada desnecessariamente.
 *
 * Testes de regressão: src/tests/pagination/layout.test.ts
 *   "[otimizado] questão maior que firstPageCapacity deve ser fragmentada"
 *   "[otimizado] set group com base maior que firstPageCapacity deve fragmentar a base"
 *
 * 2. appendOptions e textBlockCount
 * ───────────────────────────────────
 * appendOptions retorna:
 *   - undefined  → opções encontradas mas não expandidas (bloco atômico)
 *   - N (número) → sem opções (ex: setBase/poema) ou opções expandidas
 *
 * Em buildFragmentsForQuestion: se textBlockCount===undefined e há mais
 * de 1 bloco, retorna null imediatamente → força retry com expandOptions=true.
 * Isso garante que fragmentação de MCQ seja feita bloco-a-bloco nas opções.
 *
 * 3. capHere em placeWithFragmentation
 * ──────────────────────────────────────
 * placeWithFragmentation usa pages[last].coluna1.remaining como capHere.
 * Por isso, NÃO feche a coluna antes de chamá-la quando quiser que ela
 * use o espaço restante da página atual. Se remaining=0, ela cria uma
 * nova página e capHere=otherPageCapacity — o que não resolve o bug (1).
 *
 * 4. Remoção de páginas vazias
 * ─────────────────────────────
 * O filtro `pages.filter(p => !isEmptyPage(p))` remove páginas sem itens.
 * Depois, o .map re-atribui capacidades: idx===0 → firstPageCapacity,
 * resto → otherPageCapacity. Se uma página alocada com otherPageCapacity
 * se tornar idx===0 após filtragem, seu remainingHeight é recalculado
 * mas os ITENS já foram colocados assumindo 931px — o overflow persiste.
 * Nunca deixe a primeira página ficar vazia.
 *
 * 5. Aproveitamento de espaço residual (tryFragmentResidual)
 * ──────────────────────────────────────────────────────────
 * Quando um slot tem espaço residual >= 50% da capacidade da coluna e o
 * próximo elemento a colocar (primeiro de um set — o texto base) não cabe
 * inteiro, tenta-se fragmentá-lo para aproveitar o espaço.
 *
 * Critérios para ativar: slot.remaining >= colCap * 0.50 E
 * slot.items.length > 0 (coluna não vazia — mesma proteção do item 1) E
 * fragmento inicial >= 30% do total (evita fragmento minúsculo/feio)
 *
 * Só se aplica ao PRIMEIRO elemento do set (texto base). Itens intermediários
 * nunca são fragmentados por esse mecanismo — quebraria a coesão visual.
 *
 * Testes: src/tests/pagination/layout.test.ts
 *   "[residual] fragmenta texto-base quando espaço residual >= 30%"
 *   "[residual] NÃO fragmenta quando espaço residual < 30%"
 *   "[residual] NÃO fragmenta quando fragmento inicial < 30% do total"
 *   "[residual] NÃO fragmenta quando coluna está vazia"
 * ════════════════════════════════════════════════════════════════════════
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

function isPaginationDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem("pmeditor:pagination-debug") === "1";
  } catch {
    return false;
  }
}

function writePaginationDebug(payload: any) {
  if (!isPaginationDebugEnabled() || typeof window === "undefined") return;
  (window as any).__PMEDITOR_PAGINATION_DEBUG__ = payload;
  console.log("[pagination-debug]", payload);
}

function appendPaginationDebugTrace(entry: any) {
  if (!isPaginationDebugEnabled() || typeof window === "undefined") return;
  const key = "__PMEDITOR_PAGINATION_DEBUG_TRACE__";
  const current = Array.isArray((window as any)[key]) ? (window as any)[key] : [];
  current.push(entry);
  (window as any)[key] = current;
  console.log("[pagination-debug:trace]", entry);
}

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
  const visual = Math.max(
    el.offsetHeight,
    el.scrollHeight,
    Math.ceil(el.getBoundingClientRect().height)
  );
  return Math.ceil(px(visual + mt + mb));
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
    if (!options) return blocks.length; // sem opções: todos os blocos são texto

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

  // Regressão: set discursivo renderizado como um único wrapper pode conter
  // vários `.question-text` em sequência (texto base + partes). O caminho
  // antigo via querySelector pegava só o primeiro `.question-text`, inflava o
  // prefixHeight com o restante do conteúdo e inviabilizava a fragmentação.
  //
  // Mantemos o caso estrito: só ativa quando NÃO há `.question-options`,
  // preservando a lógica atual de MCQ e de opções expandidas.
  const allQuestionTexts = Array.from(
    conteudo.querySelectorAll(".question-text")
  ) as HTMLElement[];
  if (allQuestionTexts.length > 1 && !conteudo.querySelector(".question-options")) {
    const blocks = allQuestionTexts.flatMap((qt) => Array.from(qt.children) as HTMLElement[]);
    if (blocks.length >= 1) {
      return { blocks, textBlockCount: blocks.length };
    }
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
  for (let i = 0; i < blockEls.length - 1; i++) {
    const currentRect = blockEls[i].getBoundingClientRect();
    const nextRect = blockEls[i + 1].getBoundingClientRect();
    const gap = Math.max(0, Math.ceil(nextRect.top - currentRect.bottom));
    if (gap > 0) {
      blocksHeights[i] += gap;
    }
  }

  const contentBlocksSum = blocksHeights.reduce((a, b) => a + b, 0);

  const total = Math.max(measureOuterHeight(wrapper), 10);
  const { mb } = measureMargins(wrapper);

  // Prefix = tudo que não é blocos; mas tira a margem-bottom do wrapper
  // (para não "cobrar" essa margem em todo fragmento).
  const prefixHeight = Math.max(0, total - contentBlocksSum - mb);

  appendPaginationDebugTrace({
    type: "measureSplitInfo",
    index,
    expandOptions,
    total,
    suffixHeight: mb,
    prefixHeight,
    textBlockCount,
    blocksHeights,
    blockCount: blockEls.length,
  });

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

  appendPaginationDebugTrace({
    type: "buildFragmentsForQuestion",
    qIndex,
    capFirstFrag,
    capNextFrag,
    prefixHeight,
    suffixHeight,
    textBlockCount,
    blocksHeights,
    items,
    heights,
  });

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

  /**
   * ALTERAÇÃO DOCUMENTADA:
   * Antes, a lógica linear tentava fragmentar imediatamente quando a questão
   * não cabia no slot atual. Agora ela verifica primeiro se a questão cabe
   * inteira no próximo slot limpo.
   *
   * Regras atuais:
   * - em 2 colunas, se estamos na coluna1, o próximo slot limpo é a coluna2
   *   da mesma página;
   * - caso contrário, o próximo slot limpo é uma nova página.
   */
  const getCleanSlotPlan = (
    fullH: number
  ): { kind: "column" | "page"; cap: number } | null => {
    if (columns === 2 && col === "coluna1" && fullH <= getCap()) {
      return { kind: "column", cap: getCap() };
    }

    if (fullH <= otherPageCapacity) {
      return { kind: "page", cap: otherPageCapacity };
    }

    return null;
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

    // ALTERAÇÃO DOCUMENTADA:
    // LÓGICA ANTIGA (mantida aqui em comentário para reversão fácil):
    // ---------------------------------------------------------------
    // // Tenta fragmentar aproveitando o espaço restante na coluna atual
    // const remaining = cap - used;
    // const capFirstFrag = remaining > 0 ? remaining : getCap();
    //
    // // Se não há espaço restante, avança para coluna/página limpa
    // if (remaining <= 0 && used > 0) {
    //   nextColumnOrPage();
    // }
    //
    // const capHere = remaining > 0 ? remaining : getCap();
    //
    // // Se cabe inteira numa coluna limpa, coloca como full
    // if (used === 0 && fullH <= capHere) {
    //   page[col].push({ kind: "full", q: i });
    //   used += fullH;
    //   continue;
    // }
    // ---------------------------------------------------------------
    // LÓGICA NOVA:
    // 1) não coube no slot atual;
    // 2) tenta próximo slot limpo SEM fragmentar;
    // 3) só fragmenta se não couber nem em slot limpo.
    const cleanSlotPlan = getCleanSlotPlan(fullH);
    if (cleanSlotPlan) {
      if (cleanSlotPlan.kind === "column") {
        // Próximo slot limpo = coluna2 da mesma página.
        nextColumnOrPage();
      } else {
        // Próximo slot limpo = nova página.
        // Ponto crítico: avançamos MESMO QUANDO used === 0.
        // Isso corrige o caso da primeira página vazia, porém insuficiente.
        if (columns === 2 && col === "coluna1") {
          // Se estivermos em 2 colunas na coluna1 e decidimos que o slot limpo
          // correto é uma NOVA página, precisamos pular também a coluna2 atual.
          nextColumnOrPage();
        }
        nextColumnOrPage();
      }

      page[col].push({ kind: "full", q: i });
      used += fullH;
      continue;
    }

    // Não coube em slot limpo: agora a fragmentação é obrigatória.
    const remaining = cap - used;
    const capFirstFrag = remaining > 0 ? remaining : getCap();

    // Se não há espaço restante, avança para coluna/página limpa ANTES
    // de iniciar a fragmentação.
    if (remaining <= 0) {
      nextColumnOrPage();
    }

    // Recalcula capHere depois de eventual avanço. Antes isso era calculado
    // com base no estado antigo, o que podia deixar a decisão inconsistente.
    const capHere = used > 0 ? Math.max(0, getCap() - used) : getCap();

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
      // ALTERAÇÃO DOCUMENTADA:
      // Antes esse fallback era silencioso. Mantive o comportamento, mas agora
      // ele deixa um aviso explícito para depuração.
      console.warn(
        `[pagination][linear] Falha ao fragmentar questão ${i}. Inserindo como 'full' por fallback.`
      );
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

  // Separa sets e livres
  const fixedGroups = groups.filter((g) => g.isSet);
  const freeGroups = groups.filter((g) => !g.isSet);

  // Sem sets: FFD puro — ordena livres por altura desc para maximizar aproveitamento
  // Com sets: preserva ordem original para manter fluxo de leitura da prova
  // (FFD colocaria questões livres *depois* dos sets, quebrando a ordem visual)
  let orderedGroups: typeof groups;
  if (fixedGroups.length === 0) {
    freeGroups.sort((a, b) => b.totalHeight - a.totalHeight);
    orderedGroups = freeGroups;
  } else {
    orderedGroups = groups;
  }

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
   * Tenta fragmentar a questão `qIdx` para aproveitar espaço residual do slot.
   * Ativa apenas quando:
   *   - slot não está vazio (items.length > 0)
   *   - slot.remaining >= 50% da capacidade da coluna
   *   - questão não cabe inteira (h > slot.remaining)
   *   - fragmento inicial >= 30% da altura total (evita fragmento minúsculo)
   * Retorna null se não for possível/válido fragmentar.
   */
  function tryFragmentResidual(
    qIdx: number,
    h: number,
    slot: PageSlots["coluna1"],
    colCap: number,
    capNext: number,
    allowEmptySlot = false
  ): { firstItem: LayoutItem; firstHeight: number; restItems: LayoutItem[]; restHeights: number[] } | null {
    if (slot.items.length === 0 && !allowEmptySlot) return null;
    if (slot.remaining < colCap * 0.50) return null;
    if (h <= slot.remaining) return null; // cabe inteira — loop normal trata

    const split = measureSplitInfo(measureItemsRef, qIdx);
    if (!split) return null;
    const frags = buildFragmentsForQuestion(qIdx, split, slot.remaining, capNext);
    if (!frags || frags.items.length < 2) return null;
    if (frags.heights[0] / h < 0.30) return null; // fragmento < 30% — feio

    return {
      firstItem: frags.items[0],
      firstHeight: frags.heights[0],
      restItems: frags.items.slice(1),
      restHeights: frags.heights.slice(1),
    };
  }

  /**
   * Só permite fragmentar em slot vazio quando estamos iniciando na coluna2
   * de uma página que já tem conteúdo na coluna1. Isso evita reabrir o bug
   * da página inteira vazia, mas aproveita a coluna2 que hoje fica em branco.
   */
  function canUseEmptySlotResidual(
    page: PageSlots,
    col: "coluna1" | "coluna2"
  ): boolean {
    return columns === 2 &&
      col === "coluna2" &&
      page.coluna1.items.length > 0 &&
      page.coluna2.items.length === 0;
  }

  function placeResidualFragments(
    result: { firstItem: LayoutItem; firstHeight: number; restItems: LayoutItem[]; restHeights: number[] },
    startCol: "coluna1" | "coluna2"
  ): "coluna1" | "coluna2" {
    let currentCol = startCol;
    let slot = pages[pages.length - 1][currentCol];

    slot.items.push(result.firstItem);
    slot.remaining -= result.firstHeight;
    slot.usedHeight += result.firstHeight;
    slot.remaining = 0;

    for (let k = 0; k < result.restItems.length; k++) {
      if (columns === 2 && currentCol === "coluna1") {
        currentCol = "coluna2";
      } else {
        pages.push(newPage(pages.length));
        currentCol = "coluna1";
      }
      slot = pages[pages.length - 1][currentCol];
      slot.items.push(result.restItems[k]);
      slot.remaining -= result.restHeights[k];
      slot.usedHeight += result.restHeights[k];
    }

    return currentCol;
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

      // Se a primeira página ainda está vazia e h > firstPageCapacity, tenta fragmentar.
      // Sem isso: cria nova página (otherPageCapacity), a primeira página fica vazia,
      // é removida, e a nova página vira a página 0 renderizada — com cabeçalho mas
      // sem espaço planejado para ele → overflow.
      // Restrição: só fragmenta se a página AINDA ESTÁ VAZIA (sem itens) para não
      // acionar fragmentação desnecessária em páginas intermediárias.
      const firstPageEmpty = pages.length === 1 &&
        pages[0].coluna1.items.length === 0 &&
        pages[0].coluna2.items.length === 0;
      const bestRemaining = firstPageEmpty
        ? Math.max(pages[0].coluna1.remaining, columns === 2 ? pages[0].coluna2.remaining : 0)
        : 0;
      if (h > firstPageCapacity && bestRemaining > 0) {
        placeWithFragmentation(qIdx, h);
        return;
      }

      if (h <= otherPageCapacity) {
        const newP = newPage(pages.length);
        pages.push(newP);
        tryPlaceInSlot(newP.coluna1, qIdx, h);
        return;
      }

      placeWithFragmentation(qIdx, h);
      return;
    }

    // Grupo de set — coloca sequencialmente (sem reordenar internamente)
    // Quando o set muda de coluna/página, fecha o espaço restante da coluna
    // anterior pra que questões livres não entrem no meio do set.
    let setCol: "coluna1" | "coluna2" = "coluna1";

    // Se col1 está esgotada (remaining=0), inicia o set em col2 para que a
    // tentativa de fragmentação e o loop principal aproveitem o espaço residual
    // de col2 (gerado pelo grupo anterior que terminou cedo nessa coluna).
    if (columns === 2 && pages[pages.length - 1].coluna1.remaining === 0) {
      setCol = "coluna2";
    }

    // --- Aproveitamento de espaço residual antes de iniciar o set ---
    // Tenta fragmentar o texto-base (indexes[0]) se não couber inteiro,
    // desde que o primeiro fragmento seja >= 30% do total.
    let startIdx = 0;
    if (group.indexes.length > 0) {
      const page = pages[pages.length - 1];
      const slot = page[setCol];
      const colCap = pages.length === 1 ? firstPageCapacity : otherPageCapacity;
      const baseIdx = group.indexes[0];
      const baseH = questionHeights[baseIdx] ?? 0;
      const result = tryFragmentResidual(
        baseIdx,
        baseH,
        slot,
        colCap,
        otherPageCapacity,
        canUseEmptySlotResidual(page, setCol)
      );
      if (result) {
        setCol = placeResidualFragments(result, setCol);
        startIdx = 1; // texto-base já tratado — pula no loop principal
      }
    }

    for (let iIdx = startIdx; iIdx < group.indexes.length; iIdx++) {
      const qIdx = group.indexes[iIdx];
      const h = questionHeights[qIdx] ?? 0;

      const lastPage = pages[pages.length - 1];

      // Tenta coluna atual da última página
      if (tryPlaceInSlot(lastPage[setCol], qIdx, h)) continue;

      const colCap = pages.length === 1 ? firstPageCapacity : otherPageCapacity;
      const capNext =
        columns === 2 && setCol === "coluna1" && lastPage.coluna2.remaining > 0
          ? lastPage.coluna2.remaining
          : otherPageCapacity;
      const residualInCurrentSlot = tryFragmentResidual(
        qIdx,
        h,
        lastPage[setCol],
        colCap,
        capNext,
        canUseEmptySlotResidual(lastPage, setCol)
      );
      if (residualInCurrentSlot) {
        setCol = placeResidualFragments(residualInCurrentSlot, setCol);
        continue;
      }

      // Antes de fechar a coluna: se a página ainda está vazia e h > firstPageCapacity,
      // tenta fragmentar — evita que a página fique vazia, seja removida e a próxima
      // vire a página 0 renderizada sem espaço para o cabeçalho → overflow.
      const currentPageEmpty = lastPage.coluna1.items.length === 0 &&
        lastPage.coluna2.items.length === 0;
      if (h > firstPageCapacity && currentPageEmpty && lastPage[setCol].remaining > 0) {
        placeWithFragmentation(qIdx, h);
        setCol = "coluna1";
        continue;
      }

      if (columns === 2 && setCol === "coluna1") {
        lastPage[setCol].remaining = 0;
        setCol = "coluna2";
        if (tryPlaceInSlot(lastPage.coluna2, qIdx, h)) continue;

        const residualInEmptyCol2 = tryFragmentResidual(
          qIdx,
          h,
          lastPage.coluna2,
          colCap,
          otherPageCapacity,
          canUseEmptySlotResidual(lastPage, "coluna2")
        );
        if (residualInEmptyCol2) {
          setCol = placeResidualFragments(residualInEmptyCol2, "coluna2");
          continue;
        }

        if (h > firstPageCapacity && currentPageEmpty && lastPage.coluna2.remaining > 0) {
          placeWithFragmentation(qIdx, h);
          setCol = "coluna1";
          continue;
        }

        lastPage.coluna2.remaining = 0;
      } else {
        lastPage[setCol].remaining = 0;
      }

      if (h <= otherPageCapacity) {
        const newP = newPage(pages.length);
        pages.push(newP);
        setCol = "coluna1";
        tryPlaceInSlot(newP.coluna1, qIdx, h);
        continue;
      }

      placeWithFragmentation(qIdx, h);
      setCol = "coluna1";
    }

  }

  /**
   * Fragmentação: questão não cabe inteira em nenhum slot.
   * Usa a mesma lógica de buildFragmentsForQuestion.
   */
  function placeWithFragmentation(qIndex: number, fullH: number): void {
    const SLOT_FIT_EPS = 10;

    let split = measureSplitInfo(measureItemsRef, qIndex);
    if (!split) {
      // ALTERAÇÃO DOCUMENTADA:
      // Antes esse fallback era silencioso. Mantive o comportamento para não
      // alterar demais o fluxo atual, mas agora ele deixa rastro no console.
      console.warn(
        `[pagination][optimized] measureSplitInfo falhou para questão ${qIndex}. Inserindo como 'full' por fallback.`
      );
      // Fallback: coloca inteira numa nova página
      const newP = newPage(pages.length);
      pages.push(newP);
      newP.coluna1.items.push({ kind: "full", q: qIndex });
      newP.coluna1.remaining -= fullH;
      return;
    }

    const tryBuildFragment = (
      baseSplit: SplitInfo,
      capFirst: number,
      capNext: number
    ) => {
      let built = buildFragmentsForQuestion(qIndex, baseSplit, capFirst, capNext);
      if (!built) {
        const splitExpanded = measureSplitInfo(measureItemsRef, qIndex, true);
        if (splitExpanded) {
          built = buildFragmentsForQuestion(qIndex, splitExpanded, capFirst, capNext);
        }
      }
      return built;
    };

    const isTinyInitialFragment = (
      built: { items: LayoutItem[]; heights: number[] } | null
    ) => {
      if (!built || built.items.length < 2) return false;
      return built.heights[0] / Math.max(fullH, 1) < 0.30;
    };

    const isFreshStart = (
      page: PageSlots,
      col: "coluna1" | "coluna2"
    ) => col === "coluna1" && page.coluna1.items.length === 0 && page.coluna2.items.length === 0;

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

    // capNext precisa respeitar o PRÓXIMO slot real.
    // Se o primeiro fragmento começa na coluna1, o próximo destino preferencial
    // é a coluna2 da mesma página. Usar otherPageCapacity aqui pode gerar um
    // segundo fragmento grande demais para a coluna2 da primeira página,
    // fazendo o algoritmo pular indevidamente para a próxima página.
    //
    // Usamos a capacidade do próximo slot imediato quando ele existe; isso pode
    // gerar fragmentos um pouco menores do que o estritamente necessário, mas
    // preserva o fluxo coluna1 -> coluna2 -> próxima página sem overflow.
    const capNext =
      columns === 2 && targetCol === "coluna1" && targetPage.coluna2.remaining > 0
        ? targetPage.coluna2.remaining
        : otherPageCapacity;

    let frag = tryBuildFragment(split, capHere, capNext);
    if (frag && isTinyInitialFragment(frag) && !isFreshStart(targetPage, targetCol)) {
      frag = null;
    }

    if (!frag && columns === 2 && targetCol === "coluna1" && targetPage.coluna2.remaining > 0) {
      const col2CapHere = targetPage.coluna2.remaining;
      const col2CapNext = otherPageCapacity;
      const retryCol2 = tryBuildFragment(split, col2CapHere, col2CapNext);
      if (retryCol2 && !(isTinyInitialFragment(retryCol2) && !isFreshStart(targetPage, "coluna2"))) {
        targetCol = "coluna2";
        capHere = col2CapHere;
        frag = retryCol2;
      }
    }

    if (!frag) {
      const cleanPage = newPage(pages.length);
      const cleanCapHere = cleanPage.coluna1.remaining;
      const cleanCapNext = columns === 2 ? cleanPage.coluna2.remaining : otherPageCapacity;
      const retryCleanPage = tryBuildFragment(split, cleanCapHere, cleanCapNext);
      if (retryCleanPage) {
        pages.push(cleanPage);
        targetPage = cleanPage;
        targetCol = "coluna1";
        capHere = cleanCapHere;
        frag = retryCleanPage;
      }
    }

    if (!frag) {
      // ALTERAÇÃO DOCUMENTADA:
      // fallback silencioso removido; agora há aviso explícito para facilitar
      // detectar divergências entre medição e fragmentação real.
      console.warn(
        `[pagination][optimized] Falha ao fragmentar questão ${qIndex}. Inserindo como 'full' por fallback.`
      );
      // Fallback
      const slot = targetCol === "coluna1" ? targetPage.coluna1 : targetPage.coluna2;
      slot.items.push({ kind: "full", q: qIndex });
      slot.remaining -= fullH;
      slot.usedHeight += fullH;
      return;
    }

    const sealFragmentSlot = (slot: PageSlots["coluna1"]) => {
      // Quando uma questão continua em outro slot, o espaço visual restante
      // deste slot não pode ser reutilizado por outra questão, senão ela entra
      // "no meio" da continuidade do texto fragmentado.
      slot.remaining = 0;
    };

    const buildRemainingFromBlock = (
      fromBlockIndex: number,
      capFirst: number,
      capNextLocal: number
    ) => {
      const remainingSplit: SplitInfo = {
        prefixHeight: 0,
        suffixHeight: split.suffixHeight,
        blocksHeights: split.blocksHeights.slice(fromBlockIndex),
        textBlockCount:
          split.textBlockCount == null
            ? undefined
            : Math.max(0, split.textBlockCount - fromBlockIndex),
      };

      const rebuilt = tryBuildFragment(remainingSplit, capFirst, capNextLocal);
      if (!rebuilt) return null;

      return {
        items: rebuilt.items.map((fragItem) => {
          const fi = fragItem as Extract<LayoutItem, { kind: "frag" }>;
          return {
            ...fi,
            q: qIndex,
            from: fi.from + fromBlockIndex,
            to: fi.to + fromBlockIndex,
            first: false,
            textBlockCount: split.textBlockCount,
          };
        }),
        heights: rebuilt.heights,
      };
    };

    let currentPage = targetPage;
    let currentCol = targetCol;

    for (let k = 0; k < frag.items.length; k++) {
      const item = frag.items[k] as Extract<LayoutItem, { kind: "frag" }>;
      const h = frag.heights[k];
      const isLastFragment = k === frag.items.length - 1;

      if (k === 0) {
        const slot = currentCol === "coluna1" ? currentPage.coluna1 : currentPage.coluna2;
        slot.items.push(item);
        slot.remaining -= h;
        slot.usedHeight += h;
        if (!isLastFragment) {
          sealFragmentSlot(slot);
        }
      } else {
        // Fragmentos seguintes: avançam para o próximo slot real do fluxo
        let placed = false;

        if (columns === 2 && currentCol === "coluna1") {
          if (
            currentPage.coluna2.remaining > 0 &&
            currentPage.coluna2.remaining + SLOT_FIT_EPS < h
          ) {
            const rebuilt = buildRemainingFromBlock(item.from - 1, currentPage.coluna2.remaining, otherPageCapacity);
            if (rebuilt) {
              frag.items.splice(k, frag.items.length - k, ...rebuilt.items);
              frag.heights.splice(k, frag.heights.length - k, ...rebuilt.heights);
              const rebuiltItem = frag.items[k];
              const rebuiltHeight = frag.heights[k];
              const rebuiltIsLast = k === frag.items.length - 1;

              currentPage.coluna2.items.push(rebuiltItem);
              currentPage.coluna2.remaining -= rebuiltHeight;
              currentPage.coluna2.usedHeight += rebuiltHeight;
              currentCol = "coluna2";
              if (!rebuiltIsLast) {
                sealFragmentSlot(currentPage.coluna2);
              }
              placed = true;
            }
          }

          if (!placed && currentPage.coluna2.remaining + SLOT_FIT_EPS >= h) {
            currentPage.coluna2.items.push(item);
            currentPage.coluna2.remaining -= h;
            currentPage.coluna2.usedHeight += h;
            currentCol = "coluna2";
            if (!isLastFragment) {
              sealFragmentSlot(currentPage.coluna2);
            }
            placed = true;
          }
        }

        if (!placed) {
          const newP = newPage(pages.length);
          const rebuilt = buildRemainingFromBlock(
            item.from - 1,
            newP.coluna1.remaining,
            columns === 2 ? newP.coluna2.remaining : otherPageCapacity
          );
          if (rebuilt) {
            pages.push(newP);
            currentPage = newP;
            currentCol = "coluna1";
            frag.items.splice(k, frag.items.length - k, ...rebuilt.items);
            frag.heights.splice(k, frag.heights.length - k, ...rebuilt.heights);
            const rebuiltItem = frag.items[k];
            const rebuiltHeight = frag.heights[k];
            const rebuiltIsLast = k === frag.items.length - 1;

            newP.coluna1.items.push(rebuiltItem);
            newP.coluna1.remaining -= rebuiltHeight;
            newP.coluna1.usedHeight += rebuiltHeight;
            if (!rebuiltIsLast) {
              sealFragmentSlot(newP.coluna1);
            }
            continue;
          }
          pages.push(newP);
          currentPage = newP;
          currentCol = "coluna1";
          newP.coluna1.items.push(item);
          newP.coluna1.remaining -= h;
          newP.coluna1.usedHeight += h;
          if (!isLastFragment) {
            sealFragmentSlot(newP.coluna1);
          }
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
  if (isPaginationDebugEnabled() && typeof window !== "undefined") {
    (window as any).__PMEDITOR_PAGINATION_DEBUG_TRACE__ = [];
  }

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
    const layout = adjustRemaining(distributeQuestionsOptimized(
      questionCount,
      questionHeights,
      firstPageCapacity,
      otherPageCapacity,
      config.columns,
      refs.measureItemsRef,
      config.setGroups ?? []
    ));
    writePaginationDebug({
      mode: "optimized",
      questionCount,
      firstPageCapacity,
      otherPageCapacity,
      rawHeights,
      questionHeights,
      setGroups: config.setGroups ?? [],
      pages: layout.map((p, pageIndex) => ({
        pageIndex,
        coluna1: p.coluna1,
        coluna2: p.coluna2,
        remainingHeight: p.remainingHeight,
        col1Remaining: p.col1Remaining,
        col2Remaining: p.col2Remaining,
      })),
    });
    return layout;
  }

  const layout = adjustRemaining(distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity,
    config.columns,
    refs.measureItemsRef
  ));
  writePaginationDebug({
    mode: "linear",
    questionCount,
    firstPageCapacity,
    otherPageCapacity,
    rawHeights,
    questionHeights,
    pages: layout.map((p, pageIndex) => ({
      pageIndex,
      coluna1: p.coluna1,
      coluna2: p.coluna2,
      remainingHeight: p.remainingHeight,
      col1Remaining: p.col1Remaining,
      col2Remaining: p.col2Remaining,
    })),
  });
  return layout;
}
