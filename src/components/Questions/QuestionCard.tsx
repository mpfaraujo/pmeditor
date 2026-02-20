"use client";

import { useMemo, useState } from "react";
import QuestionRenderer from "./QuestionRenderer";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { QuestionVersion } from "@/lib/questions";

type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

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

  content: any; // ativo (doc do ProseMirror)
  base?: {
    metadata?: any;
    content?: any;
  };

  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;

  variantsCount?: number;
  active?: { kind: "base" | "variant"; id: string };

  onVersionChange?: (versionData: QuestionVersion) => void;
};

/* ---------------- helpers (somente leitura) ---------------- */

function safeParseDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object") return null;
    if (doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
}

function findSetNodeInDocOrQuestion(doc: PMNode | null): PMNode | null {
  if (!doc) return null;

  const direct = doc.content?.find((n) => n?.type === "set_questions") ?? null;
  if (direct) return direct;

  const q = doc.content?.find((n) => n?.type === "question") ?? null;
  const nested = q?.content?.find((n) => n?.type === "set_questions") ?? null;
  return nested;
}

function getSetPartsFromDoc(doc: PMNode | null): {
  baseText: PMNode | null;
  items: PMNode[];
} {
  const setNode = findSetNodeInDocOrQuestion(doc);
  if (!setNode) return { baseText: null, items: [] };

  const baseText =
    (setNode.content ?? []).find((n) => n?.type === "base_text") ?? null;

  const items = (setNode.content ?? []).filter((n) => n?.type === "question_item");

  return { baseText, items };
}

function wrapAsQuestionDoc(nodes: PMNode[]): PMNode {
  return {
    type: "doc",
    content: [
      {
        type: "question",
        content: nodes,
      },
    ],
  };
}

const PREVIEW_PARAGRAPHS = 3;

function buildBasePreviewDoc(baseText: PMNode | null): {
  doc: PMNode | null;
  truncated: boolean;
} {
  if (!baseText) return { doc: null, truncated: false };

  const blocks = baseText.content ?? [];
  const paragraphs = blocks.filter((n) => n?.type === "paragraph");

  if (paragraphs.length === 0) {
    // sem parágrafos: mantém tudo
    return { doc: wrapAsQuestionDoc([baseText]), truncated: false };
  }

  const previewParas = paragraphs.slice(0, PREVIEW_PARAGRAPHS);
  const truncated = paragraphs.length > PREVIEW_PARAGRAPHS;

  const previewBaseText: PMNode = {
    ...baseText,
    content: previewParas,
  };

  return {
    doc: wrapAsQuestionDoc([previewBaseText]),
    truncated,
  };
}

function buildItemDoc(item: PMNode | null): PMNode | null {
  if (!item) return null;

  const nodes: PMNode[] = [];
  (item.content ?? []).forEach((n) => {
    if (n.type === "statement" || n.type === "options") nodes.push(n);
  });

  if (nodes.length === 0) return null;
  return wrapAsQuestionDoc(nodes);
}

type AnswerKey =
  | { kind: "mcq"; correct: "A" | "B" | "C" | "D" | "E" }
  | { kind: "tf"; correct: "C" | "E" }
  | { kind: "essay"; rubric?: string };

function parseAlt(x: unknown) {
  const s = (x ?? "").toString().trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D" || s === "E") return s;
  return null;
}

function extractAnswerKeyFromItemNode(itemNode: PMNode | null): AnswerKey | null {
  if (!itemNode) return null;

  const g =
    itemNode.attrs?.gabarito ??
    itemNode.attrs?.answerKey ??
    itemNode.attrs?.correct ??
    null;

  if (!g) return null;

  // formato {kind, correct}
  if (typeof g === "object" && g.kind) {
    const kind = (g.kind ?? "").toString();
    if (kind === "mcq") {
      const c = parseAlt((g as any).correct);
      return c ? { kind: "mcq", correct: c as any } : null;
    }
    if (kind === "tf") {
      const c = parseAlt((g as any).correct);
      if (c === "C" || c === "E") return { kind: "tf", correct: c };
      return null;
    }
    if (kind === "essay") return { kind: "essay", rubric: (g as any).rubric };
  }

  // formato "A"/"B"/...
  const c = parseAlt(g);
  return c ? { kind: "mcq", correct: c as any } : null;
}

/* ---------------- component ---------------- */

export default function QuestionCard({
  metadata,
  content,
  base,
  selected = false,
  onSelect,
  variantsCount = 0,
  active,
  onVersionChange,
}: QuestionCardProps) {
  const isEdited = variantsCount > 0;
  const hasBase = !!base?.content;

  const [view, setView] = useState<"active" | "base">("active");
  const [itemIndex, setItemIndex] = useState(0);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const isShowingVariant = active?.kind === "variant" && view === "active";

  const renderedContent = view === "base" && hasBase ? base!.content : content;

  const parsedDoc = useMemo(() => safeParseDoc(renderedContent), [renderedContent]);
  const setParts = useMemo(() => getSetPartsFromDoc(parsedDoc), [parsedDoc]);

  const isSet = setParts.items.length > 0 || !!setParts.baseText;
  const itemsCount = isSet ? setParts.items.length : 0;

  const safeItemIndex = useMemo(() => {
    if (!isSet) return 0;
    if (itemsCount <= 0) return 0;
    return Math.min(Math.max(itemIndex, 0), itemsCount - 1);
  }, [isSet, itemIndex, itemsCount]);

  const { doc: basePreviewDoc, truncated: baseTruncated } = useMemo(() => {
    if (!isSet) return { doc: null as PMNode | null, truncated: false };
    return buildBasePreviewDoc(setParts.baseText);
  }, [isSet, setParts.baseText]);

  const currentItemNode = useMemo(() => {
    if (!isSet) return null;
    return setParts.items[safeItemIndex] ?? null;
  }, [isSet, setParts.items, safeItemIndex]);

  const itemDoc = useMemo(() => {
    if (!isSet) return null;
    return buildItemDoc(currentItemNode);
  }, [isSet, currentItemNode]);

  const itemAnswerKey = useMemo(() => {
    if (!isSet) return null;
    return extractAnswerKeyFromItemNode(currentItemNode);
  }, [isSet, currentItemNode]);

  const headerLabel = isSet ? "Conjunto" : "Questão";

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">

          <div className="text-xs text-muted-foreground space-y-1">
            {metadata.disciplina && <div>{metadata.disciplina}</div>}
            {metadata.assunto && <div>{metadata.assunto}</div>}

            {/* IMPORTANTE: set_questions não tem gabarito único */}
            {!isSet &&
              metadata.gabarito &&
              (() => {
                const g = metadata.gabarito;
                if (g.kind === "mcq") return <div>Gabarito: {g.correct}</div>;
                if (g.kind === "tf")
                  return (
                    <div>Gabarito: {g.correct === "C" ? "Certo" : "Errado"}</div>
                  );
                if (g.kind === "essay") return <div>Gabarito: Discursiva</div>;
                return null;
              })()}

            {metadata.dificuldade && <div>Dificuldade: {metadata.dificuldade}</div>}
            {metadata.source?.kind && (
              <div>
                Origem:{" "}
                {metadata.source.kind === "concurso"
                  ? (metadata.source as any).concurso || "Concurso"
                  : metadata.source.kind === "original"
                  ? "Original"
                  : metadata.source.kind}
                {metadata.source.kind === "concurso" && (metadata.source as any).ano && (
                  <> ({(metadata.source as any).ano})</>
                )}
              </div>
            )}
            {metadata.tags && metadata.tags.length > 0 && (
              <div>Tags: {metadata.tags.join(", ")}</div>
            )}

            {isSet && itemsCount > 0 && (
              <div>
                Itens no conjunto: <span className="font-medium">{itemsCount}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {isEdited && onVersionChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Ver histórico ({variantsCount + 1})
            </Button>
          )}

          {onSelect && (
            <Checkbox
              className="border-2 border-slate-400 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
              checked={selected}
              onCheckedChange={(v) => onSelect(metadata.id, v === true)}
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-semibold">{headerLabel}</span>
        <span className="font-mono text-sm text-muted-foreground break-all">
          {metadata.id}:
        </span>
      </div>

      {/* Conteúdo */}
      <div className="print-mode space-y-3">
        {/* Caso normal: questão */}
        {!isSet && <QuestionRenderer content={renderedContent} />}

        {/* Caso set_questions: preview do base_text + navegação de itens */}
        {isSet && (
          <>
            {/* Preview: base_text (N parágrafos) */}
            {basePreviewDoc ? (
              <div className="space-y-2">
                <QuestionRenderer content={basePreviewDoc} />
                {baseTruncated && (
                  <div className="text-xs text-muted-foreground">
                    (texto base continua…)
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                (Sem base_text detectável no conjunto)
              </div>
            )}

            {/* Carousel simples: visualizar question_item */}
            {itemsCount > 0 && (
              <div className="border rounded-md p-3 bg-slate-50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs text-muted-foreground">
                    Visualizar item {safeItemIndex + 1} / {itemsCount}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItemIndex((i) => Math.max(0, i - 1))}
                      disabled={safeItemIndex === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemIndex((i) => Math.min(itemsCount - 1, i + 1))
                      }
                      disabled={safeItemIndex >= itemsCount - 1}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>

                {itemAnswerKey ? (
                  <div className="text-xs text-muted-foreground mb-2">
                    Gabarito do item:{" "}
                    {itemAnswerKey.kind === "mcq"
                      ? itemAnswerKey.correct
                      : itemAnswerKey.kind === "tf"
                      ? itemAnswerKey.correct === "C"
                        ? "Certo"
                        : "Errado"
                      : "Discursiva"}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mb-2">
                    (Item sem gabarito)
                  </div>
                )}

                {itemDoc ? (
                  <QuestionRenderer content={itemDoc} />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    (Item sem conteúdo renderizável)
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de histórico de versões */}
      {onVersionChange && (
        <VersionHistoryModal
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
          questionId={metadata.id}
          currentVersionId={active?.id ?? null}
          onVersionSelect={(versionData) => {
            onVersionChange(versionData);
          }}
        />
      )}
    </div>
  );
}
