"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BaseTextEditorView } from "@/components/editor/BaseTextEditorView";
import { getBaseText, updateBaseText, createBaseText, deleteBaseText, type BaseTextItem } from "@/lib/baseTexts";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import Link from "next/link";

function BaseTextEditorInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { isLoggedIn, loading: authLoading } = useAuth();

  const isNew = id === "novo";

  const [item, setItem] = useState<BaseTextItem | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [tema, setTema] = useState("");
  const [genero, setGenero] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteState, setDeleteState] = useState<
    "idle" | "confirm" | "linked" | "deleting"
  >("idle");
  const [linkedCount, setLinkedCount] = useState(0);

  useEffect(() => {
    if (isNew) return;
    getBaseText(id).then((bt) => {
      if (!bt) { setNotFound(true); setLoading(false); return; }
      setItem(bt);
      setTitulo(bt.titulo ?? "");
      setAutor(bt.autor ?? "");
      setDisciplina(bt.disciplina ?? "");
      setTema(bt.tema ?? "");
      setGenero(bt.genero ?? "");
      setLoading(false);
    });
  }, [id, isNew]);

  const handleDelete = async (force = false) => {
    if (!item) return;
    setDeleteState("deleting");
    const result = await deleteBaseText(item.id, force);
    if (result.success) {
      router.replace("/editor/textos-base");
      return;
    }
    if ("linked" in result && result.linked) {
      setLinkedCount(result.linkedCount ?? 0);
      setDeleteState("linked");
      return;
    }
    setDeleteState("idle");
    setSaveError(result.error ?? "Erro ao excluir.");
  };

  const handleSave = async (baseTextContent: any) => {
    setSaving(true);
    setSavedOk(false);
    setSaveError(null);

    if (isNew) {
      const newId = crypto.randomUUID();
      const result = await createBaseText({
        id: newId,
        content: baseTextContent,
        titulo: titulo.trim() || undefined,
        autor: autor.trim() || undefined,
        disciplina: disciplina.trim() || undefined,
        tema: tema.trim() || undefined,
        genero: genero.trim() || undefined,
      });
      setSaving(false);
      if (result.success) {
        router.replace(`/editor/texto-base/${result.id}`);
      } else if ("duplicate" in result && result.duplicate && result.existing_id) {
        router.replace(`/editor/texto-base/${result.existing_id}`);
      } else {
        setSaveError(result.error ?? "Erro ao salvar.");
      }
      return;
    }

    const result = await updateBaseText({
      id,
      content: baseTextContent,
      titulo: titulo.trim() || null,
      autor: autor.trim() || null,
      disciplina: disciplina.trim() || null,
      tema: tema.trim() || null,
      genero: genero.trim() || null,
    });

    setSaving(false);
    if (result.success) {
      window.close();
      // fallback: se window.close() foi bloqueado (aba não aberta por script), redireciona
      setTimeout(() => {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      }, 300);
    } else {
      setSaveError(result.error ?? "Erro ao salvar.");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-400">Carregando…</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">Faça login para editar textos base.</p>
        <Button onClick={() => router.push("/")}>Voltar ao início</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando texto base…</p>
      </div>
    );
  }

  if (!isNew && (notFound || !item)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Texto base não encontrado.</p>
        <Link href="/editor/textos-base" className="text-sm text-primary underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra superior */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {item?.tag && (
              <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                {item.tag}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {isNew ? "Novo texto base" : "Editar texto base"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          {savedOk && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Salvo
            </span>
          )}
          {!isNew && deleteState === "idle" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteState("confirm")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {!isNew && deleteState === "confirm" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-destructive font-medium">Excluir texto base?</span>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(false)}>
                Excluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteState("idle")}>
                Cancelar
              </Button>
            </div>
          )}
          {!isNew && deleteState === "linked" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-destructive font-medium">
                Vinculado a {linkedCount} questão{linkedCount > 1 ? "ões" : ""}. Excluir mesmo assim?
              </span>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(true)}>
                Excluir mesmo assim
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteState("idle")}>
                Cancelar
              </Button>
            </div>
          )}
          {deleteState === "deleting" && (
            <span className="text-xs text-muted-foreground">Excluindo…</span>
          )}
        </div>
      </div>

      {/* Metadados */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-4">
        <div className="bg-white border rounded-lg p-4 grid grid-cols-2 gap-3">
          <h2 className="col-span-2 text-sm font-semibold text-muted-foreground">Metadados</h2>
          <div className="space-y-1">
            <label className="text-xs font-medium">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Texto I" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Autor</label>
            <Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Ex: Machado de Assis" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Disciplina</label>
            <Input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="Ex: Língua Portuguesa" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Tema</label>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex: meio ambiente" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Gênero</label>
            <Input value={genero} onChange={(e) => setGenero(e.target.value)} placeholder="Ex: crônica, poema" className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <BaseTextEditorView
          value={isNew ? null : item?.content}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}

export default function BaseTextEditorPage() {
  return (
    <Suspense>
      <BaseTextEditorInner />
    </Suspense>
  );
}
