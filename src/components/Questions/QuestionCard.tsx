"use client";

import { useState } from "react";
import QuestionRenderer from "./QuestionRenderer";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type QuestionCardProps = {
  metadata: {
    id: string;
    disciplina?: string;
    assunto?: string;
    dificuldade?: string;
    tipo?: string;
    source?: { kind?: string };
    tags?: string[];

    gabarito?: {
      kind: "mcq" | "tf" | "essay";
      correct?: string;
      rubric?: string;
    };
  };

  content: any; // ativo
  base?: {
    metadata?: any;
    content?: any;
  };

  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;

  variantsCount?: number;
  active?: { kind: "base" | "variant"; id: string };
};

function Dot({ className, title }: { className: string; title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`h-2.5 w-2.5 rounded-full ring-1 ring-border ${className}`}
    />
  );
}

export default function QuestionCard({
  metadata,
  content,
  base,
  selected = false,
  onSelect,
  variantsCount = 0,
  active,
}: QuestionCardProps) {
  const isEdited = variantsCount > 0;
  const hasBase = !!base?.content;

  const [view, setView] = useState<"active" | "base">("active");

  const isShowingVariant = active?.kind === "variant" && view === "active";

  const renderedContent =
    view === "base" && hasBase ? base!.content : content;

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Dot
              className={isEdited ? "bg-amber-400" : "bg-slate-300"}
              title={
                isEdited
                  ? `Editada (${variantsCount} variante${variantsCount === 1 ? "" : "s"})`
                  : "Original"
              }
            />

            {isShowingVariant && (
              <Dot
                className="bg-blue-500"
                title="Variante ativa (exibindo variante)"
              />
            )}

            {isEdited && (
              <span className="text-[11px] text-muted-foreground">
                {variantsCount} variante{variantsCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {metadata.disciplina && <div>{metadata.disciplina}</div>}
            {metadata.assunto && <div>{metadata.assunto}</div>}

            {metadata.gabarito &&
              (() => {
                const g = metadata.gabarito;
                if (g.kind === "mcq") return <div>Gabarito: {g.correct}</div>;
                if (g.kind === "tf")
                  return <div>Gabarito: {g.correct === "C" ? "Certo" : "Errado"}</div>;
                if (g.kind === "essay") return <div>Gabarito: Discursiva</div>;
                return null;
              })()}

            {metadata.dificuldade && <div>Dificuldade: {metadata.dificuldade}</div>}
            {metadata.source?.kind && <div>Origem: {metadata.source.kind}</div>}
            {metadata.tags && metadata.tags.length > 0 && (
              <div>Tags: {metadata.tags.join(", ")}</div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {hasBase && isEdited && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setView((v) => (v === "active" ? "base" : "active"))
              }
            >
              {view === "active" ? "Ver original" : "Ver editada"}
            </Button>
          )}

          {onSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelect(metadata.id, v === true)}
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-semibold">Questão</span>
        <span className="font-mono text-sm text-muted-foreground break-all">
          {metadata.id}:
        </span>
      </div>

      {/* Conteúdo */}
      <div className="print-mode">
        <QuestionRenderer content={renderedContent} />
      </div>
    </div>
  );
}
