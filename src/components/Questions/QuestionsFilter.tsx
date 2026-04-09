"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeAssunto, normalizeDisciplina, groupAssuntosByArea } from "@/data/assuntos";
import { Search, ChevronDown, ChevronRight, X, Loader2, SlidersHorizontal } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FilterValues {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  niveis: string[];
  tags: string;
  sourceKind: string;
  rootType: string;
  concursos: string[];
  anos: string[];
}

export const EMPTY_FILTERS: FilterValues = {
  disciplinas: [], assuntos: [], tipos: [], dificuldades: [],
  niveis: [], tags: "", sourceKind: "", rootType: "", concursos: [], anos: [],
};

interface FilterOptions {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  concursos: string[];
  anos: string[];
}

// ─── Cores por disciplina ─────────────────────────────────────────────────────

const DISC_COLORS: Record<string, string> = {
  "Matemática":            "#3b82f6",
  "Física":                "#8b5cf6",
  "Química":               "#10b981",
  "Biologia":              "#22c55e",
  "História":              "#f59e0b",
  "Geografia":             "#06b6d4",
  "Língua Portuguesa":     "#ec4899",
  "Inglês":                "#f97316",
  "Espanhol":              "#f97316",
  "Filosofia":             "#6b7280",
  "Sociologia":            "#6b7280",
  "Arte":                  "#a855f7",
  "Educação Física":       "#14b8a6",
};

function discColor(d: string) {
  return DISC_COLORS[d] ?? "#1a6680";
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE
  ?? "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({
  label, count, open, onToggle,
}: { label: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full py-2 text-left group"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-[#B8C7D9] group-hover:text-white transition-colors">
        {label}
        {count != null && count > 0 && (
          <span className="ml-1.5 text-[10px] font-bold text-[#2D3436] bg-[#FBC02D] px-1.5 py-0.5 rounded-full border border-[#E0B22A]">
            {count}
          </span>
        )}
      </span>
      {open
        ? <ChevronDown className="h-3.5 w-3.5 text-[#6E84A3]" />
        : <ChevronRight className="h-3.5 w-3.5 text-[#6E84A3]" />}
    </button>
  );
}

function Pill({
  label, active, color, onClick, compact,
}: {
  label: string; active: boolean; color?: string;
  onClick: () => void; compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative rounded-md border text-xs font-medium transition-all duration-150 select-none
        ${compact ? "px-2.5 py-1" : "px-3 py-1.5"}
        ${active
          ? "text-[#2D3436] shadow-sm"
          : "text-[#D7E2EE] hover:shadow-sm"
        }
      `}
      style={active ? { backgroundColor: "#FBC02D", borderColor: "#E0B22A" } : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(184, 199, 217, 0.18)" }}
    >
      {label}
    </button>
  );
}

function LocalSearch({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6E84A3]" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Buscar…"}
        className="h-6 pl-6 pr-2 text-[11px] focus-visible:ring-1 focus-visible:ring-[#1a6680]/40"
        style={{ borderColor: "rgba(184, 199, 217, 0.18)", backgroundColor: "rgba(255,255,255,0.05)", color: "#F4F4F2" }}
      />
    </div>
  );
}

// ─── Hook de estado ───────────────────────────────────────────────────────────

export function useQuestionsFilter({
  onFilter,
  initialFilters,
}: {
  onFilter: (f: FilterValues) => void;
  initialFilters?: Partial<FilterValues>;
}) {
  const [filters, setFilters] = useState<FilterValues>({ ...EMPTY_FILTERS, ...initialFilters });
  const [options, setOptions] = useState<FilterOptions>({
    disciplinas: [], assuntos: [], tipos: [], dificuldades: [], concursos: [], anos: [],
  });

  const [open, setOpen] = useState({
    busca: true, disciplina: true, assunto: true,
    tipo: true, dificuldade: true, estrutura: false, fonte: false,
  });

  const [assuntoSearch, setAssuntoSearch] = useState("");
  const [concursoSearch, setConcursoSearch] = useState("");
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOptions = useCallback(async (discs: string[] = [], concs: string[] = []) => {
    try {
      const params = new URLSearchParams();
      discs.forEach(d => params.append("disciplinas[]", d));
      concs.forEach(c => params.append("concursos[]", c));
      const res = await fetch(`${BASE_URL}/filters.php?${params}`, {
        headers: { "X-Questions-Token": TOKEN },
      });
      const data = await res.json();
      if (!data.success) return;

      const rawDiscs: string[] = data.disciplinas ?? [];
      const rawAssuntos: string[] = data.assuntos ?? [];

      setOptions({
        disciplinas: [...new Set(rawDiscs.map(normalizeDisciplina))].filter(Boolean).sort(),
        assuntos: [...new Set(rawAssuntos.map(normalizeAssunto))].filter(Boolean).sort(),
        tipos: data.tipos ?? [],
        dificuldades: data.dificuldades ?? [],
        concursos: data.concursos ?? [],
        anos: data.anos ?? [],
      });
    } catch {}
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => {
    loadOptions(filters.disciplinas, filters.concursos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.disciplinas, filters.concursos]);

  const dispatch = useCallback((next: FilterValues) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilter(next), 400);
  }, [onFilter]);

  const setAndDispatch = useCallback((updater: (prev: FilterValues) => FilterValues) => {
    setFilters(prev => {
      const next = updater(prev);
      dispatch(next);
      return next;
    });
  }, [dispatch]);

  const toggleArr = (key: keyof FilterValues, value: string) => {
    setAndDispatch(prev => {
      const cur = prev[key] as string[];
      const updated = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      return { ...prev, [key]: updated };
    });
  };

  const toggleAreaAssuntos = (areaAssuntos: string[]) => {
    setAndDispatch(prev => {
      const all = areaAssuntos.every(a => prev.assuntos.includes(a));
      const without = prev.assuntos.filter(a => !areaAssuntos.includes(a));
      return { ...prev, assuntos: all ? without : [...without, ...areaAssuntos] };
    });
  };

  const toggleSection = (key: keyof typeof open) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const clear = () => {
    setFilters(EMPTY_FILTERS);
    setAssuntoSearch("");
    setConcursoSearch("");
    onFilter(EMPTY_FILTERS);
  };

  const hasAnyFilter =
    filters.disciplinas.length > 0 || filters.assuntos.length > 0 ||
    filters.tipos.length > 0 || filters.dificuldades.length > 0 ||
    filters.niveis.length > 0 || filters.tags !== "" ||
    filters.sourceKind !== "" || filters.rootType !== "" ||
    filters.concursos.length > 0 || filters.anos.length > 0;

  const assuntoGroups = groupAssuntosByArea(options.assuntos, filters.disciplinas[0]);
  const filteredGroups = assuntoSearch.trim()
    ? assuntoGroups
        .map(g => ({
          ...g,
          assuntos: g.assuntos.filter(a =>
            a.toLowerCase().includes(assuntoSearch.toLowerCase())
          ),
        }))
        .filter(g => g.assuntos.length > 0)
    : assuntoGroups;

  const filteredConcursos = concursoSearch.trim()
    ? options.concursos.filter(c => c.toLowerCase().includes(concursoSearch.toLowerCase()))
    : options.concursos;

  return {
    filters, options, open,
    assuntoSearch, setAssuntoSearch,
    concursoSearch, setConcursoSearch,
    openAreas, setOpenAreas,
    toggleArr, toggleAreaAssuntos, toggleSection,
    setAndDispatch, clear,
    hasAnyFilter, filteredGroups, filteredConcursos,
  };
}

export type QuestionsFilterState = ReturnType<typeof useQuestionsFilter>;

// ─── Painel esquerdo: busca + disciplina + assunto ────────────────────────────

export function QuestionsFilterLeft({
  state, totalResults, loading,
}: {
  state: QuestionsFilterState;
  totalResults: number;
  loading?: boolean;
}) {
  const {
    filters, options, open, assuntoSearch, setAssuntoSearch,
    openAreas, setOpenAreas,
    toggleArr, toggleAreaAssuntos, toggleSection, setAndDispatch, clear,
    hasAnyFilter, filteredGroups,
  } = state;
  const visibleDisciplinas = filters.disciplinas.length > 0
    ? options.disciplinas.filter(d => filters.disciplinas.includes(d))
    : options.disciplinas;

  return (
    <div
      className="w-60 shrink-0 flex flex-col h-screen border-r border-slate-200/80 shadow-[1px_0_8px_rgba(0,0,0,0.04)]"
      style={{ backgroundColor: "#0B1020", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#FBC02D]" />
            <span className="text-sm font-bold text-white">Filtros</span>
          </div>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-[#94A8C4] hover:text-rose-300 transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {loading
            ? <Loader2 className="h-3 w-3 animate-spin text-[#FBC02D]" />
            : <span className="h-2 w-2 rounded-full bg-[#FBC02D]" />
          }
          <span className="text-[11px] text-[#94A8C4] tabular-nums">
            {loading ? "Buscando…" : `${totalResults.toLocaleString("pt-BR")} questões`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-1 space-y-0.5">

          {/* ── Busca ── */}
          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6E84A3]" />
              <Input
                value={filters.tags}
                onChange={e => setAndDispatch(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Buscar no enunciado, tags…"
                className="pl-8 h-8 text-xs focus-visible:ring-1 focus-visible:ring-[#1a6680]/40"
                style={{ borderColor: "rgba(184, 199, 217, 0.18)", backgroundColor: "rgba(255,255,255,0.05)", color: "#F4F4F2" }}
              />
              {filters.tags && (
                <button
                  type="button"
                  onClick={() => setAndDispatch(prev => ({ ...prev, tags: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3 w-3 text-[#6E84A3] hover:text-white" />
                </button>
              )}
            </div>
          </div>

          <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />

          {/* ── Disciplina ── */}
          <div>
            <SectionHeader
              label="Disciplina"
              count={filters.disciplinas.length}
              open={open.disciplina}
              onToggle={() => toggleSection("disciplina")}
            />
            {open.disciplina && (
              <div className="grid grid-cols-2 gap-1.5 pb-3">
                {visibleDisciplinas.map(d => (
                  <Pill
                    key={d}
                    label={d}
                    active={filters.disciplinas.includes(d)}
                    color={discColor(d)}
                    onClick={() => toggleArr("disciplinas", d)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Assunto ── */}
          {filters.disciplinas.length > 0 && options.assuntos.length > 0 && (
            <>
              <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
              <div>
                <SectionHeader
                  label="Assunto"
                  count={filters.assuntos.length}
                  open={open.assunto}
                  onToggle={() => toggleSection("assunto")}
                />
                {open.assunto && (
                  <div className="pb-3">
                    <LocalSearch
                      value={assuntoSearch}
                      onChange={setAssuntoSearch}
                      placeholder="Filtrar assuntos…"
                    />
                    <div className="space-y-0.5">
                      {filteredGroups.map(({ area, assuntos: asList }) => {
                        const sel = asList.filter(a => filters.assuntos.includes(a)).length;
                        const allSel = sel === asList.length;
                        const someSel = sel > 0 && !allSel;
                        const areaOpen = openAreas.has(area);
                        return (
                          <div key={area}>
                            <div className="flex items-center gap-2 py-1 group">
                              <Checkbox
                                checked={allSel ? true : someSel ? "indeterminate" : false}
                                onCheckedChange={() => toggleAreaAssuntos(asList)}
                                className="h-3.5 w-3.5 shrink-0"
                              />
                              <button
                                type="button"
                                className="flex-1 flex items-center justify-between text-left"
                                onClick={() => setOpenAreas(prev => {
                                  const next = new Set(prev);
                                  next.has(area) ? next.delete(area) : next.add(area);
                                  return next;
                                })}
                              >
                                <span className="text-xs text-[#D7E2EE] font-medium group-hover:text-white">
                                  {area}
                                  {sel > 0 && (
                                    <span className="ml-1 text-[10px] text-[#FBC02D] font-bold">({sel})</span>
                                  )}
                                </span>
                                {areaOpen
                                  ? <ChevronDown className="h-3 w-3 text-[#6E84A3]" />
                                  : <ChevronRight className="h-3 w-3 text-[#6E84A3]" />}
                              </button>
                            </div>
                            {areaOpen && (
                              <div className="pl-6 space-y-0.5 mb-1">
                                {asList.map(a => (
                                  <div key={a} className="flex items-center gap-2 py-0.5">
                                    <Checkbox
                                      id={`ass-${a}`}
                                      checked={filters.assuntos.includes(a)}
                                      onCheckedChange={() => toggleArr("assuntos", a)}
                                      className="h-3 w-3 shrink-0"
                                    />
                                    <label
                                      htmlFor={`ass-${a}`}
                                      className="text-[11px] text-[#B8C7D9] cursor-pointer leading-tight hover:text-white"
                                    >
                                      {a}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Painel direito: tipo + dificuldade + estrutura + fonte ───────────────────

export function QuestionsFilterRight({ state }: { state: QuestionsFilterState }) {
  const {
    filters, options, open,
    concursoSearch, setConcursoSearch,
    toggleArr, toggleSection, setAndDispatch,
    filteredConcursos,
  } = state;

  return (
    <div
      className="w-72 shrink-0 flex flex-col h-screen border-l border-slate-200/80 shadow-[-2px_0_14px_rgba(15,23,42,0.06)]"
      style={{ backgroundColor: "#0B1020", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="px-4 pt-4 pb-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#FBC02D]" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B8C7D9]">Refinar</span>
        </div>
        <p className="mt-1 text-[11px] text-[#94A8C4]">Tipo, dificuldade, estrutura e origem.</p>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 py-3 space-y-3">

          {/* ── Tipo ── */}
          <div className="rounded-xl border shadow-[0_1px_4px_rgba(0,0,0,0.16)] px-3 py-2" style={{ borderColor: "rgba(184, 199, 217, 0.14)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <SectionHeader
              label="Tipo"
              count={filters.tipos.length}
              open={open.tipo}
              onToggle={() => toggleSection("tipo")}
            />
            {open.tipo && (
              <div className="flex flex-wrap gap-1.5 pb-3">
                {options.tipos.map(t => (
                  <Pill
                    key={t}
                    label={t === "Múltipla Escolha" ? "MCQ" : t}
                    active={filters.tipos.includes(t)}
                    onClick={() => toggleArr("tipos", t)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Dificuldade ── */}
          <div className="rounded-xl border shadow-[0_1px_4px_rgba(0,0,0,0.16)] px-3 py-2" style={{ borderColor: "rgba(184, 199, 217, 0.14)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <SectionHeader
              label="Dificuldade"
              count={filters.dificuldades.length}
              open={open.dificuldade}
              onToggle={() => toggleSection("dificuldade")}
            />
            {open.dificuldade && (
              <div className="flex flex-wrap gap-1.5 pb-3">
                {[
                  { value: "Fácil", color: "#22c55e" },
                  { value: "Média", color: "#f59e0b" },
                  { value: "Difícil", color: "#ef4444" },
                ].filter(d => options.dificuldades.includes(d.value)).map(({ value, color }) => (
                  <Pill
                    key={value}
                    label={value}
                    active={filters.dificuldades.includes(value)}
                    color={color}
                    onClick={() => toggleArr("dificuldades", value)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Estrutura ── */}
          <div className="rounded-xl border shadow-[0_1px_4px_rgba(0,0,0,0.16)] px-3 py-2" style={{ borderColor: "rgba(184, 199, 217, 0.14)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <SectionHeader
              label="Estrutura"
              open={open.estrutura}
              onToggle={() => toggleSection("estrutura")}
            />
            {open.estrutura && (
              <div className="flex flex-wrap gap-1.5 pb-3">
                {[
                  { value: "", label: "Todas" },
                  { value: "question", label: "Individual" },
                  { value: "set_questions", label: "Conjunto" },
                ].map(opt => (
                  <Pill
                    key={opt.value || "todas"}
                    label={opt.label}
                    active={filters.rootType === opt.value}
                    onClick={() => setAndDispatch(prev => ({ ...prev, rootType: opt.value }))}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Fonte ── */}
          <div className="rounded-xl border shadow-[0_1px_4px_rgba(0,0,0,0.16)] px-3 py-2" style={{ borderColor: "rgba(184, 199, 217, 0.14)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <SectionHeader
              label="Fonte"
              count={filters.concursos.length + filters.anos.length + (filters.sourceKind ? 1 : 0)}
              open={open.fonte}
              onToggle={() => toggleSection("fonte")}
            />
            {open.fonte && (
              <div className="pb-3 space-y-3">
                {/* Origem */}
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-[#94A8C4] font-semibold">Origem</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[
                      { value: "", label: "Todas" },
                      { value: "original", label: "Original" },
                      { value: "concurso", label: "Concurso" },
                    ].map(opt => (
                      <Pill
                        key={opt.value || "todas"}
                        label={opt.label}
                        active={filters.sourceKind === opt.value}
                        onClick={() => setAndDispatch(prev => ({
                          ...prev,
                          sourceKind: opt.value,
                          concursos: opt.value === "concurso" ? prev.concursos : [],
                          anos: opt.value === "concurso" ? prev.anos : [],
                        }))}
                        compact
                      />
                    ))}
                  </div>
                </div>

                {/* Concurso */}
                {options.concursos.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-[#94A8C4] font-semibold">Concurso</span>
                    <div className="mt-1">
                      <LocalSearch
                        value={concursoSearch}
                        onChange={setConcursoSearch}
                        placeholder="ENEM, CEDERJ…"
                      />
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {filteredConcursos.map(c => (
                          <div key={c} className="flex items-center gap-2 py-1">
                            <Checkbox
                              id={`conc-${c}`}
                              checked={filters.concursos.includes(c)}
                              onCheckedChange={() => {
                                setAndDispatch(prev => ({
                                  ...prev,
                                  concursos: prev.concursos.includes(c)
                                    ? prev.concursos.filter(x => x !== c)
                                    : [...prev.concursos, c],
                                  anos: [],
                                }));
                              }}
                              className="h-3 w-3 shrink-0"
                            />
                            <label htmlFor={`conc-${c}`} className="text-[11px] leading-5 text-[#D7E2EE] cursor-pointer hover:text-white">
                              {c}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ano */}
                {filters.concursos.length > 0 && options.anos.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-[#94A8C4] font-semibold">Ano</span>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      {options.anos.map(ano => (
                        <Pill
                          key={ano}
                          label={String(ano)}
                          active={filters.anos.includes(String(ano))}
                          onClick={() => {
                            const s = String(ano);
                            setAndDispatch(prev => ({
                              ...prev,
                              anos: prev.anos.includes(s)
                                ? prev.anos.filter(a => a !== s)
                                : [...prev.anos, s],
                            }));
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Chips de filtros ativos ──────────────────────────────────────────────────

interface ActiveChip {
  label: string;
  onRemove: () => void;
}

export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: FilterValues;
  onChange: (f: FilterValues) => void;
}) {
  const chips: ActiveChip[] = [];

  filters.disciplinas.forEach(d =>
    chips.push({ label: d, onRemove: () => onChange({ ...filters, disciplinas: filters.disciplinas.filter(x => x !== d) }) })
  );
  filters.assuntos.forEach(a =>
    chips.push({ label: a, onRemove: () => onChange({ ...filters, assuntos: filters.assuntos.filter(x => x !== a) }) })
  );
  filters.tipos.forEach(t =>
    chips.push({ label: t === "Múltipla Escolha" ? "MCQ" : t, onRemove: () => onChange({ ...filters, tipos: filters.tipos.filter(x => x !== t) }) })
  );
  filters.dificuldades.forEach(d =>
    chips.push({ label: d, onRemove: () => onChange({ ...filters, dificuldades: filters.dificuldades.filter(x => x !== d) }) })
  );
  if (filters.sourceKind)
    chips.push({ label: filters.sourceKind === "concurso" ? "Concurso" : "Original", onRemove: () => onChange({ ...filters, sourceKind: "", concursos: [], anos: [] }) });
  filters.concursos.forEach(c =>
    chips.push({ label: c, onRemove: () => onChange({ ...filters, concursos: filters.concursos.filter(x => x !== c), anos: [] }) })
  );
  filters.anos.forEach(a =>
    chips.push({ label: a, onRemove: () => onChange({ ...filters, anos: filters.anos.filter(x => x !== a) }) })
  );
  if (filters.rootType)
    chips.push({ label: filters.rootType === "set_questions" ? "Conjunto" : "Individual", onRemove: () => onChange({ ...filters, rootType: "" }) });
  if (filters.tags)
    chips.push({ label: `"${filters.tags}"`, onRemove: () => onChange({ ...filters, tags: "" }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-2">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: "rgba(251, 192, 45, 0.16)", color: "#F4F4F2", borderColor: "rgba(251, 192, 45, 0.34)" }}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:text-rose-500 transition-colors ml-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {chips.length >= 2 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-[11px] text-white/65 hover:text-rose-300 transition-colors"
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
}
