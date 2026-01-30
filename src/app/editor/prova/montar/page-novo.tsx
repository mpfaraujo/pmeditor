"use client";

import { useState, useMemo } from "react";
import { useProva } from "@/contexts/ProvaContext";
import { useRouter, useSearchParams } from "next/navigation";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, ListOrdered } from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";
import { ReorderModal } from "@/components/prova/ReorderModal";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";
import { LayoutType, ColumnCount, QuestionData, ColumnLayout } from "@/types/layout";
import "./prova.css";

const PAGE_HEIGHT = 1183;
const SAFETY_PX = 180;

export default function MontarProvaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedQuestions: initialQuestions, updateColumnLayout } = useProva();

  // Parâmetros de query: ?type=prova|exercicio&columns=1|2
  const layoutType: LayoutType = (searchParams.get("type") as LayoutType) || "prova";
  const columnCount: ColumnCount = (parseInt(searchParams.get("columns") || "2") as ColumnCount) || 2;

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

  // Seleciona o layout baseado no tipo
  const LayoutComponent = layoutType === "exercicio" ? ExerciseLayout : ProvaLayout;

  return (
    <>
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

        {/* Renderiza o layout escolhido */}
        <LayoutComponent
          pages={pages}
          orderedQuestions={orderedQuestions}
          logoUrl={logoUrl}
          onLogoClick={() => setLogoDialogOpen(true)}
          renderQuestion={renderQuestion}
          refs={refs}
          columns={columnCount}
        />

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
