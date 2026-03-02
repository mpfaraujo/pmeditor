"use client";

import { useState } from "react";
import disciplinasJson from "@/data/disciplinas_areas.json";

type AreasMap = Record<string, { subareas: string[] }>;
type NivelAreasMap = Partial<Record<"fundamental" | "medio" | "superior", AreasMap>>;

const DADOS = disciplinasJson as Record<string, NivelAreasMap>;
const DISCIPLINAS = Object.keys(DADOS);
const NIVEIS = [
  { value: "fundamental", label: "Fundamental" },
  { value: "medio",       label: "Médio" },
  { value: "superior",    label: "Superior" },
] as const;

export default function ConsultaAssuntosPage() {
  const [disciplina, setDisciplina] = useState(DISCIPLINAS[0]);
  const [nivel, setNivel] = useState<"fundamental" | "medio" | "superior">("medio");
  const [copiado, setCopiado] = useState<string | null>(null);

  const nivelMap = DADOS[disciplina];
  const areasMap: AreasMap = nivelMap?.[nivel] ?? nivelMap?.["medio"] ?? {};
  const areas = Object.entries(areasMap);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      /* ignora */
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          Assuntos por Disciplina
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Copie o nome exato do assunto para usar no campo{" "}
          <code className="bg-slate-100 px-1 rounded font-mono text-xs">assunto:</code>{" "}
          do modelo de informações.
        </p>

        {/* Seletor de disciplina e nível */}
        <div className="flex gap-3 mb-6">
          <select
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as typeof nivel)}
            className="w-36 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {NIVEIS.filter(n => nivelMap?.[n.value]).map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>

        {/* Áreas e assuntos */}
        {areas.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Nenhum assunto cadastrado para este nível.
          </p>
        ) : (
          <div className="space-y-4">
            {areas.map(([area, { subareas }]) => (
              <div key={area} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 border-b">
                  <span className="text-sm font-semibold text-slate-700">{area}</span>
                </div>
                <ul className="divide-y">
                  {subareas.map((s) => (
                    <li
                      key={s}
                      className="flex items-center justify-between px-4 py-2 group hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">{s}</span>
                      <button
                        onClick={() => copiar(s)}
                        className="text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      >
                        {copiado === s ? "✓ Copiado" : "Copiar"}
                      </button>
                    </li>
                  ))}
                  {subareas.length === 0 && (
                    <li className="px-4 py-2 text-xs text-slate-400 italic">
                      Nenhum assunto cadastrado.
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
