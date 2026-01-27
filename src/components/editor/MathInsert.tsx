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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import "katex/dist/katex.min.css";
import katex from "katex";

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

  const [matRows, setMatRows] = useState<string>("2");
  const [matCols, setMatCols] = useState<string>("2");
  const [casesLines, setCasesLines] = useState<string>("3");

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

  const safeInt = (s: string, fallback: number) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const insertIntoTextarea = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setLatex((prev) => (prev ? `${prev} ${snippet}` : snippet));
      return;
    }

    const start = el.selectionStart ?? latex.length;
    const end = el.selectionEnd ?? latex.length;

    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleInsert = () => {
    const trimmed = latex.trim();
    if (!trimmed) {
      setErr("Digite uma expressão.");
      return;
    }
    onInsert(trimmed);
    onOpenChange(false);
  };

  const TinyIconButton = ({
    label,
    onClick,
    children,
  }: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-7 w-9 p-0 text-xs leading-none"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[520px] p-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Use os atalhos e ajuste no LaTeX.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 flex-wrap">
            <TinyIconButton
              label="Fração"
              onClick={() => insertIntoTextarea("\\frac{\\Box}{\\Box}")}
            >
              a/b
            </TinyIconButton>

            <TinyIconButton
              label="Raiz"
              onClick={() => insertIntoTextarea("\\sqrt{\\Box}")}
            >
              √
            </TinyIconButton>

            <TinyIconButton
              label="Combinação"
              onClick={() => insertIntoTextarea("\\binom{n}{k}")}
            >
              C
            </TinyIconButton>

            <TinyIconButton
              label="Potência"
              onClick={() => insertIntoTextarea("x^{\\Box}")}
            >
              x^
            </TinyIconButton>

            <TinyIconButton
              label="Parênteses"
              onClick={() => insertIntoTextarea("\\left(\\Box\\right)")}
            >
              ( )
            </TinyIconButton>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 w-9 p-0 text-xs leading-none"
                    >
                      ▦
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Matriz</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="start" className="p-2 w-[220px]">
                <DropdownMenuLabel className="text-xs p-0">
                  Matriz
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2" />
                <div className="flex items-center gap-1">
                  <Input
                    value={matRows}
                    onChange={(e) => setMatRows(e.target.value)}
                    placeholder="L"
                    inputMode="numeric"
                    className="h-7 w-12 px-2 text-xs"
                  />
                  <Input
                    value={matCols}
                    onChange={(e) => setMatCols(e.target.value)}
                    placeholder="C"
                    inputMode="numeric"
                    className="h-7 w-12 px-2 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      insertIntoTextarea(
                        buildMatrix(safeInt(matRows, 2), safeInt(matCols, 2))
                      )
                    }
                  >
                    Inserir
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  1–8
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 w-9 p-0 text-xs leading-none"
                    >
                      {"{ }"}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Função por partes
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="start" className="p-2 w-[220px]">
                <DropdownMenuLabel className="text-xs p-0">
                  Por partes
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2" />
                <div className="flex items-center gap-1">
                  <Input
                    value={casesLines}
                    onChange={(e) => setCasesLines(e.target.value)}
                    placeholder="n"
                    inputMode="numeric"
                    className="h-7 w-12 px-2 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      insertIntoTextarea(buildCases(safeInt(casesLines, 3)))
                    }
                  >
                    Inserir
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  2–5 linhas
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              className="w-full h-[92px] rounded-md border px-2 py-1 text-xs"
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
