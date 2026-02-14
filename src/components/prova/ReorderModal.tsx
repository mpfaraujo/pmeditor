"use client";

import { useState, useEffect, useMemo } from "react";
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

/** Um bloco visual: questão individual ou grupo de set (base + itens) */
type Block = {
  kind: "single";
  items: QuestionData[];
} | {
  kind: "set";
  parentId: string;
  items: QuestionData[]; // [base, item1, item2, ...]
};

/** Agrupa expandedQuestions em blocos (singles e sets) */
function buildBlocks(questions: QuestionData[]): Block[] {
  const blocks: Block[] = [];
  let currentSet: { parentId: string; items: QuestionData[] } | null = null;

  for (const q of questions) {
    const baseInfo = (q as any)?.__setBase;
    const setInfo = (q as any)?.__set;

    if (baseInfo?.parentId) {
      // Início de um set — fecha o anterior se houver
      if (currentSet) {
        blocks.push({ kind: "set", parentId: currentSet.parentId, items: currentSet.items });
      }
      currentSet = { parentId: baseInfo.parentId, items: [q] };
    } else if (setInfo?.parentId && currentSet && setInfo.parentId === currentSet.parentId) {
      // Item do set atual
      currentSet.items.push(q);
    } else {
      // Questão livre — fecha set anterior se houver
      if (currentSet) {
        blocks.push({ kind: "set", parentId: currentSet.parentId, items: currentSet.items });
        currentSet = null;
      }
      blocks.push({ kind: "single", items: [q] });
    }
  }

  // Fecha último set
  if (currentSet) {
    blocks.push({ kind: "set", parentId: currentSet.parentId, items: currentSet.items });
  }

  return blocks;
}

/** Expande blocos de volta pra lista plana */
function flattenBlocks(blocks: Block[]): QuestionData[] {
  return blocks.flatMap((b) => b.items);
}

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
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      setBlocks(buildBlocks(questions));

      // Congela rótulos estáveis Q1, Q2... na ordem ao abrir
      const map = new Map<string, string>();
      let counter = 0;
      questions.forEach((q) => {
        const id = q?.metadata?.id ?? "";
        if ((q as any)?.__setBase) {
          map.set(id, "Texto base");
        } else {
          counter++;
          map.set(id, `Q${counter}`);
        }
      });
      setLabelMap(map);
    }
  }, [open, questions]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...blocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setBlocks(newBlocks);
  };

  const moveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onApply(flattenBlocks(blocks));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setBlocks(buildBlocks(questions));
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  // Numeração visual dos blocos
  const blockNumbers = useMemo(() => {
    let counter = 0;
    return blocks.map((b) => {
      if (b.kind === "single") {
        counter++;
        return counter;
      }
      // Set: conta os itens (sem o base)
      const itemCount = b.items.filter((q) => !(q as any)?.__setBase).length;
      const start = counter + 1;
      counter += itemCount;
      return start;
    });
  }, [blocks]);

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
          {blocks.length === 0 ? (
            <div className="text-xs text-gray-400 italic p-4 text-center">
              Nenhuma questão na prova
            </div>
          ) : (
            blocks.map((block, index) => {
              const num = blockNumbers[index];

              if (block.kind === "single") {
                const q = block.items[0];
                const id = q?.metadata?.id ?? "";
                const label = labelMap.get(id) ?? "?";

                return (
                  <div
                    key={`${id}-${index}`}
                    className="flex items-center gap-1 px-2 py-1 border rounded text-[11px] bg-white hover:bg-gray-50"
                  >
                    <div className="flex gap-0.5">
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => moveUp(index)} disabled={index === 0} title="Mover para cima">
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => moveDown(index)} disabled={index === blocks.length - 1} title="Mover para baixo">
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="font-semibold leading-none">{num}.</div>
                      <div className="text-[10px] text-gray-500 leading-none">{label}</div>
                    </div>

                    <Button variant="destructive" size="icon" className="h-5 w-5" onClick={() => removeBlock(index)} title="Remover da prova">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              }

              // Set: bloco agrupado
              const itemCount = block.items.filter((q) => !(q as any)?.__setBase).length;
              const endNum = num + itemCount - 1;
              const rangeLabel = itemCount > 1 ? `${num}–${endNum}` : `${num}`;

              return (
                <div
                  key={`set-${block.parentId}-${index}`}
                  className="border rounded bg-gray-100 border-gray-300"
                >
                  {/* Cabeçalho do grupo */}
                  <div className="flex items-center gap-1 px-2 py-1 text-[11px]">
                    <div className="flex gap-0.5">
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => moveUp(index)} disabled={index === 0} title="Mover grupo para cima">
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => moveDown(index)} disabled={index === blocks.length - 1} title="Mover grupo para baixo">
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="font-semibold leading-none">{rangeLabel}.</div>
                      <div className="text-[10px] text-gray-500 leading-none">
                        Conjunto ({itemCount} {itemCount === 1 ? "questão" : "questões"} + texto base)
                      </div>
                    </div>

                    <Button variant="destructive" size="icon" className="h-5 w-5" onClick={() => removeBlock(index)} title="Remover conjunto da prova">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Itens dentro do grupo */}
                  <div className="px-3 pb-1.5 space-y-0.5">
                    {block.items.map((q, i) => {
                      const id = q?.metadata?.id ?? "";
                      const label = labelMap.get(id) ?? "?";
                      const isBase = !!(q as any)?.__setBase;

                      return (
                        <div
                          key={`${id}-${i}`}
                          className="text-[10px] text-gray-600 pl-1 leading-tight"
                        >
                          {isBase ? (
                            <span className="italic">Texto base</span>
                          ) : (
                            <span>{label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
