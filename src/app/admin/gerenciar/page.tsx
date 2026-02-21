"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  listQuestions,
  getQuestionVariants,
  deleteQuestion,
  deleteVariant,
  promoteVariant,
  QuestionVersion,
} from "@/lib/questions";
import QuestionCard from "@/components/Questions/QuestionCard";
import { QuestionEditorModal } from "@/components/Questions/QuestionEditorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  Eye,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

type QuestionItem = {
  id: string;
  disciplina?: string;
  assunto?: string;
  tipo?: string;
  dificuldade?: string;
  author?: string;
  tags?: string[];
  variantsCount?: number;
  active?: { kind: "base" | "variant"; id: string };
  metadata: any;
  content: any;
};

type ConfirmAction =
  | { type: "question"; id: string; label: string }
  | { type: "variant"; id: string; questionId: string; label: string }
  | null;

export default function AdminGerenciarPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const [variantsMap, setVariantsMap] = useState<
    Record<string, QuestionVersion[]>
  >({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingVariants, setLoadingVariants] = useState<Set<string>>(
    new Set()
  );

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [promotingVariantId, setPromotingVariantId] = useState<string | null>(null);
  const [previewVariant, setPreviewVariant] = useState<{
    variant: QuestionVersion;
    base: QuestionVersion | null;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setLoadingQuestions(true);
    listQuestions({ limit: 100, includeContent: true })
      .then((data) => setQuestions(data.items ?? []))
      .catch((err) => setErrorMsg(err?.message ?? "Erro ao carregar questões."))
      .finally(() => setLoadingQuestions(false));
  }, [authLoading, isAdmin]);

  const filtered = useMemo(() => {
    let result = questions;
    if (filterTipo) {
      result = result.filter((q) => q.tipo === filterTipo);
    }
    const q = search.trim().toLowerCase();
    if (!q) return result;
    return result.filter((item) => {
      const fields = [
        item.disciplina,
        item.assunto,
        ...(item.tags ?? []),
        item.author,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(q);
    });
  }, [questions, search, filterTipo]);

  async function toggleVariants(questionId: string) {
    if (expandedIds.has(questionId)) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      return;
    }
    setExpandedIds((prev) => new Set(prev).add(questionId));
    if (variantsMap[questionId]) return;
    setLoadingVariants((prev) => new Set(prev).add(questionId));
    try {
      const data = await getQuestionVariants(questionId, true);
      setVariantsMap((prev) => ({ ...prev, [questionId]: data.variants }));
    } catch {
      setErrorMsg("Erro ao carregar versões.");
    } finally {
      setLoadingVariants((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    setDeleting(true);
    setErrorMsg("");
    try {
      if (confirmAction.type === "question") {
        await deleteQuestion(confirmAction.id);
        setQuestions((prev) => prev.filter((q) => q.id !== confirmAction.id));
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(confirmAction.id);
          return next;
        });
        setVariantsMap((prev) => {
          const next = { ...prev };
          delete next[confirmAction.id];
          return next;
        });
      } else {
        await deleteVariant(confirmAction.id);
        setVariantsMap((prev) => ({
          ...prev,
          [confirmAction.questionId]: (
            prev[confirmAction.questionId] ?? []
          ).filter((v) => v.id !== String(confirmAction.id)),
        }));
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === confirmAction.questionId
              ? {
                  ...q,
                  variantsCount: Math.max(0, (q.variantsCount ?? 1) - 1),
                }
              : q
          )
        );
      }
      setConfirmAction(null);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro ao deletar.");
    } finally {
      setDeleting(false);
    }
  }

  function handleSaved(updated: any, info: { questionId: string; kind: "base" | "variant" }) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === info.questionId
          ? {
              ...q,
              metadata: updated.metadata ?? q.metadata,
              content: updated.content ?? q.content,
              disciplina: updated.metadata?.disciplina ?? q.disciplina,
              assunto: updated.metadata?.assunto ?? q.assunto,
              tipo: updated.metadata?.tipo ?? q.tipo,
              dificuldade: updated.metadata?.dificuldade ?? q.dificuldade,
              tags: updated.metadata?.tags ?? q.tags,
            }
          : q
      )
    );
    // Invalida cache de variantes para forçar recarregamento
    setVariantsMap((prev) => {
      const next = { ...prev };
      delete next[info.questionId];
      return next;
    });
  }

  async function handlePromote(variantId: string, questionId: string) {
    setPromotingVariantId(variantId);
    setErrorMsg("");
    try {
      await promoteVariant(variantId);
      // Invalida cache de variantes e recarrega a questão na lista
      setVariantsMap((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      // Fecha o painel expandido para forçar o usuário a reabrir e ver atualizado
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro ao promover variante.");
    } finally {
      setPromotingVariantId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">
            Acesso restrito
          </h1>
          <p className="text-gray-600">
            Essa página é exclusiva para administradores.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen stripe-grid-bg">
      {/* Cabeçalho */}
      <header className="brand-header sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/minha-area")}
              className="hover:bg-yellow-600/20"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Minha Área
            </Button>
            <div className="h-5 w-px bg-slate-400/40" />
            <h1 className="text-lg font-bold text-slate-800">
              Gerenciar Questões
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 flex gap-6">
        {/* Sidebar: filtros */}
        <aside className="w-64 flex-shrink-0 space-y-4">
          <div className="stripe-card-gradient p-4 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">
                Busca livre
              </label>
              <Input
                placeholder="Disciplina, assunto, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">Tipo</label>
              <div className="flex flex-col gap-1">
                {["", "Multipla Escolha", "Certo/Errado", "Discursiva"].map(
                  (tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setFilterTipo(tipo)}
                      className={`text-left text-sm px-2 py-1 rounded transition-colors ${
                        filterTipo === tipo
                          ? "bg-slate-800 text-white"
                          : "hover:bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tipo === "" ? "Todos" : tipo}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-xs text-slate-400">
              {filtered.length} de {questions.length} questões
            </div>
          </div>
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 min-w-0">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {loadingQuestions ? (
            <div className="flex justify-center py-24">
              <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <p className="text-lg font-medium">Nenhuma questão encontrada</p>
              <p className="text-sm mt-1">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                const variants = variantsMap[item.id];
                const loadingV = loadingVariants.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
                  >
                    {/* Barra de ações admin */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <button
                        onClick={() => toggleVariants(item.id)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {item.variantsCount ?? 0} versão(ões)
                      </button>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => setEditingQuestion(item)}
                        >
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            setConfirmAction({
                              type: "question",
                              id: item.id,
                              label: `${item.disciplina ?? ""} — ${item.assunto ?? item.id}`,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                          Deletar questão
                        </Button>
                      </div>
                    </div>

                    {/* Card da questão */}
                    <QuestionCard
                      metadata={item.metadata}
                      content={item.content}
                      variantsCount={item.variantsCount}
                      active={item.active}
                    />

                    {/* Painel de versões */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                          Versões
                        </h3>
                        {loadingV ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="animate-spin h-4 w-4 text-slate-400" />
                          </div>
                        ) : !variants || variants.length === 0 ? (
                          <p className="text-sm text-slate-400">
                            Sem versões registradas.
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                                <th className="pb-2 pr-4 font-medium">
                                  Versão
                                </th>
                                <th className="pb-2 pr-4 font-medium">Data</th>
                                <th className="pb-2 pr-4 font-medium">Autor</th>
                                <th className="pb-2 pr-4 font-medium">
                                  Descrição
                                </th>
                                <th className="pb-2 font-medium" />
                              </tr>
                            </thead>
                            <tbody>
                              {variants.map((v, idx) => (
                                <tr
                                  key={v.id}
                                  className="border-b border-slate-100 last:border-0"
                                >
                                  <td className="py-2 pr-4 font-medium text-slate-700">
                                    {v.kind === "base" ? "Base" : `v${idx}`}
                                  </td>
                                  <td className="py-2 pr-4 text-slate-500">
                                    {new Date(v.updatedAt).toLocaleDateString(
                                      "pt-BR"
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-slate-500">
                                    {v.author ?? "—"}
                                  </td>
                                  <td className="py-2 pr-4 text-slate-400 italic text-xs">
                                    {v.changeDescription ?? "—"}
                                  </td>
                                  <td className="py-2 text-right">
                                    {v.kind === "base" ? (
                                      <span className="text-xs text-slate-300">
                                        versão oficial
                                      </span>
                                    ) : (
                                      <div className="flex items-center justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs gap-1 text-slate-500"
                                          onClick={() => setPreviewVariant({
                                            variant: v,
                                            base: variants?.find((x) => x.kind === "base") ?? null,
                                          })}
                                        >
                                          <Eye className="h-3 w-3" />
                                          Comparar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          disabled={promotingVariantId === v.id}
                                          onClick={() => handlePromote(v.id, item.id)}
                                        >
                                          {promotingVariantId === v.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <ChevronsUp className="h-3 w-3" />
                                          )}
                                          Tornar oficial
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-7 text-xs gap-1"
                                          onClick={() =>
                                            setConfirmAction({
                                              type: "variant",
                                              id: v.id,
                                              questionId: item.id,
                                              label: `v${idx} — ${item.assunto ?? item.id}`,
                                            })
                                          }
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          Deletar
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal de edição */}
      <QuestionEditorModal
        open={editingQuestion !== null}
        onOpenChange={(open) => { if (!open) setEditingQuestion(null); }}
        question={editingQuestion}
        onSaved={handleSaved}
      />

      {/* Dialog de comparação de variante */}
      <Dialog open={previewVariant !== null} onOpenChange={(open) => { if (!open) setPreviewVariant(null); }}>
        <DialogContent className="w-[90vw] max-w-none max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200">
            <DialogTitle>Comparar versões</DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-slate-500 mt-1">
                {previewVariant?.variant.changeDescription && (
                  <span className="italic">"{previewVariant.variant.changeDescription}" · </span>
                )}
                {previewVariant?.variant.author && <span>{previewVariant.variant.author} · </span>}
                {previewVariant?.variant.updatedAt && (
                  <span>{new Date(previewVariant.variant.updatedAt).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 divide-x divide-slate-200">
            {/* Coluna esquerda: versão oficial */}
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Versão oficial (base)
              </p>
              {previewVariant?.base?.content ? (
                <QuestionCard
                  metadata={previewVariant.base.metadata}
                  content={previewVariant.base.content}
                />
              ) : (
                <p className="text-sm text-slate-400">Sem conteúdo.</p>
              )}
            </div>

            {/* Coluna direita: variante */}
            <div className="p-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">
                Esta versão (variante)
              </p>
              {previewVariant?.variant.content ? (
                <QuestionCard
                  metadata={previewVariant.variant.metadata}
                  content={previewVariant.variant.content}
                />
              ) : (
                <p className="text-sm text-slate-400">Sem conteúdo.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setConfirmAction(null);
            setErrorMsg("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "question"
                ? "Deletar questão"
                : "Deletar versão"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  {confirmAction?.type === "question"
                    ? "Isso apagará permanentemente a questão e todas as suas versões."
                    : "Isso apagará permanentemente esta versão. A questão base permanece intacta."}
                  {" "}Ação irreversível.
                </p>
                {confirmAction?.label && (
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {confirmAction.label}
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAction(null);
                setErrorMsg("");
              }}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
