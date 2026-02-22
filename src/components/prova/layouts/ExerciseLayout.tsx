/**
 * Layout de Lista de Exercício
 * Renderiza lista com cabeçalho (ExerciseHeader)
 * Suporta 1 ou 2 colunas
 */

"use client";

import React from "react";
import { LayoutProps, ColumnCount } from "@/types/layout";
import { ExerciseHeader } from "../headers/ExerciseHeader";
import { ProvaFooter } from "../ProvaFooter";
import { useProva } from "@/contexts/ProvaContext";
import type { QuestionPermutation } from "@/lib/GeraTiposDeProva";
import { SpacerHandle } from "../SpacerHandle";

interface ExerciseLayoutProps extends LayoutProps {
  columns: ColumnCount;
  logoPlaceholder?: string;
  tipoAtual?: number;
  numTipos?: number;
  permutations?: QuestionPermutation[] | null;
  spacers?: Map<string, number>;
  committedSpacers?: Map<string, number>;
  onSpacerChange?: (key: string, h: number) => void;
  onSpacerCommit?: (key: string, h: number) => void;
}

export function ExerciseLayout({
  pages,
  orderedQuestions,
  logoUrl,
  onLogoClick,
  renderQuestion,
  refs,
  columns,
  tipoAtual,
  numTipos,
  permutations,
  spacers,
  committedSpacers,
  onSpacerChange,
  onSpacerCommit,
}: ExerciseLayoutProps) {
  const { provaConfig } = useProva();

  const qKey = (it: any) => `q${typeof it === "number" ? it : it?.q ?? 0}`;
  const colTotal = (items: any[]) =>
    items.slice(0, -1).reduce((sum: number, it: any) =>
      sum + (spacers?.get(qKey(it)) ?? 0), 0);

  const renderLayoutItem = (it: any) => {
    if (typeof it === "number") {
      return renderQuestion(orderedQuestions[it], it);
    }

    if (it?.kind === "full") {
      return renderQuestion(orderedQuestions[it.q], it.q);
    }

    if (it?.kind === "frag") {
      const rq = renderQuestion as unknown as (
        q: any,
        idx: number,
        frag: any
      ) => React.ReactNode;

      return rq(orderedQuestions[it.q], it.q, it);
    }

    return null;
  };

  return (
    <>
      {/* Camada invisível para medição (NÃO IMPRIMIR) */}
      <div className="measure-layer absolute -z-10 invisible pointer-events-none">
        {/* Template 1: com cabeçalho */}
        <div className="prova-page mx-auto bg-white" ref={refs.measureFirstPageRef}>
          <ExerciseHeader
            logoUrl={logoUrl}
            onLogoClick={onLogoClick}
            isEditable={false}
            instituicao={provaConfig.instituicao}
            titulo={provaConfig.layoutType === "exercicio" ? "Lista de Exercícios" : "Exercícios"}
            professor={provaConfig.professor}
            disciplina={provaConfig.disciplina}
            turma={provaConfig.turma}
            data={provaConfig.data}
          />
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
              {orderedQuestions.map((q, idx) => renderQuestion(q, idx))}
            </div>

            {/* CRÍTICO: precisa existir coluna-2 no DOM para ativar o :has(.coluna-2)
                e medir a coluna-1 com 8.5cm quando columns=2 */}
            {columns === 2 && <div className="coluna coluna-2" />}
          </div>
        </div>
      </div>

      {/* Renderização das páginas */}
      {(pages.length ? pages : [{ coluna1: [], coluna2: [], remainingHeight: 0 }] as any).map((p: any, pageIndex: number) => (
        <div key={pageIndex} className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
          <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
            {pageIndex === 0 && (
              <ExerciseHeader
                logoUrl={logoUrl}
                onLogoClick={onLogoClick}
                isEditable={true}
                instituicao={provaConfig.instituicao}
                titulo={provaConfig.layoutType === "exercicio" ? "Lista de Exercícios" : "Exercícios"}
                professor={provaConfig.professor}
                disciplina={provaConfig.disciplina}
                turma={provaConfig.turma}
                data={provaConfig.data}
              />
            )}

            {/* espaço controlado entre header e questões */}
            <div className={pageIndex === 0 ? "pt-6" : ""}>
              <div className="questoes-container">
                <div className="coluna coluna-1">
                  {(p.coluna1 ?? []).map((it: any, idx: number) => {
                    const items = p.coluna1 ?? [];
                    const key = qKey(it);
                    const maxH = Math.max(0, p.col1Remaining ?? 0) + (committedSpacers?.get(key) ?? 0);
                    return (
                      <React.Fragment key={idx}>
                        {renderLayoutItem(it)}
                        {onSpacerChange && idx < items.length - 1 && (
                          <SpacerHandle
                            spacerKey={key}
                            currentHeight={spacers?.get(key) ?? 0}
                            maxHeight={maxH}
                            onChange={onSpacerChange}
                            onCommit={onSpacerCommit}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {columns === 2 && (
                  <div className="coluna coluna-2">
                    {(p.coluna2 ?? []).map((it: any, idx: number) => {
                      const items = p.coluna2 ?? [];
                      const key = qKey(it);
                      const maxH = Math.max(0, p.col2Remaining ?? 0) + (committedSpacers?.get(key) ?? 0);
                      return (
                        <React.Fragment key={idx}>
                          {renderLayoutItem(it)}
                          {onSpacerChange && idx < items.length - 1 && (
                            <SpacerHandle
                              spacerKey={key}
                              currentHeight={spacers?.get(key) ?? 0}
                              maxHeight={maxH}
                              onChange={onSpacerChange}
                              onCommit={onSpacerCommit}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <ProvaFooter
              disciplina={provaConfig.disciplina}
              currentPage={pageIndex + 1}
              totalPages={pages.length || 1}
              spacerHeight={Math.max(0, (p.remainingHeight ?? 0) - Math.max(
                colTotal(p.coluna1 ?? []),
                colTotal(p.coluna2 ?? [])
              ))}
              tipoAtual={tipoAtual}
              numTipos={numTipos}
            />
          </div>
        </div>
      ))}
    </>
  );
}
