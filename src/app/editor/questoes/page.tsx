"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/Questions/QuestionCard";
import { QuestionsFilter } from "@/components/Questions/QuestionsFilter";
import { QuestionsFilterMobile } from "@/components/Questions/QuestionsFilterMobile";
import { useProva } from "@/contexts/ProvaContext";
import { listQuestions } from "@/lib/questions";
import { Button } from "@/components/ui/button";
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
};

export default function QuestoesPage() {
  const router = useRouter();
  const { addQuestion, removeQuestion, isSelected, selectedCount, clearAll } = useProva();

  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionItem | null>(null);

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
    };
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (filters: Partial<FilterValues>) => {
    setLoading(true);
    try {
      const params: any = {
        page: 1,
        limit: 100,
        includeContent: true,
        includeBase: true,
      };

      if (filters.disciplinas?.length) params.disciplinas = filters.disciplinas;
      if (filters.assuntos?.length) params.assuntos = filters.assuntos;
      if (filters.tipos?.length) params.tipos = filters.tipos;
      if (filters.dificuldades?.length) params.dificuldades = filters.dificuldades;
      if (filters.tags) params.tags = filters.tags;
      if (filters.sourceKind) params.sourceKind = filters.sourceKind;
      if (filters.rootType) params.rootType = filters.rootType;
      if (filters.concursos?.length) params.concursos = filters.concursos;
      if (filters.anos?.length) params.anos = filters.anos;

      const res: any = await listQuestions(params);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : [];

      setItems(list);
      setTotalResults(res?.total ?? list.length);
      setCurrentIndex(0);
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

  const handleMontarProva = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  const handleEditAtual = () => {
    const q = items[currentIndex];
    if (!q) return;
    setEditing(q);
    setEditorOpen(true);
  };

  const hasSelection = selectedCount > 0;

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-full md:max-w-[12cm] mx-auto mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/editor/questoes/filtro")}>
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
            <div className="flex items-start justify-between gap-4 mb-3 min-h-[52px]">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground mb-2">
                  Questão {currentIndex + 1} de {items.length}
                </div>

                <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-1 ring-border" />
                    <span>Original</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-1 ring-border" />
                    <span>Editada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-border" />
                    <span>Variante ativa</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleEditAtual}>
                  Editar
                </Button>

                <Button
                  onClick={handleMontarProva}
                  disabled={!hasSelection}
                  className={!hasSelection ? "opacity-0 pointer-events-none" : ""}
                >
                  Montar Prova ({selectedCount})
                </Button>
                {hasSelection && (
                  <Button size="sm" variant="ghost" onClick={clearAll} className="text-xs text-muted-foreground">
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => api?.scrollPrev()}
                disabled={currentIndex === 0}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13, opacity: currentIndex === 0 ? 0.3 : 1 }}
              >
                ‹ Anterior
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 60, textAlign: "center" as const }}>
                {currentIndex + 1} / {items.length}
              </span>
              <button
                onClick={() => api?.scrollNext()}
                disabled={currentIndex >= items.length - 1}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13, opacity: currentIndex >= items.length - 1 ? 0.3 : 1 }}
              >
                Próxima ›
              </button>
            </div>

            <Carousel opts={{ align: "center" }} className="w-full" setApi={setApi}>
              <CarouselContent>
                {items.map((q, idx) => (
  <CarouselItem key={`${q.metadata.id}-${idx}`}>
                    <div className="w-full md:w-[10cm] mx-auto px-2">
                      <QuestionCard
                        metadata={q.metadata}
                        content={q.content}
                        base={q.base}
                        variantsCount={q.variantsCount}
                        active={q.active}
                        selected={isSelected(q.metadata.id)}
                        onSelect={toggleSelect}
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
