"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SelectionBarProps = {
  count: number;
  includesOtherPages?: boolean;
  onClear: () => void;
  onBuild: () => void;
  onDiagramar?: () => void;
};

export function SelectionBar({
  count,
  includesOtherPages,
  onClear,
  onBuild,
  onDiagramar,
}: SelectionBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || count <= 0) return null;

  return (
    <div className="workspace-selectionbar print:hidden">
      <div className="workspace-selectionbar-inner">
        <div className="min-w-0 rounded-lg border border-[#E0B22A]/70 bg-[#FFF9E6] px-3 py-2">
          <div className="text-sm font-bold tabular-nums text-slate-950">
            {count} {count === 1 ? "questão selecionada" : "questões selecionadas"}
            {includesOtherPages && (
              <span className="font-normal text-slate-500"> · inclui outras páginas</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>
            Limpar seleção
          </Button>
          {onDiagramar && (
            <Button size="sm" variant="outline" onClick={onDiagramar}>
              Diagramar
            </Button>
          )}
          <Button size="sm" onClick={onBuild} className="bg-[#FBC02D] text-[#2D3436] hover:bg-[#FFD93D]">
            Montar Prova
          </Button>
        </div>
      </div>
    </div>
  );
}
