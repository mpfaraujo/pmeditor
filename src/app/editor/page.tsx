"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { parseYamlMeta, generateYamlTemplate } from "@/lib/yamlMeta";
import type { QuestionMetadataV1 } from "@/components/editor/QuestionMetaBar";
import { Button } from "@/components/ui/button";
import { ArrowRight, SkipForward, Copy, Check, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Step = "yaml" | "editor";

function EditorContent() {
  const searchParams = useSearchParams();
  const skipYaml = searchParams.get("skipYaml") === "1";

  const [step, setStep] = useState<Step>(skipYaml ? "editor" : "yaml");
  const [yamlText, setYamlText] = useState("");
  const [initialMeta, setInitialMeta] =
    useState<Partial<QuestionMetadataV1> | null>(null);
  const [copied, setCopied] = useState(false);

  // Ler metadados do sessionStorage (vindo do Minha Área)
  useEffect(() => {
    if (!skipYaml) return;
    try {
      const stored = sessionStorage.getItem("pm_yaml_meta");
      if (stored) {
        setInitialMeta(JSON.parse(stored));
        sessionStorage.removeItem("pm_yaml_meta");
      }
    } catch {}
  }, [skipYaml]);

  const template = generateYamlTemplate();

  const parsed = useMemo(() => {
    if (!yamlText.trim()) return null;
    return parseYamlMeta(yamlText);
  }, [yamlText]);

  const handleContinue = () => {
    setInitialMeta(parsed);
    setStep("editor");
  };

  const handleSkip = () => {
    setInitialMeta(null);
    setStep("editor");
  };

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "editor") {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto">
          <div className="mb-8">
            <Link
              href="/minha-area"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Minha Área
            </Link>
            <h1 className="text-3xl font-bold text-center">
              Editor de Questões
            </h1>
          </div>
          <QuestionEditor
            initial={
              initialMeta
                ? {
                    metadata: initialMeta as QuestionMetadataV1,
                    content: undefined as any,
                  }
                : undefined
            }
            onNewRequest={() => {
              setYamlText("");
              setInitialMeta(null);
              setStep("yaml");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            href="/minha-area"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Minha Área
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nova Questão
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha as informações da questão no modelo abaixo e cole aqui, ou
            pule direto para o editor.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Botão copiar modelo */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Primeira vez? Copie o modelo, preencha no Bloco de Notas e cole
            abaixo.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTemplate}
            className="gap-1.5 shrink-0"
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

        {/* Textarea */}
        <textarea
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          placeholder={template}
          className="w-full h-72 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-sm p-4 resize-y placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          spellCheck={false}
        />

        {/* Preview dos campos parseados */}
        {yamlText.trim() && (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {parsed ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              {parsed
                ? "Campos reconhecidos"
                : "Não foi possível ler os campos — verifique se o texto começa e termina com ---"}
            </h3>
            {parsed && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {parsed.tipo && <Field label="Tipo" value={parsed.tipo} />}
                {parsed.dificuldade && (
                  <Field label="Dificuldade" value={parsed.dificuldade} />
                )}
                {parsed.disciplina && (
                  <Field label="Disciplina" value={parsed.disciplina} />
                )}
                {parsed.assunto && (
                  <Field label="Assunto" value={parsed.assunto} />
                )}
                {parsed.gabarito && (
                  <Field
                    label="Gabarito"
                    value={
                      parsed.gabarito.kind === "mcq"
                        ? parsed.gabarito.correct
                        : parsed.gabarito.kind === "tf"
                          ? parsed.gabarito.correct
                          : "Discursiva"
                    }
                  />
                )}
                {parsed.tags && parsed.tags.length > 0 && (
                  <Field label="Tags" value={parsed.tags.join(", ")} />
                )}
                {parsed.source?.kind && (
                  <Field label="Fonte" value={parsed.source.kind} />
                )}
                {parsed.source?.concurso && (
                  <Field label="Concurso" value={parsed.source.concurso} />
                )}
                {parsed.source?.banca && (
                  <Field label="Banca" value={parsed.source.banca} />
                )}
                {parsed.source?.ano && (
                  <Field label="Ano" value={String(parsed.source.ano)} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleSkip} className="gap-2">
            <SkipForward className="h-4 w-4" />
            Pular
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!parsed}
            className="gap-2"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-slate-400">Carregando...</div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </>
  );
}
