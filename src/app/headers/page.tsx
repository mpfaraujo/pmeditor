// src/app/demo-headers/page.tsx

"use client";

import { useState } from "react";
import { ProvaHeader } from "@/components/prova/headers/ProvaHeader";

const dadosMock = {
  logoUrl: null,
  nome: "João da Silva Santos",
  turma: "3º A",
  professor: "Maria Oliveira",
  disciplina: "Matemática",
  data: "2025-02-04",
  nota: "10,0",
  instituicao: "Instituição Exemplo",
  onLogoClick: () => alert("Click na logo"),
};

const LAYOUT_NOMES: Record<number, string> = {
  0: "Layout Original",
  1: "Layout 1 - Sidebar",
  2: "Layout 2 - Grid Simétrico",
  3: "Layout 3 - Duas Colunas",
  4: "Layout 4 - Minimalista",
  5: "Layout 5 - Agrupado",
  6: "Layout 6 - Com Linhas",
  7: "Layout 7 - Centralizado",
  8: "Layout 8 - Com Ícones",
  9: "Layout 9 - Moderno",
  10: "Layout 10 - Completo",
};

export default function DemoHeadersPage() {
  const [layoutAtivo, setLayoutAtivo] = useState<number>(0);

  const layouts = Array.from({ length: 11 }, (_, i) => ({ id: i, nome: LAYOUT_NOMES[i] }));

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">
          Layouts de Cabeçalho - Demo
        </h1>

        {/* Seletor de Layout */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">
            Selecione um layout:
          </h2>
          <div className="flex flex-wrap gap-2">
            {layouts.map((layout) => (
              <button
                key={layout.id}
                onClick={() => setLayoutAtivo(layout.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  layoutAtivo === layout.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {layout.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Preview do Layout Selecionado */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-700">
            {layouts.find((l) => l.id === layoutAtivo)?.nome}
          </h2>
          <div className="border-4 border-gray-200 p-4 overflow-x-auto">
            <div style={{ minWidth: "18cm" }}>
              <ProvaHeader layout={layoutAtivo} {...dadosMock} />
            </div>
          </div>
        </div>

        {/* Comparação Todos os Layouts */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            Comparação - Todos os Layouts
          </h2>
          <div className="space-y-8">
            {layouts.map((layout) => (
              <div key={layout.id} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-700">
                  {layout.nome}
                </h3>
                <div className="border-2 border-gray-200 p-4 overflow-x-auto">
                  <div style={{ minWidth: "18cm" }}>
                    <ProvaHeader layout={layout.id} {...dadosMock} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
