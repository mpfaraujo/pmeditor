"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import * as Icons from "lucide-react";

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
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          
          {/* ARQUIVO */}
          <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-100"
              onClick={() => onAction("new")}
              title="Nova questão"
            >
              <Icons.FilePlus2 className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Novo</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-100"
              onClick={() => onAction("load")}
              title="Abrir questão"
            >
              <Icons.FolderOpen className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Abrir</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-100"
              onClick={() => onAction("save")}
              title="Salvar questão"
            >
              <Icons.Save className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Salvar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-blue-100"
              onClick={() => onAction("recover")}
              title="Recuperar questão"
            >
              <Icons.RotateCcw className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Recuperar</span>
            </Button>
          </div>

          {/* EDIÇÃO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("undo")}
              title="Desfazer"
            >
              <Icons.Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("redo")}
              title="Refazer"
            >
              <Icons.Redo className="h-4 w-4" />
            </Button>
          </div>

          {/* FORMATAÇÃO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:strong")}
              title="Negrito"
            >
              <Icons.Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:em")}
              title="Itálico"
            >
              <Icons.Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:underline")}
              title="Sublinhado"
            >
              <Icons.Underline className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:code")}
              title="Código"
            >
              <Icons.Code className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:superscript")}
              title="Sobrescrito"
            >
              <Icons.Superscript className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("mark:subscript")}
              title="Subscrito"
            >
              <Icons.Subscript className="h-4 w-4" />
            </Button>
          </div>

          {/* ALINHAMENTO */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("align-left")}
              title="Alinhar à esquerda"
            >
              <Icons.AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("align-center")}
              title="Centralizar"
            >
              <Icons.AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("align-right")}
              title="Alinhar à direita"
            >
              <Icons.AlignRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("align-justify")}
              title="Justificar"
            >
              <Icons.AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          {/* INSERIR */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-gray-100"
              onClick={() => onAction("image")}
              title="Inserir imagem"
            >
              <Icons.Image className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Imagem</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-gray-100"
              onClick={() => onAction("math")}
              title="Inserir fórmula"
            >
              <Icons.Sigma className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Fórmula</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-gray-100"
              onClick={() => onAction("symbols")}
              title="Símbolos"
            >
              <Icons.Omega className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Símbolos</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-gray-100"
              onClick={() => onAction("codeblock")}
              title="Bloco de código"
            >
              <Icons.FileCode className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Código</span>
            </Button>
          </div>

          {/* ESTRUTURA */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-100"
              onClick={() => onAction("basetext")}
              title="Texto-base"
            >
              <Icons.FileText className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Texto-base</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-100"
              onClick={() => onAction("set-type-multipla")}
              title="Múltipla Escolha"
            >
              <Icons.ListOrdered className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Múltipla</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-100"
              onClick={() => onAction("set-type-discursiva")}
              title="Discursiva"
            >
              <Icons.PenTool className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Discursiva</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-green-100"
              onClick={() => onAction("set-width-narrow")}
              title="Estreita (8.5cm)"
            >
              <Icons.Columns2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-green-100"
              onClick={() => onAction("set-width-wide")}
              title="Ampla (18cm)"
            >
              <Icons.Maximize2 className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 border-l border-gray-300 pl-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 hover:bg-green-100"
                onClick={() => onAction("dec-options")}
                disabled={!canDec}
                title="Remover opção"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold text-gray-600 px-1 min-w-[1.5rem] text-center">
                {clampedOptions}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 hover:bg-green-100"
                onClick={() => onAction("inc-options")}
                disabled={!canInc}
                title="Adicionar opção"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-green-100"
              onClick={() => onAction("convert-to-setquestions")}
              title="Conjunto"
            >
              <Icons.Layers className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Conjunto</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-green-100"
              onClick={() => onAction("add-question-item")}
              title="Adicionar pergunta"
            >
              <Icons.PlusSquare className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-green-100"
              onClick={() => onAction("remove-question-item")}
              title="Remover pergunta"
            >
              <Icons.MinusSquare className="h-4 w-4" />
            </Button>
          </div>

          {/* TAMANHO DE IMAGEM */}
          <div className="flex items-center gap-1 border-r border-gray-300 px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("img-w-dec")}
              title="Reduzir imagem"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 hover:bg-gray-100"
              onClick={() => onAction("img-w-inc")}
              title="Aumentar imagem"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* CONFIGURAÇÕES */}
          <div className="flex items-center gap-1 pl-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-gray-100"
              onClick={() => onAction("metadata")}
              title="Configurações"
            >
              <Icons.Settings className="h-4 w-4" />
              <span className="ml-1 text-xs font-medium hidden sm:inline">Config</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
