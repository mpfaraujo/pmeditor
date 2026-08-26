"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyReport, ReportReason } from "@/lib/questions";

const REASONS: Array<{ value: ReportReason; label: string; hint?: string }> = [
  { value: "content",       label: "⛔ Conteúdo impróprio", hint: "Oculta a questão até admin revisar." },
  { value: "answer",        label: "❌ Gabarito errado" },
  { value: "wording",       label: "📝 Enunciado com erro" },
  { value: "missing_image", label: "🖼️ Falta imagem/figura" },
  { value: "metadata",      label: "🏷️ Classificação errada", hint: "Assunto, disciplina, tags." },
  { value: "duplicate",     label: "🔁 Duplicada" },
];

export type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: ReportReason; duplicate_of?: string }) => void;
  onUndo: () => void;
  myReport: MyReport | null;
};

export function ReportModal({
  open,
  onOpenChange,
  onSubmit,
  onUndo,
  myReport,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [dupRef, setDupRef] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setDupRef("");
    }
  }, [open]);

  const alreadyReported = myReport !== null;
  const dupValid = reason !== "duplicate" || dupRef.trim() !== "";
  const canSubmit = reason !== null && dupValid;

  const handleSubmit = () => {
    if (!reason || !dupValid) return;
    onSubmit(
      reason === "duplicate"
        ? { reason, duplicate_of: dupRef.trim() }
        : { reason }
    );
  };

  const currentLabel = alreadyReported
    ? REASONS.find((r) => r.value === myReport?.reason)?.label
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar problema na questão</DialogTitle>
        </DialogHeader>

        {alreadyReported ? (
          <div className="text-sm">
            Você já reportou essa questão como <strong>{currentLabel}</strong>.
          </div>
        ) : (
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-start gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-1"
                />
                <div>
                  <div>{r.label}</div>
                  {r.hint && (
                    <div className="text-xs text-muted-foreground">{r.hint}</div>
                  )}
                </div>
              </label>
            ))}
            {reason === "duplicate" && (
              <Input
                placeholder="ID ou link da questão duplicada"
                value={dupRef}
                onChange={(e) => setDupRef(e.target.value)}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {alreadyReported ? (
            <Button variant="destructive" onClick={onUndo}>
              Desfazer report
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              Enviar report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
