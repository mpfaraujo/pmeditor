"use client";

import { useState, useMemo } from "react";
import { useProva } from "@/contexts/ProvaContext";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ListOrdered } from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";
import { ReorderModal } from "@/components/prova/ReorderModal";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import "./prova.css";

type QuestionData = {
  metadata: any;
  content: any;
};

type ColumnLayout = {
  coluna1: QuestionData[];
  coluna2: QuestionData[];
};

const PAGE_HEIGHT = 1183;
const SAFETY_PX = 180;

export default function MontarProvaPage() {
  const router = useRouter();
  const { selectedQuestions: initialQuestions, updateColumnLayout } = useProva();

  const [layout, setLayout] = useState<ColumnLayout>(() => {
    const mid = Math.ceil(initialQuestions.length / 2);
    return {
      coluna1: initialQuestions.slice(0, mid),
      coluna2: initialQuestions.slice(mid),
    };
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);

  if (initialQuestions.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Nenhuma questão selecionada</p>
        <Button onClick={() => router.push("/editor/questoes")}>Voltar para seleção</Button>
      </div>
    );
  }

  const handleReorder = (newLayout: ColumnLayout) => {
    setLayout(newLayout);
    updateColumnLayout(newLayout);
  };

  const handlePrint = () => {
    window.print();
  };

  // Ordem linear atual (reordenação respeitada)
  const orderedQuestions = useMemo(() => {
    return [...layout.coluna1, ...layout.coluna2];
  }, [layout]);

  // Hook de paginação - extrai toda a lógica complexa
  const { pages, refs } = usePagination({
    config: {
      pageHeight: PAGE_HEIGHT,
      safetyMargin: SAFETY_PX,
    },
    questionCount: orderedQuestions.length,
    dependencies: [orderedQuestions, logoUrl],
  });

  const renderQuestion = (question: QuestionData | undefined, globalIndex: number) => {
    if (!question) return null;

    return (
      <div key={question.metadata.id} className="questao-item-wrapper">
        <div className="questao-item">
          <div className="questao-header-linha">
            <QuestionHeaderSvg numero={globalIndex + 1} totalMm={85} boxMm={28} />
            <span contentEditable suppressContentEditableWarning className="pontos-editavel"></span>
          </div>

          <div
            className="
              questao-conteudo
              [&_p]:!m-0
              [&_p]:!p-0
              [&_img]:!m-0
            "
          >
            <QuestionRenderer content={question.content} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Camada invisível para medição (NÃO IMPRIMIR) */}
      <div className="measure-layer absolute -z-10 invisible pointer-events-none">
        {/* Template 1: com cabeçalho */}
        <div className="prova-page mx-auto bg-white" ref={refs.measureFirstPageRef}>
          <div className="prova-header">
            <div className="header-grid">
              <div
                className={`logo-area flex items-center justify-center text-xs font-bold ${
                  logoUrl ? "" : "border-2 border-gray-800"
                }`}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo da instituição"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  "LOGO"
                )}
              </div>

              <div className="field-wrapper">
                <div className="field-label">Nome</div>
                <div className="field-content" />
              </div>

              <div className="field-wrapper">
                <div className="field-label">Turma</div>
                <div className="field-content" />
              </div>
            </div>

            <div className="header-grid-2">
              <div className="field-wrapper">
                <div className="field-label">Professor</div>
                <div className="field-content" />
              </div>

              <div className="field-wrapper">
                <div className="field-label">Disciplina</div>
                <div className="field-content" />
              </div>

              <div className="field-wrapper">
                <div className="field-label">Data</div>
                <div className="field-content" />
              </div>

              <div className="field-wrapper">
                <div className="field-label">Nota</div>
                <div className="field-content" />
              </div>
            </div>

            <div className="instituicao-footer">
              Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
            </div>
          </div>

          <div className="questoes-container" ref={refs.measureFirstQuestoesRef}>
            <div className="coluna coluna-1" />
            <div className="coluna coluna-2" />
          </div>
        </div>

        {/* Template 2: sem cabeçalho */}
        <div className="prova-page mx-auto bg-white" ref={refs.measureOtherPageRef}>
          <div className="questoes-container" ref={refs.measureOtherQuestoesRef}>
            <div className="coluna coluna-1" />
            <div className="coluna coluna-2" />
          </div>
        </div>

        {/* Template 3: alturas das questões */}
        <div className="prova-page mx-auto bg-white">
          <div className="questoes-container">
            <div className="coluna coluna-1" ref={refs.measureItemsRef}>
              {orderedQuestions.map((q, idx) => renderQuestion(q, idx))}
            </div>
          </div>
        </div>
      </div>

      <PaginatedA4 className="SEU_WRAPPER_ATUAL_DO_A4">
        {/* Barra de ações */}
        <div className="print:hidden fixed top-4 left-4 right-4 z-50 flex gap-2 justify-between bg-white p-4 border rounded-lg shadow-lg">
          <Button variant="outline" onClick={() => router.push("/editor/questoes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReorderModalOpen(true)}>
              <ListOrdered className="h-4 w-4 mr-2" />
              Reordenar
            </Button>

            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {(pages.length ? pages : [{ coluna1: [], coluna2: [] }]).map((p, pageIndex) => (
          <div key={pageIndex} className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
            <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
              {pageIndex === 0 && (
                <div className="prova-header">
                  <div className="header-grid">
                    <div
                      className={`logo-area flex items-center justify-center text-xs font-bold cursor-pointer print:cursor-default ${
                        logoUrl ? "" : "border-2 border-gray-800"
                      }`}
                      onClick={() => setLogoDialogOpen(true)}
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo da instituição"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        "LOGO"
                      )}
                    </div>

                    <div className="field-wrapper">
                      <div className="field-label">Nome</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>

                    <div className="field-wrapper">
                      <div className="field-label">Turma</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>
                  </div>

                  <div className="header-grid-2">
                    <div className="field-wrapper">
                      <div className="field-label">Professor</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>

                    <div className="field-wrapper">
                      <div className="field-label">Disciplina</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>

                    <div className="field-wrapper">
                      <div className="field-label">Data</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>

                    <div className="field-wrapper">
                      <div className="field-label">Nota</div>
                      <div contentEditable suppressContentEditableWarning className="field-content" />
                    </div>
                  </div>

                  <div contentEditable suppressContentEditableWarning className="instituicao-footer">
                    Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
                  </div>
                </div>
              )}

              <div className="questoes-container">
                <div className="coluna coluna-1">
                  {p.coluna1.map((idx) => renderQuestion(orderedQuestions[idx], idx))}
                </div>

                <div className="coluna coluna-2">
                  {p.coluna2.map((idx) => renderQuestion(orderedQuestions[idx], idx))}
                </div>
              </div>
            </div>
          </div>
        ))}

        <ImageUpload
          open={logoDialogOpen}
          onOpenChange={setLogoDialogOpen}
          onImageInsert={(url) => setLogoUrl(url)}
        />

        <ReorderModal
          open={reorderModalOpen}
          onOpenChange={setReorderModalOpen}
          layout={layout}
          onReorder={handleReorder}
        />
      </PaginatedA4>
    </>
  );
}
