"use client";

import { Checkbox } from "@/components/ui/checkbox";

type QuestionCardCompactProps = {
  metadata: {
    id: string;
    disciplina?: string;
    assunto?: string;
    dificuldade?: string;
    tipo?: string;
    source?: { kind?: string; concurso?: string; ano?: number };
    tags?: string[];
  };
  content: any;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onPreview?: () => void;
};

function extractPlainText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(extractPlainText).join(" ").replace(/\s+/g, " ").trim();
}

const DIFICULDADE_COLOR: Record<string, string> = {
  "Fácil": "bg-green-100 text-green-700",
  "Média": "bg-yellow-100 text-yellow-700",
  "Difícil": "bg-red-100 text-red-700",
};

const TIPO_LABEL: Record<string, string> = {
  "Múltipla Escolha": "MCQ",
  "Certo/Errado": "C/E",
  "Discursiva": "Disc.",
};

export function QuestionCardCompact({ metadata, content, selected, onSelect, onPreview }: QuestionCardCompactProps) {
  const { id, disciplina, assunto, dificuldade, tipo, source } = metadata;

  const plainText = extractPlainText(content);
  const preview = plainText.length > 130 ? plainText.slice(0, 130) + "…" : plainText;

  const tipoLabel = tipo ? (TIPO_LABEL[tipo] ?? tipo) : null;
  const difColor = dificuldade ? (DIFICULDADE_COLOR[dificuldade] ?? "bg-gray-100 text-gray-600") : null;

  const isSet = content?.content?.[0]?.type === "set_questions";
  const itemsCount = isSet
    ? (content?.content?.[0]?.content ?? []).filter((n: any) => n.type === "question_item").length
    : null;

  return (
    <div
      className={`relative flex flex-col h-[160px] rounded-lg border bg-white p-3 cursor-pointer transition-all hover:shadow-md ${
        selected ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-gray-200"
      }`}
      onClick={() => onPreview?.()}
    >
      {/* Checkbox */}
      <div
        className="absolute top-2 right-2"
        onClick={(e) => { e.stopPropagation(); onSelect?.(id, !selected); }}
      >
        <Checkbox checked={selected} />
      </div>

      {/* Header: tipo + dificuldade */}
      <div className="flex items-center gap-1.5 flex-wrap pr-6 mb-1">
        {tipoLabel && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
            {isSet ? `Conjunto (${itemsCount ?? "?"} itens)` : tipoLabel}
          </span>
        )}
        {dificuldade && difColor && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${difColor}`}>
            {dificuldade}
          </span>
        )}
      </div>

      {/* Disciplina / assunto */}
      <div className="text-[11px] font-semibold text-gray-700 truncate mb-1">
        {[disciplina, assunto].filter(Boolean).join(" · ")}
      </div>

      {/* Preview do enunciado */}
      <div className="flex-1 overflow-hidden text-[11px] text-gray-500 leading-snug">
        {preview || <span className="italic">Sem enunciado</span>}
      </div>

      {/* Rodapé: origem */}
      {source?.kind === "concurso" && (source.concurso || source.ano) && (
        <div className="text-[10px] text-gray-400 mt-1 truncate">
          {[source.concurso, source.ano].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
