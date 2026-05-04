"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus, ChevronDown } from "lucide-react";
import * as Icons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HorizontalToolbarProps {
  onAction: (action: string) => void;
  optionsCount: number;
  isSetQuestions?: boolean;
  itemCount?: number;
  isInPoem?: boolean;
  isInBaseText?: boolean;
  isInTitle?: boolean;
  isNumbered?: boolean;
  activeMarks?: {
    strong?: boolean;
    em?: boolean;
    underline?: boolean;
    superscript?: boolean;
    subscript?: boolean;
  };
  textAlign?: "left" | "center" | "right" | "justify" | null;
}

export function HorizontalToolbar({
  onAction,
  optionsCount,
  isSetQuestions = false,
  itemCount = 0,
  isInPoem = false,
  isInBaseText = false,
  isInTitle = false,
  isNumbered = false,
  activeMarks,
  textAlign = null,
}: HorizontalToolbarProps) {
  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

  // Ícone do Alinhar muda conforme o estado atual — feedback visual sem abrir o dropdown
  const AlignIcon = textAlign === "center" ? Icons.AlignCenter
    : textAlign === "right" ? Icons.AlignRight
    : textAlign === "justify" ? Icons.AlignJustify
    : Icons.AlignLeft;

  return (
    <div className="w-full bg-gradient-to-b from-blue-50 to-white border-b-2 border-blue-200 shadow-sm">
      <div className="px-3 pt-1 pb-0.5 flex items-center gap-1 flex-wrap">

        {/* ── HISTÓRICO ── */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("undo")} title="Desfazer (Ctrl+Z)">
            <Icons.Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("redo")} title="Refazer (Ctrl+Y)">
            <Icons.Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* ── EDIÇÃO ── B I U Sup Sub | Alinhar ▼ | Listas ▼ | Título Poema */}
        <div className="flex items-center gap-1 border-r border-gray-300 px-2">
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${activeMarks?.strong ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("mark:strong")} title="Negrito (Ctrl+B)">
            <Icons.Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${activeMarks?.em ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("mark:em")} title="Itálico (Ctrl+I)">
            <Icons.Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${activeMarks?.underline ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("mark:underline")} title="Sublinhado (Ctrl+U)">
            <Icons.Underline className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${activeMarks?.superscript ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("mark:superscript")} title="Sobrescrito (Ctrl+.)">
            <Icons.Superscript className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${activeMarks?.subscript ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("mark:subscript")} title="Subscrito (Ctrl+,)">
            <Icons.Subscript className="h-4 w-4" />
          </Button>

          {/* Alinhar ▼ — ícone reflete alinhamento atual */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-gray-100" title="Alinhamento">
                <AlignIcon className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onAction("align-left")} className={(!textAlign || textAlign === "left") ? "bg-blue-50" : ""}>
                <Icons.AlignLeft className="h-4 w-4 mr-2" /> Esquerda
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("align-center")} className={textAlign === "center" ? "bg-blue-50" : ""}>
                <Icons.AlignCenter className="h-4 w-4 mr-2" /> Centro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("align-right")} className={textAlign === "right" ? "bg-blue-50" : ""}>
                <Icons.AlignRight className="h-4 w-4 mr-2" /> Direita
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("align-justify")} className={textAlign === "justify" ? "bg-blue-50" : ""}>
                <Icons.AlignJustify className="h-4 w-4 mr-2" /> Justificado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Listas ▼ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-gray-100" title="Listas">
                <Icons.List className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onAction("insert-bullet-list")}>
                <Icons.List className="h-4 w-4 mr-2" /> Lista  •
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-ordered-list")}>
                <Icons.ListOrdered className="h-4 w-4 mr-2" /> Ordenada  1, 2, 3…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-roman-list")}>
                <Icons.ListOrdered className="h-4 w-4 mr-2" /> Romana  I, II, III…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-alpha-list")}>
                <Icons.ListOrdered className="h-4 w-4 mr-2" /> Alfabética  a, b, c…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-assertive-list")}>
                <Icons.SquareCheck className="h-4 w-4 mr-2" /> VF  ( )
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Título */}
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${isInTitle ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("toggle-title")} title={isInTitle ? "Remover título" : "Formatar como título"}>
            <Icons.Heading2 className="h-4 w-4" />
          </Button>
          {/* Poema */}
          <Button variant="ghost" size="sm" className={`h-8 w-8 ${isInPoem ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100"}`} onClick={() => onAction("insert-poem")} title={isInPoem ? "Sair do modo poema" : "Formatar como poema"}>
            <Icons.BookOpen className="h-4 w-4" />
          </Button>
        </div>

        {/* ── INSERIR ── dropdown + Img resize + Preview */}
        <div className="flex items-center gap-1 border-r border-gray-300 px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-gray-100">
                <Icons.PlusCircle className="h-4 w-4" />
                <span className="ml-1 text-xs font-medium">Inserir</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onAction("image")}>
                <Icons.Image className="h-4 w-4 mr-2" /> Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("math")}>
                <Icons.Sigma className="h-4 w-4 mr-2" /> Fórmula <span className="ml-auto text-xs text-muted-foreground pl-4">Ctrl+K</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("symbols")}>
                <Icons.Omega className="h-4 w-4 mr-2" /> Símbolos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("codeblock")}>
                <Icons.FileCode className="h-4 w-4 mr-2" /> Bloco de Código
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("basetext")}>
                <Icons.FileText className="h-4 w-4 mr-2" /> Texto-base
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-credits")}>
                <Icons.Quote className="h-4 w-4 mr-2" /> Créditos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("insert-databox")}>
                <Icons.BoxSelect className="h-4 w-4 mr-2" /> Dados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-xs text-gray-500">Img</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("img-w-dec")} title="Reduzir imagem (−1 cm)">
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("img-w-inc")} title="Aumentar imagem (+1 cm)">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* ── ESTRUTURA ── dropdown + contador de alternativas inline */}
        <div className="flex items-center gap-1 border-r border-gray-300 px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-green-100">
                <Icons.Layers className="h-4 w-4" />
                <span className="ml-1 text-xs font-medium">Estrutura</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {/* Tipo */}
              <DropdownMenuItem onClick={() => onAction("set-type-multipla")}>
                <Icons.CheckSquare className="h-4 w-4 mr-2" /> Múltipla Escolha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("set-type-discursiva")}>
                <Icons.PenTool className="h-4 w-4 mr-2" /> Discursiva
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Conjunto */}
              {!isSetQuestions && (
                <DropdownMenuItem onClick={() => onAction("convert-to-setquestions")}>
                  <Icons.Layers className="h-4 w-4 mr-2" /> Converter para conjunto
                </DropdownMenuItem>
              )}
              {isSetQuestions && (
                <>
                  <DropdownMenuItem onClick={() => onAction("add-question-item")}>
                    <Icons.PlusSquare className="h-4 w-4 mr-2" /> Adicionar item
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("remove-question-item")} disabled={itemCount <= 1}>
                    <Icons.MinusSquare className="h-4 w-4 mr-2" /> Remover item
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {/* Ref. de linha */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icons.MapPin className="h-4 w-4 mr-2" /> Ref. de linha
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onAction("mark-anchor")}>
                    <Icons.Tag className="h-4 w-4 mr-2" /> Marcar expressão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("remove-anchor")}>
                    <Icons.X className="h-4 w-4 mr-2" /> Remover marcador
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("insert-line-ref")}>
                    <Icons.Hash className="h-4 w-4 mr-2" /> Inserir (linha N)
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              {/* Numerar linhas */}
              <DropdownMenuItem onClick={() => onAction("toggle-numbered")} className={isNumbered ? "bg-blue-50 text-blue-700" : ""}>
                <Icons.Hash className="h-4 w-4 mr-2" /> Numerar linhas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Contador de alternativas inline */}
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("dec-options")} disabled={!canDec} title="Remover alternativa">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-gray-600 min-w-[1.5rem] text-center">{clampedOptions}</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("inc-options")} disabled={!canInc} title="Adicionar alternativa">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* ── DOCUMENTO ── New Load ⓘ Preview Salvar */}
        <div className="flex items-center gap-1 pl-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("new")} title="Nova questão">
            <Icons.FilePlus2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("load")} title="Abrir questão">
            <Icons.FolderOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("metadata")} title="Informações da questão">
            <Icons.Info className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-violet-100 text-violet-700 border border-violet-200" onClick={() => onAction("preview")} title="Visualizar renderização">
            <Icons.Eye className="h-4 w-4 mr-1" />
            <span className="text-xs font-medium">Preview</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("save")} title="Salvar questão">
            <Icons.Save className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}
