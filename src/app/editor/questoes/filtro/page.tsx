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
import { ImageUpload } from "@/components/editor/ImageUpload";

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

  // Estados para Contexto da Prova
  const [professor, setProfessor] = useState(provaConfig.professor);
  const [instituicao, setInstituicao] = useState(provaConfig.instituicao);
  const [headerLayout, setHeaderLayout] = useState<number>((provaConfig as any).headerLayout ?? 0);
  const [questionHeaderVariant, setQuestionHeaderVariant] = useState<number>((provaConfig as any).questionHeaderVariant ?? 0);
  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);

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
        setOptions({
          disciplinas: data.disciplinas || [],
          assuntos: data.assuntos || [],
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

                    {/* Assuntos */}
                    {options.assuntos.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-bold text-slate-700">Assunto</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {options.assuntos.map(ass => (
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

      <ImageUpload
        open={logoDialogOpen}
        onOpenChange={setLogoDialogOpen}
        onImageInsert={(url) => {
          setLogoUrl(url);
          setLogoDialogOpen(false);
        }}
      />
    </div>
  );
}
