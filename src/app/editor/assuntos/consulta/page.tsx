"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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
    <main className="pm-shell">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-start justify-between animate-fade-in-up pm-topbar-dark">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Assuntos por Disciplina
            </h1>
            <p className="mt-0.5 text-sm text-[#9eb4d1]">
              Referência para preencher o campo{" "}
              <code className="rounded bg-white/10 px-1 font-mono text-xs text-white">assunto:</code>{" "}
              do modelo de informações.
            </p>
          </div>
          <button
            onClick={() => window.close()}
            title="Fechar aba"
            className="mt-0.5 shrink-0 rounded-md p-1.5 text-[#9eb4d1] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in-up">
        {/* Seletor de disciplina e nível */}
        <div className="mb-6 flex gap-3 rounded-2xl pm-surface p-4">
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
              <div key={area} className="overflow-hidden rounded-2xl pm-surface">
                <div className="border-b bg-slate-50/80 px-4 py-3">
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

        <p className="mt-8 text-center text-xs text-slate-400">
          Feche esta aba quando terminar.{" "}
          <Link href="/dashboard" className="underline hover:text-slate-600">
            Ir para o Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
