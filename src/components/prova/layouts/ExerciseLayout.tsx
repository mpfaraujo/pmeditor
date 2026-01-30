/**
 * Layout de Lista de Exercício
 * Renderiza lista com cabeçalho simples (ExerciseHeader)
 * Suporta 1 ou 2 colunas
 */

import { LayoutProps, ColumnCount } from "@/types/layout";
import { ExerciseHeader } from "../headers/ExerciseHeader";

interface ExerciseLayoutProps extends LayoutProps {
  columns: ColumnCount;
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
  return (
    <>
      {/* Camada invisível para medição (NÃO IMPRIMIR) */}
      <div className="measure-layer absolute -z-10 invisible pointer-events-none">
        {/* Template 1: com cabeçalho */}
        <div className="prova-page mx-auto bg-white" ref={refs.measureFirstPageRef}>
          <ExerciseHeader logoUrl={logoUrl} onLogoClick={onLogoClick} isEditable={false} />
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
          </div>
        </div>
      </div>

      {/* Renderização das páginas */}
      {(pages.length ? pages : [{ coluna1: [], coluna2: [] }]).map((p, pageIndex) => (
        <div key={pageIndex} className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
          <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
            {pageIndex === 0 && (
              <ExerciseHeader logoUrl={logoUrl} onLogoClick={onLogoClick} isEditable={true} />
            )}

            <div className="questoes-container">
              <div className="coluna coluna-1">
                {p.coluna1.map((idx) => renderQuestion(orderedQuestions[idx], idx))}
              </div>

              {columns === 2 && (
                <div className="coluna coluna-2">
                  {p.coluna2.map((idx) => renderQuestion(orderedQuestions[idx], idx))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
