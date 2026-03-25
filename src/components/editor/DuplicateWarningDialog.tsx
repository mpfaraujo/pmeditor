"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getQuestion } from "@/lib/questions";
import QuestionRendererBase from "@/components/Questions/QuestionRendererBase";

type Props = {
  open: boolean;
  existingId: string;
  similarity: number;
  newContent: any;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DuplicateWarningDialog({ open, existingId, similarity, newContent, onConfirm, onCancel }: Props) {
  const [existingContent, setExistingContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !existingId) return;
    setLoading(true);
    getQuestion(existingId)
      .then((q) => setExistingContent(q.content ?? null))
      .catch(() => setExistingContent(null))
      .finally(() => setLoading(false));
  }, [open, existingId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="w-[90vw] max-w-none h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-amber-600">
            Possível duplicata detectada — {Math.round(similarity * 100)}% de similaridade
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Já existe uma questão parecida no banco (ID: <code className="text-xs bg-muted px-1 rounded">{existingId}</code>).
            Verifique se são a mesma questão antes de salvar.
          </p>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden divide-x">
          {/* Questão existente */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 shrink-0">
              JÁ NO BANCO
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!loading && existingContent && (
                <QuestionRendererBase content={existingContent} mode="default" />
              )}
              {!loading && !existingContent && (
                <p className="text-sm text-muted-foreground">Não foi possível carregar a questão existente.</p>
              )}
            </div>
          </div>

          {/* Questão nova */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 shrink-0">
              NOVA QUESTÃO
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <QuestionRendererBase content={newContent} mode="default" />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Salvar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
