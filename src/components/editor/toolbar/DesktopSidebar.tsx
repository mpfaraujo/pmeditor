"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import { useEffect, useState } from "react";

interface DesktopSidebarProps {
  onAction: (action: string) => void;
  optionsCount: number; // 2..5
}

export function DesktopSidebar({ onAction, optionsCount }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("editor:sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("editor:sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

  return (
    <div
      className={`
        fixed right-0 top-0 h-screen bg-gradient-to-b from-slate-50 to-slate-100 border-l border-slate-300
        transition-all duration-300 ease-in-out z-10
        ${collapsed ? "w-16" : "w-72"}
      `}
    >
      {/* Header */}
      <div className="p-2 border-b border-slate-300 bg-white flex justify-between items-center shadow-sm">
        {!collapsed && (
          <div className="text-xs font-bold text-slate-700 uppercase tracking-widest px-2">
            Toolbar
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir" : "Recolher"}
          className="hover:bg-slate-100"
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-56px)] p-3 space-y-4">
        
        {/* ===== SEÇÃO 1: ARQUIVO ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              📁 Arquivo
            </div>
          )}

          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-blue-50 hover:text-blue-600`}
              onClick={() => onAction("new")}
              title={collapsed ? "Novo" : undefined}
            >
              <Icons.FilePlus2 className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Novo</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-blue-50 hover:text-blue-600`}
              onClick={() => onAction("load")}
              title={collapsed ? "Abrir" : undefined}
            >
              <Icons.FolderOpen className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Abrir</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-green-50 hover:text-green-600`}
              onClick={() => onAction("save")}
              title={collapsed ? "Salvar" : undefined}
            >
              <Icons.Save className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Salvar</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("recover")}
              title={collapsed ? "Recuperar" : undefined}
            >
              <Icons.RotateCcw className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Recuperar</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("metadata")}
              title={collapsed ? "Informações" : undefined}
            >
              <Icons.Info className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Informações</span>}
            </Button>
          </div>
        </div>

        {/* ===== SEÇÃO 2: ESTRUTURA DA QUESTÃO ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              ⚙️ Estrutura
            </div>
          )}

          <div className="space-y-2">
            {/* Texto Base */}
            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-purple-50 hover:text-purple-600`}
              onClick={() => onAction("basetext")}
              title={collapsed ? "Texto-base" : undefined}
            >
              <Icons.FileText className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Texto-base</span>}
            </Button>

            {/* Tipo */}
            <div className={`grid ${collapsed ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-blue-50 hover:text-blue-600`}
                onClick={() => onAction("set-type-multipla")}
                title={collapsed ? "Múltipla" : undefined}
              >
                <Icons.ListOrdered className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Múltipla</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-green-50 hover:text-green-600`}
                onClick={() => onAction("set-type-discursiva")}
                title={collapsed ? "Discursiva" : undefined}
              >
                <Icons.PenTool className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Discursiva</span>}
              </Button>
            </div>

            {/* Largura */}
            <div className={`grid ${collapsed ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("set-width-narrow")}
                title={collapsed ? "Estreita" : undefined}
              >
                <Icons.Columns2 className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Estreita</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("set-width-wide")}
                title={collapsed ? "Ampla" : undefined}
              >
                <Icons.Maximize2 className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Ampla</span>}
              </Button>
            </div>

            {/* Opções */}
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-1`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-slate-100"
                onClick={() => onAction("dec-options")}
                disabled={!canDec}
                aria-label="Remover opção"
                title="Remover opção"
              >
                <Minus className="h-4 w-4" />
              </Button>

              {!collapsed && (
                <div className="text-sm font-bold text-slate-700 px-2 min-w-[3rem] text-center">
                  {clampedOptions}
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-slate-100"
                onClick={() => onAction("inc-options")}
                disabled={!canInc}
                aria-label="Adicionar opção"
                title="Adicionar opção"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Conjuntos */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-orange-50 hover:text-orange-600`}
                onClick={() => onAction("convert-to-setquestions")}
                title={collapsed ? "Conjunto" : undefined}
              >
                <Icons.Layers className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Criar Conjunto</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-green-50 hover:text-green-600`}
                onClick={() => onAction("add-question-item")}
                title={collapsed ? "Adicionar pergunta" : undefined}
              >
                <Icons.PlusSquare className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Adicionar Pergunta</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-red-50 hover:text-red-600`}
                onClick={() => onAction("remove-question-item")}
                title={collapsed ? "Remover pergunta" : undefined}
              >
                <Icons.MinusSquare className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Remover Pergunta</span>}
              </Button>
            </div>
          </div>
        </div>

        {/* ===== SEÇÃO 3: EDIÇÃO ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              ↩️ Editar
            </div>
          )}

          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("undo")}
              title={collapsed ? "Desfazer" : undefined}
            >
              <Icons.Undo className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Desfazer (Ctrl+Z)</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("redo")}
              title={collapsed ? "Refazer" : undefined}
            >
              <Icons.Redo className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Refazer (Ctrl+Y)</span>}
            </Button>
          </div>
        </div>

        {/* ===== SEÇÃO 4: CONTEÚDO (Formatação) ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              ✏️ Formatação
            </div>
          )}

          <div className="space-y-2">
            {/* Texto */}
            <div className={`grid ${collapsed ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:strong")}
                title={collapsed ? "Negrito" : undefined}
              >
                <Icons.Bold className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Negrito</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:em")}
                title={collapsed ? "Itálico" : undefined}
              >
                <Icons.Italic className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Itálico</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:underline")}
                title={collapsed ? "Sublinhado" : undefined}
              >
                <Icons.Underline className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Sublinhado</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:code")}
                title={collapsed ? "Código" : undefined}
              >
                <Icons.Code className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Código</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:superscript")}
                title={collapsed ? "Sobrescrito" : undefined}
              >
                <Icons.Superscript className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Sobrescrito</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
                onClick={() => onAction("mark:subscript")}
                title={collapsed ? "Subscrito" : undefined}
              >
                <Icons.Subscript className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-sm">Subscrito</span>}
              </Button>
            </div>
          </div>
        </div>

        {/* ===== SEÇÃO 5: INSERÇÃO ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              ➕ Inserir
            </div>
          )}

          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("image")}
              title={collapsed ? "Imagem" : undefined}
            >
              <Icons.Image className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Imagem</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("math")}
              title={collapsed ? "Fórmula" : undefined}
            >
              <Icons.Sigma className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Fórmula</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("codeblock")}
              title={collapsed ? "Código" : undefined}
            >
              <Icons.FileCode className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Bloco de Código</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-full h-9 ${collapsed ? "justify-center px-0" : "justify-start"} hover:bg-slate-100`}
              onClick={() => onAction("symbols")}
              title={collapsed ? "Símbolos" : undefined}
            >
              <Icons.Omega className="h-4 w-4" />
              {!collapsed && <span className="ml-2 text-sm">Símbolos</span>}
            </Button>
          </div>
        </div>

        {/* ===== SEÇÃO 6: ALINHAMENTO E IMAGEM ===== */}
        <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-md">
          {!collapsed && (
            <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 px-1">
              📐 Layout
            </div>
          )}

          <div className="space-y-3">
            {/* Alinhamento */}
            {!collapsed && (
              <div>
                <div className="text-xs text-slate-600 font-semibold mb-2 px-1">Alinhamento</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start hover:bg-slate-100"
                    onClick={() => onAction("align-left")}
                    title="Esquerda"
                  >
                    <Icons.AlignLeft className="h-4 w-4" />
                    <span className="ml-2 text-sm">Esquerda</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start hover:bg-slate-100"
                    onClick={() => onAction("align-center")}
                    title="Centro"
                  >
                    <Icons.AlignCenter className="h-4 w-4" />
                    <span className="ml-2 text-sm">Centro</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start hover:bg-slate-100"
                    onClick={() => onAction("align-right")}
                    title="Direita"
                  >
                    <Icons.AlignRight className="h-4 w-4" />
                    <span className="ml-2 text-sm">Direita</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 justify-start hover:bg-slate-100"
                    onClick={() => onAction("align-justify")}
                    title="Justificar"
                  >
                    <Icons.AlignJustify className="h-4 w-4" />
                    <span className="ml-2 text-sm">Justificar</span>
                  </Button>
                </div>
              </div>
            )}

            {collapsed && (
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("align-left")}
                  title="Esquerda"
                >
                  <Icons.AlignLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("align-center")}
                  title="Centro"
                >
                  <Icons.AlignCenter className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("align-right")}
                  title="Direita"
                >
                  <Icons.AlignRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("align-justify")}
                  title="Justificar"
                >
                  <Icons.AlignJustify className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Imagem */}
            <div>
              {!collapsed && (
                <div className="text-xs text-slate-600 font-semibold mb-2 px-1">Tamanho de Imagem</div>
              )}
              <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("img-w-dec")}
                  aria-label="Diminuir imagem"
                  title="Reduzir (−1 cm)"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                {!collapsed && (
                  <div className="text-sm text-slate-600 px-2 font-semibold">Tamanho</div>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-slate-100"
                  onClick={() => onAction("img-w-inc")}
                  aria-label="Aumentar imagem"
                  title="Aumentar (+1 cm)"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
