// src/hooks/usePagination.ts
/**
 * Custom hook para gerenciar a paginação de provas
 * Encapsula a lógica de cálculo de layout e estado de páginas
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculatePageLayout,
  PageLayout,
  PaginationConfig,
} from "@/lib/pagination";

export interface UsePaginationProps {
  config: PaginationConfig;
  questionCount: number;
  dependencies: any[];
}

function stableStringify(value: any): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "function") return "[fn]";
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();

    if (v && typeof v === "object") {
      if (seen.has(v)) return "[circular]";
      seen.add(v);
    }

    return v;
  });
}

export function usePagination({ config, questionCount, dependencies }: UsePaginationProps) {
  // Refs para os elementos de medição
  const measureItemsRef = useRef<HTMLDivElement | null>(null);
  const measureFirstPageRef = useRef<HTMLDivElement | null>(null);
  const measureFirstQuestoesRef = useRef<HTMLDivElement | null>(null);
  const measureOtherPageRef = useRef<HTMLDivElement | null>(null);
  const measureOtherQuestoesRef = useRef<HTMLDivElement | null>(null);

  // Estado das páginas calculadas
  const [pages, setPages] = useState<PageLayout[]>([]);

  // Chave estável baseada no CONTEÚDO de dependencies (não na identidade do array)
  const depsKey = useMemo(() => stableStringify(dependencies), [dependencies]);

  // Dependências primitivas do config (evita loop por identidade de objeto)
  const pageHeight = config.pageHeight;
  const safetyMargin = config.safetyMargin;
  const columns = config.columns;
  const allowPageBreak = config.allowPageBreak ?? false;

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    let timeoutId: NodeJS.Timeout | undefined;

    const attemptLayout = () => {
      const layout = calculatePageLayout(
        { pageHeight, safetyMargin, columns, allowPageBreak },
        {
          firstPageRef: measureFirstPageRef.current,
          firstQuestoesRef: measureFirstQuestoesRef.current,
          otherPageRef: measureOtherPageRef.current,
          otherQuestoesRef: measureOtherQuestoesRef.current,
          measureItemsRef: measureItemsRef.current,
        },
        questionCount
      );

      if (layout) {
        setPages(layout);
      } else if (retryCount < maxRetries) {
        retryCount++;
        timeoutId = setTimeout(attemptLayout, 50 * retryCount);
      }
    };

    attemptLayout();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [depsKey, pageHeight, safetyMargin, columns, allowPageBreak, questionCount]);

  return {
    pages,
    refs: {
      measureItemsRef,
      measureFirstPageRef,
      measureFirstQuestoesRef,
      measureOtherPageRef,
      measureOtherQuestoesRef,
    },
  };
}
