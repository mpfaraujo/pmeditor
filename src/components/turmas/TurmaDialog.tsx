"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeAssunto, normalizeDisciplina, groupAssuntosByArea } from "@/data/assuntos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Turma, FilterValues } from "@/lib/turmas";
import { useToast } from "@/hooks/use-toast";

interface TurmaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turma?: Turma | null;
  onSave: (payload: {
    id?: number;
    nome: string;
    descricao?: string;
    filtros: FilterValues;
  }) => Promise<void>;
}

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

interface FilterOptions {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
}

export function TurmaDialog({
  open,
  onOpenChange,
  turma,
  onSave,
}: TurmaDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [filtros, setFiltros] = useState<FilterValues>({
    disciplinas: [],
    assuntos: [],
    tipos: [],
    dificuldades: [],
    tags: "",
    sourceKind: "",
    rootType: "",
    concursos: [],
    anos: [],
  });

  const [options, setOptions] = useState<FilterOptions>({
    disciplinas: [],
    assuntos: [],
    tipos: [],
    dificuldades: [],
  });

  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Carregar opções de filtro
  useEffect(() => {
    if (open) {
      loadFilterOptions();
    }
  }, [open]);

  // Recarregar assuntos quando disciplinas mudam
  useEffect(() => {
    if (open && filtros.disciplinas.length > 0) {
      loadFilterOptions(filtros.disciplinas);
    }
  }, [filtros.disciplinas, open]);

  // Preencher formulário ao editar
  useEffect(() => {
    if (open && turma) {
      setNome(turma.nome);
      setDescricao(turma.descricao || "");
      setFiltros(turma.filtros);
    } else if (open) {
      // Limpar ao criar nova
      setNome("");
      setDescricao("");
      setFiltros({
        disciplinas: [],
        assuntos: [],
        tipos: [],
        dificuldades: [],
        tags: "",
        sourceKind: "",
        rootType: "",
        concursos: [],
        anos: [],
      });
    }
  }, [open, turma]);

  const loadFilterOptions = async (disciplinas: string[] = []) => {
    try {
      const params = new URLSearchParams();
      disciplinas.forEach(d => params.append("disciplinas[]", d));

      const res = await fetch(`${BASE_URL}/filters.php?${params.toString()}`, {
        headers: { "X-Questions-Token": TOKEN },
      });
      const data = await res.json();

      if (data.success) {
        const rawAssuntos: string[] = data.assuntos || [];
        const rawDisciplinas: string[] = data.disciplinas || [];
        const normalized = [...new Set(rawAssuntos.map(normalizeAssunto))].filter(Boolean).sort();
        setOptions({
          disciplinas: [...new Set(rawDisciplinas.map(normalizeDisciplina))].filter(Boolean).sort(),
          assuntos: normalized,
          tipos: data.tipos || [],
          dificuldades: data.dificuldades || [],
        });
      }
    } catch (err) {
      console.error("Erro ao carregar filtros:", err);
    }
  };

  const toggleFilter = (
    key: "disciplinas" | "assuntos" | "tipos" | "dificuldades",
    value: string
  ) => {
    setFiltros(prev => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const toggleAreaAssuntos = (areaAssuntos: string[]) => {
    setFiltros(prev => {
      const allSelected = areaAssuntos.every(a => prev.assuntos.includes(a));
      const without = prev.assuntos.filter(a => !areaAssuntos.includes(a));
      return {
        ...prev,
        assuntos: allSelected ? without : [...without, ...areaAssuntos],
      };
    });
  };

  const handleSave = async () => {
    if (!nome.trim()) return;

    setSaving(true);
    try {
      await onSave({
        id: turma?.id,
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        filtros,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao salvar turma:", err);
      toast({
        title: "Erro ao salvar turma",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{turma ? "Editar Turma" : "Nova Turma"}</DialogTitle>
          <DialogDescription>
            Configure os filtros que serão aplicados automaticamente ao selecionar esta turma
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 pb-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Nome da Turma *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: 3º Ano A - Cálculo"
                maxLength={255}
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva a turma..."
                rows={3}
              />
            </div>

            <Separator />

            {/* Filtros */}
            <div>
              <Label className="text-base font-semibold">Filtros da Turma</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione os filtros que serão aplicados automaticamente
              </p>

              <div className="space-y-4">
                {/* Disciplinas */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Disciplina</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {options.disciplinas.map(disc => (
                      <div key={disc} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`disc-${disc}`}
                          checked={filtros.disciplinas.includes(disc)}
                          onCheckedChange={() => toggleFilter("disciplinas", disc)}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`disc-${disc}`} className="text-xs cursor-pointer leading-tight">
                          {disc}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assuntos */}
                {filtros.disciplinas.length > 0 && options.assuntos.length > 0 && (
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Assunto</Label>
                    <Accordion type="multiple" className="w-full">
                      {groupAssuntosByArea(options.assuntos).map(({ area, assuntos }) => {
                        const selectedCount = assuntos.filter(a => filtros.assuntos.includes(a)).length;
                        const allSelected = selectedCount === assuntos.length;
                        const someSelected = selectedCount > 0 && !allSelected;
                        return (
                          <AccordionItem key={area} value={area} className="border-b-0">
                            <AccordionTrigger
                              className="py-1.5 text-xs font-medium hover:no-underline"
                              prefixContent={
                                <Checkbox
                                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                  onCheckedChange={() => toggleAreaAssuntos(assuntos)}
                                  className="h-3.5 w-3.5"
                                />
                              }
                            >
                              {area}
                              {selectedCount > 0 && (
                                <span className="text-[10px] text-blue-600">({selectedCount})</span>
                              )}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1 pt-0">
                              <div className="grid grid-cols-3 gap-x-3 gap-y-1 pl-6">
                                {assuntos.map(ass => (
                                  <div key={ass} className="flex items-center gap-1.5">
                                    <Checkbox
                                      id={`ass-${ass}`}
                                      checked={filtros.assuntos.includes(ass)}
                                      onCheckedChange={() => toggleFilter("assuntos", ass)}
                                      className="h-3.5 w-3.5"
                                    />
                                    <label htmlFor={`ass-${ass}`} className="text-xs cursor-pointer leading-tight">
                                      {ass}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}

                {/* Tipo */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Tipo</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {options.tipos.map(tipo => (
                      <div key={tipo} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`tipo-${tipo}`}
                          checked={filtros.tipos.includes(tipo)}
                          onCheckedChange={() => toggleFilter("tipos", tipo)}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`tipo-${tipo}`} className="text-xs cursor-pointer leading-tight">
                          {tipo}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dificuldade */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Dificuldade</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {options.dificuldades.map(dif => (
                      <div key={dif} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`dif-${dif}`}
                          checked={filtros.dificuldades.includes(dif)}
                          onCheckedChange={() => toggleFilter("dificuldades", dif)}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`dif-${dif}`} className="text-xs cursor-pointer leading-tight">
                          {dif}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label htmlFor="tags-input" className="text-xs font-medium mb-1.5 block">
                    Tags
                  </Label>
                  <Input
                    id="tags-input"
                    placeholder="Buscar por tag..."
                    value={filtros.tags}
                    onChange={(e) => setFiltros(prev => ({ ...prev, tags: e.target.value }))}
                    className="text-xs h-7"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nome.trim() || saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
