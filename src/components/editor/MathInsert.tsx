"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

import "katex/dist/katex.min.css";
import katex from "katex";
import "katex/contrib/mhchem";

import MathToolbar from "./MathToolbar";

interface MathInsertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latex: string) => void;
  initialLatex?: string;
  title?: string;
}

function buildMatrix(rows: number, cols: number) {
  const safeR = Math.max(1, Math.min(8, rows));
  const safeC = Math.max(1, Math.min(8, cols));

  const lines: string[] = [];
  for (let i = 1; i <= safeR; i++) {
    const cells: string[] = [];
    for (let j = 1; j <= safeC; j++) cells.push(`a_{${i}${j}}`);
    lines.push(cells.join(" & "));
  }
  return `\\begin{pmatrix}\n${lines.join(" \\\\\n")}\n\\end{pmatrix}`;
}

function buildCases(linesCount: number) {
  const n = Math.max(2, Math.min(5, linesCount));
  const lines: string[] = [];
  for (let i = 1; i <= n; i++)
    lines.push(`f_${i}(x) & \\text{se } \\text{condição }${i}`);
  return `f(x)=\\begin{cases}\n${lines.join(" \\\\\n")}\n\\end{cases}`;
}

export function MathInsert({
  open,
  onOpenChange,
  onInsert,
  initialLatex,
  title = "Fórmula",
}: MathInsertProps) {
  const [latex, setLatex] = useState<string>(initialLatex ?? "\\frac{a}{b}");
  const [err, setErr] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) {
      setErr("");
      return;
    }
    setErr("");
    setLatex((initialLatex ?? "\\frac{a}{b}").toString());
  }, [open, initialLatex]);

  const previewHtml = useMemo(() => {
    try {
      setErr("");
      return katex.renderToString(latex || "\\;", {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return "";
    }
  }, [latex]);

  const handleInsert = () => {
    const trimmed = latex.trim();
    if (!trimmed) {
      setErr("Digite uma expressão.");
      return;
    }
    onInsert(trimmed);
    onOpenChange(false);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[560px] p-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Use a paleta ou edite diretamente o LaTeX.
            </DialogDescription>
          </DialogHeader>

          {/* NOVA TOOLBAR */}
<MathToolbar
  value={latex}
  onChange={setLatex}
  textareaRef={textareaRef}
/>


          <div className="space-y-2 mt-2">
            <textarea
              ref={textareaRef}
              className="w-full h-[96px] rounded-md border px-2 py-1 text-xs"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="LaTeX..."
            />

            <div className="rounded-md border p-2 bg-white">
              <div className="text-[11px] text-muted-foreground mb-1">
                Preview
              </div>
              <div
                className="text-sm overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={() => {
                onOpenChange(false);
                setErr("");
              }}
            >
              Cancelar
            </Button>
            <Button className="h-7 px-3 text-xs" onClick={handleInsert}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
