// src/app/demo-headers/page.tsx

"use client";

import { useState } from "react";
import { ProvaHeader } from "@/components/prova/headers/ProvaHeader";
import { ProvaHeaderLayout1 } from "@/components/prova/headers/ProvaHeaderLayout1";
import { ProvaHeaderLayout2 } from "@/components/prova/headers/ProvaHeaderLayout2";
import { ProvaHeaderLayout3 } from "@/components/prova/headers/ProvaHeaderLayout3";
import { ProvaHeaderLayout4 } from "@/components/prova/headers/ProvaHeaderLayout4";
import { ProvaHeaderLayout5 } from "@/components/prova/headers/ProvaHeaderLayout5";
import { ProvaHeaderLayout6 } from "@/components/prova/headers/ProvaHeaderLayout6";
import { ProvaHeaderLayout7 } from "@/components/prova/headers/ProvaHeaderLayout7";
import { ProvaHeaderLayout8 } from "@/components/prova/headers/ProvaHeaderLayout8";
import { ProvaHeaderLayout9 } from "@/components/prova/headers/ProvaHeaderLayout9";
import { ProvaHeaderLayout10 } from "@/components/prova/headers/ProvaHeaderLayout10";

const dadosMock = {
  logoUrl: null,
  nome: "João da Silva Santos",
  turma: "3º A",
  professor: "Maria Oliveira",
  disciplina: "Matemática",
  data: "2025-02-04",
  nota: "10,0",
  onLogoClick: () => alert("Click na logo"),
};

export default function DemoHeadersPage() {
  const [layoutAtivo, setLayoutAtivo] = useState<string>("original");

  const layouts = [
    { id: "original", nome: "Layout Original", component: ProvaHeader },
    { id: "layout1", nome: "Layout 1 - Sidebar", component: ProvaHeaderLayout1 },
    { id: "layout2", nome: "Layout 2 - Grid Simétrico", component: ProvaHeaderLayout2 },
    { id: "layout3", nome: "Layout 3 - Duas Colunas", component: ProvaHeaderLayout3 },
    { id: "layout4", nome: "Layout 4 - Minimalista", component: ProvaHeaderLayout4 },
    { id: "layout5", nome: "Layout 5 - Agrupado", component: ProvaHeaderLayout5 },
    { id: "layout6", nome: "Layout 6 - Com Linhas", component: ProvaHeaderLayout6 },
    { id: "layout7", nome: "Layout 7 - Centralizado", component: ProvaHeaderLayout7 },
    { id: "layout8", nome: "Layout 8 - Com Ícones", component: ProvaHeaderLayout8 },
    { id: "layout9", nome: "Layout 9 - Moderno", component: ProvaHeaderLayout9 },
    { id: "layout10", nome: "Layout 10 - Completo", component: ProvaHeaderLayout10 }
  ];

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
          <div className="border-4 border-gray-200 p-4">
            {layoutAtivo === "original" && <ProvaHeader {...dadosMock} />}
            {layoutAtivo === "layout1" && <ProvaHeaderLayout1 {...dadosMock} />}
            {layoutAtivo === "layout2" && <ProvaHeaderLayout2 {...dadosMock} />}
            {layoutAtivo === "layout3" && <ProvaHeaderLayout3 {...dadosMock} />}
            {layoutAtivo === "layout4" && <ProvaHeaderLayout4 {...dadosMock} />}
            {layoutAtivo === "layout5" && <ProvaHeaderLayout5 {...dadosMock} />}
            {layoutAtivo === "layout6" && <ProvaHeaderLayout6 {...dadosMock} />}
            {layoutAtivo === "layout7" && <ProvaHeaderLayout7 {...dadosMock} />}
            {layoutAtivo === "layout8" && <ProvaHeaderLayout8 {...dadosMock} />}
            {layoutAtivo === "layout9" && <ProvaHeaderLayout9 {...dadosMock} />}
            {layoutAtivo === "layout10" && <ProvaHeaderLayout10 {...dadosMock} />}
          </div>
        </div>

        {/* Comparação Todos os Layouts */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            Comparação - Todos os Layouts
          </h2>
          <div className="space-y-8">
            {layouts.map((layout) => {
              const Component = layout.component;
              return (
                <div key={layout.id} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold mb-4 text-gray-700">
                    {layout.nome}
                  </h3>
                  <div className="border-2 border-gray-200 p-4">
                    <Component {...dadosMock} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
