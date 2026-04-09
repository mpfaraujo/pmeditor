"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText,
  PlusCircle,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getQuestion, listQuestions } from "@/lib/questions";
import { useToast } from "@/hooks/use-toast";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";

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

interface PreviewQuestion {
  metadata?: any;
  content: any;
}

export function QuestoesTab() {
  const router = useRouter();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<PreviewQuestion | null>(null);

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

  const handlePreview = async (id: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewQuestion(null);
    try {
      const response: any = await getQuestion(id);
      const item = response?.item ?? response;
      if (!item?.content) throw new Error("Questão sem conteúdo");
      setPreviewQuestion(item);
    } catch (err) {
      console.error("Erro ao carregar preview da questão:", err);
      toast({
        title: "Erro ao carregar questão",
        description: "Não foi possível abrir a visualização.",
        variant: "destructive",
      });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
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

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {questions.map((q) => (
          <Card key={q.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-md">
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
                    onClick={() => handlePreview(q.id)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[min(96vw,22.5cm)] max-w-[22.5cm] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar questão</DialogTitle>
          </DialogHeader>
          {previewLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
          )}
          {!previewLoading && previewQuestion?.content && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <QuestionRenderer content={previewQuestion.content} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
