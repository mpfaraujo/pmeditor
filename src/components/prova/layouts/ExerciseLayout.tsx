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
import { MeasureLayer } from "./MeasureLayer";

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
  blocos,
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
      {/* Camadas invisíveis para medição (NÃO IMPRIMIR) — uma por bloco de paginação */}
      {(blocos ?? [{ columns, refs, inicio: 0, fim: orderedQuestions.length }]).map((b) => (
        <MeasureLayer
          key={`${b.inicio}-${b.columns}`}
          header={
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
          }
          columns={b.columns}
          refs={b.refs}
          questions={orderedQuestions.slice(b.inicio, b.fim)}
          inicio={b.inicio}
          renderQuestion={renderQuestion}
        />
      ))}

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

                {(p.columns ?? columns) === 2 && (
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
              layoutType="exercicio"
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
