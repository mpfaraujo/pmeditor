"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  listQuestions,
  getQuestionVariants,
  deleteQuestion,
  deleteVariant,
  deleteVariants,
  promoteVariant,
  QuestionVersion,
} from "@/lib/questions";
import { Checkbox } from "@/components/ui/checkbox";
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

function norm(s: string | undefined | null): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function dedupeByNorm(values: (string | undefined | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    if (!v) continue;
    const key = norm(v);
    if (!seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

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
  const [checkedVariantIds, setCheckedVariantIds] = useState<Set<string>>(new Set());

  // Filtros avançados
  const [filterHasVariant, setFilterHasVariant] = useState(false);
  const [filterDisciplinas, setFilterDisciplinas] = useState<string[]>([]);
  const [filterBancas, setFilterBancas] = useState<string[]>([]);
  const [filterAnos, setFilterAnos] = useState<string[]>([]);
  const [filterDificuldades, setFilterDificuldades] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState("");

  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [promotingVariantId, setPromotingVariantId] = useState<string | null>(null);
  const [previewVariant, setPreviewVariant] = useState<{
    variant: QuestionVersion;
    base: QuestionVersion | null;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setLoadingQuestions(true);
    listQuestions({ limit: 500, includeContent: true })
      .then((data) => setQuestions(data.items ?? []))
      .catch((err) => setErrorMsg(err?.message ?? "Erro ao carregar questões."))
      .finally(() => setLoadingQuestions(false));
  }, [authLoading, isAdmin]);

  const TIPOS_CANONICOS = ["Múltipla Escolha", "Certo/Errado", "Discursiva"];
  const DIFICULDADES_CANONICAS = ["Fácil", "Média", "Difícil"];

  const tiposNormSet = useMemo(
    () => new Set(questions.map((q) => norm(q.tipo))),
    [questions]
  );
  const dificuldadesNormSet = useMemo(
    () => new Set(questions.map((q) => norm(q.dificuldade))),
    [questions]
  );

  const availableTipos = TIPOS_CANONICOS.filter((t) => tiposNormSet.has(norm(t)));
  const availableDificuldades = DIFICULDADES_CANONICAS.filter((d) => dificuldadesNormSet.has(norm(d)));
  const availableDisciplinas = useMemo(
    () => dedupeByNorm(questions.map((q) => q.disciplina)),
    [questions]
  );
  const availableBancas = useMemo(
    () => dedupeByNorm(questions.map((q) => q.metadata?.source?.banca)),
    [questions]
  );
  const availableAnos = useMemo(
    () =>
      [...new Set(questions.map((q) => String(q.metadata?.source?.ano ?? "")).filter(Boolean))]
        .sort((a, b) => Number(b) - Number(a)),
    [questions]
  );
  const availableTags = useMemo(
    () => [...new Set(questions.flatMap((q) => q.tags ?? []))].sort(),
    [questions]
  );

  const hasActiveFilters =
    !!search || !!filterTipo || filterHasVariant ||
    filterDisciplinas.length > 0 || filterBancas.length > 0 ||
    filterAnos.length > 0 || filterDificuldades.length > 0 || !!filterTags;

  function clearFilters() {
    setSearch("");
    setFilterTipo("");
    setFilterHasVariant(false);
    setFilterDisciplinas([]);
    setFilterBancas([]);
    setFilterAnos([]);
    setFilterDificuldades([]);
    setFilterTags("");
  }

  function toggleMulti<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) {
    setter((prev) => prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]);
  }

  const filtered = useMemo(() => {
    let result = questions;
    if (filterTipo) result = result.filter((q) => norm(q.tipo) === norm(filterTipo));
    if (filterHasVariant) result = result.filter((q) => (q.variantsCount ?? 0) > 0);
    if (filterDisciplinas.length) {
      const ns = filterDisciplinas.map(norm);
      result = result.filter((q) => ns.includes(norm(q.disciplina)));
    }
    if (filterBancas.length) {
      const ns = filterBancas.map(norm);
      result = result.filter((q) => ns.includes(norm(q.metadata?.source?.banca)));
    }
    if (filterAnos.length) result = result.filter((q) => filterAnos.includes(String(q.metadata?.source?.ano ?? "")));
    if (filterDificuldades.length) {
      const ns = filterDificuldades.map(norm);
      result = result.filter((q) => ns.includes(norm(q.dificuldade)));
    }
    if (filterTags.trim()) {
      const tag = filterTags.trim().toLowerCase();
      result = result.filter((item) => (item.tags ?? []).some((t) => t.toLowerCase().includes(tag)));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) => {
        const fields = [item.disciplina, item.assunto, ...(item.tags ?? []), item.author]
          .filter(Boolean).join(" ").toLowerCase();
        return fields.includes(q);
      });
    }
    return result;
  }, [questions, search, filterTipo, filterHasVariant, filterDisciplinas, filterBancas, filterAnos, filterDificuldades, filterTags]);

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

  function toggleVariantCheck(variantId: string) {
    setCheckedVariantIds((prev) => {
      const next = new Set(prev);
      next.has(variantId) ? next.delete(variantId) : next.add(variantId);
      return next;
    });
  }

  async function handleDeleteChecked(questionId: string) {
    const ids = [...checkedVariantIds].filter((id) =>
      (variantsMap[questionId] ?? []).some((v) => v.id === id)
    );
    if (ids.length === 0) return;
    setDeleting(true);
    setErrorMsg("");
    try {
      await deleteVariants(ids);
      setVariantsMap((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] ?? []).filter((v) => !ids.includes(v.id)),
      }));
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, variantsCount: Math.max(0, (q.variantsCount ?? 0) - ids.length) }
            : q
        )
      );
      setCheckedVariantIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro ao deletar versões.");
    } finally {
      setDeleting(false);
    }
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
        <aside className="w-72 flex-shrink-0">
          <div className="stripe-card-gradient p-4 space-y-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            {/* Busca livre */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">Busca livre</label>
              <Input
                placeholder="Disciplina, assunto, autor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Tem variante */}
            <div>
              <button
                onClick={() => setFilterHasVariant((v) => !v)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
                  filterHasVariant ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-slate-100 text-slate-600"
                }`}
              >
                <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${filterHasVariant ? "bg-amber-500 border-amber-500" : "border-slate-300"}`} />
                Com variantes pendentes
              </button>
            </div>

            {/* Tipo */}
            {availableTipos.length > 0 && (
              <FilterSection label="Tipo">
                {availableTipos.map((tipo) => (
                  <FilterChip
                    key={tipo}
                    label={tipo}
                    active={filterTipo === tipo}
                    onClick={() => setFilterTipo((prev) => prev === tipo ? "" : tipo)}
                  />
                ))}
              </FilterSection>
            )}

            {/* Dificuldade */}
            {availableDificuldades.length > 0 && (
              <FilterSection label="Dificuldade">
                {availableDificuldades.map((d) => (
                  <FilterChip
                    key={d}
                    label={d}
                    active={filterDificuldades.includes(d)}
                    onClick={() => toggleMulti(setFilterDificuldades, d)}
                  />
                ))}
              </FilterSection>
            )}

            {/* Disciplina */}
            {availableDisciplinas.length > 0 && (
              <FilterSection label="Disciplina">
                <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                  {availableDisciplinas.map((d) => (
                    <FilterChip
                      key={d}
                      label={d}
                      active={filterDisciplinas.includes(d)}
                      onClick={() => toggleMulti(setFilterDisciplinas, d)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Banca */}
            {availableBancas.length > 0 && (
              <FilterSection label="Banca">
                <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                  {availableBancas.map((b) => (
                    <FilterChip
                      key={b}
                      label={b}
                      active={filterBancas.includes(b)}
                      onClick={() => toggleMulti(setFilterBancas, b)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Ano */}
            {availableAnos.length > 0 && (
              <FilterSection label="Ano">
                <div className="flex flex-wrap gap-1">
                  {availableAnos.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleMulti(setFilterAnos, a)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        filterAnos.includes(a)
                          ? "bg-slate-800 text-white border-slate-800"
                          : "border-slate-200 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Tags */}
            {availableTags.length > 0 && (
              <FilterSection label="Tags">
                <div className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                  {availableTags.map((t) => (
                    <FilterChip
                      key={t}
                      label={t}
                      active={filterTags === t}
                      onClick={() => setFilterTags((prev) => prev === t ? "" : t)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

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
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Versões
                          </h3>
                          {(() => {
                            const selectedHere = (variantsMap[item.id] ?? [])
                              .filter((v) => v.kind === "variant" && checkedVariantIds.has(v.id));
                            return selectedHere.length > 0 ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 text-xs gap-1"
                                disabled={deleting}
                                onClick={() => handleDeleteChecked(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                                Deletar selecionadas ({selectedHere.length})
                              </Button>
                            ) : null;
                          })()}
                        </div>
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
                                <th className="pb-2 pr-2 w-6" />
                                <th className="pb-2 pr-4 font-medium">Versão</th>
                                <th className="pb-2 pr-4 font-medium">Data</th>
                                <th className="pb-2 pr-4 font-medium">Autor</th>
                                <th className="pb-2 pr-4 font-medium">Descrição</th>
                                <th className="pb-2 font-medium" />
                              </tr>
                            </thead>
                            <tbody>
                              {variants.map((v, idx) => (
                                <tr
                                  key={v.id}
                                  className="border-b border-slate-100 last:border-0"
                                >
                                  <td className="py-2 pr-2">
                                    {v.kind === "variant" && (
                                      <Checkbox
                                        checked={checkedVariantIds.has(v.id)}
                                        onCheckedChange={() => toggleVariantCheck(v.id)}
                                      />
                                    )}
                                  </td>
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

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
        active ? "bg-slate-800 text-white" : "hover:bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
