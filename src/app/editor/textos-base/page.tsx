"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listBaseTexts, getBaseText, type BaseTextItem } from "@/lib/baseTexts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Pencil } from "lucide-react";
import "@/app/editor/prova/montar/prova.css";
import Link from "next/link";

function wrapBaseTextForRender(content: any) {
  return {
    type: "doc",
    content: [{ type: "question", content: [{ type: "base_text", content: content?.content ?? [] }] }],
  };
}

function BaseTextPreviewInline({ id }: { id: string }) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBaseText(id).then((bt) => {
      setContent(bt?.content ?? null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-xs text-muted-foreground py-2">Carregando…</p>;
  if (!content) return <p className="text-xs text-muted-foreground">Sem conteúdo.</p>;

  return (
    <div className="border rounded bg-white p-3 max-h-64 overflow-y-auto text-sm print-mode">
      <QuestionRenderer content={wrapBaseTextForRender(content)} />
    </div>
  );
}

function TextosBaseContent() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [search, setSearch] = useState("");
  const [filterDisciplina, setFilterDisciplina] = useState("");
  const [items, setItems] = useState<BaseTextItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setExpandedId(null);
    const { items: result, total: t } = await listBaseTexts({
      search: search.trim() || undefined,
      disciplina: filterDisciplina.trim() || undefined,
      limit: 50,
    });
    setItems(result);
    setTotal(t);
    setLoading(false);
  }, [search, filterDisciplina]);

  useEffect(() => {
    if (isLoggedIn) doSearch();
  }, [isLoggedIn, doSearch]);

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
        <p className="text-slate-600">Faça login para gerenciar textos base.</p>
        <Button onClick={() => router.push("/")}>Voltar ao início</Button>
      </div>
    );
  }

  return (
    <div className="pm-shell">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 px-4 pt-4">
        <div className="max-w-6xl mx-auto pm-topbar-dark px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/minha-area")} className="text-[#F4F4F2] hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Minha área
          </Button>
          <h1 className="text-sm font-semibold text-white">Textos Base</h1>
        </div>
        <Button size="sm" asChild className="border border-[#E0B22A] bg-[#FBC02D] text-[#2D3436] hover:bg-[#FFD93D]">
          <Link href="/editor/texto-base/novo">
            <Plus className="h-4 w-4 mr-1" />
            Novo texto base
          </Link>
        </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Filtros */}
        <div className="pm-surface rounded-2xl p-4 flex gap-2">
          <Input
            placeholder="Buscar por trecho do texto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          />
          <Input
            placeholder="Disciplina"
            value={filterDisciplina}
            onChange={(e) => setFilterDisciplina(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            className="w-44"
          />
          <Button variant="outline" onClick={doSearch} disabled={loading}>
            {loading ? "…" : "Buscar"}
          </Button>
        </div>

        {/* Resultado */}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum texto base encontrado.</p>
        )}

        {total > items.length && (
          <p className="text-xs text-muted-foreground text-right">{total} encontrados — mostrando os primeiros {items.length}</p>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="pm-surface rounded-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-[#FFF4CC] text-[#5A4500] border border-[#FBC02D]/35 px-1.5 py-0.5 rounded-md font-bold">
                      {item.tag}
                    </span>
                    {item.titulo && <span className="text-sm font-medium">{item.titulo}</span>}
                    {item.disciplina && <span className="text-xs text-muted-foreground">{item.disciplina}</span>}
                  </div>
                  {item.autor && <p className="text-xs text-muted-foreground mt-0.5">{item.autor}</p>}
                  {item.tema && <p className="text-xs text-muted-foreground">{item.tema}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId((p) => p === item.id ? null : item.id)}
                    title={expandedId === item.id ? "Ocultar" : "Visualizar"}
                  >
                    {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/editor/texto-base/${item.id}`)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                </div>
              </div>

              {expandedId === item.id && (
                <div className="border-t px-3 pb-3 pt-2 bg-slate-50/80">
                  <BaseTextPreviewInline id={item.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TextosBasePage() {
  return (
    <Suspense>
      <TextosBaseContent />
    </Suspense>
  );
}
