"use client";

import { useEffect, useState, useMemo } from "react";
import { useLineRefMeasure } from "@/hooks/useLineRefMeasure";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/Questions/QuestionCard";
import {
  useQuestionsFilter,
  QuestionsFilterLeft,
  QuestionsFilterRight,
  ActiveFilterChips,
  EMPTY_FILTERS,
} from "@/components/Questions/QuestionsFilter";
import type { FilterValues } from "@/components/Questions/QuestionsFilter";
import { useProva } from "@/contexts/ProvaContext";
import { listQuestions, QuestionVersion } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Rows3, Plus, X, CheckSquare, LayoutDashboard, UserRound } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { QuestionEditorModal } from "@/components/Questions/QuestionEditorModal";
import { QuestionCardCompact } from "@/components/Questions/QuestionCardCompact";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

export default function QuestoesPage() {
  const router = useRouter();
  const { addQuestion, removeQuestion, isSelected, selectedCount, clearAll, selectedQuestions } = useProva();
  const hasSelectedQuestions = selectedQuestions.length > 0;
  const effectiveSelectedCount = selectedCount > 0 ? selectedCount : selectedQuestions.length;

  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (typeof window === "undefined") return "carousel";
    return (localStorage.getItem("questaoViewMode") as "carousel" | "grid") ?? "carousel";
  });

  useEffect(() => { load(EMPTY_FILTERS, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (filters: Partial<FilterValuesWithMy>, page: number = 1) => {
    setLoading(true);
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

      setItems(items);
      setTotalResults(total);
      setCurrentPage(page);
      setCurrentIndex(0);
      api?.scrollTo(0);
    } finally {
      setLoading(false);
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
    checked ? addQuestion(q) : removeQuestion(id);
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
    return selectedQuestions as QuestionItem[];
  }, [items, showOnlySelected, selectedQuestions]);

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
    // Layout 3 colunas: [Filtros esq] | [Questões] | [Filtros dir]
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F4F4F2" }}>

      {/* ── Coluna esquerda: busca + disciplina + assunto ── */}
      <QuestionsFilterLeft
        state={filterState}
        totalResults={totalResults}
        loading={loading}
      />

      {/* ── Coluna central: Questões ── */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ backgroundColor: "#F4F4F2" }}
      >

        {/* Barra de topo: chips ativos + controles */}
        <div
          className="border-b px-4 py-2 shrink-0"
          style={{ backgroundColor: "#2D3436", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-stretch gap-4">
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-center gap-2 px-1 pb-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="h-7 px-2 text-[11px] text-[#9eb4d1] hover:bg-white/10 hover:text-white"
                >
                  <LayoutDashboard className="mr-1 h-3.5 w-3.5" />
                  Dashboard
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/minha-area")}
                  className="h-7 px-2 text-[11px] text-[#9eb4d1] hover:bg-white/10 hover:text-white"
                >
                  <UserRound className="mr-1 h-3.5 w-3.5" />
                  Minha Área
                </Button>
              </div>
              <div className="min-h-[4.5rem]">
                <ActiveFilterChips
                  filters={topBarFilters}
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
            <div className="shrink-0 w-[360px] flex flex-col justify-between gap-2 py-1">
              <div className="flex items-center justify-end gap-1.5 min-h-9">
                <button
                  type="button"
                  title={viewMode === "carousel" ? "Modo grade compacta" : "Modo carrossel"}
                  onClick={toggleViewMode}
                  className="p-1.5 rounded transition-colors hover:bg-white/10"
                  style={{ color: "#F4F4F2" }}
                >
                  {viewMode === "carousel" ? <LayoutGrid className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
                </button>
                {viewMode === "carousel" ? (
                  <Button size="sm" variant="ghost" onClick={handleEditAtual} className="text-xs min-w-[72px] justify-center text-[#F4F4F2] hover:bg-white/10 hover:text-white">
                    Editar
                  </Button>
                ) : (
                  <div className="w-[72px]" />
                )}
                <Button size="sm" variant="ghost" onClick={handleNovaQuestao} className="text-xs gap-1 min-w-[84px] justify-center text-[#F4F4F2] hover:bg-white/10 hover:text-white">
                  <Plus className="h-3.5 w-3.5" /> Nova
                </Button>
                <div className="w-px h-4 bg-white/15 mx-1" />
                <Button
                  onClick={handleMontarProva}
                  disabled={!hasSelectedQuestions}
                  size="sm"
                  className="text-xs gap-1 min-w-[138px] justify-center border border-[#E0B22A] bg-[#FBC02D] text-[#2D3436] hover:bg-[#FFD93D]"
                >
                  <span suppressHydrationWarning className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums min-w-[26px] text-center ${hasSelectedQuestions ? "bg-black/10 opacity-100" : "opacity-0"}`}>
                    {hasSelectedQuestions ? effectiveSelectedCount : "0"}
                  </span>
                  Montar Prova
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2 min-h-8">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowOnlySelected(v => !v)}
                  disabled={!hasSelectedQuestions}
                  className={`text-xs min-w-[148px] justify-center border ${showOnlySelected ? "border-[#FBC02D]/50 bg-white/12 text-[#FFD93D]" : "border-white/10 text-[#D7E2EE] hover:bg-white/10 hover:text-white"}`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {showOnlySelected ? "Ver todas" : "Mostrar selecionadas"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAll}
                  disabled={!hasSelectedQuestions}
                  className="text-xs min-w-[120px] justify-center border border-white/10 text-[#D7E2EE] hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar seleção
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de questões */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 py-4 relative">

            {loading && items.length > 0 && (
              <div className="absolute right-4 top-4 z-10 rounded-full border bg-white px-3 py-1 text-xs text-[#4f4f4d] shadow-sm" style={{ borderColor: "rgba(45,52,54,0.12)" }}>
                Carregando…
              </div>
            )}
            {loading && items.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="text-sm text-muted-foreground py-16 text-center">Nenhuma questão encontrada.</div>
            )}

            {(loading || items.length > 0) && (
              <>
                {/* Paginação */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <button onClick={handlePreviousPage} disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 bg-white">
                    ‹
                  </button>
                  <span className="text-xs text-muted-foreground px-2 tabular-nums">
                    {currentPage} / {Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE))}
                  </span>
                  <button onClick={handleNextPage} disabled={currentPage >= Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE))}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50 bg-white">
                    ›
                  </button>
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
                  <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                    {displayItems.map((q) => (
                      <QuestionCardCompact key={q.metadata.id}
                        metadata={q.metadata} content={q.content}
                        selected={isSelected(q.metadata.id)} onSelect={toggleSelect}
                        onPreview={() => setPreviewItem(q)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Coluna direita: tipo + dificuldade + estrutura + fonte ── */}
      <QuestionsFilterRight state={filterState} />

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
                <div className="flex justify-end mb-2">
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
