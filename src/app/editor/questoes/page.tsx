// src/app/editor/questoes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/Questions/QuestionCard";
import { QuestionsFilter } from "@/components/Questions/QuestionsFilter";
import { QuestionsFilterMobile } from "@/components/Questions/QuestionsFilterMobile";
import { useProva } from "@/contexts/ProvaContext";
import { listQuestions } from "@/lib/questions";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import "./print.css";
import type { CarouselApi } from "@/components/ui/carousel";

type QuestionItem = {
  metadata: {
    id: string;
    disciplina?: string;
    assunto?: string;
    dificuldade?: string;
    tipo?: string;
    source?: { kind?: string };
    tags?: string[];
    gabarito?: {
      kind: "mcq" | "tf" | "essay";
      correct?: string;
      rubric?: string;
    };
  };
  content: any;
  variantsCount?: number;
  active?: { kind: "base" | "variant"; id: string };
};

type FilterValues = {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  tags: string;
};

export default function QuestoesPage() {
  const router = useRouter();
  const { selectedQuestions, addQuestion, removeQuestion, isSelected } = useProva();
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    load({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (filters: Partial<FilterValues>) => {
    setLoading(true);
    try {
      const params: any = { page: 1, limit: 100, includeContent: true };

      if (filters.disciplinas?.length) params.disciplinas = filters.disciplinas;
      if (filters.assuntos?.length) params.assuntos = filters.assuntos;
      if (filters.tipos?.length) params.tipos = filters.tipos;
      if (filters.dificuldades?.length) params.dificuldades = filters.dificuldades;
      if (filters.tags) params.tags = filters.tags;

      const res: any = await listQuestions(params);

      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];

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
    const question = items.find((q) => q.metadata.id === id);
    if (!question) return;

    if (checked) addQuestion(question);
    else removeQuestion(id);
  };

  const handleMontarProva = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  const hasSelection = selectedQuestions.length > 0;

  return (
    <div className="flex h-screen">
      {/* Desktop */}
      <div className="hidden md:block">
        <QuestionsFilter onFilter={load} totalResults={totalResults} />
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <QuestionsFilterMobile onFilter={load} totalResults={totalResults} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-hidden">
        {loading && <div className="text-sm">Carregando…</div>}

        {!loading && items.length === 0 && <div className="text-sm">Nenhuma questão encontrada.</div>}

        {!loading && items.length > 0 && (
          <div className="w-full max-w-full md:max-w-[12cm] mx-auto">
            {/* TOPO FIXO (reserva espaço; não desloca o carousel) */}
            <div className="flex items-start justify-between gap-4 mb-3 min-h-[52px]">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground mb-2">
                  Questão {currentIndex + 1} de {items.length}
                </div>

                {/* LEGENDA */}
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

              {/* Botão no mesmo nível da legenda (sempre reserva espaço) */}
              <div className="shrink-0">
                <Button
                  onClick={handleMontarProva}
                  disabled={!hasSelection}
                  className={!hasSelection ? "opacity-0 pointer-events-none" : ""}
                >
                  Montar Prova ({selectedQuestions.length})
                </Button>
              </div>
            </div>

            <Carousel opts={{ align: "center" }} className="w-full" setApi={setApi}>
              <CarouselContent>
                {items.map((q) => (
                  <CarouselItem key={q.metadata.id}>
                    <div className="w-full md:w-[10cm] mx-auto px-2">
                      <QuestionCard
                        metadata={q.metadata}
                        content={q.content}
                        variantsCount={q.variantsCount}
                        active={q.active}
                        selected={isSelected(q.metadata.id)}
                        onSelect={toggleSelect}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <div className="hidden md:block">
                <CarouselPrevious className="left-0" />
                <CarouselNext className="right-0" />
              </div>
            </Carousel>
          </div>
        )}
      </div>
    </div>
  );
}
