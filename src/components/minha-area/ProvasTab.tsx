"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listProvas, deleteProva, type ProvaSalva } from "@/lib/provas";
import { getQuestion } from "@/lib/questions";
import { useProva } from "@/contexts/ProvaContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, BookOpen, Play, Trash, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function ProvasTab() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    updateColumnLayout,
    setSetSelection,
    clearSetSelections,
  } = useProva();

  const [provas, setProvas] = useState<ProvaSalva[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [provaToDelete, setProvaToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingProva, setLoadingProva] = useState<number | null>(null);

  useEffect(() => {
    loadProvas();
  }, []);

  const loadProvas = async () => {
    try {
      const data = await listProvas();
      setProvas(data);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar provas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCarregar = async (prova: ProvaSalva) => {
    setLoadingProva(prova.id);

    try {
      // 1. Buscar questões completas (IDs estão em prova.selections)
      const questionIds = prova.selections.map(s => s.id);
      const promises = questionIds.map(id => getQuestion(id));
      const questions = await Promise.all(promises);

      // Extrair .item de cada questão (API retorna { success, item })
      const validQuestions = questions
        .filter(q => q !== null)
        .map(q => (q as any).item || q);

      if (validQuestions.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhuma questão encontrada",
          variant: "destructive",
        });
        setLoadingProva(null);
        return;
      }

      // 2. Restaurar no ProvaContext (setar todas de uma vez)
      updateColumnLayout({
        coluna1: validQuestions as any,
        coluna2: [],
      });

      // Salvar direto no localStorage antes de redirecionar
      localStorage.setItem("provaQuestions_v1", JSON.stringify(validQuestions));

      // 3. Restaurar selections (para sets com itemIndexes)
      clearSetSelections();

      const newSetSelections: Record<string, number[]> = {};
      prova.selections.forEach(sel => {
        if (sel.kind === "set") {
          setSetSelection(sel.id, sel.itemIndexes);
          newSetSelections[sel.id] = sel.itemIndexes;
        }
      });

      localStorage.setItem("provaSetSelections_v1", JSON.stringify(newSetSelections));

      toast({
        title: "Prova carregada",
        description: `Prova "${prova.nome}" carregada com sucesso`,
      });

      // 4. Redirecionar para montagem
      router.push("/editor/prova/selecionar-layout");

    } catch (err: any) {
      console.error("Erro ao carregar prova:", err);
      toast({
        title: "Erro ao carregar prova",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingProva(null);
    }
  };

  const handleDeleteClick = (id: number) => {
    setProvaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!provaToDelete) return;

    setDeleting(true);

    try {
      await deleteProva(provaToDelete);

      setProvas(prev => prev.filter(p => p.id !== provaToDelete));

      toast({
        title: "Prova deletada",
        description: "Prova deletada com sucesso",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao deletar prova",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setProvaToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-300" />
          <p className="mt-4 text-sm text-slate-400">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (provas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-500">
            Nenhuma prova salva
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Suas provas montadas aparecerão aqui.
          </p>
          <Button asChild className="mt-6 btn-primary">
            <Link href="/editor/questoes/filtro">
              <BookOpen className="h-4 w-4 mr-2" />
              Montar Prova
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Provas Salvas</h3>
          <Button asChild className="btn-primary">
            <Link href="/editor/questoes/filtro">
              <BookOpen className="h-4 w-4 mr-2" />
              Montar Prova
            </Link>
          </Button>
        </div>

        {provas.map((prova) => (
          <Card key={prova.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{prova.nome}</CardTitle>
                  <CardDescription>
                    {prova.disciplina && `${prova.disciplina} • `}
                    {prova.selections.length} questão(ões)
                    {" • "}
                    {format(new Date(prova.created_at), "dd/MM/yyyy")}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleCarregar(prova)}
                    disabled={loadingProva !== null}
                  >
                    {loadingProva === prova.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Carregar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteClick(prova.id)}
                    disabled={loadingProva !== null || deleting}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar prova?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
