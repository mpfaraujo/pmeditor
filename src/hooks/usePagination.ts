/**
 * Custom hook para gerenciar a paginação de provas
 * Encapsula a lógica de cálculo de layout e estado de páginas
 */

import { useEffect, useRef, useState } from "react";
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

export function usePagination({
  config,
  questionCount,
  dependencies,
}: UsePaginationProps) {
  // Refs para os elementos de medição
  const measureItemsRef = useRef<HTMLDivElement | null>(null);
  const measureFirstPageRef = useRef<HTMLDivElement | null>(null);
  const measureFirstQuestoesRef = useRef<HTMLDivElement | null>(null);
  const measureOtherPageRef = useRef<HTMLDivElement | null>(null);
  const measureOtherQuestoesRef = useRef<HTMLDivElement | null>(null);

  // Estado das páginas calculadas
  const [pages, setPages] = useState<PageLayout[]>([]);

  // Effect que calcula o layout das páginas
  useEffect(() => {
    const layout = calculatePageLayout(config, {
      firstPageRef: measureFirstPageRef.current,
      firstQuestoesRef: measureFirstQuestoesRef.current,
      otherPageRef: measureOtherPageRef.current,
      otherQuestoesRef: measureOtherQuestoesRef.current,
      measureItemsRef: measureItemsRef.current,
    }, questionCount);

    if (layout) {
      setPages(layout);
    }
  }, dependencies);

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
