"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import QuestaoHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import { ProvaHeader } from "@/components/prova/headers/ProvaHeader";
import { ProvaHeaderLayout1 } from "@/components/prova/headers/ProvaHeaderLayout1";
import { ProvaHeaderLayout2 } from "@/components/prova/headers/ProvaHeaderLayout2";
import { ProvaHeaderLayout3 } from "@/components/prova/headers/ProvaHeaderLayout3";
import { ProvaHeaderLayout4 } from "@/components/prova/headers/ProvaHeaderLayout4";
import { ProvaHeaderLayout5 } from "@/components/prova/headers/ProvaHeaderLayout5";
import { ProvaHeaderLayout6 } from "@/components/prova/headers/ProvaHeaderLayout6";
import { ProvaHeaderLayout7 } from "@/components/prova/headers/ProvaHeaderLayout7";
import { ProvaHeaderLayout8 } from "@/components/prova/headers/ProvaHeaderLayout8";
import { ProvaHeaderLayout9 } from "@/components/prova/headers/ProvaHeaderLayout9";
import { ProvaHeaderLayout10 } from "@/components/prova/headers/ProvaHeaderLayout10";

interface HeaderPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHeaderLayout: number;
  onHeaderSelect: (layout: number) => void;
  selectedDecorator: number;
  onDecoratorSelect: (decorator: number) => void;
  logoUrl: string | null;
  professor: string;
  instituicao: string;
}

const HEADER_COMPONENTS: Record<number, React.ComponentType<any>> = {
  0: ProvaHeader,
  1: ProvaHeaderLayout1,
  2: ProvaHeaderLayout2,
  3: ProvaHeaderLayout3,
  4: ProvaHeaderLayout4,
  5: ProvaHeaderLayout5,
  6: ProvaHeaderLayout6,
  7: ProvaHeaderLayout7,
  8: ProvaHeaderLayout8,
  9: ProvaHeaderLayout9,
  10: ProvaHeaderLayout10,
};

export function HeaderPreviewModal({
  open,
  onOpenChange,
  selectedHeaderLayout,
  onHeaderSelect,
  selectedDecorator,
  onDecoratorSelect,
  logoUrl,
  professor,
  instituicao,
}: HeaderPreviewModalProps) {
  const HeaderComponent = HEADER_COMPONENTS[selectedHeaderLayout] || ProvaHeader;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Visualizar Cabeçalho e Decoradores</DialogTitle>
          <DialogDescription>
            Escolha o modelo de cabeçalho e o estilo de decorador que melhor se adequa à sua prova
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="headers" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="headers">Cabeçalhos</TabsTrigger>
            <TabsTrigger value="decorators">Decoradores de Questão</TabsTrigger>
          </TabsList>

          {/* TAB: CABEÇALHOS */}
          <TabsContent value="headers" className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div className="space-y-6 pr-4">
                {Array.from({ length: 11 }, (_, i) => {
                  const HeaderComp = HEADER_COMPONENTS[i] || ProvaHeader;
                  const isSelected = i === selectedHeaderLayout;

                  return (
                    <div
                      key={i}
                      onClick={() => onHeaderSelect(i)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="mb-3">
                        <h3 className="font-semibold text-sm">
                          {i === 0 ? "Cabeçalho Original" : `Cabeçalho Layout ${i}`}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {isSelected && "✓ Selecionado"}
                        </p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded p-2 overflow-x-auto">
                        <div style={{ minWidth: "500px" }}>
                          <HeaderComp
                            logoUrl={logoUrl}
                            onLogoClick={() => {}}
                            isEditable={false}
                            nome="Aluno Exemplo"
                            turma="1º Ano"
                            professor={professor || "Prof. Exemplo"}
                            disciplina="Matemática"
                            data="2026-02-09"
                            nota="10"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB: DECORADORES */}
          <TabsContent value="decorators" className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div className="space-y-6 pr-4">
                {Array.from({ length: 5 }, (_, i) => {
                  const isSelected = i === selectedDecorator;
                  const decoratorNames = [
                    "Classic (Caixa com fundo cinza)",
                    "Bracket (Colchete moderno)",
                    "Badge (Círculo compacto)",
                    "Minimal (Apenas número)",
                    "Corner (Canto com linha pontilhada)",
                  ];

                  return (
                    <div
                      key={i}
                      onClick={() => onDecoratorSelect(i)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="mb-4">
                        <h3 className="font-semibold text-sm">
                          Decorador {i}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {decoratorNames[i]}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {isSelected && "✓ Selecionado"}
                        </p>
                      </div>

                      <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                        {/* Exemplo com 1 coluna */}
                        <div>
                          <p className="text-xs text-slate-500 mb-2">
                            Exemplo (1 coluna):
                          </p>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <QuestaoHeaderSvg
                                numero={1}
                                totalMm={180}
                                boxMm={28}
                                variant={i as 0 | 1 | 2 | 3 | 4}
                              />
                            </div>
                            <div className="text-xs text-slate-600 flex-1">
                              Texto da questão começa aqui...
                            </div>
                          </div>
                        </div>

                        {/* Exemplo com 2 colunas */}
                        <div>
                          <p className="text-xs text-slate-500 mb-2">
                            Exemplo (2 colunas):
                          </p>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <QuestaoHeaderSvg
                                numero={5}
                                totalMm={85}
                                boxMm={28}
                                variant={i as 0 | 1 | 2 | 3 | 4}
                              />
                            </div>
                            <div className="text-xs text-slate-600 flex-1">
                              Texto da questão em coluna...
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
