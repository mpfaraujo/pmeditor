"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { generateYamlTemplate, generateYamlSetTemplate } from "@/lib/yamlMeta";

type Tab = "individual" | "conjunto";

export default function TemplatePage() {
  const [tab, setTab] = useState<Tab>("individual");
  const [copied, setCopied] = useState(false);
  const template = generateYamlTemplate();
  const setTemplate = generateYamlSetTemplate();

  const activeTemplate = tab === "individual" ? template : setTemplate;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="pm-shell">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="mx-auto max-w-5xl px-6 py-5 animate-fade-in-up pm-topbar-dark">
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-sm text-[#9eb4d1] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">
            Modelo de Informações da Questão
          </h1>
          <p className="mt-1 text-sm text-[#9eb4d1]">
            Copie o modelo abaixo, preencha num editor de texto e cole ao criar
            a questão.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 animate-fade-in-up">
        {/* Template com tabs */}
        <div className="relative overflow-hidden rounded-2xl pm-surface pm-surface-accent">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b bg-slate-50/80 px-4 py-3">
            <div className="flex gap-1">
              <button
                onClick={() => { setTab("individual"); setCopied(false); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  tab === "individual"
                    ? "border border-[#FBC02D]/40 bg-[#FFF4CC] text-[#3A2C00] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Questão individual
              </button>
              <button
                onClick={() => { setTab("conjunto"); setCopied(false); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  tab === "conjunto"
                    ? "border border-[#FBC02D]/40 bg-[#FFF4CC] text-[#3A2C00] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Conjunto de questões
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar modelo
                </>
              )}
            </Button>
          </div>
          <pre className="p-4 text-sm leading-relaxed overflow-x-auto font-mono whitespace-pre text-slate-700">
            {activeTemplate}
          </pre>
        </div>

        {/* Instruções */}
        <div className="pm-surface rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Como usar</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Copie</strong> o modelo acima clicando em &quot;Copiar
              modelo&quot;.
            </li>
            <li>
              <strong>Edite</strong> os campos no Bloco de Notas, VS Code ou
              qualquer editor de texto.
            </li>
            <li>
              Vá para o{" "}
              <Link href="/editor" className="text-blue-600 underline">
                editor de questões
              </Link>{" "}
              e <strong>cole</strong> o texto preenchido na área indicada.
            </li>
            <li>
              Clique em <strong>&quot;Continuar&quot;</strong> — as informações
              já estarão preenchidas no editor.
            </li>
          </ol>

          <div className="pt-2 space-y-3 text-sm">
            <h3 className="font-semibold text-base">Campos</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1.5 pr-4 font-medium">Campo</th>
                  <th className="py-1.5 font-medium">Valores aceitos</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">tipo</td>
                  <td className="py-1.5">
                    Múltipla Escolha, Certo/Errado, Discursiva
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">dificuldade</td>
                  <td className="py-1.5">Fácil, Média, Difícil</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">disciplina<br/>assunto</td>
                  <td className="py-1.5">
                    Use os nomes exatos da{" "}
                    <Link href="/editor/assuntos/consulta" className="text-blue-600 underline" target="_blank">
                      lista de assuntos por disciplina
                    </Link>
                    {" "}para evitar erros de cadastro.
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">gabarito</td>
                  <td className="py-1.5">
                    Letra: A–E ou C/E (deixe vazio se for discursiva)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">tags</td>
                  <td className="py-1.5">Palavras-chave livres que não cabem nos outros campos (não use aqui: banca, ano, assunto)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">fonte</td>
                  <td className="py-1.5">
                    original ou concurso (preencha os demais campos se concurso)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">gabarito<em>N</em></td>
                  <td className="py-1.5">
                    Gabarito do item N (apenas conjunto — ex: gabarito1, gabarito2)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">assunto<em>N</em></td>
                  <td className="py-1.5">
                    Assunto do item N (apenas conjunto — ex: assunto1, assunto2)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Link href="/editor">
            <Button size="lg" className="gap-2 pm-accent-button">
              Ir para o editor <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
