/**
 * Camada invisível de medição da paginação (NÃO IMPRIMIR).
 *
 * Uma instância por bloco de paginação: na diagramação híbrida há duas
 * (bloco de 1 coluna e bloco de 2 colunas), cada uma com seus refs e a
 * fatia [inicio, fim) das questões, medida com a largura de coluna do bloco.
 */

import React from "react";
import type { ColumnCount, PaginationRefs, QuestionData } from "@/types/layout";

interface MeasureLayerProps {
  /** Cabeçalho da 1ª página (template 1), já com título se houver */
  header: React.ReactNode;
  columns: ColumnCount;
  refs: PaginationRefs;
  questions: QuestionData[];
  /** índice global da 1ª questão da fatia */
  inicio: number;
  renderQuestion: (question: QuestionData | undefined, globalIndex: number) => React.ReactNode;
}

export function MeasureLayer({ header, columns, refs, questions, inicio, renderQuestion }: MeasureLayerProps) {
  return (
    <div className="measure-layer absolute -z-10 opacity-0 pointer-events-none" aria-hidden="true">
      {/* Template 1: com cabeçalho */}
      <div className="prova-page mx-auto bg-white" ref={refs.measureFirstPageRef}>
        {header}
        <div className="questoes-container" ref={refs.measureFirstQuestoesRef}>
          <div className="coluna coluna-1" />
          {columns === 2 && <div className="coluna coluna-2" />}
        </div>
      </div>

      {/* Template 2: sem cabeçalho */}
      <div className="prova-page mx-auto bg-white" ref={refs.measureOtherPageRef}>
        <div className="questoes-container" ref={refs.measureOtherQuestoesRef}>
          <div className="coluna coluna-1" />
          {columns === 2 && <div className="coluna coluna-2" />}
        </div>
      </div>

      {/* Template 3: alturas das questões */}
      <div className="prova-page mx-auto bg-white">
        <div className={`questoes-container columns-${columns}`}>
          <div className="coluna coluna-1" ref={refs.measureItemsRef}>
            {questions.map((q, i) => renderQuestion(q, inicio + i))}
          </div>

          {/* CRÍTICO: precisa existir coluna-2 no DOM para ativar o :has(.coluna-2)
              e medir a coluna-1 com 8.5cm quando columns=2 */}
          {columns === 2 && <div className="coluna coluna-2" />}
        </div>
      </div>
    </div>
  );
}
