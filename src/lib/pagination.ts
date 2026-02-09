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
  allowPageBreak?: boolean;
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
  // Usamos offsetTop em vez de getBoundingClientRect para evitar problemas com scroll
  // ou transformações de escala durante a medição
  const questionsTop = questionsContainerElement.offsetTop;
  const firstPageTop = firstPageElement.offsetTop;
  
  // A altura ocupada pelo cabeçalho e outros elementos acima do container de questões
  const occupiedHeight = questionsTop - firstPageTop;
  
  // Aumentamos a margem de segurança na primeira página para 1.5x o padrão
  // para acomodar variações de renderização de cabeçalhos complexos
  return Math.max(0, pageHeight - occupiedHeight - (safetyMargin * 1.5));
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
  const questionsTop = questionsContainerElement.offsetTop;
  const otherPageTop = otherPageElement.offsetTop;
  
  const occupiedHeight = questionsTop - otherPageTop;
  
  return Math.max(0, pageHeight - occupiedHeight - safetyMargin);
}

/**
 * Mede a altura de cada questão incluindo suas margens
 * Com validação para garantir que elementos estão renderizados
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
    const height = el.offsetHeight + mt + mb;
    
    // Validação: se a altura for 0, pode indicar que o elemento ainda não foi renderizado
    // Retorna um valor mínimo conservador (10px) para evitar distribuição incorreta
    return Math.max(height, 10);
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
  columns: 1 | 2,
  allowPageBreak: boolean = false
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
    const cap = getPageCapacity();

    // Quando allowPageBreak está ativado e a questão é maior que a capacidade
    // da página inteira, não tentamos mantê-la indivisivel.
    // Colocamos ela na posição atual e o CSS (break-inside: auto)
    // vai permitir que o browser quebre naturalmente entre páginas.
    if (allowPageBreak && h > cap && used === 0) {
      // Questão gigante no início da coluna: coloca e avança.
      // O browser vai quebrar visualmente via CSS.
      // Estimamos quantas "páginas" essa questão vai consumir
      // e ajustamos o espaço restante.
      page[col].push(i);
      const overflow = h - cap;
      if (overflow > 0) {
        // A questão vai "vazar" para a próxima página/coluna.
        // Calculamos o espaço consumido após a quebra.
        const pagesConsumed = Math.ceil(overflow / otherPageCapacity);
        // Avançamos para a próxima coluna/página
        if (columns === 2 && col === "coluna1") {
          col = "coluna2";
          used = 0;
        } else {
          newPages.push(page);
          pageIndex += pagesConsumed;
          page = { coluna1: [], coluna2: [] };
          col = "coluna1";
          // Espaço residual consumido na última página
          used = overflow - ((pagesConsumed - 1) * otherPageCapacity);
          if (used < 0) used = 0;
        }
      } else {
        used = h;
      }
      continue;
    }

    if (used > 0 && used + h > cap) {
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
 * Com validações extras para garantir medições corretas
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

  // Validação: garantir que os elementos estão visíveis e têm dimensões
  if (refs.firstPageRef.offsetHeight === 0 || refs.measureItemsRef.offsetHeight === 0) {
    // Elementos ainda não foram renderizados, retorna null para tentar novamente
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

  // Validação: capacidades devem ser positivas
  if (firstPageCapacity <= 0 || otherPageCapacity <= 0) {
    // Capacidades inválidas, retorna null para tentar novamente
    return null;
  }

  const questionHeights = measureQuestionHeights(refs.measureItemsRef);

  return distributeQuestionsAcrossPages(
    questionCount,
    questionHeights,
    firstPageCapacity,
    otherPageCapacity,
    config.columns,
    config.allowPageBreak ?? false
  );
}
