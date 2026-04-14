/**
 * Layout Acessível — modo TEA/TDAH
 * 1 coluna forçada, tipografia ampliada, espaçamento aumentado,
 * sem elementos decorativos, hierarquia visual clara.
 */

"use client";

import React from "react";
import { LayoutProps } from "@/types/layout";
import { AccessibleHeader } from "../headers/AccessibleHeader";
import { ProvaFooter } from "../ProvaFooter";
import { useProva } from "@/contexts/ProvaContext";
import type { QuestionPermutation } from "@/lib/GeraTiposDeProva";

interface AccessibleLayoutProps extends LayoutProps {
  logoPlaceholder?: string;
  tipoAtual?: number;
  numTipos?: number;
  permutations?: QuestionPermutation[] | null;
  spacers?: Map<string, number>;
  committedSpacers?: Map<string, number>;
  onSpacerChange?: (key: string, h: number) => void;
  onSpacerCommit?: (key: string, h: number) => void;
}

export function AccessibleLayout({
  pages,
  orderedQuestions,
  logoUrl,
  onLogoClick,
  renderQuestion,
  refs,
  tipoAtual,
  numTipos,
}: AccessibleLayoutProps) {
  const { provaConfig, updateProvaConfig } = useProva();

  const renderLayoutItem = (it: any) => {
    if (typeof it === "number") return renderQuestion(orderedQuestions[it], it);
    if (it?.kind === "full") return renderQuestion(orderedQuestions[it.q], it.q);
    if (it?.kind === "frag") {
      const rq = renderQuestion as unknown as (q: any, idx: number, frag: any) => React.ReactNode;
      return rq(orderedQuestions[it.q], it.q, it);
    }
    return null;
  };

  const headerProps = {
    logoUrl,
    onLogoClick,
    disciplina: provaConfig.disciplina,
    professor: provaConfig.professor,
    turma: provaConfig.turma,
    data: provaConfig.data,
  };

  return (
    <>
      {/* Camada de medição (invisível) */}
      <div className="measure-layer absolute -z-10 opacity-0 pointer-events-none" aria-hidden="true">
        {/* Template 1: com cabeçalho */}
        <div className="prova-page accessible-page mx-auto bg-white" ref={refs.measureFirstPageRef}>
          <AccessibleHeader {...headerProps} isEditable={false} />
          {provaConfig.titulo && (
            <div className="text-[11pt] font-bold text-center uppercase pt-0 pb-3">
              {provaConfig.titulo}
            </div>
          )}
          <div className="questoes-container" ref={refs.measureFirstQuestoesRef}>
            <div className="coluna coluna-1" />
          </div>
        </div>

        {/* Template 2: sem cabeçalho */}
        <div className="prova-page accessible-page mx-auto bg-white" ref={refs.measureOtherPageRef}>
          <div className="questoes-container" ref={refs.measureOtherQuestoesRef}>
            <div className="coluna coluna-1" />
          </div>
        </div>

        {/* Template 3: alturas das questões */}
        <div className="prova-page accessible-page mx-auto bg-white">
          <div className="questoes-container columns-1">
            <div className="coluna coluna-1" ref={refs.measureItemsRef}>
              {orderedQuestions.map((q, idx) => renderQuestion(q, idx))}
            </div>
          </div>
        </div>
      </div>

      {/* Renderização das páginas */}
      {(pages.length ? pages : [{ coluna1: [], coluna2: [], remainingHeight: 0 }] as any).map((p: any, pageIndex: number) => (
        <div key={pageIndex} className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
          <div className="prova-page accessible-page mx-auto bg-white shadow-lg print:shadow-none">
            {pageIndex === 0 && (
              <AccessibleHeader
                {...headerProps}
                isEditable={true}
                onFieldChange={(field, value) => updateProvaConfig({ [field]: value } as any)}
              />
            )}
            {pageIndex === 0 && provaConfig.titulo !== undefined && (
              <div
                className="text-[11pt] font-bold text-center uppercase pt-0 pb-3"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateProvaConfig({ titulo: e.currentTarget.textContent ?? "" })}
              >
                {provaConfig.titulo}
              </div>
            )}

            <div className={pageIndex === 0 ? "pt-4" : ""}>
              <div className="questoes-container">
                <div className="coluna coluna-1">
                  {(p.coluna1 ?? []).map((it: any, idx: number) => (
                    <React.Fragment key={idx}>
                      {renderLayoutItem(it)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <ProvaFooter
              layoutType="acessivel"
              disciplina={provaConfig.disciplina}
              currentPage={pageIndex + 1}
              totalPages={pages.length || 1}
              spacerHeight={Math.max(0, p.remainingHeight ?? 0)}
              tipoAtual={tipoAtual}
              numTipos={numTipos}
            />
          </div>
        </div>
      ))}
    </>
  );
}
