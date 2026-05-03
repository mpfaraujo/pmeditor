"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { discColor } from "@/components/Questions/QuestionsFilter";

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
  showSubjectBorder?: boolean;
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

export function QuestionCardCompact({ metadata, content, selected, onSelect, onPreview, showSubjectBorder = true }: QuestionCardCompactProps) {
  const { id, disciplina, assunto, dificuldade, tipo, source } = metadata;

  const plainText = extractPlainText(content);
  const preview = plainText.length > 260 ? plainText.slice(0, 260) + "…" : plainText;

  const tipoLabel = tipo ? (TIPO_LABEL[tipo] ?? tipo) : null;
  const difColor = dificuldade ? (DIFICULDADE_COLOR[dificuldade] ?? "bg-gray-100 text-gray-600") : null;
  const subjectColor = disciplina ? discColor(disciplina) : "#64748b";

  const isSet = content?.content?.[0]?.type === "set_questions";
  const itemsCount = isSet
    ? (content?.content?.[0]?.content ?? []).filter((n: any) => n.type === "question_item").length
    : null;

  return (
    <div
      className={`relative flex h-[210px] cursor-pointer flex-col rounded-lg border p-4 transition-all hover:shadow-md ${
        showSubjectBorder ? "border-t-4" : ""
      } ${
        selected
          ? "border-[#E0B22A] bg-[#FFF9E6] ring-2 ring-[#FBC02D]/55 shadow-sm"
          : "border-gray-200 bg-white"
      }`}
      style={showSubjectBorder ? { borderTopColor: subjectColor } : undefined}
      onClick={() => onPreview?.()}
    >
      {/* Checkbox */}
      <div
        className={`absolute top-3 right-3 rounded border shadow-sm ${
          selected ? "border-[#E0B22A] bg-[#FBC02D]" : "border-slate-200 bg-white"
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(id, !selected); }}
      >
        <Checkbox checked={selected} />
      </div>
      {selected && (
        <div className="absolute right-12 top-3 rounded border border-[#E0B22A] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#5A4500] shadow-sm">
          Selecionada
        </div>
      )}

      {/* Header: tipo + dificuldade */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap pr-7">
        {tipoLabel && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-600">
            {isSet ? `Conjunto (${itemsCount ?? "?"} itens)` : tipoLabel}
          </span>
        )}
        {dificuldade && difColor && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${difColor}`}>
            {dificuldade}
          </span>
        )}
      </div>

      {/* Disciplina / assunto */}
      <div className="mb-2 flex min-w-0 items-center gap-2">
        {disciplina && (
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ backgroundColor: subjectColor }}
          >
            {disciplina}
          </span>
        )}
        {assunto && (
          <span className="truncate text-[13px] font-semibold text-gray-700">
            {assunto}
          </span>
        )}
      </div>

      <div
        className={`flex-1 overflow-hidden rounded-md px-3 py-2 text-[13px] leading-relaxed text-gray-700 ${
          selected ? "bg-white" : "bg-slate-50"
        }`}
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
        }}
      >
        {preview || <span className="italic">Sem enunciado</span>}
      </div>

      {/* Rodapé: origem */}
      {source?.kind === "concurso" && (source.concurso || source.ano) && (
        <div className="text-[11px] text-gray-400 mt-2 truncate">
          {[source.concurso, source.ano].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
