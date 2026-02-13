/**
 * Layout de Lista de Exercício
 * Renderiza lista com cabeçalho (ExerciseHeader)
 * Suporta 1 ou 2 colunas
 */

"use client";

import React from "react";
import { LayoutProps, ColumnCount } from "@/types/layout";
import { ExerciseHeader } from "../headers/ExerciseHeader";
import { useProva } from "@/contexts/ProvaContext";

interface ExerciseLayoutProps extends LayoutProps {
  columns: ColumnCount;
  logoPlaceholder?: string;
}

export function ExerciseLayout({
  pages,
  orderedQuestions,
  logoUrl,
  onLogoClick,
  renderQuestion,
  refs,
  columns,
}: ExerciseLayoutProps) {
  const { provaConfig } = useProva();

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
      {(pages.length ? pages : [{ coluna1: [], coluna2: [] }]).map((p, pageIndex) => (
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
                  {(p.coluna1 ?? []).map((it: any) => renderLayoutItem(it))}
                </div>

                {columns === 2 && (
                  <div className="coluna coluna-2">
                    {(p.coluna2 ?? []).map((it: any) => renderLayoutItem(it))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
