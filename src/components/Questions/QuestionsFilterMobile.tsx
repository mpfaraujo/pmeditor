"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter } from "lucide-react";
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
}

interface QuestionsFilterMobileProps {
  onFilter: (filters: FilterValues) => void;
  totalResults: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

export function QuestionsFilterMobile({ onFilter, totalResults }: QuestionsFilterMobileProps) {
  const [open, setOpen] = useState(false);
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
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadFilterOptions(filters.disciplinas);
  }, [filters.disciplinas]);

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

  const toggleFilter = (key: keyof Omit<FilterValues, "tags">, value: string) => {
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
    setOpen(false);
  };

  const handleClear = () => {
    const cleared: FilterValues = {
      disciplinas: [],
      assuntos: [],
      tipos: [],
      dificuldades: [],
      tags: "",
    };
    setFilters(cleared);
    onFilter(cleared);
    loadFilterOptions();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed top-4 left-4 z-50 shadow-lg"
          aria-label="Filtros"
        >
          <Filter className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[80vw] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            {totalResults} questões encontradas
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Disciplinas */}
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Disciplina</Label>
              <div className="space-y-1">
                {options.disciplinas.map(disc => (
                  <div key={disc} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`mobile-disc-${disc}`}
                      checked={filters.disciplinas.includes(disc)}
                      onCheckedChange={() => toggleFilter("disciplinas", disc)}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`mobile-disc-${disc}`} className="text-xs cursor-pointer leading-tight">
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
                          prefix={
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
                                  id={`mobile-ass-${ass}`}
                                  checked={filters.assuntos.includes(ass)}
                                  onCheckedChange={() => toggleFilter("assuntos", ass)}
                                  className="h-3.5 w-3.5"
                                />
                                <label htmlFor={`mobile-ass-${ass}`} className="text-xs cursor-pointer leading-tight">
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
                      id={`mobile-tipo-${tipo}`}
                      checked={filters.tipos.includes(tipo)}
                      onCheckedChange={() => toggleFilter("tipos", tipo)}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`mobile-tipo-${tipo}`} className="text-xs cursor-pointer leading-tight">
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
                      id={`mobile-dif-${dif}`}
                      checked={filters.dificuldades.includes(dif)}
                      onCheckedChange={() => toggleFilter("dificuldades", dif)}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`mobile-dif-${dif}`} className="text-xs cursor-pointer leading-tight">
                      {dif}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="mobile-tags-input" className="text-xs font-medium mb-1.5 block">
                Tags
              </Label>
              <Input
                id="mobile-tags-input"
                placeholder="Buscar por tag..."
                value={filters.tags}
                onChange={(e) => setFilters(prev => ({ ...prev, tags: e.target.value }))}
                className="text-xs h-7"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t space-y-2">
          <Button onClick={handleFilter} className="w-full">
            Filtrar
          </Button>
          <Button onClick={handleClear} variant="outline" className="w-full">
            Limpar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
