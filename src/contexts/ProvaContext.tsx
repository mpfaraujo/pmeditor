"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
  useEffect,
} from "react";

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

  // header layout (0..10)
  headerLayout: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  questionHeaderVariant: 0 | 1 | 2 | 3 | 4;

  // quebra controlada: permite que questões longas sejam divididas entre páginas
  allowPageBreak: boolean;
};

export type Selection =
  | { kind: "question"; id: string }
  | { kind: "set"; id: string; itemIndexes: number[] }; // >= 2

type ProvaContextType = {
  // EXISTENTE (não muda)
  selectedQuestions: QuestionData[];
  addQuestion: (question: QuestionData) => void;
  removeQuestion: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  updateColumnLayout: (layout: ColumnLayout) => void;

  // NOVO (mínima interferência)
  selections: Selection[];
  selectedCount: number;
  setSetSelection: (setId: string, itemIndexes: number[]) => void;

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
  instituicao: "",

  headerLayout: 0,
  questionHeaderVariant: 0,
  allowPageBreak: true,
};

const ProvaContext = createContext<ProvaContextType | undefined>(undefined);

/* ---------------- helpers (somente leitura) ---------------- */

type PMNode = {
  type: string;
  attrs?: any;
  content?: PMNode[];
};

function safeParseDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object") return null;
    if (doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
}

function getSetItemCount(doc: PMNode | null): number {
  const setNode = doc?.content?.find((n) => n?.type === "set_questions");
  const items = setNode?.content?.filter((n) => n?.type === "question_item") ?? [];
  return items.length;
}

function isSetDoc(doc: PMNode | null): boolean {
  return !!doc?.content?.some((n) => n?.type === "set_questions");
}

function normalizeHeaderLayout(v: any): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  const n = typeof v === "number" ? v : Number(v);
  if (n >= 0 && n <= 10) return n as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  return 0;
}

const LS_KEY = "provaConfig_v1";

/* ---------------- provider ---------------- */

export function ProvaProvider({ children }: { children: ReactNode }) {
  // EXISTENTE
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionData[]>([]);
  const [provaConfig, setProvaConfig] = useState<ProvaConfig>(() => {
    if (typeof window === "undefined") return defaultProvaConfig;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return defaultProvaConfig;
      const parsed = JSON.parse(raw) as Partial<ProvaConfig> | null;
      if (!parsed || typeof parsed !== "object") return defaultProvaConfig;
      return {
        ...defaultProvaConfig,
        ...parsed,
        headerLayout: normalizeHeaderLayout((parsed as any).headerLayout),
      };
    } catch {
      return defaultProvaConfig;
    }
  });

  // NOVO: guarda seleção de itens por setId
  const [setSelectionsById, setSetSelectionsById] = useState<
    Record<string, number[]>
  >({});

  // EXISTENTE (idêntico)
  const addQuestion = (question: QuestionData) => {
    setSelectedQuestions((prev) => {
      const exists = prev.find((q) => q.metadata.id === question.metadata.id);
      if (exists) return prev;
      return [...prev, question];
    });
  };

  // EXISTENTE + limpeza do map (não afeta comportamento antigo)
  const removeQuestion = (id: string) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.metadata.id !== id));
    setSetSelectionsById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // EXISTENTE + limpeza do map
  const clearAll = () => {
    setSelectedQuestions([]);
    setSetSelectionsById({});
  };

  // EXISTENTE (idêntico)
  const isSelected = (id: string) => {
    return selectedQuestions.some((q) => q.metadata.id === id);
  };

  // EXISTENTE (idêntico)
  const updateColumnLayout = (layout: ColumnLayout) => {
    setSelectedQuestions([...layout.coluna1, ...layout.coluna2]);
  };

  // NOVO: setter do subconjunto (enforce >=2 aqui)
  const setSetSelection = (setId: string, itemIndexes: number[]) => {
    const uniqSorted = Array.from(new Set(itemIndexes))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => a - b);

    // regra mínima: >=2. Se não cumprir, não salva (mantém seleção anterior).
    if (uniqSorted.length < 2) return;

    setSetSelectionsById((prev) => ({ ...prev, [setId]: uniqSorted }));
  };

  // EXISTENTE (+ normalização do headerLayout)
  const updateProvaConfig = (config: Partial<ProvaConfig>) => {
    setProvaConfig((prev) => ({
      ...prev,
      ...config,
      headerLayout:
        config.headerLayout !== undefined
          ? normalizeHeaderLayout(config.headerLayout)
          : prev.headerLayout,
    }));
  };

  // EXISTENTE
  const resetProvaConfig = () => {
    setProvaConfig(defaultProvaConfig);
  };

  // persistência (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          ...provaConfig,
          headerLayout: normalizeHeaderLayout(provaConfig.headerLayout),
        })
      );
    } catch {
      // ignore
    }
  }, [provaConfig]);

  // NOVO: selections derivado + respeita setSelectionsById
  const selections = useMemo<Selection[]>(() => {
    const out: Selection[] = [];

    for (const q of selectedQuestions) {
      const id = q?.metadata?.id;
      if (!id) continue;

      const doc = safeParseDoc(q.content);
      if (isSetDoc(doc)) {
        const n = getSetItemCount(doc);
        if (n >= 2) {
          const saved = setSelectionsById[id];
          const fallbackAll = Array.from({ length: n }, (_, i) => i);

          // usa saved se for válido; senão, cai em "todos"
          const chosen = Array.isArray(saved)
            ? saved.filter((i) => i >= 0 && i < n)
            : fallbackAll;

          const chosenUniq = Array.from(new Set(chosen)).sort((a, b) => a - b);

          // garante regra >=2 (se não, volta pra "todos")
          const finalIdxs =
            chosenUniq.length >= 2 ? chosenUniq : fallbackAll;

          out.push({ kind: "set", id, itemIndexes: finalIdxs });
          continue;
        }
      }

      out.push({ kind: "question", id });
    }

    return out;
  }, [selectedQuestions, setSelectionsById]);

  // NOVO: contador real (set soma itens)
  const selectedCount = useMemo(() => {
    return selections.reduce((acc, s) => {
      if (s.kind === "question") return acc + 1;
      return acc + s.itemIndexes.length;
    }, 0);
  }, [selections]);

  return (
    <ProvaContext.Provider
      value={{
        selectedQuestions,
        addQuestion,
        removeQuestion,
        clearAll,
        isSelected,
        updateColumnLayout,

        selections,
        selectedCount,
        setSetSelection,

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
