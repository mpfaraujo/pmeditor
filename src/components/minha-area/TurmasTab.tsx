"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Users, Plus, Edit, Trash } from "lucide-react";
import { listTurmas, deleteTurma, type Turma } from "@/lib/turmas";
import { FilterPreview } from "@/components/turmas/FilterPreview";
import { useToast } from "@/hooks/use-toast";

export function TurmasTab() {
  const router = useRouter();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTurmas();
  }, []);

  const loadTurmas = async () => {
    setLoading(true);
    try {
      const data = await listTurmas();
      setTurmas(data);
    } catch (err: any) {
      console.error("Erro ao carregar turmas:", err);
      toast({
        title: "Erro ao carregar turmas",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push("/minha-area/turmas/nova");
  };

  const handleEdit = (id: number) => {
    router.push(`/minha-area/turmas/${id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      await deleteTurma(deletingId);
      toast({
        title: "Turma deletada",
        description: "A turma foi deletada com sucesso",
      });
      await loadTurmas();
    } catch (err: any) {
      console.error("Erro ao deletar turma:", err);
      toast({
        title: "Erro ao deletar turma",
        description: err.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Minhas Turmas</h3>
          <p className="text-sm text-muted-foreground">
            Organize filtros de questões por turma
          </p>
        </div>
        <Button onClick={handleCreate} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Turma
        </Button>
      </div>

      {turmas.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-medium text-slate-500">
              Nenhuma turma cadastrada
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Crie turmas para organizar filtros de questões
            </p>
            <Button onClick={handleCreate} className="mt-6 btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Turma
            </Button>
          </CardContent>
        </Card>
      )}

      {turmas.map((turma) => (
        <Card key={turma.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle>{turma.nome}</CardTitle>
                {turma.descricao && (
                  <CardDescription className="mt-1">
                    {turma.descricao}
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(turma.id)}
                  title="Editar turma"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeletingId(turma.id)}
                  title="Deletar turma"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FilterPreview filtros={turma.filtros} />
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A turma será permanentemente deletada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
