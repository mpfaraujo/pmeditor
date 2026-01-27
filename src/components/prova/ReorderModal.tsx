"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from "lucide-react";

type QuestionData = {
  metadata: any;
  content: any;
};

type ColumnLayout = {
  coluna1: QuestionData[];
  coluna2: QuestionData[];
};

type ReorderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ColumnLayout;
  onReorder: (layout: ColumnLayout) => void;
};

export function ReorderModal({
  open,
  onOpenChange,
  layout,
  onReorder,
}: ReorderModalProps) {
  const [localLayout, setLocalLayout] = useState<ColumnLayout>(layout);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      setLocalLayout(layout);

      // Congela rótulos estáveis Q1, Q2, Q3... na ordem original ao abrir o modal
      const all = [...layout.coluna1, ...layout.coluna2];
      const map = new Map<string, string>();
      all.forEach((q, i) => {
        map.set(q.metadata.id, `Q${i + 1}`);
      });
      setLabelMap(map);
    }
  }, [open, layout]);

  const moveUp = (column: "coluna1" | "coluna2", index: number) => {
    if (index === 0) return;
    const newColumn = [...localLayout[column]];
    [newColumn[index - 1], newColumn[index]] = [
      newColumn[index],
      newColumn[index - 1],
    ];
    setLocalLayout({ ...localLayout, [column]: newColumn });
  };

  const moveDown = (column: "coluna1" | "coluna2", index: number) => {
    if (index === localLayout[column].length - 1) return;
    const newColumn = [...localLayout[column]];
    [newColumn[index], newColumn[index + 1]] = [
      newColumn[index + 1],
      newColumn[index],
    ];
    setLocalLayout({ ...localLayout, [column]: newColumn });
  };

  const moveToColumn2 = (index: number) => {
    const question = localLayout.coluna1[index];
    setLocalLayout({
      coluna1: localLayout.coluna1.filter((_, i) => i !== index),
      coluna2: [...localLayout.coluna2, question],
    });
  };

  const moveToColumn1 = (index: number) => {
    const question = localLayout.coluna2[index];
    setLocalLayout({
      coluna1: [...localLayout.coluna1, question],
      coluna2: localLayout.coluna2.filter((_, i) => i !== index),
    });
  };

  const removeFromSelection = (column: "coluna1" | "coluna2", index: number) => {
    setLocalLayout({
      coluna1:
        column === "coluna1"
          ? localLayout.coluna1.filter((_, i) => i !== index)
          : localLayout.coluna1,
      coluna2:
        column === "coluna2"
          ? localLayout.coluna2.filter((_, i) => i !== index)
          : localLayout.coluna2,
    });
  };

  const handleApply = () => {
    onReorder(localLayout);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalLayout(layout);
    onOpenChange(false);
  };

  const renderColumn = (
    column: "coluna1" | "coluna2",
    questions: QuestionData[],
    title: string
  ) => (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="font-bold text-sm mb-2 pb-2 border-b sticky top-0 bg-white z-10">
        {title} ({questions.length})
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {questions.length === 0 ? (
          <div className="text-xs text-gray-400 italic p-4 text-center">
            Nenhuma questão nesta coluna
          </div>
        ) : (
          questions.map((question, index) => {
            const posicaoGlobal =
              column === "coluna1"
                ? index + 1
                : localLayout.coluna1.length + index + 1;

            const label = labelMap.get(question.metadata.id) ?? "?";

            return (
              <div
                key={question.metadata.id}
                className="flex items-center gap-1 px-1 py-0.5 border rounded bg-white hover:bg-gray-50 text-[11px]"
              >
                <div className="flex gap-0.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveUp(column, index)}
                    disabled={index === 0}
                    title="Mover para cima"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveDown(column, index)}
                    disabled={index === questions.length - 1}
                    title="Mover para baixo"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="font-semibold leading-none">
                    Posição {posicaoGlobal}
                  </div>
                  <div className="text-[10px] text-gray-500 leading-none">
                    ({label})
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => removeFromSelection(column, index)}
                  title="Remover da seleção"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>

                <Button
                  variant="default"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 bg-blue-500 hover:bg-blue-600"
                  onClick={() =>
                    column === "coluna1"
                      ? moveToColumn2(index)
                      : moveToColumn1(index)
                  }
                  title={
                    column === "coluna1"
                      ? "Mover para Coluna 2"
                      : "Mover para Coluna 1"
                  }
                >
                  {column === "coluna1" ? (
                    <ArrowRight className="h-3 w-3" />
                  ) : (
                    <ArrowLeft className="h-3 w-3" />
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reordenar Questões por Coluna</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          {renderColumn("coluna1", localLayout.coluna1, "Coluna 1")}
          {renderColumn("coluna2", localLayout.coluna2, "Coluna 2")}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
