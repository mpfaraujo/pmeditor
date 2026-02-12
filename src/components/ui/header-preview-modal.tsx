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

const PROVA_STYLES = `
  .prova-header { margin-bottom: 0.8cm; }
  .header-grid { display: grid; grid-template-columns: 2cm 1fr 3cm; gap: 0.15cm; margin-bottom: 0.1cm; align-items: stretch; }
  .header-grid-2 { display: grid; grid-template-columns: 1fr 1fr 2cm 2cm; gap: 0.15cm; margin-bottom: 0.1cm; align-items: stretch; }
  .field-content { height: 26px; }
  .field-text { display: block; min-height: 1em; line-height: 1.1; }
  .logo-area { grid-row: 1 / 3; height: 100%; border-radius: 5px; }
  .field-wrapper { position: relative; padding-top: 8px; }
  .field-label { position: absolute; top: 0; left: 6px; font-size: 7pt; font-weight: normal; background: white; padding: 0 3px; z-index: 1; }
  .field-content { border: 1px solid #000; border-radius: 5px; padding: 4px 6px; min-height: 22px; outline: none; width: 100%; box-sizing: border-box; }
  .instituicao-footer { background: #666; color: white; text-align: center; padding: 5px; font-weight: bold; margin-top: 0.1cm; border-radius: 5px; }
`;

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
    <>
      <style>{PROVA_STYLES}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Configuração Visual da Prova</DialogTitle>
            <DialogDescription>
              Selecione o modelo de cabeçalho e o estilo dos decoradores de questão.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="headers" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="headers">Modelos de Cabeçalho</TabsTrigger>
              <TabsTrigger value="decorators">Estilos de Questão</TabsTrigger>
            </TabsList>

            {/* TAB: CABEÇALHOS */}
            <TabsContent value="headers" className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex flex-wrap gap-2 justify-center p-2 bg-slate-50 rounded-lg border">
                {Array.from({ length: 11 }, (_, i) => (
                  <Button
                    key={i}
                    variant={selectedHeaderLayout === i ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 font-bold"
                    onClick={() => onHeaderSelect(i)}
                  >
                    {i}
                  </Button>
                ))}
              </div>

              <div className="flex-1 border rounded-xl bg-slate-100 p-8 overflow-auto flex items-center justify-center">
                <div className="bg-white shadow-2xl p-8 w-full max-w-[21cm] min-h-[5cm]" style={{ fontSize: "10pt", fontFamily: "Calibri, Arial, sans-serif" }}>
                  <div className="mb-4 text-center text-xs font-bold text-blue-600 uppercase tracking-widest border-b pb-2">
                    Preview do Cabeçalho {selectedHeaderLayout}
                  </div>
                  <HeaderComponent
                    logoUrl={logoUrl}
                    onLogoClick={() => {}}
                    isEditable={false}
                    nome="Nome do Aluno"
                    turma="Turma Exemplo"
                    professor={professor || "Nome do Professor"}
                    disciplina="Disciplina Exemplo"
                    data="2026-02-09"
                    nota="10,0"
                    instituicao={instituicao || "Instituição Exemplo"}
                  />
                  <div className="mt-4 text-center text-[8pt] text-slate-400 italic">
                    * A instituição exibida acima é a que você configurou no filtro.
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: DECORADORES */}
            <TabsContent value="decorators" className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex flex-wrap gap-2 justify-center p-2 bg-slate-50 rounded-lg border">
                {Array.from({ length: 5 }, (_, i) => (
                  <Button
                    key={i}
                    variant={selectedDecorator === i ? "default" : "outline"}
                    size="sm"
                    className="px-4 h-10 font-bold"
                    onClick={() => onDecoratorSelect(i)}
                  >
                    Estilo {i}
                  </Button>
                ))}
              </div>

              <div className="flex-1 border rounded-xl bg-slate-100 p-8 overflow-auto flex flex-col items-center gap-6">
                <div className="bg-white shadow-lg p-8 w-full max-w-[18cm] rounded-lg">
                  <h4 className="text-sm font-bold mb-6 text-slate-500 border-b pb-2">Exemplo em 1 Coluna</h4>
                  <div className="flex items-start gap-4">
                    <QuestaoHeaderSvg numero={1} totalMm={180} boxMm={28} variant={selectedDecorator as any} />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-slate-100 rounded w-full"></div>
                      <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                      <div className="h-3 bg-slate-100 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-[18cm]">
                  <div className="bg-white shadow-lg p-6 rounded-lg">
                    <h4 className="text-xs font-bold mb-4 text-slate-500 border-b pb-2 text-center">Coluna 1</h4>
                    <div className="flex items-start gap-3">
                      <QuestaoHeaderSvg numero={5} totalMm={85} boxMm={28} variant={selectedDecorator as any} />
                      <div className="space-y-2 flex-1">
                        <div className="h-2 bg-slate-100 rounded w-full"></div>
                        <div className="h-2 bg-slate-100 rounded w-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white shadow-lg p-6 rounded-lg">
                    <h4 className="text-xs font-bold mb-4 text-slate-500 border-b pb-2 text-center">Coluna 2</h4>
                    <div className="flex items-start gap-3">
                      <QuestaoHeaderSvg numero={6} totalMm={85} boxMm={28} variant={selectedDecorator as any} />
                      <div className="space-y-2 flex-1">
                        <div className="h-2 bg-slate-100 rounded w-full"></div>
                        <div className="h-2 bg-slate-100 rounded w-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)} className="px-8">
              Concluir Seleção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
