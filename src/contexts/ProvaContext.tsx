"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type QuestionData = {
  metadata: any;
  content: any;
};

type ColumnLayout = {
  coluna1: QuestionData[];
  coluna2: QuestionData[];
};

type LayoutType = "prova" | "exercicio";
type ColumnCount = 1 | 2;

export type ProvaConfig = {
  layoutType: LayoutType;
  columns: ColumnCount;
  logoUrl: string | null;

  // gabarito
  showGabarito: boolean;

  // campos do cabeçalho
  nome: string;
  turma: string;
  professor: string;
  disciplina: string;
  data: string;
  nota: string;

  instituicao: string;
};


type ProvaContextType = {
  selectedQuestions: QuestionData[];
  addQuestion: (question: QuestionData) => void;
  removeQuestion: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  updateColumnLayout: (layout: ColumnLayout) => void;

  provaConfig: ProvaConfig;
  updateProvaConfig: (config: Partial<ProvaConfig>) => void;
  resetProvaConfig: () => void;
};

const defaultProvaConfig: ProvaConfig = {
  layoutType: "prova",
  columns: 2,
  logoUrl: null,
  showGabarito: false,

  nome: "",
  turma: "",
  professor: "",
  disciplina: "",
  data: "",
  nota: "",

  instituicao: "Centro Federal de Educação Tecnológica Celso Suckow da Fonseca",
};

const ProvaContext = createContext<ProvaContextType | undefined>(undefined);

export function ProvaProvider({ children }: { children: ReactNode }) {
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionData[]>([]);
  const [provaConfig, setProvaConfig] = useState<ProvaConfig>(defaultProvaConfig);

  const addQuestion = (question: QuestionData) => {
    setSelectedQuestions((prev) => {
      const exists = prev.find((q) => q.metadata.id === question.metadata.id);
      if (exists) return prev;
      return [...prev, question];
    });
  };

  const removeQuestion = (id: string) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.metadata.id !== id));
  };

  const clearAll = () => {
    setSelectedQuestions([]);
  };

  const isSelected = (id: string) => {
    return selectedQuestions.some((q) => q.metadata.id === id);
  };

  const updateColumnLayout = (layout: ColumnLayout) => {
    setSelectedQuestions([...layout.coluna1, ...layout.coluna2]);
  };

  const updateProvaConfig = (config: Partial<ProvaConfig>) => {
    setProvaConfig((prev) => ({ ...prev, ...config }));
  };

  const resetProvaConfig = () => {
    setProvaConfig(defaultProvaConfig);
  };

  return (
    <ProvaContext.Provider
      value={{
        selectedQuestions,
        addQuestion,
        removeQuestion,
        clearAll,
        isSelected,
        updateColumnLayout,
        provaConfig,
        updateProvaConfig,
        resetProvaConfig,
      }}
    >
      {children}
    </ProvaContext.Provider>
  );
}

export function useProva() {
  const context = useContext(ProvaContext);
  if (!context) throw new Error("useProva must be used within ProvaProvider");
  return context;
}
