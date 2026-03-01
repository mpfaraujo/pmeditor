"use client";

import { useState, useCallback } from "react";
import disciplinasJson from "@/data/disciplinas_areas.json";
import matematicaJson from "@/data/matematica_areas.json";

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

type AreasMap = Record<string, { subareas: string[] }>;
type DisciplinasData = Record<string, AreasMap>;

// ──────────────────────────────────────────────
// Dados base (deep clone para edição)
// ──────────────────────────────────────────────

const BASE_DATA: DisciplinasData = {
  Matemática: matematicaJson as AreasMap,
  ...(disciplinasJson as DisciplinasData),
};

const DISCIPLINAS = Object.keys(BASE_DATA);

const CODIGO_ACESSO = "assuntos2024";

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
    <div className="border rounded-lg mb-3 overflow-hidden bg-white shadow-sm">
      {/* Cabeçalho da área */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b">
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
          className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
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
  const [codigo, setCodigo] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [erroLogin, setErroLogin] = useState(false);

  // Disciplina selecionada
  const [disciplinaAtual, setDisciplinaAtual] = useState<string>(DISCIPLINAS[0]);

  // Estado editável — um AreasMap por disciplina (lazy: carrega ao entrar)
  const [dados, setDados] = useState<DisciplinasData>(() => deepClone(BASE_DATA));

  // JSON exportado
  const [jsonExportado, setJsonExportado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // ── Autenticação ──────────────────────────────

  const handleLogin = () => {
    if (codigo.trim() === CODIGO_ACESSO) {
      setAutenticado(true);
      setErroLogin(false);
    } else {
      setErroLogin(true);
    }
  };

  // ── Mutadores ─────────────────────────────────

  const getAreas = (): [string, { subareas: string[] }][] =>
    Object.entries(dados[disciplinaAtual] ?? {});

  const setAreas = useCallback(
    (updater: (prev: AreasMap) => AreasMap) => {
      setDados((d) => ({
        ...d,
        [disciplinaAtual]: updater(d[disciplinaAtual] ?? {}),
      }));
      setJsonExportado(null);
    },
    [disciplinaAtual]
  );

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

  // ── Exportar JSON ─────────────────────────────

  const gerarJson = () => {
    const disciplinaData = dados[disciplinaAtual] ?? {};
    // Filtra subareas vazias
    const clean: AreasMap = {};
    for (const [area, { subareas }] of Object.entries(disciplinaData)) {
      const filtered = subareas.filter((s) => s.trim() !== "");
      if (area.trim()) clean[area.trim()] = { subareas: filtered };
    }
    setJsonExportado(JSON.stringify({ [disciplinaAtual]: clean }, null, 2));
    setCopiado(false);
  };

  const copiarJson = async () => {
    if (!jsonExportado) return;
    try {
      await navigator.clipboard.writeText(jsonExportado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // fallback: selecionar textarea
      const ta = document.getElementById("json-output") as HTMLTextAreaElement | null;
      ta?.select();
    }
  };

  // ── Tela de login ─────────────────────────────

  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Editar Assuntos</h1>
          <p className="text-sm text-slate-500 mb-6">
            Digite o código de acesso para continuar.
          </p>
          <input
            type="password"
            autoFocus
            suppressHydrationWarning
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Código de acesso"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {erroLogin && (
            <p className="text-xs text-red-500 mb-3">Código incorreto. Tente novamente.</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  // ── Tela principal ────────────────────────────

  const areas = getAreas();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Cabeçalho */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Editar Assuntos por Disciplina</h1>
          <p className="text-sm text-slate-500 mt-1">
            Edite as áreas e assuntos de cada disciplina. Ao terminar, clique em{" "}
            <strong>Gerar JSON</strong> e envie o resultado para o administrador.
          </p>
        </div>

        {/* Seletor de disciplina */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Disciplina
          </label>
          <select
            value={disciplinaAtual}
            onChange={(e) => {
              setDisciplinaAtual(e.target.value);
              setJsonExportado(null);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Áreas */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Áreas de {disciplinaAtual}{" "}
              <span className="text-slate-400 font-normal">({areas.length} área(s))</span>
            </h2>
            <button
              onClick={handleAddArea}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            >
              + Nova área
            </button>
          </div>

          {areas.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              Nenhuma área cadastrada. Clique em "+ Nova área" para começar.
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
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={gerarJson}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
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
            {jsonExportado && (
              <span className="text-xs text-slate-400">
                Envie este JSON para o administrador atualizar o arquivo.
              </span>
            )}
          </div>

          {jsonExportado && (
            <textarea
              id="json-output"
              readOnly
              value={jsonExportado}
              rows={14}
              className="w-full font-mono text-xs border rounded-lg p-3 bg-slate-50 focus:outline-none resize-none"
            />
          )}
        </div>

        {/* Instruções */}
        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p>• <strong>Duplo clique</strong> no nome de uma área ou assunto para renomear.</p>
          <p>• Assuntos em branco são ignorados ao gerar o JSON.</p>
          <p>• As alterações ficam apenas nesta sessão — gere e envie o JSON para salvar permanentemente.</p>
        </div>
      </div>
    </div>
  );
}
