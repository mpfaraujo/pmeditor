"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/Questions/QuestionCard";
import { QuestionsFilter } from "@/components/Questions/QuestionsFilter";
import { QuestionsFilterMobile } from "@/components/Questions/QuestionsFilterMobile";
import { useProva } from "@/contexts/ProvaContext";
import { listQuestions, QuestionVersion } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { CarouselApi } from "@/components/ui/carousel";
import { QuestionEditorModal } from "@/components/Questions/QuestionEditorModal";
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

type FilterValues = {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  tags: string;
  sourceKind: string;
  rootType: string;
  concursos: string[];
  anos: string[];
  myQuestions?: boolean;
};

const ITEMS_PER_PAGE = 30;

export default function QuestoesPage() {
  const router = useRouter();
  const { addQuestion, removeQuestion, isSelected, selectedCount, clearAll } = useProva();

  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionItem | null>(null);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const filters: Partial<FilterValues> = {
      disciplinas: searchParams.getAll("disciplinas"),
      assuntos: searchParams.getAll("assuntos"),
      tipos: searchParams.getAll("tipos"),
      dificuldades: searchParams.getAll("dificuldades"),
      tags: searchParams.get("tags") || "",
      sourceKind: searchParams.get("source_kind") || "",
      rootType: searchParams.get("root_type") || "",
      concursos: searchParams.getAll("concursos"),
      anos: searchParams.getAll("anos"),
      myQuestions: searchParams.get("myQuestions") === "1",
    };
    load(filters, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (filters: Partial<FilterValues>, page: number = 1) => {
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

    return () => {
      api.off("select", update);
    };
  }, [api]);

  const toggleSelect = (id: string, checked: boolean) => {
    const q = items.find((x) => x.metadata.id === id);
    if (!q) return;
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

  const handleMontarProva = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  const handleEditAtual = () => {
    const q = items[currentIndex];
    if (!q) return;
    setEditing(q);
    setEditorOpen(true);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const searchParams = new URLSearchParams(window.location.search);
      const filters: Partial<FilterValues> = {
        disciplinas: searchParams.getAll("disciplinas"),
        assuntos: searchParams.getAll("assuntos"),
        tipos: searchParams.getAll("tipos"),
        dificuldades: searchParams.getAll("dificuldades"),
        tags: searchParams.get("tags") || "",
        sourceKind: searchParams.get("source_kind") || "",
        rootType: searchParams.get("root_type") || "",
        concursos: searchParams.getAll("concursos"),
        anos: searchParams.getAll("anos"),
        myQuestions: searchParams.get("myQuestions") === "1",
      };
      load(filters, currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      const searchParams = new URLSearchParams(window.location.search);
      const filters: Partial<FilterValues> = {
        disciplinas: searchParams.getAll("disciplinas"),
        assuntos: searchParams.getAll("assuntos"),
        tipos: searchParams.getAll("tipos"),
        dificuldades: searchParams.getAll("dificuldades"),
        tags: searchParams.get("tags") || "",
        sourceKind: searchParams.get("source_kind") || "",
        rootType: searchParams.get("root_type") || "",
        concursos: searchParams.getAll("concursos"),
        anos: searchParams.getAll("anos"),
        myQuestions: searchParams.get("myQuestions") === "1",
      };
      load(filters, currentPage + 1);
    }
  };

  // Filtrar questões se toggle ativo
  const displayItems = useMemo(() => {
    if (!showOnlySelected) return items;
    return items.filter((q) => isSelected(q.metadata.id));
  }, [items, showOnlySelected, isSelected]);

  // Reset index quando toggle muda
  useEffect(() => {
    setCurrentIndex(0);
    api?.scrollTo(0);
  }, [showOnlySelected, api]);

  // Desmarcar toggle quando zera seleções (evita ficar travado)
  useEffect(() => {
    if (selectedCount === 0 && showOnlySelected) {
      setShowOnlySelected(false);
    }
  }, [selectedCount, showOnlySelected]);

  return (
    <div className="flex h-screen stripe-grid-bg">
      <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-full md:max-w-[12cm] mx-auto mb-4 animate-fade-in-up">
          <Button variant="ghost" size="sm" onClick={() => router.push("/editor/questoes/filtro")} className="hover:bg-white/60">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Filtros
          </Button>
        </div>
        {loading && <div className="text-sm">Carregando…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm">Nenhuma questão encontrada.</div>
        )}

        {!loading && items.length > 0 && (
          <div className="w-full max-w-full md:max-w-[12cm] mx-auto">
            {/* Toolbar */}
            <div className="flex flex-col gap-2 mb-3">
              {/* Linha 1: Toggle + Botões de ação */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-only-selected"
                    checked={showOnlySelected}
                    onCheckedChange={(checked) => setShowOnlySelected(checked === true)}
                  />
                  <label
                    htmlFor="show-only-selected"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Mostrar apenas selecionadas ({selectedCount})
                  </label>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleEditAtual}>
                    Editar
                  </Button>

                  <Button
                    onClick={handleMontarProva}
                    disabled={selectedCount === 0}
                    className="btn-primary"
                  >
                    Montar Prova ({selectedCount})
                  </Button>
                </div>
              </div>

              {/* Linha 2: Limpar */}
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                  className="text-xs text-muted-foreground"
                >
                  Limpar
                </Button>
              </div>
            </div>

            {/* Paginação entre páginas de resultados */}
            {totalResults > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  title="Página anterior"
                  className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50"
                >
                  ‹
                </button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage} / {Math.ceil(totalResults / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= Math.ceil(totalResults / ITEMS_PER_PAGE)}
                  title="Próxima página"
                  className="px-2 py-1 text-sm border rounded disabled:opacity-30 hover:bg-gray-50"
                >
                  ›
                </button>
              </div>
            )}

            {/* Navegação dentro do carrossel */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => {
                  setCurrentIndex(currentIndex - 1);
                  api?.scrollTo(currentIndex - 1);
                }}
                disabled={currentIndex === 0}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13, opacity: currentIndex === 0 ? 0.3 : 1 }}
              >
                ‹ Anterior
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 60, textAlign: "center" as const }}>
                {currentIndex + 1} / {displayItems.length}
              </span>
              <button
                onClick={() => {
                  setCurrentIndex(currentIndex + 1);
                  api?.scrollTo(currentIndex + 1);
                }}
                disabled={currentIndex >= displayItems.length - 1}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13, opacity: currentIndex >= displayItems.length - 1 ? 0.3 : 1 }}
              >
                Próxima ›
              </button>
            </div>

            <Carousel opts={{ align: "start", duration: 60, watchResize: false, watchSlides: false }} className="w-full" setApi={setApi}>
              <CarouselContent>
                {displayItems.map((q) => (
                  <CarouselItem key={q.metadata.id}>
                    <div className="w-full md:w-[10cm] mx-auto px-2">
                      <QuestionCard
                        metadata={q.metadata}
                        content={q.content}
                        base={q.base}
                        variantsCount={q.variantsCount}
                        active={q.active}
                        selected={isSelected(q.metadata.id)}
                        onSelect={toggleSelect}
                        onVersionChange={(versionData) => handleVersionChange(q.metadata.id, versionData)}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        )}
      </div>

      <QuestionEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        question={editing}
        onSaved={(updated) => {
          const next = updated?.item ?? updated;

          if (!next?.metadata?.id) return;

          setItems((prev) =>
            prev.map((it) =>
              it.metadata.id === next.metadata.id
                ? {
                    ...it,
                    ...next,
                    metadata: next.metadata ?? it.metadata,
                    content: next.content ?? it.content,
                    base: next.base ?? it.base,
                    variantsCount: next.variantsCount ?? it.variantsCount,
                    active: next.active ?? it.active,
                  }
                : it
            )
          );
        }}
      />
    </div>
  );
}
