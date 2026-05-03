"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useLineRefMeasure } from "@/hooks/useLineRefMeasure";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/Questions/QuestionCard";
import {
  useQuestionsFilter,
  QuestionsFilterSidebar,
  ActiveFilterChips,
  EMPTY_FILTERS,
} from "@/components/Questions/QuestionsFilter";
import type { FilterValues } from "@/components/Questions/QuestionsFilter";
import { useProva } from "@/contexts/ProvaContext";
import { listQuestions, QuestionVersion } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, Rows3, Plus, X, CheckSquare, LayoutDashboard, UserRound, Search } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { QuestionEditorModal } from "@/components/Questions/QuestionEditorModal";
import { QuestionCardCompact } from "@/components/Questions/QuestionCardCompact";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SelectionBar } from "@/components/Questions/SelectionBar";
import "./print.css";

type QuestionItem = {
  metadata: {
    id: string;
    disciplina?: string;
    assunto?: string;
    dificuldade?: string;
    tipo?: string;
    source?: { kind?: string };
    tags?: string[];
    gabarito?: any;
  };
  content: any;
  base?: {
    metadata?: any;
    content?: any;
  };
  variantsCount?: number;
  active?: { kind: "base" | "variant"; id: string };
};

type FilterValuesWithMy = FilterValues & { myQuestions?: boolean };

const ITEMS_PER_PAGE = 30;
const MAX_SELECTION_COUNT = 100;
const SELECTED_DISPLAY_LIMIT = 50;

function hasAnyFilter(filters: Partial<FilterValuesWithMy>): boolean {
  return Boolean(
    filters.disciplinas?.length ||
    filters.assuntos?.length ||
    filters.tipos?.length ||
    filters.dificuldades?.length ||
    filters.niveis?.length ||
    filters.tags ||
    filters.sourceKind ||
    filters.rootType ||
    filters.concursos?.length ||
    filters.anos?.length ||
    filters.myQuestions
  );
}

export default function QuestoesPage() {
  const router = useRouter();
  const { addQuestion, removeQuestion, isSelected, selectedCount, clearAll, selectedQuestions, selections } = useProva();
  const { toast } = useToast();
  const effectiveSelectedCount = selectedCount > 0 ? selectedCount : selectedQuestions.length;
  const hasSelectedQuestions = effectiveSelectedCount > 0 || selections.length > 0;
  const loadRequestIdRef = useRef(0);

  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionItem | null>(null);
  const [previewItem, setPreviewItem] = useState<QuestionItem | null>(null);
  const previewMeasureRef = useLineRefMeasure(!!previewItem);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues>(EMPTY_FILTERS);

  const filterState = useQuestionsFilter({
    onFilter: (f) => { setActiveFilters(f); load(f, 1); },
    initialFilters: EMPTY_FILTERS,
  });
  const [viewMode, setViewMode] = useState<"carousel" | "grid">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("questaoViewMode") as "carousel" | "grid") ?? "grid";
  });

  useEffect(() => { load(EMPTY_FILTERS, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleSelectionLimit = (event: Event) => {
      const detail = (event as CustomEvent<{
        currentTotal?: number;
        itemsToAdd?: number;
        remaining?: number;
      }>).detail ?? {};
      toast({
        title: "Limite de seleção atingido",
        description: `Cabem mais ${Math.max(0, detail.remaining ?? 0)} questão(ões). Esta seleção adicionaria ${detail.itemsToAdd ?? 1}.`,
        variant: "destructive",
      });
    };

    window.addEventListener("pmeditor:selection-limit", handleSelectionLimit);
    return () => window.removeEventListener("pmeditor:selection-limit", handleSelectionLimit);
  }, [toast]);

  const load = async (filters: Partial<FilterValuesWithMy>, page: number = 1) => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const baseParams: any = {
        includeContent: true,
        includeBase: true,
      };

      if (filters.disciplinas?.length) baseParams.disciplinas = filters.disciplinas;
      if (filters.assuntos?.length) baseParams.assuntos = filters.assuntos;
      if (filters.tipos?.length) baseParams.tipos = filters.tipos;
      if (filters.dificuldades?.length) baseParams.dificuldades = filters.dificuldades;
      if (filters.niveis?.length) baseParams.niveis = filters.niveis;
      if (filters.tags) baseParams.tags = filters.tags;
      if (filters.sourceKind) baseParams.sourceKind = filters.sourceKind;
      if (filters.rootType) baseParams.rootType = filters.rootType;
      if (filters.concursos?.length) baseParams.concursos = filters.concursos;
      if (filters.anos?.length) baseParams.anos = filters.anos;
      if (filters.myQuestions) baseParams.myQuestions = true;

      // Buscar APENAS a página solicitada
      const response: any = await listQuestions({
        ...baseParams,
        page,
        limit: ITEMS_PER_PAGE
      });

      const total = response?.total ?? 0;
      const items = Array.isArray(response?.items) ? response.items : [];

      if (requestId !== loadRequestIdRef.current) return;
      setItems(items);
      setTotalResults(total);
      setCurrentPage(page);
      setCurrentIndex(0);
      api?.scrollTo(0);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error("[questoes] erro ao buscar questões", error);
      setItems([]);
      setTotalResults(0);
      setCurrentPage(page);
      setCurrentIndex(0);
      setLoadError("Não foi possível carregar as questões. Tente novamente.");
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!api) return;
    const update = () => setCurrentIndex(api.selectedScrollSnap());
    update();
    api.on("select", update);
    return () => { api.off("select", update); };
  }, [api]);

  const toggleSelect = (id: string, checked: boolean) => {
    const q = items.find((x) => x.metadata.id === id)
      ?? (selectedQuestions as QuestionItem[]).find((x) => x.metadata.id === id);
    if (!q) return;
    if (!checked && showOnlySelected) {
      setPendingRemoveId(id);
      return;
    }
    if (checked) {
      const remaining = MAX_SELECTION_COUNT - effectiveSelectedCount;
      if (!isSelected(id) && remaining < 1) {
        toast({
          title: "Limite de seleção atingido",
          description: `Cabem mais ${Math.max(0, remaining)} questão(ões) nesta prova.`,
          variant: "destructive",
        });
        return;
      }
      addQuestion(q);
    } else {
      removeQuestion(id);
    }
  };

  const handleSelectCurrentPage = () => {
    const toAdd = items.filter((q) => !isSelected(q.metadata.id));
    if (toAdd.length === 0) {
      toast({
        title: "Página já selecionada",
        description: "Todas as questões visíveis nesta página já estão selecionadas.",
      });
      return;
    }

    const remaining = MAX_SELECTION_COUNT - effectiveSelectedCount;
    if (toAdd.length > remaining) {
      toast({
        title: "Não foi possível selecionar a página",
        description: `Cabem mais ${Math.max(0, remaining)} questão(ões), mas esta página adicionaria ${toAdd.length}. Nenhuma questão foi selecionada.`,
        variant: "destructive",
      });
      return;
    }

    toAdd.forEach(addQuestion);
    toast({
      title: "Página selecionada",
      description: `${toAdd.length} questão(ões) visíveis adicionadas à seleção.`,
    });
  };

  const handleVersionChange = (questionId: string, versionData: QuestionVersion) => {
    const questionData: QuestionItem = {
      metadata: versionData.metadata,
      content: versionData.content,
      base: undefined,
      variantsCount: items.find(q => q.metadata.id === questionId)?.variantsCount ?? 0,
      active: {
        kind: versionData.kind,
        id: versionData.id,
      },
    };

    // Substituir no contexto (remove e adiciona novamente com nova versão)
    removeQuestion(questionId);
    addQuestion(questionData);

    // Atualizar lista local para refletir mudança
    setItems(prev =>
      prev.map(item =>
        item.metadata.id === questionId ? questionData : item
      )
    );
  };

  const toggleViewMode = () => {
    setViewMode(prev => {
      const next = prev === "carousel" ? "grid" : "carousel";
      localStorage.setItem("questaoViewMode", next);
      return next;
    });
  };

  const handleMontarProva = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  const handleEditAtual = () => {
    const q = displayItems[currentIndex];
    if (!q) return;
    setEditing(q);
    setEditorOpen(true);
  };

  const handleNovaQuestao = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) load(activeFilters, currentPage - 1);
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);
    if (currentPage < totalPages) load(activeFilters, currentPage + 1);
  };

  // Filtrar questões se toggle ativo
  // Quando showOnlySelected, usa selectedQuestions do contexto diretamente —
  // assim mostra todas as selecionadas independente dos filtros atuais.
  const displayItems = useMemo(() => {
    if (!showOnlySelected) return items;
    return (selectedQuestions as QuestionItem[]).slice(0, SELECTED_DISPLAY_LIMIT);
  }, [items, showOnlySelected, selectedQuestions]);

  const selectedDisplayTotal = selectedQuestions.length;
  const selectedDisplayShown = showOnlySelected ? displayItems.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));
  const hasDisplayItems = displayItems.length > 0;
  const activeFilterHasValues = useMemo(() => hasAnyFilter(activeFilters), [activeFilters]);
  const selectedIdsOnCurrentPage = useMemo(
    () => new Set(items.map((q) => q.metadata.id)),
    [items]
  );
  const includesSelectedOutsidePage = useMemo(
    () => selectedQuestions.some((q: any) => !selectedIdsOnCurrentPage.has(q?.metadata?.id)),
    [selectedQuestions, selectedIdsOnCurrentPage]
  );
  const showSubjectBorder = activeFilters.disciplinas.length !== 1;

  const currentDisplayItem = useMemo(() => {
    if (displayItems.length === 0) return null;
    return displayItems[Math.min(currentIndex, displayItems.length - 1)] ?? displayItems[0];
  }, [displayItems, currentIndex]);

  const topBarFilters = useMemo(
    () => ({
      ...activeFilters,
      disciplinas: [],
      assuntos: [],
      tipos: [],
      dificuldades: [],
      sourceKind: "",
      rootType: "",
      concursos: [],
      anos: [],
    }),
    [activeFilters]
  );

  const currentMetaChips = useMemo(() => {
    const q = currentDisplayItem;
    if (!q) return [] as string[];

    const chips: string[] = [];
    if (q.metadata.disciplina) chips.push(q.metadata.disciplina);
    if (q.metadata.assunto) chips.push(q.metadata.assunto);
    if (q.metadata.tipo) chips.push(q.metadata.tipo === "Múltipla Escolha" ? "MCQ" : q.metadata.tipo);
    if (q.metadata.dificuldade) chips.push(q.metadata.dificuldade);

    const g = q.metadata.gabarito;
    if (g?.kind === "mcq" && g.correct) chips.push(`Gabarito ${g.correct}`);
    if (g?.kind === "tf" && g.correct) chips.push(`Gabarito ${g.correct === "C" ? "Certo" : "Errado"}`);
    if (g?.kind === "essay") chips.push("Discursiva");

    if (q.metadata.source?.kind === "concurso") {
      const concurso = (q.metadata.source as any)?.concurso;
      const ano = (q.metadata.source as any)?.ano;
      if (concurso || ano) chips.push([concurso, ano].filter(Boolean).join(" · "));
    } else if (q.metadata.source?.kind === "original") {
      chips.push("Original");
    }

    if (q.metadata.tags?.length) chips.push(...q.metadata.tags.slice(0, 3));
    return [...new Set(chips.map(c => c.trim()).filter(Boolean))];
  }, [currentDisplayItem]);

  // Reset index quando toggle muda
  useEffect(() => {
    setCurrentIndex(0);
    api?.scrollTo(0);
  }, [showOnlySelected, api]);

  // Desmarcar toggle quando zera seleções (evita ficar travado)
  useEffect(() => {
    if (!hasSelectedQuestions && showOnlySelected) {
      setShowOnlySelected(false);
    }
  }, [hasSelectedQuestions, showOnlySelected]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F4F4F2" }}>
      <QuestionsFilterSidebar
        state={filterState}
        totalResults={totalResults}
        loading={loading}
      />

      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ backgroundColor: "#F4F4F2" }}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="h-7 px-2 text-[11px] text-slate-500 hover:bg-slate-100"
                >
                  <LayoutDashboard className="mr-1 h-3.5 w-3.5" />
                  Dashboard
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/minha-area")}
                  className="h-7 px-2 text-[11px] text-slate-500 hover:bg-slate-100"
                >
                  <UserRound className="mr-1 h-3.5 w-3.5" />
                  Minha Área
                </Button>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Banco de Questões</h1>
                <p className="mt-1 text-sm text-slate-500">Filtre e selecione questões para montar sua prova</p>
              </div>
              <div className="mt-4 flex max-w-3xl items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={activeFilters.tags}
                    onChange={(e) => {
                      const next = { ...activeFilters, tags: e.target.value };
                      setActiveFilters(next);
                      filterState.setAndDispatch(() => next);
                    }}
                    placeholder="Buscar por tag…"
                    className="h-11 rounded-lg border-slate-300 bg-white pl-10 text-sm"
                  />
                </div>
                <div className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                  {loading ? "Buscando..." : `${totalResults.toLocaleString("pt-BR")} resultados`}
                </div>
              </div>
              <div className="mt-3">
                <ActiveFilterChips
                  filters={topBarFilters}
                  variant="light"
                  onChange={(f) => {
                    const next = {
                      ...f,
                      disciplinas: activeFilters.disciplinas,
                      assuntos: activeFilters.assuntos,
                      tipos: activeFilters.tipos,
                      dificuldades: activeFilters.dificuldades,
                      sourceKind: activeFilters.sourceKind,
                      rootType: activeFilters.rootType,
                      concursos: activeFilters.concursos,
                      anos: activeFilters.anos,
                    };
                    setActiveFilters(next);
                    load(next, 1);
                    filterState.setAndDispatch(() => next);
                  }}
                />
                {viewMode === "carousel" && currentMetaChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1">
                    {currentMetaChips.map((chip, idx) => (
                      <span
                        key={`${chip}-${idx}`}
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: "#FFF4CC", borderColor: "rgba(251, 192, 45, 0.34)", color: "#5A4500" }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  title={viewMode === "carousel" ? "Modo grade compacta" : "Modo carrossel"}
                  onClick={toggleViewMode}
                  className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                >
                  {viewMode === "carousel" ? <LayoutGrid className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
                </button>
                {viewMode === "carousel" ? (
                  <Button size="sm" variant="ghost" onClick={handleEditAtual} className="text-xs text-slate-500 hover:bg-slate-100">
                    Editar
                  </Button>
                ) : (
                  <div className="w-[72px]" />
                )}
                <Button size="sm" variant="ghost" onClick={handleNovaQuestao} className="text-xs gap-1 text-slate-500 hover:bg-slate-100">
                  <Plus className="h-3.5 w-3.5" /> Nova
                </Button>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowOnlySelected(v => !v)}
                  disabled={!hasSelectedQuestions}
                  className={`text-xs min-w-[148px] justify-center border ${showOnlySelected ? "border-[#FBC02D]/70 bg-[#FFF4CC] text-[#5A4500]" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {showOnlySelected ? "Ver todas" : "Mostrar selecionadas"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="relative px-6 py-5 pb-6">

            {loading && items.length > 0 && (
              <div className="absolute right-4 top-4 z-10 rounded-full border bg-white px-3 py-1 text-xs text-[#4f4f4d] shadow-sm" style={{ borderColor: "rgba(45,52,54,0.12)" }}>
                Carregando…
              </div>
            )}
            {loading && items.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
            )}
            {!loading && loadError && (
              <div className="py-16 text-center">
                <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white px-5 py-5 text-sm text-red-900 shadow-sm">
                  <div className="text-base font-semibold">Erro ao carregar questões</div>
                  <div className="mt-1 text-red-700">{loadError}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => load(activeFilters, currentPage)}
                    className="mt-4 bg-white"
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}
            {!loading && !loadError && !showOnlySelected && items.length === 0 && (
              <div className="py-16 text-center">
                {activeFilterHasValues ? (
                  <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white px-5 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="text-base font-semibold text-slate-950">Nenhum resultado para estes filtros</div>
                    <div className="mt-1 text-slate-500">Ajuste os filtros ou limpe a seleção atual para ver mais questões.</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={filterState.clear}
                      className="mt-4 bg-white"
                    >
                      Limpar filtros
                    </Button>
                  </div>
                ) : (
                  <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white px-5 py-5 text-sm text-slate-700 shadow-sm">
                    <div className="text-base font-semibold text-slate-950">O banco de questões está vazio</div>
                    <div className="mt-1 text-slate-500">Crie uma questão para começar a montar seu banco.</div>
                    <Button
                      size="sm"
                      onClick={handleNovaQuestao}
                      className="mt-4 bg-[#FBC02D] text-[#2D3436] hover:bg-[#FFD93D]"
                    >
                      Criar primeira questão
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!loading && !loadError && showOnlySelected && displayItems.length === 0 && (
              <div className="text-sm text-muted-foreground py-16 text-center">
                Nenhuma questão selecionada.
              </div>
            )}

            {!loadError && (loading || hasDisplayItems) && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  {showOnlySelected ? (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Mostrando {selectedDisplayShown} de {selectedDisplayTotal} selecionada(s)
                      {selectedDisplayTotal > selectedDisplayShown ? ` · limite visual de ${SELECTED_DISPLAY_LIMIT}` : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Selecione questões visíveis ou abra um card para visualizar completo.
                    </div>
                  )}
                  {!showOnlySelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSelectCurrentPage}
                      disabled={loading || items.length === 0}
                      className="bg-white"
                    >
                      Selecionar página atual
                    </Button>
                  )}
                </div>

                {viewMode === "carousel" ? (
                  <div className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] px-7 py-7 border-t-[4px]" style={{ borderTopColor: "#FBC02D" }}>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <button onClick={() => api?.scrollTo(currentIndex - 1)} disabled={currentIndex === 0}
                        className="px-4 py-1.5 text-sm border rounded-md bg-[#F8F9FA] text-[#5C6468] hover:bg-[#EEF1F4] disabled:opacity-30">
                        ‹ Anterior
                      </button>
                      <span className="text-sm font-medium tabular-nums text-slate-600 min-w-16 text-center">
                        {currentIndex + 1} / {displayItems.length}
                      </span>
                      <button onClick={() => api?.scrollTo(currentIndex + 1)} disabled={currentIndex >= displayItems.length - 1}
                        className="px-4 py-1.5 text-sm border rounded-md bg-[#F8F9FA] text-[#5C6468] hover:bg-[#EEF1F4] disabled:opacity-30">
                        Próxima ›
                      </button>
                    </div>
                    <Carousel opts={{ align: "center", duration: 60 }} className="w-full" setApi={setApi}>
                      <CarouselContent>
                        {displayItems.map((q) => (
                          <CarouselItem key={q.metadata.id}>
                            <div className="question-readable-preview mx-auto px-2 w-[20.5cm] max-w-[20.5cm]">
                              <QuestionCard
                                metadata={q.metadata} content={q.content} base={q.base}
                                variantsCount={q.variantsCount} active={q.active}
                                selected={isSelected(q.metadata.id)} onSelect={toggleSelect}
                                onVersionChange={(v) => handleVersionChange(q.metadata.id, v)}
                                showMetaHeader={false}
                              />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {displayItems.map((q) => (
                      <QuestionCardCompact key={q.metadata.id}
                        metadata={q.metadata} content={q.content}
                        selected={isSelected(q.metadata.id)} onSelect={toggleSelect}
                        onPreview={() => setPreviewItem(q)}
                        showSubjectBorder={showSubjectBorder}
                      />
                    ))}
                  </div>
                )}

              </>
            )}
          </div>
        </div>

        {!showOnlySelected && !loadError && hasDisplayItems && (
          <div className="shrink-0 border-t border-slate-200 bg-white/95 px-6 py-3 shadow-[0_-4px_18px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-center gap-2">
              <button onClick={handlePreviousPage} disabled={currentPage === 1 || loading}
                className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 bg-white">
                ‹
              </button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                Página {currentPage} de {totalPages} · {totalResults.toLocaleString("pt-BR")} resultado(s)
              </span>
              <button onClick={handleNextPage} disabled={currentPage >= totalPages || loading}
                className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 bg-white">
                ›
              </button>
            </div>
          </div>
        )}
        <SelectionBar
          count={effectiveSelectedCount}
          includesOtherPages={includesSelectedOutsidePage}
          onClear={clearAll}
          onBuild={handleMontarProva}
        />
      </div>

      {/* Confirmação de remoção da seleção */}
      <Dialog open={!!pendingRemoveId} onOpenChange={(open) => { if (!open) setPendingRemoveId(null); }}>
        <DialogContent className="max-w-sm p-6">
          <DialogTitle>Remover da seleção?</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">A questão será removida da lista de selecionadas.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setPendingRemoveId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => {
              if (pendingRemoveId) removeQuestion(pendingRemoveId);
              setPendingRemoveId(null);
            }}>Remover</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de preview (modo grade) */}
      <Dialog open={!!previewItem} onOpenChange={(open) => { if (!open) setPreviewItem(null); }}>
          <DialogContent className="w-[min(96vw,22.5cm)] max-w-[22.5cm] max-h-[90vh] overflow-y-auto p-4">
            <DialogTitle className="sr-only">Visualizar questão</DialogTitle>
            {previewItem && (
              <>
                <div className="mb-2 flex justify-end pr-10">
                <Button size="sm" variant="secondary" onClick={() => { setEditing(previewItem); setEditorOpen(true); setPreviewItem(null); }}>
                  Editar
                </Button>
              </div>
              <div className="question-readable-preview" ref={previewMeasureRef}>
                <QuestionCard
                  metadata={previewItem.metadata}
                  content={previewItem.content}
                  base={previewItem.base}
                  variantsCount={previewItem.variantsCount}
                  active={previewItem.active}
                  selected={isSelected(previewItem.metadata.id)}
                  onSelect={(id, checked) => { toggleSelect(id, checked); }}
                  showMetaHeader={false}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <QuestionEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        question={editing}
        onSaved={(updated, info) => {
          const next = updated?.item ?? updated;

          if (!next?.metadata?.id) return;

          // get.php não retorna variantsCount — preserva o atual e incrementa se foi variant
          const prevVariantsCount = items.find(it => it.metadata.id === next.metadata.id)?.variantsCount ?? 0;
          const newVariantsCount = info?.kind === "variant" ? prevVariantsCount + 1 : prevVariantsCount;

          const updatedItem: QuestionItem = {
            metadata: next.metadata,
            content: next.content,
            base: next.base,
            variantsCount: newVariantsCount,
            active: next.active,
          };

          const isNew = !items.find(it => it.metadata.id === next.metadata.id);

          if (isNew) {
            setItems((prev) => [updatedItem, ...prev]);
            addQuestion(updatedItem);
          } else {
            setItems((prev) =>
              prev.map((it) =>
                it.metadata.id === next.metadata.id ? { ...it, ...updatedItem } : it
              )
            );
            // Atualiza também a seleção, se a questão estiver selecionada
            if (isSelected(next.metadata.id)) {
              removeQuestion(next.metadata.id);
              addQuestion(updatedItem);
            }
          }
        }}
      />
    </div>
  );
}
