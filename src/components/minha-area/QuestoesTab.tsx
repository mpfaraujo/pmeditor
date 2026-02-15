"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  PlusCircle,
  Copy,
  Check,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { parseYamlMeta, generateYamlTemplate } from "@/lib/yamlMeta";

export function QuestoesTab() {
  const router = useRouter();
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlText, setYamlText] = useState("");
  const [copied, setCopied] = useState(false);

  const template = generateYamlTemplate();

  const parsed = useMemo(() => {
    if (!yamlText.trim()) return null;
    return parseYamlMeta(yamlText);
  }, [yamlText]);

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEditor = () => {
    if (parsed) {
      sessionStorage.setItem("pm_yaml_meta", JSON.stringify(parsed));
    }
    router.push("/editor?skipYaml=1");
  };

  const handleOpenEditorBlank = () => {
    router.push("/editor?skipYaml=1");
  };

  return (
    <div className="space-y-4">
      {/* Estado vazio */}
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-500">
            Nenhuma questão criada
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Suas questões salvas aparecerão aqui.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={handleOpenEditorBlank} variant="outline" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Nova Questão em Branco
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setYamlOpen(!yamlOpen)}
              className="gap-1.5 text-muted-foreground"
            >
              {yamlOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Preencher informações antes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção YAML colapsável */}
      {yamlOpen && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Cole o modelo preenchido ou edite diretamente abaixo.
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

            <textarea
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              placeholder={template}
              className="w-full h-56 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-sm p-4 resize-y placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />

            {/* Preview dos campos */}
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
                    : "Não foi possível ler — verifique se o texto começa e termina com ---"}
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

            {/* Botão continuar */}
            <div className="flex justify-end">
              <Button
                onClick={handleOpenEditor}
                disabled={yamlText.trim() !== "" && !parsed}
                className="gap-2"
              >
                Abrir Editor <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
