"use client";

import { useState } from "react";
import { Selection } from "@/contexts/ProvaContext";
import { createProva, type ProvaSalva } from "@/lib/provas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type SalvarProvaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selections: Selection[];
  onSaved?: (prova: ProvaSalva) => void;
};

export function SalvarProvaDialog({
  open,
  onOpenChange,
  selections,
  onSaved,
}: SalvarProvaDialogProps) {
  const [nome, setNome] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSalvar = async () => {
    if (!nome.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const prova = await createProva({
        nome: nome.trim(),
        disciplina: disciplina.trim() || undefined,
        selections,
      });

      onSaved?.(prova);
      setNome("");
      setDisciplina("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar prova");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Prova</DialogTitle>
          <DialogDescription>
            Salve a seleção atual de questões para reutilizar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Prova *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Prova 1 - Álgebra Linear"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="disciplina">Disciplina (opcional)</Label>
            <Input
              id="disciplina"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              placeholder="Ex: Matemática"
              disabled={loading}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {selections.length} questão(ões) será(ão) salva(s).
          </p>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={!nome.trim() || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
