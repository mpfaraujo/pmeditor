// src/components/prova/layouts/ProvaLayout.tsx
/**
 * Layout de Prova
 * Renderiza prova com cabeçalho completo (ProvaHeader)
 * Suporta 1 ou 2 colunas
 */

import React from "react";
import { LayoutProps, ColumnCount } from "@/types/layout";
import { ProvaHeader } from "../headers/ProvaHeader";
import { ProvaFooter } from "../ProvaFooter";
import { useProva } from "@/contexts/ProvaContext";
import { ProvaHeaderLayout1 } from "../headers/ProvaHeaderLayout1";
import { ProvaHeaderLayout2 } from "../headers/ProvaHeaderLayout2";
import { ProvaHeaderLayout3 } from "../headers/ProvaHeaderLayout3";
import { ProvaHeaderLayout4 } from "../headers/ProvaHeaderLayout4";
import { ProvaHeaderLayout5 } from "../headers/ProvaHeaderLayout5";
import { ProvaHeaderLayout6 } from "../headers/ProvaHeaderLayout6";
import { ProvaHeaderLayout7 } from "../headers/ProvaHeaderLayout7";
import { ProvaHeaderLayout8 } from "../headers/ProvaHeaderLayout8";
import { ProvaHeaderLayout9 } from "../headers/ProvaHeaderLayout9";
import { ProvaHeaderLayout10 } from "../headers/ProvaHeaderLayout10";
import type { QuestionPermutation } from "@/lib/GeraTiposDeProva";
import { SpacerHandle } from "../SpacerHandle";

interface ProvaLayoutProps extends LayoutProps {
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

export function ProvaLayout({
  pages,
  orderedQuestions,
  logoUrl,
  logoPlaceholder,
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
}: ProvaLayoutProps) {
  const { provaConfig } = useProva();

  const HeaderComponent = (() => {
    switch ((provaConfig as any).headerLayout) {
      case 1:
        return ProvaHeaderLayout1;
      case 2:
        return ProvaHeaderLayout2;
      case 3:
        return ProvaHeaderLayout3;
      case 4:
        return ProvaHeaderLayout4;
      case 5:
        return ProvaHeaderLayout5;
      case 6:
        return ProvaHeaderLayout6;
      case 7:
        return ProvaHeaderLayout7;
      case 8:
        return ProvaHeaderLayout8;
      case 9:
        return ProvaHeaderLayout9;
      case 10:
        return ProvaHeaderLayout10;
      case 0:
      default:
        return ProvaHeader; // original / default
    }
  })();

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

  const qKey = (it: any) => `q${typeof it === "number" ? it : it?.q ?? 0}`;
  const colTotal = (items: any[]) =>
    items.slice(0, -1).reduce((sum: number, it: any) =>
      sum + (spacers?.get(qKey(it)) ?? 0), 0);

  const safePages = (pages.length ? pages : [{ coluna1: [], coluna2: [] }] as any) as any[];
  

  return (
    <>
      {/* Camada invisível para medição (NÃO IMPRIMIR) */}
      <div className="measure-layer absolute -z-10 invisible pointer-events-none">
        {/* Template 1: com cabeçalho */}
        <div
          className="prova-page mx-auto bg-white"
          ref={refs.measureFirstPageRef}
        >
          <HeaderComponent
            logoUrl={logoUrl}
            onLogoClick={onLogoClick}
            logoPlaceholder={logoPlaceholder}
            isEditable={false}
            nome=""
            turma={provaConfig.turma}
            professor={provaConfig.professor}
            disciplina={provaConfig.disciplina}
            data={provaConfig.data}
            nota=""
            instituicao={provaConfig.instituicao}
          />
          <div
            className="questoes-container"
            ref={refs.measureFirstQuestoesRef}
          >
            <div className="coluna coluna-1" />
            {columns === 2 && <div className="coluna coluna-2" />}
          </div>
        </div>

        {/* Template 2: sem cabeçalho */}
        <div
          className="prova-page mx-auto bg-white"
          ref={refs.measureOtherPageRef}
        >
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

      {/* Renderização normal (tela): páginas virtuais */}
      <div >
        {safePages.map((p: any, pageIndex: number) => (
          <div
            key={pageIndex}
            className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0"
          >
            <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
              {pageIndex === 0 && (
                <HeaderComponent
                  logoUrl={logoUrl}
                  onLogoClick={onLogoClick}
                  isEditable={true}
                  nome=""
                  turma={provaConfig.turma}
                  professor={provaConfig.professor}
                  disciplina={provaConfig.disciplina}
                  data={provaConfig.data}
                  nota=""
                  instituicao={provaConfig.instituicao}
                  logoPlaceholder={logoPlaceholder}

                />
              )}

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

              <ProvaFooter
                disciplina={provaConfig.disciplina}
                currentPage={pageIndex + 1}
                totalPages={safePages.length}
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
      </div>

      {/* Impressão com quebra real: usa pages/itens (inclui frag) */}
    </>
  );
}
