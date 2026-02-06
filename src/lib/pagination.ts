/**
 * Lógica de paginação para provas em formato A4
 * Responsável por calcular como as questões devem ser distribuídas
 * entre páginas considerando o espaço disponível
 */

export type PageLayout = {
  coluna1: number[];
  coluna2: number[];
};

export interface PaginationConfig {
  pageHeight: number;
  safetyMargin: number;
  columns: 1 | 2;
}

export interface MeasurementData {
  firstPageCapacity: number;
  otherPageCapacity: number;
  questionHeights: number[];
}

/**
 * Calcula o espaço disponível em pixels para questões na primeira página
 * considerando a altura do cabeçalho
 */
export function calculateFirstPageCapacity(
  firstPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const firstPageTop = firstPageElement.getBoundingClientRect().top;
  const questionsTop = questionsContainerElement.getBoundingClientRect().top;
  return Math.max(0, pageHeight - (questionsTop - firstPageTop) - safetyMargin);
}

/**
 * Calcula o espaço disponível em pixels para questões nas páginas subsequentes
 * (sem cabeçalho)
 */
export function calculateOtherPageCapacity(
  otherPageElement: HTMLElement,
  questionsContainerElement: HTMLElement,
  pageHeight: number,
  safetyMargin: number
): number {
  const otherPageTop = otherPageElement.getBoundingClientRect().top;
  const questionsTop = questionsContainerElement.getBoundingClientRect().top;
  return Math.max(0, pageHeight - (questionsTop - otherPageTop) - safetyMargin);
}

/**
 * Mede a altura de cada questão incluindo suas margens
 */
export function measureQuestionHeights(
  measurementContainer: HTMLElement
): number[] {
  const itemEls = Array.from(
    measurementContainer.querySelectorAll(".questao-item-wrapper")
  ) as HTMLDivElement[];

  return itemEls.map((el) => {
    const cs = window.getComputedStyle(el);
    const mt = parseFloat(cs.marginTop || "0") || 0;
    const mb = parseFloat(cs.marginBottom || "0") || 0;
    return el.offsetHeight + mt + mb;
  });
}

/**
 * Distribui questões em páginas e colunas baseado nas alturas medidas
 * e na capacidade de cada página
 *
 * columns=1 => só usa coluna1, coluna2 sempre vazia
 * columns=2 => lógica padrão (coluna1 e coluna2)
 */
export function distributeQuestionsAcrossPages(
  questionCount: number,
  questionHeights: number[],
  firstPageCapacity: number,
  otherPageCapacity: number,
  columns: 1 | 2
): PageLayout[] {
  const newPages: PageLayout[] = [];
  let page: PageLayout = { coluna1: [], coluna2: [] };

  let col: "coluna1" | "coluna2" = "coluna1";
  let used = 0;
  let pageIndex = 0;

  const getPageCapacity = () =>
    pageIndex === 0 ? firstPageCapacity : otherPageCapacity;

  for (let i = 0; i < questionCount; i++) {
    const h = questionHeights[i] ?? 0;

    if (used + h > getPageCapacity()) {
      if (columns === 2 && col === "coluna1") {
        // 2 colunas: tenta a coluna 2
        col = "coluna2";
        used = 0;
      } else {
        // 1 coluna (ou coluna2 cheia): próxima página
        newPages.push(page);
        pageIndex++;
        page = { coluna1: [], coluna2: [] };
        col = "coluna1";
        used = 0;
      }
    }

    page[col].push(i);
    used += h;
  }

  newPages.push(page);
  return newPages;
}

/**
 * Função principal que orquestra todo o processo de paginação
 */
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

  const questionHeights = measureQuestionHeights(refs.measureItemsRef);

  return distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity,
    config.columns
  );
}
