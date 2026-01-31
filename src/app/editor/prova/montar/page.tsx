// src/app/editor/prova/montar/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useProva } from "@/contexts/ProvaContext";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Printer,
  ListOrdered,
  Settings,
  CheckSquare,
  Square,
} from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";
import { ReorderModal } from "@/components/prova/ReorderModal";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";
import { QuestionData, ColumnLayout } from "@/types/layout";
import Gabarito from "@/components/prova/Gabarito";
import "./prova.css";

const PAGE_HEIGHT = 1183;
const SAFETY_PX = 180;

type Alt = "A" | "B" | "C" | "D" | "E";

function parseAlt(x: unknown): Alt | null {
  const s = (x ?? "").toString().trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D" || s === "E") return s;
  return null;
}

function extractAltFromMetadata(meta: any): Alt | null {
  if (!meta) return null;

  const g = meta.gabarito;

  // NOVO: formato real (AnswerKey)
  if (g && typeof g === "object") {
    const kind = (g.kind ?? "").toString();
    if (kind === "mcq") return parseAlt(g.correct);
    if (kind === "tf") return parseAlt(g.correct); // "C" ou "E" (vai preencher só C/E)
    if (kind === "essay") return null;
  }

  // compat legado (se existir)
  const direct = parseAlt(g);
  if (direct) return direct;

  const nested = parseAlt(g?.letra ?? g?.answer ?? g?.value ?? g?.correct);
  if (nested) return nested;

  return null;
}

export default function MontarProvaPage() {
  const router = useRouter();
  const {
    selectedQuestions: initialQuestions,
    updateColumnLayout,
    provaConfig,
    updateProvaConfig,
  } = useProva();

  const [layout, setLayout] = useState<ColumnLayout>(() => {
    const mid = Math.ceil(initialQuestions.length / 2);
    return {
      coluna1: initialQuestions.slice(0, mid),
      coluna2: initialQuestions.slice(mid),
    };
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);

  if (initialQuestions.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Nenhuma questão selecionada</p>
        <Button onClick={() => router.push("/editor/questoes")}>
          Voltar para seleção
        </Button>
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

  const handleEditarConfiguracao = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  const orderedQuestions = useMemo(() => {
    return [...layout.coluna1, ...layout.coluna2];
  }, [layout]);

  const { pages, refs } = usePagination({
    config: {
      pageHeight: PAGE_HEIGHT,
      safetyMargin: SAFETY_PX,
    },
    questionCount: orderedQuestions.length,
    dependencies: [orderedQuestions, logoUrl],
  });

  const respostas = useMemo(() => {
    const out: Record<number, Alt> = {};
    orderedQuestions.forEach((q, idx) => {
      const alt = extractAltFromMetadata((q as any)?.metadata);
      if (alt) out[idx + 1] = alt;
    });
    return out;
  }, [orderedQuestions]);

  const totalQuestoes = orderedQuestions.length;

  const renderQuestion = (question: QuestionData | undefined, globalIndex: number) => {
    if (!question) return null;

    return (
      <div key={question.metadata.id} className="questao-item-wrapper">
        <div className="questao-item">
          <div className="questao-header-linha">
            <QuestionHeaderSvg
              numero={globalIndex + 1}
              totalMm={provaConfig.columns === 2 ? 85 : 180}
              boxMm={28}
            />
            <span
              contentEditable
              suppressContentEditableWarning
              className="pontos-editavel"
            />
          </div>

          <div
            className="
              questao-conteudo
              [&_p]:!m-0
              [&_p]:!p-0
              [&_img]:!my-0
            "
          >
            <QuestionRenderer content={question.content} />
          </div>
        </div>
      </div>
    );
  };

  const LayoutComponent =
    provaConfig.layoutType === "exercicio" ? ExerciseLayout : ProvaLayout;

  return (
    <>
      <PaginatedA4 className="SEU_WRAPPER_ATUAL_DO_A4">
        <div className="print:hidden fixed top-4 left-4 right-4 z-50 flex gap-2 justify-between bg-white p-4 border rounded-lg shadow-lg">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/editor/questoes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button variant="outline" onClick={handleEditarConfiguracao}>
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                updateProvaConfig({ showGabarito: !provaConfig.showGabarito })
              }
            >
              {provaConfig.showGabarito ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Gabarito
            </Button>

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

        <LayoutComponent
          pages={pages}
          orderedQuestions={orderedQuestions}
          logoUrl={logoUrl}
          onLogoClick={() => setLogoDialogOpen(true)}
          renderQuestion={renderQuestion}
          refs={refs}
          columns={provaConfig.columns}
        />

        {provaConfig.showGabarito && totalQuestoes > 0 && (
          <div className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
            <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
              <Gabarito totalQuestoes={totalQuestoes} respostas={respostas} />
            </div>
          </div>
        )}

        <ImageUpload
          open={logoDialogOpen}
          onOpenChange={setLogoDialogOpen}
          onImageInsert={(url) => {
            setLogoUrl(url);
            updateProvaConfig({ logoUrl: url });
          }}
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
