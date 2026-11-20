/**
 * Tipos para configuração de layouts de prova/exercício
 */

export type LayoutType = "prova" | "exercicio";
export type ColumnCount = 1 | 2;

export interface LayoutConfig {
  type: LayoutType;
  columns: ColumnCount;
}

/**
 * Props que um layout deve receber
 */
export interface LayoutProps {
  pages: PageLayout[];
  orderedQuestions: QuestionData[];
  logoUrl: string | null;
  onLogoClick: () => void;
  renderQuestion: (question: QuestionData | undefined, globalIndex: number) => React.ReactNode;
  refs: PaginationRefs;
  /**
   * Diagramação híbrida: uma camada de medição por bloco (colunas próprias,
   * fatia [inicio, fim) de orderedQuestions). Ausente = uma camada com `refs`.
   */
  blocos?: BlocoMedicao[];
}

export type PaginationRefs = {
  measureFirstPageRef: React.RefObject<HTMLDivElement|null>;
  measureFirstQuestoesRef: React.RefObject<HTMLDivElement|null>;
  measureOtherPageRef: React.RefObject<HTMLDivElement|null>;
  measureOtherQuestoesRef: React.RefObject<HTMLDivElement|null>;
  measureItemsRef: React.RefObject<HTMLDivElement|null>;
};

export type BlocoMedicao = {
  columns: ColumnCount;
  refs: PaginationRefs;
  /** índice global da 1ª questão do bloco */
  inicio: number;
  /** exclusivo */
  fim: number;
};

export type PageLayout = {
  coluna1: number[];
  coluna2: number[];
};

export type QuestionData = {
  metadata: any;
  content: any;
};

export type ColumnLayout = {
  coluna1: QuestionData[];
  coluna2: QuestionData[];
};
