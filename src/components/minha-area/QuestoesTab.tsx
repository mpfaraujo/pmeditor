"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PlusCircle,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listQuestions } from "@/lib/questions";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  tipo: string;
  disciplina: string;
  assunto: string;
  dificuldade: string;
  createdAt: string;
  updatedAt: string;
  tags: string[] | null;
}

export function QuestoesTab() {
  const router = useRouter();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    loadQuestions();
  }, [page]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await listQuestions({
        page,
        limit,
        myQuestions: true,
        includeContent: false,
      });

      setQuestions(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Erro ao carregar questões:", err);
      toast({
        title: "Erro ao carregar questões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/editor?id=${id}`);
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-slate-400">Carregando...</div>
      </div>
    );
  }

  if (questions.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-500">
            Nenhuma questão criada
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Crie sua primeira questão para começar
          </p>
          <Button onClick={() => router.push("/editor")} className="mt-6 gap-2 btn-primary">
            <PlusCircle className="h-4 w-4" />
            Nova Questão
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "questão" : "questões"} criada{total === 1 ? "" : "s"}
        </p>
        <Button onClick={() => router.push("/editor")} size="sm" className="gap-2 btn-primary">
          <PlusCircle className="h-4 w-4" />
          Nova Questão
        </Button>
      </div>

      {/* Lista de questões */}
      <div className="space-y-3">
        {questions.map((q) => (
          <Card key={q.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{q.tipo}</Badge>
                    {q.dificuldade && (
                      <Badge
                        variant={
                          q.dificuldade === "Fácil"
                            ? "secondary"
                            : q.dificuldade === "Média"
                              ? "default"
                              : "destructive"
                        }
                      >
                        {q.dificuldade}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-700">
                    {q.disciplina} {q.assunto && `• ${q.assunto}`}
                  </p>

                  {q.tags && q.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {q.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {q.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{q.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    Atualizada em {new Date(q.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(q.id)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
