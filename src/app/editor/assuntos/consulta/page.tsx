"use client";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import "../../library-workspace.css";

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

function ConsultaAssuntosContent() {
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
    <main className="library-page">
      <header className="library-heading-wrap">
        <div className="library-heading">
          <div>
            <h1 className="library-heading-title">
              Assuntos por Disciplina
            </h1>
            <p className="library-help">
              Referência para preencher o campo{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs text-slate-700">assunto:</code>{" "}
              do modelo de informações.
            </p>
          </div>
          <button
            onClick={() => window.close()}
            aria-label="Fechar aba de consulta"
            title="Fechar aba"
            className="library-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="library-content">
        {/* Seletor de disciplina e nível */}
        <div className="library-consult-selectors">
          <select
            aria-label="Disciplina"
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            aria-label="Nível de ensino"
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
          <div className="library-consult-grid">
            {areas.map(([area, { subareas }]) => (
              <div key={area} className="library-area-block">
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
                        className="library-copy-button"
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

export default function ConsultaAssuntosPage() {
  return <WorkspaceShell section="area" title="Consultar assuntos"><ConsultaAssuntosContent /></WorkspaceShell>;
}
