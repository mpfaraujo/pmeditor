"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RichTextMiniEditor } from "./RichTextMiniEditor";
import { listBaseTexts, createBaseText, getBaseText, listQuestionsByBaseText, type BaseTextItem, type LinkedQuestion } from "@/lib/baseTexts";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from "lucide-react";

interface BaseTextPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplina?: string;
  authorId?: string;
  authorName?: string;
  onSelect: (baseTextId: string, tag: string) => void;
}

function wrapBaseTextForRender(content: any) {
  return {
    type: "doc",
    content: [{ type: "question", content: [{ type: "base_text", content: content?.content ?? [] }] }],
  };
}

function BaseTextPreview({ id, item }: { id: string; item: BaseTextItem }) {
  const [content, setContent] = useState<any>(null);
  const [questions, setQuestions] = useState<LinkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getBaseText(id), listQuestionsByBaseText(id)]).then(([bt, qs]) => {
      setContent(bt?.content ?? null);
      setQuestions(qs);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-xs text-muted-foreground py-2">Carregando…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        {content ? (
          <div className="border rounded bg-white p-3 max-h-64 overflow-y-auto text-sm print-mode flex-1">
            <QuestionRenderer content={wrapBaseTextForRender(content)} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground flex-1">Sem conteúdo.</p>
        )}
        <Button
          size="sm"
          variant="ghost"
          title="Editar texto base"
          className="shrink-0"
          onClick={() => window.open(`/editor/texto-base/${item.id}`, "_blank")}
        >
          <Pencil className="h-3.5 w-3.5" />
          <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
        </Button>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          {questions.length === 0
            ? "Nenhuma questão vinculada"
            : `${questions.length} questão${questions.length > 1 ? "ões" : ""} vinculada${questions.length > 1 ? "s" : ""}:`}
        </p>
        {questions.length > 0 && (
          <ul className="space-y-1">
            {questions.map((q) => (
              <li key={q.id} className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                <span className="font-mono text-xs">{q.id.slice(0, 8)}…</span>
                {q.disciplina && <span>{q.disciplina}</span>}
                {q.assunto && <span>— {q.assunto}</span>}
                {q.source?.concurso && (
                  <span className="text-primary/70">
                    {q.source.concurso}{q.source.ano ? ` ${q.source.ano}` : ""}{q.source.numero ? ` Q${q.source.numero}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BaseTextPickerModal({
  open,
  onOpenChange,
  disciplina,
  authorId,
  authorName,
  onSelect,
}: BaseTextPickerModalProps) {
  // ── Aba buscar ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterDisciplina, setFilterDisciplina] = useState(disciplina ?? "");
  const [results, setResults] = useState<BaseTextItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setExpandedId(null);
    const { items } = await listBaseTexts({
      search: search.trim() || undefined,
      disciplina: filterDisciplina.trim() || undefined,
      limit: 30,
    });
    setResults(items);
    setLoading(false);
  }, [search, filterDisciplina]);

  useEffect(() => {
    if (!open) return;
    doSearch();
  }, [open, doSearch]);

  // ── Aba criar novo ──────────────────────────────────────────────────────────
  const [newTitulo, setNewTitulo] = useState("");
  const [newAutor, setNewAutor] = useState("");
  const [newDisciplina, setNewDisciplina] = useState(disciplina ?? "");
  const [newTema, setNewTema] = useState("");
  const [newGenero, setNewGenero] = useState("");
  const [newContent, setNewContent] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newContent) {
      setCreateError("Escreva o conteúdo do texto antes de salvar.");
      return;
    }
    setCreating(true);
    setCreateError(null);

    const id = crypto.randomUUID();
    const result = await createBaseText({
      id,
      content: newContent,
      titulo: newTitulo.trim() || undefined,
      autor: newAutor.trim() || undefined,
      disciplina: newDisciplina.trim() || undefined,
      tema: newTema.trim() || undefined,
      genero: newGenero.trim() || undefined,
      author: authorId ? { id: authorId, name: authorName } : undefined,
    });

    setCreating(false);

    if (result.success) {
      onSelect(result.id, result.tag);
      onOpenChange(false);
    } else if (result.duplicate && result.existing_id && result.existing_tag) {
      onSelect(result.existing_id, result.existing_tag);
      onOpenChange(false);
    } else {
      setCreateError(result.error ?? "Erro ao salvar texto base.");
    }
  };

  const handleSelect = (item: BaseTextItem) => {
    onSelect(item.id, item.tag);
    onOpenChange(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Texto Base</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="buscar">
          <TabsList className="mb-3">
            <TabsTrigger value="buscar">Buscar existente</TabsTrigger>
            <TabsTrigger value="novo">Criar novo</TabsTrigger>
          </TabsList>

          {/* ── Buscar ── */}
          <TabsContent value="buscar" className="space-y-3">
            <div className="flex gap-2">
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
                className="w-40"
              />
              <Button variant="outline" onClick={doSearch} disabled={loading}>
                {loading ? "…" : "Buscar"}
              </Button>
            </div>

            {results.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum texto encontrado.
              </p>
            )}

            <div className="space-y-2">
              {results.map((item) => (
                <div key={item.id} className="border rounded-md overflow-hidden">
                  {/* Cabeçalho do item */}
                  <div className="flex items-start justify-between gap-3 p-3 bg-white">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                          {item.tag}
                        </span>
                        {item.titulo && (
                          <span className="text-sm font-medium truncate">{item.titulo}</span>
                        )}
                        {item.disciplina && (
                          <span className="text-xs text-muted-foreground">{item.disciplina}</span>
                        )}
                      </div>
                      {item.autor && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.autor}</p>
                      )}
                      {item.tema && (
                        <p className="text-xs text-muted-foreground">{item.tema}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpand(item.id)}
                        title={expandedId === item.id ? "Ocultar prévia" : "Visualizar"}
                      >
                        {expandedId === item.id
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelect(item)}
                      >
                        Selecionar
                      </Button>
                    </div>
                  </div>

                  {/* Prévia expandida */}
                  {expandedId === item.id && (
                    <div className="border-t px-3 pb-3 pt-2 bg-slate-50">
                      <BaseTextPreview id={item.id} item={item} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Criar novo ── */}
          <TabsContent value="novo" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-sm font-medium">Conteúdo do texto <span className="text-destructive">*</span></label>
                <RichTextMiniEditor
                  value={newContent}
                  onChange={setNewContent}
                  expandable={false}
                  expandedMode={true}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Título</label>
                <Input placeholder="Ex: Texto I" value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Autor</label>
                <Input placeholder="Ex: Machado de Assis" value={newAutor} onChange={(e) => setNewAutor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Disciplina</label>
                <Input placeholder="Ex: Língua Portuguesa" value={newDisciplina} onChange={(e) => setNewDisciplina(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tema</label>
                <Input placeholder="Ex: meio ambiente, IA" value={newTema} onChange={(e) => setNewTema(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Gênero</label>
                <Input placeholder="Ex: crônica, poema, artigo" value={newGenero} onChange={(e) => setNewGenero(e.target.value)} />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Salvando…" : "Salvar e vincular"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
