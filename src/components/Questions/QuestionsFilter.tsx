"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeAssunto, normalizeDisciplina, groupAssuntosByArea } from "@/data/assuntos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FilterOptions {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
}

interface FilterValues {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  tags: string;
  sourceKind: string;
  concursos: string[];
  anos: string[];
}

interface QuestionsFilterProps {
  onFilter: (filters: FilterValues) => void;
  totalResults: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

export function QuestionsFilter({ onFilter, totalResults }: QuestionsFilterProps) {
  const [options, setOptions] = useState<FilterOptions>({
    disciplinas: [],
    assuntos: [],
    tipos: [],
    dificuldades: [],
  });

  const [filters, setFilters] = useState<FilterValues>({
    disciplinas: [],
    assuntos: [],
    tipos: [],
    dificuldades: [],
    tags: "",
    sourceKind: "",
    concursos: [],
    anos: [],
  });

  const [availableConcursos, setAvailableConcursos] = useState<string[]>([]);
  const [availableAnos, setAvailableAnos] = useState<string[]>([]);

  // Carregar opções de filtro
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Recarregar assuntos quando disciplinas mudam
  useEffect(() => {
    loadFilterOptions(filters.disciplinas);
  }, [filters.disciplinas]);

  // Recarregar anos quando concursos mudam
  useEffect(() => {
    if (filters.concursos.length === 0) return;
    const loadAnos = async () => {
      try {
        const params = new URLSearchParams();
        filters.concursos.forEach(c => params.append("concursos[]", c));
        const res = await fetch(`${BASE_URL}/filters.php?${params.toString()}`, {
          headers: { "X-Questions-Token": TOKEN },
        });
        const data = await res.json();
        if (data.success) setAvailableAnos(data.anos || []);
      } catch {}
    };
    loadAnos();
  }, [filters.concursos]);

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
        setAvailableConcursos(data.concursos || []);
        setAvailableAnos(data.anos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar filtros:", err);
    }
  };

  const toggleFilter = (key: keyof Pick<FilterValues, "disciplinas" | "assuntos" | "tipos" | "dificuldades">, value: string) => {
    setFilters(prev => {
      const current = prev[key];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const toggleAreaAssuntos = (areaAssuntos: string[]) => {
    setFilters(prev => {
      const allSelected = areaAssuntos.every(a => prev.assuntos.includes(a));
      const without = prev.assuntos.filter(a => !areaAssuntos.includes(a));
      return {
        ...prev,
        assuntos: allSelected ? without : [...without, ...areaAssuntos],
      };
    });
  };

  const handleFilter = () => {
    onFilter(filters);
  };

  const handleClear = () => {
    const cleared: FilterValues = {
      disciplinas: [],
      assuntos: [],
      tipos: [],
      dificuldades: [],
      tags: "",
      sourceKind: "",
      concursos: [],
      anos: [],
    };
    setFilters(cleared);
    onFilter(cleared);
    loadFilterOptions();
  };

  return (
    <div className="w-64 border-r bg-white h-screen sticky top-0 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Filtros</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {totalResults} questões encontradas
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Disciplinas */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Disciplina</Label>
            <div className="space-y-1">
              {options.disciplinas.map(disc => (
                <div key={disc} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`disc-${disc}`}
                    checked={filters.disciplinas.includes(disc)}
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

          {/* Assuntos agrupados por área (só aparece com disciplina selecionada) */}
          {filters.disciplinas.length > 0 && options.assuntos.length > 0 && (
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Assunto</Label>
              <Accordion type="multiple" className="w-full">
                {groupAssuntosByArea(options.assuntos).map(({ area, assuntos }) => {
                  const selectedCount = assuntos.filter(a => filters.assuntos.includes(a)).length;
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
                        <div className="space-y-1 pl-6">
                          {assuntos.map(ass => (
                            <div key={ass} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`ass-${ass}`}
                                checked={filters.assuntos.includes(ass)}
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
            <div className="space-y-1">
              {options.tipos.map(tipo => (
                <div key={tipo} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`tipo-${tipo}`}
                    checked={filters.tipos.includes(tipo)}
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
            <div className="space-y-1">
              {options.dificuldades.map(dif => (
                <div key={dif} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`dif-${dif}`}
                    checked={filters.dificuldades.includes(dif)}
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

          {/* Origem */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Origem</Label>
            <div className="space-y-1">
              {[
                { value: "", label: "Todas" },
                { value: "original", label: "Original" },
                { value: "concurso", label: "Concurso" },
              ].map(opt => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    id={`origem-${opt.value || "todas"}`}
                    name="sidebar-origem"
                    value={opt.value}
                    checked={filters.sourceKind === opt.value}
                    onChange={() => setFilters(prev => ({
                      ...prev,
                      sourceKind: opt.value,
                      concursos: opt.value === "concurso" ? prev.concursos : [],
                      anos: opt.value === "concurso" ? prev.anos : [],
                    }))}
                    className="h-3 w-3"
                  />
                  <label htmlFor={`origem-${opt.value || "todas"}`} className="text-xs cursor-pointer leading-tight">
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Concurso + Ano (se Concurso) */}
          {filters.sourceKind === "concurso" && availableConcursos.length > 0 && (
            <>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Concurso</Label>
                <div className="space-y-1">
                  {availableConcursos.map(conc => (
                    <div key={conc} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`sb-conc-${conc}`}
                        checked={filters.concursos.includes(conc)}
                        onCheckedChange={() => {
                          setFilters(prev => ({
                            ...prev,
                            concursos: prev.concursos.includes(conc)
                              ? prev.concursos.filter(c => c !== conc)
                              : [...prev.concursos, conc],
                            anos: [],
                          }));
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`sb-conc-${conc}`} className="text-xs cursor-pointer leading-tight">
                        {conc}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {availableAnos.length > 0 && (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Ano</Label>
                  <div className="space-y-1">
                    {availableAnos.map(ano => (
                      <div key={ano} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`sb-ano-${ano}`}
                          checked={filters.anos.includes(String(ano))}
                          onCheckedChange={() => {
                            const s = String(ano);
                            setFilters(prev => ({
                              ...prev,
                              anos: prev.anos.includes(s)
                                ? prev.anos.filter(a => a !== s)
                                : [...prev.anos, s],
                            }));
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`sb-ano-${ano}`} className="text-xs cursor-pointer leading-tight">
                          {ano}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tags */}
          <div>
            <Label htmlFor="tags-input" className="text-xs font-medium mb-1.5 block">
              Tags
            </Label>
            <Input
              id="tags-input"
              placeholder="Buscar por tag..."
              value={filters.tags}
              onChange={(e) => setFilters(prev => ({ ...prev, tags: e.target.value }))}
              className="text-xs h-7"
            />
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-2">
        <Button onClick={handleFilter} className="w-full">
          Filtrar
        </Button>
        <Button onClick={handleClear} variant="outline" className="w-full">
          Limpar
        </Button>
      </div>
    </div>
  );
}
