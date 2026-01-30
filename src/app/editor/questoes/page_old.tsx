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
  };
  content: any;
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
    const question = items.find(q => q.metadata.id === id);
    if (!question) return;

    if (checked) {
      addQuestion(question);
    } else {
      removeQuestion(id);
    }
  };

  const handleMontarProva = () => {
    router.push("/editor/prova/montar");
  };

  return (
    <div className="flex h-screen">
      {/* Desktop: Sidebar */}
      <div className="hidden md:block">
        <QuestionsFilter onFilter={load} totalResults={totalResults} />
      </div>

      {/* Mobile: Drawer */}
      <div className="md:hidden">
        <QuestionsFilterMobile onFilter={load} totalResults={totalResults} />
      </div>

<div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-hidden">

        {loading && <div className="text-sm">Carregando…</div>}
        
        {!loading && items.length === 0 && (
          <div className="text-sm">Nenhuma questão encontrada.</div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="w-full max-w-full md:max-w-[12cm] mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  Questão {currentIndex + 1} de {items.length}
                </div>
                
                {selectedQuestions.length > 0 && (
                  <Button onClick={handleMontarProva}>
                    Montar Prova ({selectedQuestions.length})
                  </Button>
                )}
              </div>

<Carousel
  opts={{ align: "center" }}
  className="w-full"
  setApi={setApi}
>
                <CarouselContent>
                  {items.map((q) => (
                    <CarouselItem key={q.metadata.id}>
                      <div className="w-full md:w-[10cm] mx-auto px-2">
                        <QuestionCard
                          metadata={q.metadata}
                          content={q.content}
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
          </>
        )}
      </div>
    </div>
  );
}
