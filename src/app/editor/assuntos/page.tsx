"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import disciplinasJson from "@/data/disciplinas_areas.json";
import { useAuth } from "@/contexts/AuthContext";
import { LoginButton } from "@/components/auth/LoginButton";
import { ArrowLeft } from "lucide-react";

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

type AreasMap = Record<string, { subareas: string[] }>;
type NivelAreasMap = Partial<Record<"fundamental" | "medio" | "superior", AreasMap>>;
type DisciplinasData = Record<string, NivelAreasMap>;

const NIVEIS = [
  { value: "fundamental" as const, label: "Fundamental" },
  { value: "medio"       as const, label: "Médio" },
  { value: "superior"    as const, label: "Superior" },
];

// ──────────────────────────────────────────────
// Dados base (deep clone para edição)
// ──────────────────────────────────────────────

const BASE_DATA: DisciplinasData = disciplinasJson as DisciplinasData;
const DISCIPLINAS = Object.keys(BASE_DATA);

// ──────────────────────────────────────────────
// Utilitários
// ──────────────────────────────────────────────

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// ──────────────────────────────────────────────
// Componente: card de uma área
// ──────────────────────────────────────────────

function AreaCard({
  areaName,
  subareas,
  onRenameArea,
  onDeleteArea,
  onAddSubarea,
  onRenameSubarea,
  onDeleteSubarea,
}: {
  areaName: string;
  subareas: string[];
  onRenameArea: (novo: string) => void;
  onDeleteArea: () => void;
  onAddSubarea: () => void;
  onRenameSubarea: (idx: number, novo: string) => void;
  onDeleteSubarea: (idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingArea, setEditingArea] = useState(false);
  const [areaInput, setAreaInput] = useState(areaName);

  const commitAreaRename = () => {
    const v = areaInput.trim();
    if (v && v !== areaName) onRenameArea(v);
    else setAreaInput(areaName);
    setEditingArea(false);
  };

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      {/* Cabeçalho da área */}
      <div className="flex items-center gap-2 border-b bg-slate-50/90 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-slate-400 hover:text-slate-700 text-xs w-4"
          title={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? "▼" : "▶"}
        </button>

        {editingArea ? (
          <input
            autoFocus
            className="flex-1 border rounded px-2 py-0.5 text-sm font-semibold"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onBlur={commitAreaRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAreaRename();
              if (e.key === "Escape") {
                setAreaInput(areaName);
                setEditingArea(false);
              }
            }}
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-slate-800 cursor-pointer hover:text-blue-600"
            onDoubleClick={() => setEditingArea(true)}
            title="Duplo clique para renomear"
          >
            {areaName}
          </span>
        )}

        <span className="text-xs text-slate-400">{subareas.length} assunto(s)</span>

        <button
          onClick={onAddSubarea}
          className="rounded-lg border border-[#FBC02D]/40 bg-[#FFF4CC] px-2 py-1 text-xs text-[#5A4500] hover:bg-[#FFE082]"
        >
          + Assunto
        </button>

        <button
          onClick={() => {
            if (confirm(`Remover a área "${areaName}" e todos os seus assuntos?`))
              onDeleteArea();
          }}
          className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
        >
          Remover área
        </button>
      </div>

      {/* Lista de subareas */}
      {expanded && (
        <ul className="p-2 space-y-1">
          {subareas.map((s, idx) => (
            <SubareaRow
              key={idx}
              value={s}
              onRename={(novo) => onRenameSubarea(idx, novo)}
              onDelete={() => onDeleteSubarea(idx)}
            />
          ))}
          {subareas.length === 0 && (
            <li className="text-xs text-slate-400 italic px-2">
              Nenhum assunto cadastrado. Clique em "+ Assunto" para adicionar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Componente: linha de subárea editável
// ──────────────────────────────────────────────

function SubareaRow({
  value,
  onRename,
  onDelete,
}: {
  value: string;
  onRename: (novo: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(value === "");
  const [input, setInput] = useState(value);

  const commit = () => {
    const v = input.trim();
    if (!v) {
      onDelete();
      return;
    }
    if (v !== value) onRename(v);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-2 group">
      <span className="text-slate-300 text-xs w-3">•</span>
      {editing ? (
        <input
          autoFocus
          className="flex-1 border rounded px-2 py-0.5 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              if (!value) onDelete();
              else {
                setInput(value);
                setEditing(false);
              }
            }
          }}
          placeholder="Nome do assunto..."
        />
      ) : (
        <span
          className="flex-1 text-sm text-slate-700 cursor-pointer hover:text-blue-600"
          onDoubleClick={() => setEditing(true)}
          title="Duplo clique para editar"
        >
          {value}
        </span>
      )}

      {!editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-1.5 py-0.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-1.5 py-0.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
            title="Remover"
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────

export default function AssuntosPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();

  const [disciplinaAtual, setDisciplinaAtual] = useState<string>(DISCIPLINAS[0]);
  const [nivelAtual, setNivelAtual] = useState<"fundamental" | "medio" | "superior">("medio");

  // Estado editável — estrutura completa NivelAreasMap por disciplina
  const [dados, setDados] = useState<DisciplinasData>(() => deepClone(BASE_DATA));

  const [jsonExportado, setJsonExportado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [remetente, setRemetente] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [statusEnvio, setStatusEnvio] = useState<"idle" | "ok" | "erro">("idle");

  // AreasMap do nível atual
  const currentAreasMap = (): AreasMap => dados[disciplinaAtual]?.[nivelAtual] ?? {};

  // Mutador: atualiza apenas o nível atual da disciplina atual
  const setAreas = useCallback(
    (updater: (prev: AreasMap) => AreasMap) => {
      setDados((d) => ({
        ...d,
        [disciplinaAtual]: {
          ...(d[disciplinaAtual] ?? {}),
          [nivelAtual]: updater(d[disciplinaAtual]?.[nivelAtual] ?? {}),
        },
      }));
      setJsonExportado(null);
    },
    [disciplinaAtual, nivelAtual]
  );

  const getAreas = (): [string, { subareas: string[] }][] =>
    Object.entries(currentAreasMap());

  const handleRenameArea = (oldName: string, newName: string) => {
    setAreas((prev) => {
      const entries = Object.entries(prev);
      const idx = entries.findIndex(([k]) => k === oldName);
      if (idx === -1) return prev;
      entries[idx] = [newName, entries[idx][1]];
      return Object.fromEntries(entries);
    });
  };

  const handleDeleteArea = (areaName: string) => {
    setAreas((prev) => {
      const next = { ...prev };
      delete next[areaName];
      return next;
    });
  };

  const handleAddArea = () => {
    const nome = prompt("Nome da nova área:")?.trim();
    if (!nome) return;
    setAreas((prev) =>
      prev[nome] ? prev : { ...prev, [nome]: { subareas: [] } }
    );
  };

  const handleAddSubarea = (areaName: string) => {
    setAreas((prev) => ({
      ...prev,
      [areaName]: {
        subareas: [...(prev[areaName]?.subareas ?? []), ""],
      },
    }));
  };

  const handleRenameSubarea = (areaName: string, idx: number, novo: string) => {
    setAreas((prev) => {
      const subs = [...(prev[areaName]?.subareas ?? [])];
      subs[idx] = novo;
      return { ...prev, [areaName]: { subareas: subs } };
    });
  };

  const handleDeleteSubarea = (areaName: string, idx: number) => {
    setAreas((prev) => {
      const subs = (prev[areaName]?.subareas ?? []).filter((_, i) => i !== idx);
      return { ...prev, [areaName]: { subareas: subs } };
    });
  };

  // ── Diff em relação ao original ───────────────

  const gerarDiff = (original: AreasMap, editado: AreasMap): string => {
    const lines: string[] = [];
    const areasOrig = Object.keys(original);
    const areasEdit = Object.keys(editado);
    const setOrig = new Set(areasOrig);
    const setEdit = new Set(areasEdit);

    for (const area of areasOrig) {
      if (!setEdit.has(area)) {
        lines.push(`- ÁREA REMOVIDA: ${area}`);
        for (const s of original[area].subareas) lines.push(`    - ${s}`);
      }
    }
    for (const area of areasEdit) {
      if (!setOrig.has(area)) {
        lines.push(`+ ÁREA ADICIONADA: ${area}`);
        for (const s of editado[area].subareas) lines.push(`    + ${s}`);
      }
    }
    for (const area of areasOrig) {
      if (!setEdit.has(area)) continue;
      const subsOrig = new Set(original[area].subareas.filter(s => s.trim()));
      const subsEdit = new Set(editado[area].subareas.filter(s => s.trim()));
      const removidos = [...subsOrig].filter(s => !subsEdit.has(s));
      const adicionados = [...subsEdit].filter(s => !subsOrig.has(s));
      if (removidos.length > 0 || adicionados.length > 0) {
        lines.push(`  ÁREA: ${area}`);
        for (const s of removidos) lines.push(`    - ${s}`);
        for (const s of adicionados) lines.push(`    + ${s}`);
      }
    }
    return lines.length > 0 ? lines.join("\n") : "(nenhuma alteração detectada)";
  };

  // ── Exportar JSON ─────────────────────────────

  const gerarJson = () => {
    const areasAtual = currentAreasMap();
    const clean: AreasMap = {};
    for (const [area, { subareas }] of Object.entries(areasAtual)) {
      const filtered = subareas.filter((s) => s.trim() !== "");
      if (area.trim()) clean[area.trim()] = { subareas: filtered };
    }
    setJsonExportado(
      JSON.stringify({ [disciplinaAtual]: { [nivelAtual]: clean } }, null, 2)
    );
    setCopiado(false);
  };

  const copiarJson = async () => {
    if (!jsonExportado) return;
    try {
      await navigator.clipboard.writeText(jsonExportado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      const ta = document.getElementById("json-output") as HTMLTextAreaElement | null;
      ta?.select();
    }
  };

  // ── Enviar JSON por email ──────────────────────

  const enviarPorEmail = async () => {
    if (!jsonExportado) return;
    setEnviando(true);
    setStatusEnvio("idle");
    try {
      const originalAreas = BASE_DATA[disciplinaAtual]?.[nivelAtual] ?? {};
      const editadoClean: AreasMap = {};
      for (const [area, { subareas }] of Object.entries(currentAreasMap())) {
        const filtered = subareas.filter((s) => s.trim() !== "");
        if (area.trim()) editadoClean[area.trim()] = { subareas: filtered };
      }
      const diff = gerarDiff(originalAreas, editadoClean);

      const res = await fetch(
        "https://mpfaraujo.com.br/guardafiguras/api/send-assuntos.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: jsonExportado,
            disciplina: disciplinaAtual,
            nivel: nivelAtual,
            remetente: remetente.trim(),
            diff,
          }),
        }
      );
      const data = await res.json();
      setStatusEnvio(data.success ? "ok" : "erro");
    } catch {
      setStatusEnvio("erro");
    } finally {
      setEnviando(false);
    }
  };

  // ── Gate de autenticação ──────────────────────

  if (loading) {
    return (
      <div className="pm-shell flex items-center justify-center">
        <span className="text-sm text-slate-400">Carregando...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="pm-shell flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-8 text-center pm-surface">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Editar Assuntos</h1>
          <p className="text-sm text-slate-500 mb-6">
            Você precisa estar logado para editar os assuntos.
          </p>
          <div className="flex justify-center">
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  // ── Tela principal ────────────────────────────

  const areas = getAreas();
  const niveisDisponiveis = NIVEIS.filter(n => BASE_DATA[disciplinaAtual]?.[n.value] !== undefined);

  return (
    <div className="pm-shell">
      <div className="max-w-5xl mx-auto py-6 px-4">
        {/* Cabeçalho */}
        <div className="mb-6">
          <div className="pm-topbar-dark pm-work-header">
            <button
              onClick={() => router.push("/minha-area")}
              className="mb-4 flex items-center gap-1.5 text-sm text-[#9eb4d1] transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Minha Área
            </button>
            <h1 className="pm-work-title text-white">Editar Assuntos por Disciplina</h1>
            <p className="pm-work-subtitle">
              Edite as áreas e assuntos de cada disciplina e nível. Ao terminar, clique em{" "}
              <strong className="text-white">Gerar JSON</strong> e envie para o administrador.
            </p>
          </div>
        </div>

        {/* Seletor de disciplina e nível */}
        <div className="mb-4 rounded-2xl p-5 pm-surface">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Disciplina
              </label>
              <select
                value={disciplinaAtual}
                onChange={(e) => {
                  setDisciplinaAtual(e.target.value);
                  setNivelAtual("medio");
                  setJsonExportado(null);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {DISCIPLINAS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Nível
              </label>
              <select
                value={nivelAtual}
                onChange={(e) => {
                  setNivelAtual(e.target.value as typeof nivelAtual);
                  setJsonExportado(null);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {niveisDisponiveis.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
                {/* Permite criar novo nível mesmo que não exista ainda */}
                {!niveisDisponiveis.find(n => n.value === nivelAtual) && (
                  <option value={nivelAtual}>
                    {NIVEIS.find(n => n.value === nivelAtual)?.label ?? nivelAtual}
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Áreas */}
        <div className="mb-4 rounded-2xl p-5 pm-surface">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Áreas de {disciplinaAtual} — {NIVEIS.find(n => n.value === nivelAtual)?.label}{" "}
              <span className="text-slate-400 font-normal">({areas.length} área(s))</span>
            </h2>
            <button
              onClick={handleAddArea}
              className="rounded-lg px-3 py-1.5 text-sm font-medium pm-accent-button"
            >
              + Nova área
            </button>
          </div>

          {areas.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              Nenhuma área cadastrada para este nível. Clique em "+ Nova área" para começar.
            </p>
          )}

          {areas.map(([areaName, { subareas }]) => (
            <AreaCard
              key={areaName}
              areaName={areaName}
              subareas={subareas}
              onRenameArea={(novo) => handleRenameArea(areaName, novo)}
              onDeleteArea={() => handleDeleteArea(areaName)}
              onAddSubarea={() => handleAddSubarea(areaName)}
              onRenameSubarea={(idx, novo) => handleRenameSubarea(areaName, idx, novo)}
              onDeleteSubarea={(idx) => handleDeleteSubarea(areaName, idx)}
            />
          ))}
        </div>

        {/* Exportar */}
        <div className="rounded-2xl p-5 pm-surface">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button
              onClick={gerarJson}
              className="rounded-lg px-4 py-2 text-sm font-medium pm-accent-button"
            >
              Gerar JSON
            </button>
            {jsonExportado && (
              <button
                onClick={copiarJson}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800"
              >
                {copiado ? "✓ Copiado!" : "Copiar"}
              </button>
            )}
          </div>

          {jsonExportado && (
            <>
              <textarea
                id="json-output"
                readOnly
                value={jsonExportado}
                rows={14}
                className="w-full font-mono text-xs border rounded-lg p-3 bg-slate-50 focus:outline-none resize-none mb-4"
              />

              {/* Envio por email */}
              <div className="border-t pt-4">
                <p className="text-xs text-slate-500 mb-3">
                  Envie diretamente para o administrador atualizar o arquivo:
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Seu nome (opcional)"
                    value={remetente}
                    onChange={(e) => setRemetente(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
                  />
                  <button
                    onClick={enviarPorEmail}
                    disabled={enviando}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {enviando ? "Enviando..." : "Enviar para o administrador"}
                  </button>
                  {statusEnvio === "ok" && (
                    <span className="text-sm text-emerald-600 font-medium">✓ Enviado com sucesso!</span>
                  )}
                  {statusEnvio === "erro" && (
                    <span className="text-sm text-red-600">Falha ao enviar. Copie o JSON manualmente.</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Instruções */}
        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p>• <strong>Duplo clique</strong> no nome de uma área ou assunto para renomear.</p>
          <p>• Assuntos em branco são ignorados ao gerar o JSON.</p>
          <p>• As alterações ficam apenas nesta sessão — gere e envie o JSON para salvar permanentemente.</p>
          <p>• O JSON gerado inclui a disciplina, o nível selecionado e as áreas editadas.</p>
        </div>
      </div>
    </div>
  );
}
