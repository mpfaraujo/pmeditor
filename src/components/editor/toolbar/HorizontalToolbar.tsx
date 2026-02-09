"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HorizontalToolbarProps {
  onAction: (action: string) => void;
  optionsCount: number; // 2..5
}

export function HorizontalToolbar({ onAction, optionsCount }: HorizontalToolbarProps) {
  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

  return (
    <div className="border-b bg-gradient-to-r from-white via-slate-50 to-white p-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        
        {/* ===== SEÇÃO 1: ARQUIVO (Início) ===== */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-300 shadow-md hover:shadow-lg transition-shadow">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">📁 Arquivo</div>
          <Separator orientation="vertical" className="h-6" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 hover:bg-blue-50 hover:text-blue-600"
              >
                <Icons.FilePlus2 className="h-4 w-4 mr-1" />
                <span className="text-xs hidden sm:inline">Novo</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Arquivo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAction("new")}>
                <Icons.FilePlus2 className="h-4 w-4 mr-2" />
                <span>Novo</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("load")}>
                <Icons.FolderOpen className="h-4 w-4 mr-2" />
                <span>Abrir</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("save")}>
                <Icons.Save className="h-4 w-4 mr-2" />
                <span>Salvar</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("recover")}>
                <Icons.RotateCcw className="h-4 w-4 mr-2" />
                <span>Recuperar</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAction("metadata")}>
                <Icons.Info className="h-4 w-4 mr-2" />
                <span>Informações</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ===== SEÇÃO 2: ESTRUTURA DA QUESTÃO (O Coração) ===== */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-300 shadow-md hover:shadow-lg transition-shadow">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">⚙️ Estrutura</div>
          <Separator orientation="vertical" className="h-6" />
          
          {/* Texto Base */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-purple-50 hover:text-purple-600"
            onClick={() => onAction("basetext")}
            title="Adicionar texto base (enunciado compartilhado)"
          >
            <Icons.FileText className="h-4 w-4 mr-1" />
            <span className="text-xs hidden sm:inline">Texto-base</span>
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Tipo de Questão */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-50 hover:text-blue-600"
              onClick={() => onAction("set-type-multipla")}
              title="Múltipla Escolha (com opções)"
            >
              <Icons.ListOrdered className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Múltipla</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-50 hover:text-green-600"
              onClick={() => onAction("set-type-discursiva")}
              title="Discursiva (sem opções)"
            >
              <Icons.PenTool className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Discursiva</span>
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Largura da Questão */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("set-width-narrow")}
              title="Largura estreita (8.5cm)"
            >
              <Icons.Columns2 className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Estreita</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("set-width-wide")}
              title="Largura ampla (18cm)"
            >
              <Icons.Maximize2 className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Ampla</span>
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Opções (+ / -) */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100"
              onClick={() => onAction("dec-options")}
              disabled={!canDec}
              title="Remover opção (mínimo 2)"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-slate-600 px-2 min-w-[2rem] text-center">
              {clampedOptions}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100"
              onClick={() => onAction("inc-options")}
              disabled={!canInc}
              title="Adicionar opção (máximo 5)"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Conjuntos */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-orange-50 hover:text-orange-600"
              onClick={() => onAction("convert-to-setquestions")}
              title="Converter em conjunto (texto base + múltiplas perguntas)"
            >
              <Icons.Layers className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Conjunto</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-50 hover:text-green-600"
              onClick={() => onAction("add-question-item")}
              title="Adicionar pergunta ao conjunto"
            >
              <Icons.PlusSquare className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Pergunta</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-red-50 hover:text-red-600"
              onClick={() => onAction("remove-question-item")}
              title="Remover pergunta do conjunto"
            >
              <Icons.MinusSquare className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Remover</span>
            </Button>
          </div>
        </div>

        {/* ===== SEÇÃO 3: EDIÇÃO (Desfazer/Refazer) ===== */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-300 shadow-md hover:shadow-lg transition-shadow">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">↩️ Editar</div>
          <Separator orientation="vertical" className="h-6" />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-slate-100"
            onClick={() => onAction("undo")}
            title="Desfazer (Ctrl+Z)"
          >
            <Icons.Undo className="h-4 w-4 mr-1" />
            <span className="text-xs hidden sm:inline">Desfazer</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-slate-100"
            onClick={() => onAction("redo")}
            title="Refazer (Ctrl+Y)"
          >
            <Icons.Redo className="h-4 w-4 mr-1" />
            <span className="text-xs hidden sm:inline">Refazer</span>
          </Button>
        </div>

        {/* ===== SEÇÃO 4: CONTEÚDO (Formatação e Inserção) ===== */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-300 shadow-md hover:shadow-lg transition-shadow">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">✏️ Conteúdo</div>
          <Separator orientation="vertical" className="h-6" />

          {/* Formatação de Texto */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("mark:strong")}
              title="Negrito (Ctrl+B)"
            >
              <Icons.Bold className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("mark:em")}
              title="Itálico (Ctrl+I)"
            >
              <Icons.Italic className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("mark:underline")}
              title="Sublinhado (Ctrl+U)"
            >
              <Icons.Underline className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("mark:code")}
              title="Código"
            >
              <Icons.Code className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Inserção */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("image")}
              title="Inserir imagem"
            >
              <Icons.Image className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Imagem</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("math")}
              title="Inserir fórmula matemática"
            >
              <Icons.Sigma className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Fórmula</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("symbols")}
              title="Inserir símbolos especiais"
            >
              <Icons.Omega className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Símbolos</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("codeblock")}
              title="Inserir bloco de código"
            >
              <Icons.FileCode className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">Código</span>
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Alinhamento */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("align-left")}
              title="Alinhar à esquerda"
            >
              <Icons.AlignLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("align-center")}
              title="Centralizar"
            >
              <Icons.AlignCenter className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("align-right")}
              title="Alinhar à direita"
            >
              <Icons.AlignRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100"
              onClick={() => onAction("align-justify")}
              title="Justificar"
            >
              <Icons.AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Imagem: Tamanho */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100"
              onClick={() => onAction("img-w-dec")}
              title="Reduzir imagem (−1 cm)"
            >
              <Minus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-100"
              onClick={() => onAction("img-w-inc")}
              title="Aumentar imagem (+1 cm)"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
