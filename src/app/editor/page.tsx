"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { parseYamlMeta, generateYamlTemplate, type YamlItemMeta } from "@/lib/yamlMeta";
import type { QuestionMetadataV1 } from "@/components/editor/QuestionMetaBar";
import { Button } from "@/components/ui/button";
import { ArrowRight, SkipForward, Copy, Check, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Step = "yaml" | "editor";

/** Monta o JSON de um doc set_questions com N question_items pré-preenchidos */
function buildSetQuestionsDoc(items: YamlItemMeta[], tipo?: string): object {
  const emptyPara = { type: "paragraph", attrs: { textAlign: null } };
  const isTF = tipo === "Certo/Errado";
  const isEssay = tipo === "Discursiva";

  const optionLetters = isTF ? ["C", "E"] : ["A", "B", "C", "D", "E"];
  const defaultOptions = isEssay ? null : {
    type: "options",
    content: optionLetters.map((letter) => ({
      type: "option",
      attrs: { letter },
      content: [emptyPara],
    })),
  };

  const questionItems = items.map((item) => ({
    type: "question_item",
    attrs: {
      answerKey: item.gabarito ?? null,
      assunto: item.assunto ?? null,
      tags: item.tags ?? null,
    },
    content: [
      { type: "statement", content: [emptyPara] },
      ...(defaultOptions ? [defaultOptions] : []),
    ],
  }));

  return {
    type: "doc",
    content: [{
      type: "set_questions",
      attrs: { mode: isEssay ? "essay" : null },
      content: [
        { type: "base_text", content: [emptyPara] },
        ...questionItems,
      ],
    }],
  };
}

function EditorContent() {
  const searchParams = useSearchParams();
  const skipYaml = searchParams.get("skipYaml") === "1";

  const [step, setStep] = useState<Step>(skipYaml ? "editor" : "yaml");
  const [yamlText, setYamlText] = useState("");
  const [initialMeta, setInitialMeta] =
    useState<Partial<QuestionMetadataV1> | null>(null);
  const [initialContent, setInitialContent] = useState<object | null>(null);
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
    if (parsed?.items?.length) {
      setInitialContent(buildSetQuestionsDoc(parsed.items, parsed.tipo));
    } else {
      setInitialContent(null);
    }
    setStep("editor");
  };

  const handleSkip = () => {
    setInitialMeta(null);
    setInitialContent(null);
    setStep("editor");
  };

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "editor") {
    return (
      <div className="min-h-screen bg-[#070B1D] py-6">
        <div className="pm-shell-inner animate-fade-in-up">
          <div className="mb-5">
            <div className="pm-topbar-dark flex items-start gap-5 px-5 py-4">
              <div className="shrink-0">
                <Link
                  href="/minha-area"
                  className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-[#9eb4d1] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Minha Área
                </Link>
              </div>
              <div className="min-w-0">
                <h1 className="pm-work-title">
                  Editor de Questões
                </h1>
              </div>
            </div>
          </div>
          <QuestionEditor
            initial={
              initialMeta
                ? {
                    metadata: initialMeta as QuestionMetadataV1,
                    content: initialContent ?? undefined,
                  }
                : undefined
            }
            onNewRequest={() => {
              setYamlText("");
              setInitialMeta(null);
              setInitialContent(null);
              setStep("yaml");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B1D]">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="mx-auto max-w-5xl animate-fade-in-up pm-topbar-dark px-5 py-4">
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              <Link
                href="/minha-area"
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-[#9eb4d1] transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Minha Área
              </Link>
            </div>
            <div className="min-w-0">
              <h1 className="text-[2rem] font-bold leading-tight text-white">
                Nova Questão
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-[#9eb4d1]">
                Preencha as informações da questão no modelo abaixo e cole aqui, ou
                pule direto para o editor.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 space-y-5 animate-fade-in-up">
        {/* Botão copiar modelo */}
        <div className="pm-surface rounded-2xl px-5 py-4 flex items-center justify-between">
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
          className="w-full h-72 rounded-2xl border border-slate-300 bg-white text-slate-800 font-mono text-sm p-4 resize-y placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
          spellCheck={false}
        />

        {/* Preview dos campos parseados */}
        {yamlText.trim() && (
          <div className="pm-surface pm-surface-accent p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {parsed ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              {parsed
                ? parsed.items?.length
                  ? `Conjunto de questões reconhecido (${parsed.items.length} ${parsed.items.length === 1 ? "item" : "itens"})`
                  : "Campos reconhecidos"
                : "Não foi possível ler os campos — verifique se o texto começa e termina com ---"}
            </h3>
            {parsed && (
              <>
                {/* Campos compartilhados */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {parsed.tipo && <Field label="Tipo" value={parsed.tipo} />}
                  {parsed.dificuldade && (
                    <Field label="Dificuldade" value={parsed.dificuldade} />
                  )}
                  {parsed.disciplina && (
                    <Field label="Disciplina" value={parsed.disciplina} />
                  )}
                  {/* assunto/gabarito/tags só em questão individual */}
                  {!parsed.items?.length && parsed.assunto && (
                    <Field label="Assunto" value={parsed.assunto} />
                  )}
                  {!parsed.items?.length && parsed.gabarito && (
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
                  {!parsed.items?.length && parsed.tags && parsed.tags.length > 0 && (
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

                {/* Itens do conjunto */}
                {parsed.items && parsed.items.length > 0 && (
                  <div className="space-y-1 border-t pt-2">
                    {parsed.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm border-l-2 border-slate-300 pl-2">
                        <span className="col-span-2 text-xs text-muted-foreground font-medium">Item {idx + 1}</span>
                        {item.assunto && <Field label="Assunto" value={item.assunto} />}
                        {item.tags && item.tags.length > 0 && <Field label="Tags" value={item.tags.join(", ")} />}
                        {item.gabarito && (
                          <Field
                            label="Gabarito"
                            value={
                              item.gabarito.kind === "mcq"
                                ? item.gabarito.correct
                                : item.gabarito.kind === "tf"
                                  ? item.gabarito.correct
                                  : "Discursiva"
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
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
            className="gap-2 btn-primary"
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
