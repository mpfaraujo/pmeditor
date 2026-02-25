"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus, ChevronDown } from "lucide-react";
import * as Icons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HorizontalToolbarProps {
  onAction: (action: string) => void;
  optionsCount: number;
}

export function HorizontalToolbar({ onAction, optionsCount }: HorizontalToolbarProps) {
  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

  return (
    <div className="w-full bg-gradient-to-b from-blue-50 to-white border-b-2 border-blue-200 shadow-sm">
      <div className="px-4 pt-2 pb-1 flex flex-col gap-1">

        {/* ── LINHA 1 ── */}
        <div className="flex items-center gap-1 flex-wrap">

          {/* 1. ARQUIVO */}
          <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("new")} title="Nova questão">
              <Icons.FilePlus2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("load")} title="Abrir questão">
              <Icons.FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("save")} title="Salvar questão">
              <Icons.Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-blue-100" onClick={() => onAction("metadata")} title="Informações da questão">
              <Icons.Info className="h-4 w-4" />
            </Button>
          </div>

          {/* 2. HISTÓRICO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("undo")} title="Desfazer (Ctrl+Z)">
              <Icons.Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("redo")} title="Refazer (Ctrl+Y)">
              <Icons.Redo className="h-4 w-4" />
            </Button>
          </div>

          {/* 3. FORMATAÇÃO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("mark:strong")} title="Negrito (Ctrl+B)">
              <Icons.Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("mark:em")} title="Itálico (Ctrl+I)">
              <Icons.Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("mark:underline")} title="Sublinhado (Ctrl+U)">
              <Icons.Underline className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("mark:superscript")} title="Sobrescrito">
              <Icons.Superscript className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("mark:subscript")} title="Subscrito">
              <Icons.Subscript className="h-4 w-4" />
            </Button>
          </div>

          {/* 4. ALINHAMENTO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("align-left")} title="Alinhar à esquerda">
              <Icons.AlignLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("align-center")} title="Centralizar">
              <Icons.AlignCenter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("align-right")} title="Alinhar à direita">
              <Icons.AlignRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("align-justify")} title="Justificar">
              <Icons.AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          {/* 5. INSERIR (dropdown) */}
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
                  <Icons.Sigma className="h-4 w-4 mr-2" /> Fórmula
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
                <DropdownMenuItem onClick={() => onAction("insert-poem")}>
                  <Icons.BookOpen className="h-4 w-4 mr-2" /> Poema
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction("insert-credits")}>
                  <Icons.Quote className="h-4 w-4 mr-2" /> Créditos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>


        </div>

        {/* ── LINHA 2 ── */}
        <div className="flex items-center gap-1 flex-wrap border-t border-gray-200 pt-1">

          {/* TIPO */}
          <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("set-type-multipla")} title="Múltipla Escolha">
              <Icons.CheckSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("set-type-discursiva")} title="Discursiva">
              <Icons.PenTool className="h-4 w-4" />
            </Button>
          </div>

          {/* OPÇÕES */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("dec-options")} disabled={!canDec} title="Remover alternativa">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-gray-600 min-w-[1.5rem] text-center">{clampedOptions}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("inc-options")} disabled={!canInc} title="Adicionar alternativa">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* CONJUNTO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-green-100" onClick={() => onAction("convert-to-setquestions")} title="Converter para conjunto">
              <Icons.Layers className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium">Conjunto</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("add-question-item")} title="Adicionar pergunta">
              <Icons.PlusSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-green-100" onClick={() => onAction("remove-question-item")} title="Remover pergunta">
              <Icons.MinusSquare className="h-4 w-4" />
            </Button>
          </div>

          {/* TAMANHO DE IMAGEM + NUMERAÇÃO */}
          <div className="flex items-center gap-1 px-2">
            <span className="text-xs text-gray-500">Img</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("img-w-dec")} title="Reduzir imagem (−1 cm)">
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("img-w-inc")} title="Aumentar imagem (+1 cm)">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-gray-100" onClick={() => onAction("toggle-numbered")} title="Numerar linhas">
              <Icons.Hash className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
