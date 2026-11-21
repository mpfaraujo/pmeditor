"use client";

// Campo de resposta-modelo / resolução nas informações da questão.
// No lugar só MOSTRA o conteúdo; para editar abre o editor único (BlocosEditor),
// o mesmo da questão e do texto base. O valor continua no formato doc > block+.

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QuestionRendererBase from "@/components/Questions/QuestionRendererBase";
import { BlocosEditor } from "./BlocosEditor";
import { blocksToEditorDoc } from "./editorCore";

interface RichTextMiniEditorProps {
  value?: any;
  onChange: (doc: any) => void;
  /** Mantidos por compatibilidade com as chamadas antigas; não têm mais efeito. */
  expandable?: boolean;
  expandedMode?: boolean;
  /** Título do diálogo de edição. */
  title?: string;
}

function blocosDe(value: any): any[] {
  return value && typeof value === "object" && value.type === "doc" && Array.isArray(value.content) ? value.content : [];
}

function temConteudo(blocks: any[]): boolean {
  return blocks.some((b) => b.type !== "paragraph" || (Array.isArray(b.content) && b.content.length > 0));
}

export function RichTextMiniEditor({ value, onChange, title = "Gabarito / Resposta-modelo" }: RichTextMiniEditorProps) {
  const [open, setOpen] = useState(false);
  const [rascunho, setRascunho] = useState<any[] | null>(null);
  // blocos iniciais congelados ao abrir: o editor não é recriado a cada digitação
  const [inicial, setInicial] = useState<any[] | null>(null);

  const blocks = useMemo(() => blocosDe(value), [value]);
  const preenchido = temConteudo(blocks);

  const abrir = () => {
    setInicial(blocks);
    setRascunho(blocks);
    setOpen(true);
  };

  const fechar = (salvar: boolean) => {
    if (salvar && rascunho) onChange({ type: "doc", content: rascunho });
    setOpen(false);
  };

  return (
    <div className="border rounded-md bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}
        className="relative min-h-[40px] max-h-[120px] overflow-hidden px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-50"
        title="Clique para editar"
      >
        {preenchido ? (
          <div className="pointer-events-none [&_.question]:!p-0 [&_.question]:!m-0 [&_.statement]:!m-0">
            <QuestionRendererBase content={blocksToEditorDoc(blocks) as any} mode="default" />
          </div>
        ) : (
          <span className="text-slate-400">Vazio — clique para escrever</span>
        )}
      </div>
      <div className="flex justify-end border-t px-1.5 py-1 bg-gray-50">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={abrir}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) fechar(true); }}>
        <DialogContent className="w-[calc(210mm+4rem)] max-w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {open ? (
            <BlocosEditor
              blocks={inicial}
              onChange={setRascunho}
              onSave={(b) => { onChange({ type: "doc", content: b }); setOpen(false); }}
              placeholder="Resposta-modelo..."
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
