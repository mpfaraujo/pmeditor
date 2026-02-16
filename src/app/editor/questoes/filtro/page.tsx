"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProva } from "@/contexts/ProvaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Search, Filter, Settings, User, School, Layout, Palette } from "lucide-react";
import { DotPicker, type DotPickerOption } from "@/components/ui/dot-picker";
import { LogoPicker } from "@/components/editor/LogoPicker";
import { HeaderPreviewModal } from "@/components/ui/header-preview-modal";
import { normalizeAssunto, normalizeDisciplina, groupAssuntosByArea } from "@/data/assuntos";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

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

export default function FiltroQuestoesPage() {
  const router = useRouter();
  const { provaConfig, updateProvaConfig } = useProva();

  // Estados para Filtros
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

  const [totalResults, setTotalResults] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  // Estados para Contexto da Prova (iniciam vazios pra evitar hydration mismatch)
  const [professor, setProfessor] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [headerLayout, setHeaderLayout] = useState<number>(0);
  const [questionHeaderVariant, setQuestionHeaderVariant] = useState<number>(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Sincroniza com ProvaContext após hidratação
  useEffect(() => {
    setProfessor(provaConfig.professor);
    setInstituicao(provaConfig.instituicao);
    setHeaderLayout((provaConfig as any).headerLayout ?? 0);
    setQuestionHeaderVariant((provaConfig as any).questionHeaderVariant ?? 0);
    setLogoUrl(provaConfig.logoUrl);
  }, [provaConfig]);

  // Opções para DotPickers
  const headerOptions: DotPickerOption[] = Array.from({ length: 11 }, (_, i) => ({
    value: i,
    title: i === 0 ? "Header original" : `Header layout ${i}`,
    ariaLabel: `Header layout ${i}`,
    label: i,
  }));

  const decoratorOptions: DotPickerOption[] = Array.from({ length: 5 }, (_, i) => ({
  value: i,
  title: `Decorador ${i}`,
  ariaLabel: `Decorador da questão ${i}`,
  label: i,
}));

  // Estados para Filtro de Tipo de Questão
  const [questionType, setQuestionType] = useState<string>("");
  const [questionYear, setQuestionYear] = useState<string>("");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

  // Carregar opções iniciais
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Recarregar assuntos e atualizar contagem quando filtros mudam
  useEffect(() => {
    loadFilterOptions(filters.disciplinas);
    updateCount();
  }, [filters]);

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

  const updateCount = async () => {
    setLoadingCount(true);
    try {
      const q = new URLSearchParams();
      q.set("page", "1");
      q.set("limit", "1"); // Só queremos o total
      
      if (filters.disciplinas.length) filters.disciplinas.forEach(d => q.append("disciplinas[]", d));
      if (filters.assuntos.length) filters.assuntos.forEach(a => q.append("assuntos[]", a));
      if (filters.tipos.length) filters.tipos.forEach(t => q.append("tipos[]", t));
      if (filters.dificuldades.length) filters.dificuldades.forEach(d => q.append("dificuldades[]", d));
      if (filters.tags) q.set("tags", filters.tags);

      const res = await fetch(`${BASE_URL}/list.php?${q.toString()}`, {
        headers: { "X-Questions-Token": TOKEN },
      });
      const data = await res.json();
      setTotalResults(data.total ?? 0);
    } catch (err) {
      console.error("Erro ao atualizar contagem:", err);
    } finally {
      setLoadingCount(false);
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

  const handleVerQuestoes = () => {
    // Salvar contexto no ProvaContext
    updateProvaConfig({
      professor,
      instituicao,
      headerLayout: headerLayout as any,
      questionHeaderVariant: questionHeaderVariant as any,
      logoUrl,
    });

    // Construir query params para a página de questões
    const q = new URLSearchParams();
    if (filters.disciplinas.length) filters.disciplinas.forEach(d => q.append("disciplinas", d));
    if (filters.assuntos.length) filters.assuntos.forEach(a => q.append("assuntos", a));
    if (filters.tipos.length) filters.tipos.forEach(t => q.append("tipos", t));
    if (filters.dificuldades.length) filters.dificuldades.forEach(d => q.append("dificuldades", d));
    if (filters.tags) q.set("tags", filters.tags);
    if (questionType) q.set("tipo", questionType);
    if (questionYear) q.set("ano", questionYear);

    router.push(`/editor/questoes?${q.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push("/")} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para o Início
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Preparar Prova</h1>
            <p className="text-slate-600">Configure os filtros e o cabeçalho antes de selecionar as questões</p>
          </div>
          <div className="hidden md:block">
             <Button 
              size="lg" 
              onClick={handleVerQuestoes}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              Ver {loadingCount ? "..." : totalResults} Questões
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna de Filtros */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-500" />
                  Filtros de Questões
                </CardTitle>
                <CardDescription>Refine sua busca no banco</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-6">
                    {/* Disciplinas */}
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-slate-700">Disciplina</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {options.disciplinas.map(disc => (
                          <div key={disc} className="flex items-center gap-2">
                            <Checkbox
                              id={`disc-${disc}`}
                              checked={filters.disciplinas.includes(disc)}
                              onCheckedChange={() => toggleFilter("disciplinas", disc)}
                            />
                            <label htmlFor={`disc-${disc}`} className="text-sm cursor-pointer leading-none">
                              {disc}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Assuntos agrupados por área (só aparece com disciplina selecionada) */}
                    {filters.disciplinas.length > 0 && options.assuntos.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-700">Assunto</Label>
                        <Accordion type="multiple" className="w-full">
                          {groupAssuntosByArea(options.assuntos).map(({ area, assuntos }) => {
                            const selectedCount = assuntos.filter(a => filters.assuntos.includes(a)).length;
                            const allSelected = selectedCount === assuntos.length;
                            const someSelected = selectedCount > 0 && !allSelected;
                            return (
                              <AccordionItem key={area} value={area} className="border-b-0">
                                <AccordionTrigger
                                  className="py-2 text-sm font-medium hover:no-underline"
                                  prefixContent={
                                    <Checkbox
                                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                      onCheckedChange={() => toggleAreaAssuntos(assuntos)}
                                    />
                                  }
                                >
                                  {area}
                                  {selectedCount > 0 && (
                                    <span className="text-xs text-blue-600">({selectedCount})</span>
                                  )}
                                </AccordionTrigger>
                                <AccordionContent className="pb-2 pt-0">
                                  <div className="grid grid-cols-1 gap-2 pl-7">
                                    {assuntos.map(ass => (
                                      <div key={ass} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`ass-${ass}`}
                                          checked={filters.assuntos.includes(ass)}
                                          onCheckedChange={() => toggleFilter("assuntos", ass)}
                                        />
                                        <label htmlFor={`ass-${ass}`} className="text-sm cursor-pointer leading-none">
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

                    <Separator />

                    {/* Tipos */}
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-slate-700">Tipo de Questão</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {options.tipos.map(tipo => (
                          <div key={tipo} className="flex items-center gap-2">
                            <Checkbox
                              id={`tipo-${tipo}`}
                              checked={filters.tipos.includes(tipo)}
                              onCheckedChange={() => toggleFilter("tipos", tipo)}
                            />
                            <label htmlFor={`tipo-${tipo}`} className="text-sm cursor-pointer leading-none">
                              {tipo}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Dificuldade */}
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-slate-700">Dificuldade</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {options.dificuldades.map(dif => (
                          <div key={dif} className="flex items-center gap-2">
                            <Checkbox
                              id={`dif-${dif}`}
                              checked={filters.dificuldades.includes(dif)}
                              onCheckedChange={() => toggleFilter("dificuldades", dif)}
                            />
                            <label htmlFor={`dif-${dif}`} className="text-sm cursor-pointer leading-none">
                              {dif}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Tipo de Questão */}
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-slate-700">Tipo de Questão</Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            id="tipo-todos"
                            name="tipo"
                            value=""
                            checked={questionType === ""}
                            onChange={(e) => setQuestionType(e.target.value)}
                            className="h-4 w-4"
                          />
                          <label htmlFor="tipo-todos" className="text-sm cursor-pointer">
                            Todas
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            id="tipo-original"
                            name="tipo"
                            value="Original"
                            checked={questionType === "Original"}
                            onChange={(e) => setQuestionType(e.target.value)}
                            className="h-4 w-4"
                          />
                          <label htmlFor="tipo-original" className="text-sm cursor-pointer">
                            Original
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            id="tipo-concurso"
                            name="tipo"
                            value="Concurso"
                            checked={questionType === "Concurso"}
                            onChange={(e) => setQuestionType(e.target.value)}
                            className="h-4 w-4"
                          />
                          <label htmlFor="tipo-concurso" className="text-sm cursor-pointer">
                            Concurso
                          </label>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Ano (se Concurso) */}
                    {questionType === "Concurso" && (
                      <div className="space-y-3">
                        <Label htmlFor="year-select" className="text-sm font-bold text-slate-700">
                          Ano do Concurso
                        </Label>
                        <select
                          id="year-select"
                          value={questionYear}
                          onChange={(e) => setQuestionYear(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos os anos</option>
                          {years.map((year) => (
                            <option key={year} value={year.toString()}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Separator />

                    {/* Tags */}
                    <div className="space-y-3 pb-4">
                      <Label className="text-sm font-bold text-slate-700">Tags / Busca Livre</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Ex: ENEM, 2023, Mecânica..."
                          className="pl-9"
                          value={filters.tags}
                          onChange={(e) => setFilters(prev => ({ ...prev, tags: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Coluna de Configuração de Contexto */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-500" />
                  Configuração do Cabeçalho
                </CardTitle>
                <CardDescription>Estes dados aparecerão na prova impressa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Professor e Instituição */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      Nome do Professor
                    </Label>
                    <Input 
                      placeholder="Ex: Prof. Dr. João Silva" 
                      value={professor}
                      onChange={(e) => setProfessor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <School className="h-4 w-4 text-slate-400" />
                      Instituição / Escola
                    </Label>
                    <Input 
                      placeholder="Ex: Colégio Aplicação" 
                      value={instituicao}
                      onChange={(e) => setInstituicao(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Logo e Estilos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-slate-400" />
                      Logo da Instituição
                    </Label>
                    <div
                      onClick={() => setLogoDialogOpen(true)}
                      className="w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-slate-300"
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          className="max-h-full max-w-full object-contain p-2"
                          alt="Logo selecionada"
                        />
                      ) : (
                        <div className="text-center">
                          <div className="text-slate-400 text-sm">Clique para adicionar logo</div>
                          <div className="text-slate-300 text-[10px] mt-1">PNG, JPG ou SVG</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-slate-400" />
                        Modelo de Cabeçalho
                      </Label>
                      <DotPicker
                        value={headerLayout}
                        options={headerOptions}
                        onChange={(v) => setHeaderLayout(v)}
                      />
                      <p className="text-[10px] text-slate-400">Selecione um dos 10 layouts disponíveis</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-slate-400" />
                        Decorador de Questão
                      </Label>
                      <DotPicker
                        value={questionHeaderVariant}
                        options={decoratorOptions}
                        onChange={(v) => setQuestionHeaderVariant(v)}
                      />
                      <p className="text-[10px] text-slate-400">Estilo do número da questão (Classic, Modern, etc)</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setPreviewModalOpen(true)}
                      >
                        Visualizar Cabeçalhos e Decoradores
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão Mobile */}
            <div className="md:hidden pt-4">
              <Button 
                size="lg" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-bold"
                onClick={handleVerQuestoes}
              >
                Ver {loadingCount ? "..." : totalResults} Questões
              </Button>
            </div>
          </div>
        </div>
      </div>

      <LogoPicker
        open={logoDialogOpen}
        onOpenChange={setLogoDialogOpen}
        onLogoSelect={(url) => {
          setLogoUrl(url);
        }}
        instituicao={instituicao}
      />

      <HeaderPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        selectedHeaderLayout={headerLayout}
        onHeaderSelect={setHeaderLayout}
        selectedDecorator={questionHeaderVariant}
        onDecoratorSelect={setQuestionHeaderVariant}
        logoUrl={logoUrl}
        professor={professor}
        instituicao={instituicao}
      />
    </div>
  );
}
