// src/Components/Questions/QuestionCard.tsx
"use client";

import QuestionRenderer from "./QuestionRenderer";
import { Checkbox } from "@/components/ui/checkbox";

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
  content: any;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
};

export default function QuestionCard({
  metadata,
  content,
  selected = false,
  onSelect,
}: QuestionCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs text-muted-foreground space-y-1">
          {metadata.disciplina && <div>{metadata.disciplina}</div>}
          {metadata.assunto && <div>{metadata.assunto}</div>}
          {metadata.gabarito && (() => {
  const g = metadata.gabarito;

  if (g.kind === "mcq") {
    return <div>Gabarito: {g.correct}</div>;
  }

  if (g.kind === "tf") {
    return <div>Gabarito: {g.correct === "C" ? "Certo" : "Errado"}</div>;
  }

  if (g.kind === "essay") {
    return <div>Gabarito: Discursiva</div>;
  }

  return null;
})()}

          {metadata.dificuldade && <div>Dificuldade: {metadata.dificuldade}</div>}
          {metadata.source?.kind && <div>Origem: {metadata.source.kind}</div>}
          {metadata.tags && metadata.tags.length > 0 && (
            <div>Tags: {metadata.tags.join(", ")}</div>
          )}
        </div>

        {onSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelect(metadata.id, v === true)}
          />
        )}
      </div>
<div className="mt-2">
  <span className="font-semibold">Questão</span> <span className="font-mono">{metadata.id}:</span>
</div>
      {/* Conteúdo da questão */}
<div className="print-mode">
  <QuestionRenderer content={content} />
</div>



    </div>
  );
}
