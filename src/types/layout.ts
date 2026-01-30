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
  refs: {
    measureFirstPageRef: React.RefObject<HTMLDivElement|null>;
    measureFirstQuestoesRef: React.RefObject<HTMLDivElement|null>;
    measureOtherPageRef: React.RefObject<HTMLDivElement|null>;
    measureOtherQuestoesRef: React.RefObject<HTMLDivElement|null>;
    measureItemsRef: React.RefObject<HTMLDivElement|null>;
  };
}

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
