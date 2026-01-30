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
}

export interface MeasurementData {
  firstPageCapacity: number;
  otherPageCapacity: number;
  questionHeights: number[];
}

/**
 * Calcula o espaço disponível em pixels para questões na primeira página
 * considerando a altura do cabeçalho
 *
 * @param firstPageElement - Elemento DOM da primeira página (com cabeçalho)
 * @param questionsContainerElement - Elemento DOM do container de questões
 * @param pageHeight - Altura total da página em pixels
 * @param safetyMargin - Margem de segurança em pixels
 * @returns Espaço disponível em pixels
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
 *
 * @param otherPageElement - Elemento DOM de uma página sem cabeçalho
 * @param questionsContainerElement - Elemento DOM do container de questões
 * @param pageHeight - Altura total da página em pixels
 * @param safetyMargin - Margem de segurança em pixels
 * @returns Espaço disponível em pixels
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
 *
 * @param measurementContainer - Elemento DOM que contém as questões renderizadas
 * @returns Array com a altura (em pixels) de cada questão
 */
export function measureQuestionHeights(measurementContainer: HTMLElement): number[] {
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
 * @param questionCount - Número total de questões
 * @param questionHeights - Array com a altura de cada questão
 * @param firstPageCapacity - Espaço disponível na primeira página
 * @param otherPageCapacity - Espaço disponível nas outras páginas
 * @returns Array de layouts de página, cada um com questões distribuídas em duas colunas
 */
export function distributeQuestionsAcrossPages(
  questionCount: number,
  questionHeights: number[],
  firstPageCapacity: number,
  otherPageCapacity: number
): PageLayout[] {
  const newPages: PageLayout[] = [];
  let page: PageLayout = { coluna1: [], coluna2: [] };

  let col: "coluna1" | "coluna2" = "coluna1";
  let used = 0;
  let pageIndex = 0;

  const getPageCapacity = () => (pageIndex === 0 ? firstPageCapacity : otherPageCapacity);

  for (let i = 0; i < questionCount; i++) {
    const h = questionHeights[i] ?? 0;

    // Se a questão não cabe na coluna atual, tenta passar para a próxima coluna
    if (used + h > getPageCapacity()) {
      if (col === "coluna1") {
        // Muda para coluna 2
        col = "coluna2";
        used = 0;
      } else {
        // Coluna 2 está cheia, vai para a próxima página
        newPages.push(page);
        pageIndex++;
        page = { coluna1: [], coluna2: [] };
        col = "coluna1";
        used = 0;
      }
    }

    // Adiciona a questão à coluna atual
    page[col].push(i);
    used += h;
  }

  // Adiciona a última página
  newPages.push(page);
  return newPages;
}

/**
 * Função principal que orquestra todo o processo de paginação
 *
 * @param config - Configuração de paginação (altura da página, margem de segurança)
 * @param refs - Referências aos elementos DOM necessários para medição
 * @param questionCount - Número total de questões
 * @returns Dados de medição e layout das páginas
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
  // Validação: todos os refs devem estar disponíveis
  if (
    !refs.firstPageRef ||
    !refs.firstQuestoesRef ||
    !refs.otherPageRef ||
    !refs.otherQuestoesRef ||
    !refs.measureItemsRef
  ) {
    return null;
  }

  // Calcula a capacidade de cada página
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

  // Mede as alturas das questões
  const questionHeights = measureQuestionHeights(refs.measureItemsRef);

  // Distribui as questões entre as páginas
  return distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity
  );
}
