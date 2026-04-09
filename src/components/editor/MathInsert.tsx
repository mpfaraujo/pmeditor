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
  const [latex, setLatex] = useState<string>(initialLatex ?? "");
  const [err, setErr] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) {
      setErr("");
      return;
    }
    setErr("");
    setLatex((initialLatex ?? "").toString());
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
        <DialogContent className="max-w-[560px] border border-white/10 bg-[#0B1020] p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
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
              className="h-[96px] w-full rounded-md border border-white/10 bg-[#121A2E] px-2 py-1 text-xs text-white placeholder:text-slate-400"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="LaTeX..."
            />

            <div className="rounded-md border border-slate-200 bg-white p-2 text-slate-950">
              <div className="mb-1 text-[11px] text-slate-500">
                Preview
              </div>
              <div
                className="min-h-[128px] text-sm overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="outline"
              className="h-7 border-white/12 bg-white/5 px-3 text-xs text-white hover:bg-white/10 hover:text-white"
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
