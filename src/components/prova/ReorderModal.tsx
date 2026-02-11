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
  Trash2,
  RotateCcw,
} from "lucide-react";

type QuestionData = {
  metadata: any;
  content: any;
};

type ReorderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionData[];
  onApply: (reordered: QuestionData[]) => void;
  onReset: () => void;
  isManualOrder: boolean;
};

export function ReorderModal({
  open,
  onOpenChange,
  questions,
  onApply,
  onReset,
  isManualOrder,
}: ReorderModalProps) {
  const [localList, setLocalList] = useState<QuestionData[]>(questions);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      setLocalList(questions);

      // Congela rótulos estáveis Q1, Q2, Q3... na ordem ao abrir o modal
      const map = new Map<string, string>();
      questions.forEach((q, i) => {
        const id = q?.metadata?.id ?? "";
        // Sets base mostram "Texto" em vez de número
        if ((q as any)?.__setBase) {
          map.set(id, "Texto base");
        } else {
          // Conta só questões que não são setBase pra numerar corretamente
          const nonBasesBefore = questions
            .slice(0, i)
            .filter((qq) => !(qq as any)?.__setBase).length;
          map.set(id, `Q${nonBasesBefore + 1}`);
        }
      });
      setLabelMap(map);
    }
  }, [open, questions]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...localList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setLocalList(newList);
  };

  const moveDown = (index: number) => {
    if (index === localList.length - 1) return;
    const newList = [...localList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setLocalList(newList);
  };

  const removeItem = (index: number) => {
    setLocalList(localList.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApply(localList);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalList(questions);
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reordenar Questões</DialogTitle>
          {isManualOrder && (
            <p className="text-xs text-amber-600 mt-1">
              Ordem manual ativa — o algoritmo de otimização está desativado.
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
          {localList.length === 0 ? (
            <div className="text-xs text-gray-400 italic p-4 text-center">
              Nenhuma questão na prova
            </div>
          ) : (
            localList.map((question, index) => {
              const id = question?.metadata?.id ?? "";
              const label = labelMap.get(id) ?? "?";
              const isSetBase = !!(question as any)?.__setBase;

              return (
                <div
                  key={`${id}-${index}`}
                  className={`flex items-center gap-1 px-2 py-1 border rounded text-[11px] ${
                    isSetBase
                      ? "bg-blue-50 hover:bg-blue-100 border-blue-200"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex gap-0.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveDown(index)}
                      disabled={index === localList.length - 1}
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="font-semibold leading-none">
                      {index + 1}.
                    </div>
                    <div className="text-[10px] text-gray-500 leading-none">
                      {label}
                    </div>
                    {isSetBase && (
                      <div className="text-[9px] text-blue-600 leading-none">
                        (conjunto)
                      </div>
                    )}
                  </div>

                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeItem(index)}
                    title="Remover da prova"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            title="Desfazer ordem manual e voltar ao algoritmo automático"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}