"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { normalizeAssunto, normalizeDisciplina, groupAssuntosByArea } from "@/data/assuntos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FilterValues, Turma } from "@/lib/turmas";
import { listTurmas, updateTurma } from "@/lib/turmas";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

interface FilterOptions {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
}

export default function EditarTurmaPage() {
  const router = useRouter();
  const params = useParams();
  const turmaId = Number(params.id);
  const { toast } = useToast();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadTurma();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (filtros.disciplinas.length > 0) {
      loadFilterOptions(filtros.disciplinas);
    }
  }, [filtros.disciplinas]);

  const loadTurma = async () => {
    setLoading(true);
    try {
      const turmas = await listTurmas();
      const found = turmas.find(t => t.id === turmaId);
      if (found) {
        setTurma(found);
        setNome(found.nome);
        setDescricao(found.descricao || "");
        setFiltros(found.filtros);
      } else {
        toast({
          title: "Turma não encontrada",
          variant: "destructive",
        });
        router.push("/minha-area?tab=turmas");
      }
    } catch (err) {
      console.error("Erro ao carregar turma:", err);
      toast({
        title: "Erro ao carregar turma",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
      await updateTurma({
        id: turmaId,
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        filtros,
      });
      toast({
        title: "Turma atualizada",
        description: `A turma "${nome.trim()}" foi atualizada com sucesso`,
      });
      router.push("/minha-area?tab=turmas");
    } catch (err: any) {
      console.error("Erro ao atualizar turma:", err);
      toast({
        title: "Erro ao atualizar turma",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex items-center justify-center">
        <p className="text-slate-600">Carregando...</p>
      </div>
    );
  }

  if (!turma) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push("/minha-area?tab=turmas")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Turmas
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Editar Turma</h1>
          <p className="text-slate-600 mt-2">Atualize os filtros da turma</p>
        </div>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Turma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros da Turma</CardTitle>
              <CardDescription>
                Selecione os filtros que serão aplicados automaticamente ao usar esta turma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Disciplinas */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Disciplina</Label>
                  <div className="space-y-2">
                    {options.disciplinas.map(disc => (
                      <div key={disc} className="flex items-center gap-2">
                        <Checkbox
                          id={`disc-${disc}`}
                          checked={filtros.disciplinas.includes(disc)}
                          onCheckedChange={() => toggleFilter("disciplinas", disc)}
                        />
                        <label htmlFor={`disc-${disc}`} className="text-sm cursor-pointer">
                          {disc}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tipos */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Tipo</Label>
                  <div className="space-y-2">
                    {options.tipos.map(tipo => (
                      <div key={tipo} className="flex items-center gap-2">
                        <Checkbox
                          id={`tipo-${tipo}`}
                          checked={filtros.tipos.includes(tipo)}
                          onCheckedChange={() => toggleFilter("tipos", tipo)}
                        />
                        <label htmlFor={`tipo-${tipo}`} className="text-sm cursor-pointer">
                          {tipo}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dificuldades */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Dificuldade</Label>
                  <div className="space-y-2">
                    {options.dificuldades.map(dif => (
                      <div key={dif} className="flex items-center gap-2">
                        <Checkbox
                          id={`dif-${dif}`}
                          checked={filtros.dificuldades.includes(dif)}
                          onCheckedChange={() => toggleFilter("dificuldades", dif)}
                        />
                        <label htmlFor={`dif-${dif}`} className="text-sm cursor-pointer">
                          {dif}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label htmlFor="tags-input" className="text-sm font-semibold mb-3 block">
                    Tags
                  </Label>
                  <Input
                    id="tags-input"
                    placeholder="Buscar por tag..."
                    value={filtros.tags}
                    onChange={(e) => setFiltros(prev => ({ ...prev, tags: e.target.value }))}
                  />
                </div>
              </div>

              {/* Assuntos (coluna completa) */}
              {filtros.disciplinas.length > 0 && options.assuntos.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">Assuntos</Label>
                    <Accordion type="multiple" className="w-full">
                      {groupAssuntosByArea(options.assuntos).map(({ area, assuntos }) => {
                        const selectedCount = assuntos.filter(a => filtros.assuntos.includes(a)).length;
                        const allSelected = selectedCount === assuntos.length;
                        const someSelected = selectedCount > 0 && !allSelected;
                        return (
                          <AccordionItem key={area} value={area}>
                            <AccordionTrigger
                              className="text-sm hover:no-underline"
                              prefixContent={
                                <Checkbox
                                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                  onCheckedChange={() => toggleAreaAssuntos(assuntos)}
                                />
                              }
                            >
                              {area}
                              {selectedCount > 0 && (
                                <span className="text-xs text-blue-600 ml-2">({selectedCount})</span>
                              )}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 pl-8">
                                {assuntos.map(ass => (
                                  <div key={ass} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`ass-${ass}`}
                                      checked={filtros.assuntos.includes(ass)}
                                      onCheckedChange={() => toggleFilter("assuntos", ass)}
                                    />
                                    <label htmlFor={`ass-${ass}`} className="text-sm cursor-pointer">
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pb-8">
            <Button
              variant="outline"
              onClick={() => router.push("/minha-area?tab=turmas")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!nome.trim() || saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
