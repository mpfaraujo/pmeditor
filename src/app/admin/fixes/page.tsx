"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { QuestionEditorModal } from "@/components/Questions/QuestionEditorModal";
import QuestionRendererProva from "@/components/Questions/QuestionRendererProva";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  SkipForward,
  Tag,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { ASSUNTOS_CANONICOS } from "@/data/assuntos";
import "@/app/editor/prova/montar/prova.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type QuestionItem = {
  id: string;
  metadata: any;
  content?: any;
};

type BaseTextItem = {
  id: string;
  tag?: string;
  titulo?: string;
  autor?: string;
  tema?: string;
  genero?: string;
  disciplina?: string;
  totalLinked?: number;
  content?: any;
};

type DuplicateCandidate = {
  idx: number;
  existingId: string;
  similarity: number;
  label: string;
  preview: string;
  payload: {
    metadata: any;
    content: any;
  };
  existingQuestion?: QuestionItem | null;
};

type DuplicateMetaField = "disciplina" | "assunto" | "dificuldade" | "tipo" | "tags" | "gabarito";
type DuplicateMetaSelection = Record<DuplicateMetaField, boolean>;
type DuplicateMetaDraft = Record<DuplicateMetaField, string>;

// Severidade: error > attention > info
type WarningSeverity = "error" | "attention" | "info";

type Warning = {
  type:
    | "image_placeholder"
    | "fixme"
    | "no_assunto"
    | "no_dific"
    | "no_gabarito"
    | "no_rubric"
    | "assunto_nao_canonico";
  label: string;
  severity: WarningSeverity;
};

type LogEntry = {
  ts: string;
  batchLabel: string;
  filter: string;
  dryRun: boolean;
  changed: number;
  unchanged: number;
  failed: number;
  details: FixResultItem[];
};

type FixFilter = {
  disciplinas?: string[];
  assuntos?: string[];
  tipos?: string[];
  dificuldades?: string[];
  concursos?: string[];
  anos?: number[];
  tags?: string;
  import_batch?: string;
  import_run_id?: string;
};

type ItemPatch = {
  index: number;
  assunto?: string;
  tags?: string[];
  tagsAdd?: string[];
  tagsRemove?: string[];
  answerKey?: object;
  resposta?: string;
};

type FixPatch = {
  disciplina?: string;
  assunto?: string;
  dificuldade?: string;
  tipo?: string;
  tags?: string[];
  tagsAdd?: string[];
  tagsRemove?: string[];
  source?: Record<string, any>;
  gabarito?: object;
  resposta?: string;
  items?: ItemPatch[];
  fixHifenizacao?: boolean;
  reviewed?: boolean;
};

type FixRequest = {
  ids?: string[];
  filter?: FixFilter;
  patch: FixPatch;
  dry_run?: boolean;
};

type FixResultItem = {
  id: string;
  changed: boolean;
  changes: string[];
  error?: string;
};

type FixResponse = {
  results: FixResultItem[];
  summary: { changed: number; unchanged: number; failed: number };
};

type DeleteRunPreview = {
  dry_run: boolean;
  run_id: string;
  summary: {
    questions?: number;
    uniqueBaseTexts?: number;
    questionsFound?: number;
    deletedQuestions?: number;
    notFoundQuestions?: number;
    deletedBaseTexts?: number;
    preservedBaseTexts?: number;
    failedQuestions?: number;
    failedBaseTexts?: number;
    reportRemoved?: boolean;
  };
  note?: string;
};

type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

// ─── Constantes de cor por severidade ─────────────────────────────────────────

const SEVERITY_STYLES: Record<WarningSeverity, string> = {
  error:     "bg-red-100 text-red-700 border border-red-200",
  attention: "bg-orange-100 text-orange-700 border border-orange-200",
  info:      "bg-gray-100 text-gray-500 border border-gray-200",
};

const SEVERITY_ICON: Record<WarningSeverity, React.ReactNode> = {
  error:     <XCircle size={10} className="inline mr-0.5" />,
  attention: <AlertTriangle size={10} className="inline mr-0.5" />,
  info:      null,
};

// ─── API ───────────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const API_BASE_TEXTS = API_BASE.replace(/\/questoes\/?$/, "/base_texts");
const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";
const PAGE_SIZE = 200;
const BASE_TEXT_REVIEW_KEY = "pmeditor:fixes:base-text-reviewed";
const DUPLICATE_REVIEW_KEY = "pmeditor:fixes:duplicate-reviewed";

/** Para chamadas ao PHP (list/get/update) — só aceita X-Questions-Token no CORS */
function phpHeaders(): Record<string, string> {
  return { "X-Questions-Token": TOKEN };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(node: any, maxLen = 9999): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "math_inline" || node.type === "math_block") return `[${node.attrs?.latex ?? "fórmula"}]`;
  if (node.type === "image") return "[imagem]";
  if (!Array.isArray(node.content)) return "";
  const full = node.content.map((n: any) => extractText(n)).join(" ").replace(/\s+/g, " ").trim();
  return maxLen < 9999 && full.length > maxLen ? full.slice(0, maxLen) + "…" : full;
}

function safeParseDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object" || doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
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

function normalizeBaseTextNode(content: any): PMNode | null {
  if (!content || typeof content !== "object") return null;

  if (content.type === "base_text") {
    return content as PMNode;
  }

  if (content.type === "doc") {
    return {
      type: "base_text",
      content: Array.isArray(content.content) ? content.content : [],
    };
  }

  if (content.type === "question") {
    const nestedBaseText = (content.content ?? []).find((child: PMNode) => child?.type === "base_text");
    if (nestedBaseText) return nestedBaseText;
    const statement = (content.content ?? []).find((child: PMNode) => child?.type === "statement");
    if (statement) {
      return {
        type: "base_text",
        content: Array.isArray(statement.content) ? statement.content : [],
      };
    }
  }

  return null;
}

function getBaseTextIds(metadata: any): string[] {
  const ids = new Set<string>();
  if (Array.isArray(metadata?.baseTextIds)) {
    metadata.baseTextIds.forEach((id: unknown) => {
      if (typeof id === "string" && id.trim()) ids.add(id);
    });
  }
  if (typeof metadata?.baseTextId === "string" && metadata.baseTextId.trim()) {
    ids.add(metadata.baseTextId);
  }
  return [...ids];
}

function getDuplicateCandidateKey(item: DuplicateCandidate): string {
  return item.payload?.metadata?.id ?? `${item.existingId}:${item.idx}:${item.preview}`;
}

function extractQuestionSortNumber(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const exact = trimmed.match(/^Q\.?\s*(\d+)$/i) ?? trimmed.match(/^(\d+)$/);
    if (exact) return Number(exact[1]);
    const loose = trimmed.match(/(?:quest[aã]o|q\.?)\s*[:.\-]?\s*(\d+)/i);
    if (loose) return Number(loose[1]);
  }
  return null;
}

function compareByQuestionNumber(
  aNum: number | null,
  bNum: number | null,
  aIndex: number,
  bIndex: number
): number {
  if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
  if (aNum != null && bNum == null) return -1;
  if (aNum == null && bNum != null) return 1;
  return aIndex - bIndex;
}

const DUPLICATE_META_FIELDS: DuplicateMetaField[] = [
  "disciplina",
  "assunto",
  "dificuldade",
  "tipo",
  "tags",
  "gabarito",
];

const DUPLICATE_META_LABELS: Record<DuplicateMetaField, string> = {
  disciplina: "Disciplina",
  assunto: "Assunto",
  dificuldade: "Dificuldade",
  tipo: "Tipo",
  tags: "Tags",
  gabarito: "Gabarito",
};

function normalizeMetaText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMetaTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeMetaGabarito(value: unknown): any | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const kind = typeof raw.kind === "string" ? raw.kind : null;
  const correct = typeof raw.correct === "string" ? raw.correct.trim() : "";
  const rubric = raw.rubric ?? null;

  if (kind === "mcq" || kind === "tf") {
    return correct ? { kind, correct } : null;
  }
  if (kind === "essay") {
    if (typeof rubric === "string" && rubric.trim()) return { kind, rubric: rubric.trim() };
    if (rubric && typeof rubric === "object") return { kind, rubric };
    return { kind };
  }
  return null;
}

function getMetaFieldValue(meta: any, field: DuplicateMetaField): any {
  if (field === "tags") return normalizeMetaTags(meta?.tags);
  if (field === "gabarito") return normalizeMetaGabarito(meta?.gabarito);
  return normalizeMetaText(meta?.[field]);
}

function isMetaFieldEmpty(meta: any, field: DuplicateMetaField): boolean {
  const value = getMetaFieldValue(meta, field);
  if (field === "tags") return value.length === 0;
  if (field === "gabarito") return !value;
  return value === "";
}

function areMetaFieldValuesEqual(aMeta: any, bMeta: any, field: DuplicateMetaField): boolean {
  const a = getMetaFieldValue(aMeta, field);
  const b = getMetaFieldValue(bMeta, field);

  if (field === "tags") {
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  if (field === "gabarito") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function formatMetaFieldValue(meta: any, field: DuplicateMetaField): string {
  const value = getMetaFieldValue(meta, field);
  if (field === "tags") return value.length ? value.join(", ") : "—";
  if (field === "gabarito") {
    if (!value) return "—";
    if (value.kind === "essay") return "Discursiva";
    return value.correct || "—";
  }
  return value || "—";
}

function getDraftValueFromMeta(meta: any, field: DuplicateMetaField): string {
  if (field === "tags") return normalizeMetaTags(meta?.tags).join(", ");
  if (field === "gabarito") {
    const value = normalizeMetaGabarito(meta?.gabarito);
    if (!value) return "";
    if (value.kind === "essay") return "essay";
    return value.correct ?? "";
  }
  return normalizeMetaText(meta?.[field]);
}

function buildDraftFromMeta(meta: any): DuplicateMetaDraft {
  return {
    disciplina: getDraftValueFromMeta(meta, "disciplina"),
    assunto: getDraftValueFromMeta(meta, "assunto"),
    dificuldade: getDraftValueFromMeta(meta, "dificuldade"),
    tipo: getDraftValueFromMeta(meta, "tipo"),
    tags: getDraftValueFromMeta(meta, "tags"),
    gabarito: getDraftValueFromMeta(meta, "gabarito"),
  };
}

function parseDraftTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDraftMetadataPatch(
  selection: DuplicateMetaSelection,
  drafts: DuplicateMetaDraft,
  existingMeta: any,
  attemptedMeta: any
): FixPatch {
  const patch: FixPatch = {};

  if (selection.disciplina) patch.disciplina = drafts.disciplina.trim();
  if (selection.assunto) patch.assunto = drafts.assunto.trim();
  if (selection.dificuldade) patch.dificuldade = drafts.dificuldade.trim();
  if (selection.tipo) patch.tipo = drafts.tipo.trim();
  if (selection.tags) patch.tags = parseDraftTags(drafts.tags);

  if (selection.gabarito) {
    const normalized = drafts.gabarito.trim().toUpperCase();
    const baseKind =
      normalizeMetaGabarito(attemptedMeta?.gabarito)?.kind ??
      normalizeMetaGabarito(existingMeta?.gabarito)?.kind ??
      "mcq";
    if (normalized === "ESSAY" || normalized === "DISCURSIVA") {
      patch.gabarito = { kind: "essay" };
    } else if ((baseKind === "tf" && (normalized === "C" || normalized === "E"))) {
      patch.gabarito = { kind: "tf", correct: normalized };
    } else if (/^[A-E]$/.test(normalized)) {
      patch.gabarito = { kind: "mcq", correct: normalized };
    }
  }

  return patch;
}

function getFillMissingSelection(existingMeta: any, attemptedMeta: any): DuplicateMetaSelection {
  return {
    disciplina: isMetaFieldEmpty(existingMeta, "disciplina") && !isMetaFieldEmpty(attemptedMeta, "disciplina"),
    assunto: isMetaFieldEmpty(existingMeta, "assunto") && !isMetaFieldEmpty(attemptedMeta, "assunto"),
    dificuldade: isMetaFieldEmpty(existingMeta, "dificuldade") && !isMetaFieldEmpty(attemptedMeta, "dificuldade"),
    tipo: isMetaFieldEmpty(existingMeta, "tipo") && !isMetaFieldEmpty(attemptedMeta, "tipo"),
    tags: isMetaFieldEmpty(existingMeta, "tags") && !isMetaFieldEmpty(attemptedMeta, "tags"),
    gabarito: isMetaFieldEmpty(existingMeta, "gabarito") && !isMetaFieldEmpty(attemptedMeta, "gabarito"),
  };
}

function getDifferentSelection(existingMeta: any, attemptedMeta: any): DuplicateMetaSelection {
  return {
    disciplina:
      !isMetaFieldEmpty(attemptedMeta, "disciplina") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "disciplina"),
    assunto:
      !isMetaFieldEmpty(attemptedMeta, "assunto") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "assunto"),
    dificuldade:
      !isMetaFieldEmpty(attemptedMeta, "dificuldade") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "dificuldade"),
    tipo:
      !isMetaFieldEmpty(attemptedMeta, "tipo") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "tipo"),
    tags:
      !isMetaFieldEmpty(attemptedMeta, "tags") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "tags"),
    gabarito:
      !isMetaFieldEmpty(attemptedMeta, "gabarito") &&
      !areMetaFieldValuesEqual(existingMeta, attemptedMeta, "gabarito"),
  };
}

function buildSelectedMetadataPatch(
  existingMeta: any,
  attemptedMeta: any,
  selection: DuplicateMetaSelection
): FixPatch {
  const patch: FixPatch = {};

  if (selection.disciplina && !isMetaFieldEmpty(attemptedMeta, "disciplina")) {
    patch.disciplina = getMetaFieldValue(attemptedMeta, "disciplina");
  }
  if (selection.assunto && !isMetaFieldEmpty(attemptedMeta, "assunto")) {
    patch.assunto = getMetaFieldValue(attemptedMeta, "assunto");
  }
  if (selection.dificuldade && !isMetaFieldEmpty(attemptedMeta, "dificuldade")) {
    patch.dificuldade = getMetaFieldValue(attemptedMeta, "dificuldade");
  }
  if (selection.tipo && !isMetaFieldEmpty(attemptedMeta, "tipo")) {
    patch.tipo = getMetaFieldValue(attemptedMeta, "tipo");
  }
  if (selection.tags && !isMetaFieldEmpty(attemptedMeta, "tags")) {
    patch.tags = getMetaFieldValue(attemptedMeta, "tags");
  }
  if (selection.gabarito && !isMetaFieldEmpty(attemptedMeta, "gabarito")) {
    patch.gabarito = getMetaFieldValue(attemptedMeta, "gabarito");
  }

  return patch;
}

function buildFillMissingMetadataPatch(existingMeta: any, attemptedMeta: any): FixPatch {
  return buildSelectedMetadataPatch(
    existingMeta,
    attemptedMeta,
    getFillMissingSelection(existingMeta, attemptedMeta)
  );
}

function buildMergeTagsPatch(existingMeta: any, attemptedMeta: any): FixPatch | null {
  const existingTags = normalizeMetaTags(existingMeta?.tags);
  const attemptedTags = normalizeMetaTags(attemptedMeta?.tags);
  const missing = attemptedTags.filter((tag) => !existingTags.includes(tag));
  if (missing.length === 0) return null;
  return { tagsAdd: missing };
}

function patchHasChanges(patch: FixPatch): boolean {
  return Object.keys(patch).length > 0;
}

function applyFixPatchToMetadata(currentMeta: any, patch: FixPatch): any {
  const next = { ...(currentMeta ?? {}) };

  for (const field of ["disciplina", "assunto", "dificuldade", "tipo"] as const) {
    if (patch[field] !== undefined) next[field] = patch[field];
  }

  if (patch.reviewed !== undefined) next.reviewed = patch.reviewed;
  if (patch.gabarito !== undefined) next.gabarito = patch.gabarito;

  if (patch.tags !== undefined) {
    next.tags = [...patch.tags];
  } else if (patch.tagsAdd || patch.tagsRemove) {
    const currentTags = normalizeMetaTags(next.tags);
    const added = patch.tagsAdd ? [...currentTags, ...patch.tagsAdd] : currentTags;
    next.tags = Array.from(new Set(added)).filter(
      (tag) => !(patch.tagsRemove ?? []).includes(tag)
    );
  }

  return next;
}

function buildCombinedBaseTextNode(
  ids: string[],
  cache: Map<string, BaseTextItem>
): PMNode | null {
  const combinedContent: PMNode[] = [];
  for (const id of ids) {
    const bt = cache.get(id);
    const baseTextNode = normalizeBaseTextNode(bt?.content);
    if (!baseTextNode) return null;
    const blocks = Array.isArray(baseTextNode.content) ? baseTextNode.content : [];
    combinedContent.push(...blocks);
  }
  if (combinedContent.length === 0) return null;
  return { type: "base_text", content: combinedContent };
}

function buildBaseTextSections(
  ids: string[],
  cache: Map<string, BaseTextItem>
): Array<{ id: string; tag: string; blockCount: number }> {
  return ids.flatMap((id) => {
    const bt = cache.get(id);
    const tag = bt?.tag;
    const baseTextNode = normalizeBaseTextNode(bt?.content);
    const blocks = Array.isArray(baseTextNode?.content) ? baseTextNode.content : [];
    if (!tag || blocks.length === 0) return [];
    return [{ id, tag, blockCount: blocks.length }];
  });
}

function injectBaseTextIntoDoc(content: any, baseTextNode: PMNode): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;

  return {
    type: "doc",
    content: (doc.content ?? []).map((node) => {
      if (node.type === "set_questions") {
        const withoutBase = (node.content ?? []).filter((child) => child?.type !== "base_text");
        return { ...node, content: [baseTextNode, ...withoutBase] };
      }

      if (node.type !== "question") return node;

      const hasNestedSet = (node.content ?? []).some((child) => child?.type === "set_questions");
      if (hasNestedSet) {
        return {
          ...node,
          content: (node.content ?? []).map((child) => {
            if (child?.type !== "set_questions") return child;
            const withoutBase = (child.content ?? []).filter((grandChild) => grandChild?.type !== "base_text");
            return { ...child, content: [baseTextNode, ...withoutBase] };
          }),
        };
      }

      const withoutBase = (node.content ?? []).filter((child) => child?.type !== "base_text");
      return { ...node, content: [baseTextNode, ...withoutBase] };
    }),
  };
}

function buildRenderableQuestion(
  question: QuestionItem,
  baseTextCache: Map<string, BaseTextItem>
): {
  content: any;
  baseTextSections: Array<{ id: string; tag: string; blockCount: number }>;
  linkedBaseTexts: BaseTextItem[];
} {
  const ids = getBaseTextIds(question.metadata);
  const linkedBaseTexts = ids
    .map((id) => baseTextCache.get(id))
    .filter((item): item is BaseTextItem => !!item);

  if (ids.length === 0) {
    return { content: question.content, baseTextSections: [], linkedBaseTexts };
  }

  const baseTextSections = buildBaseTextSections(ids, baseTextCache);
  const combinedBaseTextNode = buildCombinedBaseTextNode(ids, baseTextCache);
  if (!combinedBaseTextNode) {
    return { content: question.content, baseTextSections, linkedBaseTexts };
  }

  return {
    content: injectBaseTextIntoDoc(question.content, combinedBaseTextNode) ?? question.content,
    baseTextSections,
    linkedBaseTexts,
  };
}

/** Preview curto para card colapsado */
function getPreview(content: any): string {
  const root = content?.content?.[0];
  if (!root) return "(sem conteúdo)";
  if (root.type === "question") {
    const stmt = root.content?.find((n: any) => n.type === "statement");
    return extractText(stmt, 120);
  }
  if (root.type === "set_questions") {
    const items = root.content?.filter((n: any) => n.type === "question_item") ?? [];
    return `[conjunto ${items.length} itens]`;
  }
  return extractText(root, 120);
}

/** Conteúdo completo para card expandido */
function getFullContent(content: any): { statement: string; options: { letter: string; text: string }[] | null; items: string[] | null } {
  const root = content?.content?.[0];
  if (!root) return { statement: "(sem conteúdo)", options: null, items: null };

  if (root.type === "question") {
    const stmt = root.content?.find((n: any) => n.type === "statement");
    const opts = root.content?.find((n: any) => n.type === "options");
    const options = opts
      ? (opts.content ?? []).filter((n: any) => n.type === "option").map((n: any) => ({
          letter: n.attrs?.letter ?? "?",
          text: extractText(n, 200),
        }))
      : null;
    return { statement: extractText(stmt), options, items: null };
  }

  if (root.type === "set_questions") {
    const qItems = root.content?.filter((n: any) => n.type === "question_item") ?? [];
    const items = qItems.map((qi: any, i: number) => {
      const stmt = qi.content?.find((n: any) => n.type === "statement");
      return `${i + 1}. ${extractText(stmt, 200)}`;
    });
    return { statement: "[Conjunto com texto base]", options: null, items };
  }

  return { statement: extractText(root, 300), options: null, items: null };
}

function detectWarnings(q: QuestionItem): Warning[] {
  const w: Warning[] = [];
  const meta = q.metadata ?? {};
  const contentStr = JSON.stringify(q.content ?? {});

  if (contentStr.includes("\\\\includegraphics") || contentStr.includes("includegraphics"))
    w.push({ type: "image_placeholder", label: "Imagem pendente", severity: "attention" });
  if (contentStr.includes("FIXME"))
    w.push({ type: "fixme", label: "FIXME", severity: "error" });
  if (meta.tipo === "Múltipla Escolha" && !meta.gabarito?.correct)
    w.push({ type: "no_gabarito", label: "Gabarito vazio", severity: "error" });
  if (!meta.assunto)
    w.push({ type: "no_assunto", label: "Sem assunto", severity: "attention" });
  if (meta.assunto && !ASSUNTOS_CANONICOS.includes(meta.assunto))
    w.push({ type: "assunto_nao_canonico", label: "Assunto não canônico", severity: "attention" });
  if (!meta.dificuldade)
    w.push({ type: "no_dific", label: "Sem dificuldade", severity: "info" });
  // Para set_questions discursivos o rubric fica em question_item.attrs.answerKey — não no metadata raiz
  const isSetQuestions = q.content?.content?.[0]?.type === "set_questions";
  const hasRubricInItems = isSetQuestions &&
    (q.content?.content?.[0]?.content ?? [])
      .filter((n: any) => n.type === "question_item")
      .some((n: any) => n.attrs?.answerKey?.rubric);
  if (meta.tipo === "Discursiva" && !isSetQuestions && !meta.gabarito?.rubric)
    w.push({ type: "no_rubric", label: "Sem resposta modelo", severity: "info" });
  if (meta.tipo === "Discursiva" && isSetQuestions && !hasRubricInItems)
    w.push({ type: "no_rubric", label: "Sem resposta modelo", severity: "info" });

  return w;
}

// Retorna a pior severidade de uma lista de warnings
function worstSeverity(warnings: Warning[]): WarningSeverity | null {
  if (warnings.some((w) => w.severity === "error")) return "error";
  if (warnings.some((w) => w.severity === "attention")) return "attention";
  if (warnings.some ((w) => w.severity === "info")) return "info";
  return null;
}

// ─── Presets de fix JSON ───────────────────────────────────────────────────────

const PRESETS: { label: string; value: object }[] = [
  { label: "Adicionar tag",               value: { patch: { tagsAdd: ["minha-tag"] } } },
  { label: "Trocar disciplina",           value: { patch: { disciplina: "Matemática" } } },
  { label: "Trocar assunto",              value: { patch: { assunto: "Funções Quadráticas" } } },
  { label: "Ajustar gabarito MCQ",        value: { patch: { gabarito: { kind: "mcq", correct: "A" } } } },
  { label: "Preencher dificuldade",       value: { patch: { dificuldade: "Média" } } },
  { label: "Fix hifenização",             value: { patch: { fixHifenizacao: true } } },
  { label: "Marcar todos como revisados", value: { patch: { reviewed: true } } },
];

// ─── Componente: card de questão ──────────────────────────────────────────────

function QuestionCard({
  q,
  selected,
  onToggleSelect,
  onSaved,
  onReviewAndNext,
  onOpenEditor,
  onDelete,
  deleteBusy,
  baseTextCache,
  cardRef,
  forceExpanded,
}: {
  q: QuestionItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onSaved: (id: string, updated: Partial<QuestionItem>) => void;
  onReviewAndNext: (id: string) => void;
  onOpenEditor: (question: QuestionItem) => void;
  onDelete: (question: QuestionItem) => void;
  deleteBusy: boolean;
  baseTextCache: Map<string, BaseTextItem>;
  cardRef?: React.Ref<HTMLDivElement>;
  forceExpanded?: boolean;
}) {
  const meta = q.metadata ?? {};
  const [assunto, setAssunto] = useState(meta.assunto ?? "");
  const [dificuldade, setDificuldade] = useState(meta.dificuldade ?? "");
  const [gabarito, setGabarito] = useState(meta.gabarito?.correct ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(meta.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Abre o card quando o pai pede (ex: "Próximo warning")
  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  const warnings = useMemo(() => detectWarnings(q), [q]);
  const severity = worstSeverity(warnings);

  const hasChanges =
    assunto !== (meta.assunto ?? "") ||
    dificuldade !== (meta.dificuldade ?? "") ||
    gabarito !== (meta.gabarito?.correct ?? "") ||
    JSON.stringify(tags) !== JSON.stringify(meta.tags ?? []);

  async function save() {
    setSaving(true);
    const patch: any = {};
    if (assunto !== (meta.assunto ?? "")) patch.assunto = assunto;
    if (dificuldade !== (meta.dificuldade ?? "")) patch.dificuldade = dificuldade;
    if (gabarito !== (meta.gabarito?.correct ?? ""))
      patch.gabarito = { kind: "mcq", correct: gabarito };
    if (JSON.stringify(tags) !== JSON.stringify(meta.tags ?? [])) patch.tags = tags;

    try {
      const res = await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify({ ids: [q.id], patch, dry_run: false }),
      });
      const data: FixResponse = await res.json();
      if (data.summary.changed > 0) {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2000);
        onSaved(q.id, {
          metadata: {
            ...meta,
            assunto,
            dificuldade,
            tags,
            gabarito: patch.gabarito ?? meta.gabarito,
          },
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function reviewAndNext() {
    // Salva alterações pendentes (se houver) e marca revisado, tudo em um passo
    setSaving(true);
    const patch: any = { reviewed: true };
    if (assunto !== (meta.assunto ?? "")) patch.assunto = assunto;
    if (dificuldade !== (meta.dificuldade ?? "")) patch.dificuldade = dificuldade;
    if (gabarito !== (meta.gabarito?.correct ?? ""))
      patch.gabarito = { kind: "mcq", correct: gabarito };
    if (JSON.stringify(tags) !== JSON.stringify(meta.tags ?? [])) patch.tags = tags;
    try {
      await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify({ ids: [q.id], patch, dry_run: false }),
      });
      onSaved(q.id, {
        metadata: { ...meta, reviewed: true, assunto, dificuldade, tags,
          gabarito: patch.gabarito ?? meta.gabarito },
      });
      onReviewAndNext(q.id);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReviewed() {
    setSaving(true);
    const newVal = !meta.reviewed;
    try {
      await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify({ ids: [q.id], patch: { reviewed: newVal }, dry_run: false }),
      });
      onSaved(q.id, { metadata: { ...meta, reviewed: newVal } });
    } finally {
      setSaving(false);
    }
  }

  const numero = meta.source?.numero ? `Q.${meta.source.numero}` : q.id.slice(0, 8) + "…";
  const preview = getPreview(q.content);
  const fullContent = useMemo(() => getFullContent(q.content), [q.content]);
  const rendered = useMemo(
    () => buildRenderableQuestion(q, baseTextCache),
    [q, baseTextCache]
  );

  // Borda lateral por severidade
  const borderClass =
    meta.reviewed
      ? "border-green-300 bg-green-50"
      : severity === "error"
      ? "border-red-300 bg-white"
      : severity === "attention"
      ? "border-orange-200 bg-white"
      : "border-gray-200 bg-white";

  return (
    <div
      ref={cardRef}
      className={`border rounded-lg p-3 text-sm ${borderClass} ${selected ? "ring-2 ring-blue-400" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 flex-wrap">
        {/* Checkbox de seleção */}
        <div className="flex items-center mt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(q.id)}
            className="w-3.5 h-3.5"
          />
        </div>

        <span className="font-mono text-xs text-gray-500 shrink-0">{numero}</span>
        <span className="font-medium text-gray-700">{meta.disciplina ?? "—"}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-600">{meta.tipo ?? "—"}</span>
        {meta.tipo === "Múltipla Escolha" && meta.gabarito?.correct && (
          <span className="text-xs font-bold text-blue-600">Gab: {meta.gabarito.correct}</span>
        )}

        {/* Warnings com severidade */}
        {warnings.map((w) => (
          <span
            key={w.type}
            className={`text-xs px-1.5 py-0.5 rounded flex items-center ${SEVERITY_STYLES[w.severity]}`}
          >
            {SEVERITY_ICON[w.severity]}
            {w.label}
          </span>
        ))}

        {meta.reviewed && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle2 size={11} /> Revisado
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <Checkbox
              checked={!!meta.reviewed}
              onCheckedChange={() => toggleReviewed()}
              className="w-3.5 h-3.5"
            />
            Revisada
          </label>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Preview colapsado */}
      {!expanded && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-1 ml-5">{preview}</p>
      )}

      {/* Expandido */}
      {expanded && (
        <div className="mt-3 space-y-3 ml-5">
          {rendered.content && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Renderização
              </div>
              <div className="rounded border bg-slate-100 p-3 overflow-x-auto">
                <div
                  className="prova-page bg-white shadow-sm"
                  style={{ height: "auto", minHeight: "auto", overflow: "visible" }}
                >
                  <div style={{ maxWidth: "18cm" }}>
                    <QuestionRendererProva
                      content={rendered.content}
                      baseTextSections={rendered.baseTextSections}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo completo da questão */}
          <div className="text-xs text-gray-700 bg-gray-50 rounded p-2 space-y-1 leading-relaxed">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Texto extraído
            </p>
            <p className="font-medium text-gray-800">{fullContent.statement}</p>
            {fullContent.options && (
              <ul className="space-y-0.5 mt-1">
                {fullContent.options.map((o) => (
                  <li key={o.letter} className={`flex gap-1.5 ${gabarito === o.letter ? "text-blue-700 font-medium" : ""}`}>
                    <span className="shrink-0 font-mono">({o.letter})</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {fullContent.items && (
              <ul className="space-y-0.5 mt-1 list-none">
                {fullContent.items.map((it, i) => (
                  <li key={i} className="text-gray-600">{it}</li>
                ))}
              </ul>
            )}
          </div>

          {rendered.linkedBaseTexts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Textos base vinculados
              </div>
              <div className="flex flex-wrap gap-2">
                {rendered.linkedBaseTexts.map((bt) => (
                  <a
                    key={bt.id}
                    href={`/editor/texto-base/${bt.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 border border-blue-100 rounded px-2 py-1"
                  >
                    <Eye size={12} />
                    {bt.tag ? `Editar texto ${bt.tag}` : "Editar texto base"}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {/* Assunto */}
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Assunto</label>
              <Input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className={`h-7 text-xs ${
                  assunto && !ASSUNTOS_CANONICOS.includes(assunto)
                    ? "border-orange-400 bg-orange-50"
                    : ""
                }`}
                placeholder="Assunto canônico"
                list="assuntos-list"
              />
              <datalist id="assuntos-list">
                {ASSUNTOS_CANONICOS.slice(0, 150).map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              {assunto && !ASSUNTOS_CANONICOS.includes(assunto) && (
                <p className="text-xs text-orange-600 mt-0.5">Não consta no cadastro</p>
              )}
            </div>

            {/* Dificuldade */}
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Dificuldade</label>
              <Select value={dificuldade} onValueChange={setDificuldade}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fácil">Fácil</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Difícil">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gabarito MCQ */}
            {meta.tipo === "Múltipla Escolha" && (
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Gabarito</label>
                <Select value={gabarito} onValueChange={setGabarito}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D", "E"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tags</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5"
                >
                  {t}
                  <button
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  setTags([...new Set([...tags, tagInput.trim()])]);
                  setTagInput("");
                }
              }}
              className="h-7 text-xs"
              placeholder="nova-tag + Enter"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!hasChanges || saving}
              onClick={save}
            >
              {saving && <Loader2 size={12} className="animate-spin mr-1" />}
              {savedOk ? "Salvo ✓" : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant={meta.reviewed ? "outline" : "secondary"}
              className="h-7 text-xs"
              onClick={toggleReviewed}
              disabled={saving}
            >
              <CheckCircle2 size={12} className="mr-1" />
              {meta.reviewed ? "Desmarcar" : "Revisar"}
            </Button>
            {!meta.reviewed && (
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={reviewAndNext}
                disabled={saving}
                title="Salva alterações, marca como revisado e vai para o próximo com warning"
              >
                {saving && <Loader2 size={12} className="animate-spin mr-1" />}
                <CheckCircle2 size={12} className="mr-1" />
                Revisar e avançar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs ml-auto"
              onClick={() => onOpenEditor(q)}
            >
              <Pencil size={12} className="mr-1" />
              Editar questão
            </Button>
            <a
              href={`/editor/questoes?id=${q.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-500 hover:underline flex items-center gap-1"
            >
              <Eye size={12} /> Página completa
            </a>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => onDelete(q)}
              disabled={deleteBusy || saving}
            >
              {deleteBusy && <Loader2 size={12} className="animate-spin mr-1" />}
              <Trash2 size={12} className="mr-1" />
              Excluir questão
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente: card de texto base ───────────────────────────────────────────

function BaseTextCard({
  bt,
  reviewed,
  onToggleReviewed,
}: {
  bt: BaseTextItem;
  reviewed: boolean;
  onToggleReviewed: (id: string, reviewed: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(bt.titulo ?? "");
  const [autor, setAutor] = useState(bt.autor ?? "");
  const [tema, setTema] = useState(bt.tema ?? "");
  const [genero, setGenero] = useState(bt.genero ?? "");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const hasChanges =
    titulo !== (bt.titulo ?? "") ||
    autor !== (bt.autor ?? "") ||
    tema !== (bt.tema ?? "") ||
    genero !== (bt.genero ?? "");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_TEXTS}/update.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Questions-Token": TOKEN },
        body: JSON.stringify({ id: bt.id, titulo, autor, tema, genero }),
      });
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const isShared = (bt.totalLinked ?? 0) > 1;
  const previewDoc = useMemo(() => {
    const baseTextNode = normalizeBaseTextNode(bt.content);
    if (!baseTextNode) return null;
    return wrapAsQuestionDoc([baseTextNode]);
  }, [bt.content]);

  return (
    <div className="border rounded-lg p-3 text-sm bg-white space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {bt.tag && (
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{bt.tag}</span>
        )}
        <span className="text-xs text-gray-500">{bt.disciplina ?? "—"}</span>
        <span className="text-xs text-gray-400 font-mono">{bt.id.slice(0, 12)}…</span>
        {isShared && (
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle size={11} />
            Compartilhado — {bt.totalLinked} questões vinculadas (editar afeta todas)
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <Checkbox
              checked={reviewed}
              onCheckedChange={() => onToggleReviewed(bt.id, !reviewed)}
              className="w-3.5 h-3.5"
            />
            Revisada
          </label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setExpanded((value) => !value)}
          >
            <Eye size={12} className="mr-1" />
            {expanded ? "Ocultar prévia" : "Visualizar"}
          </Button>
          <a
            href={`/editor/texto-base/${bt.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <Pencil size={12} />
            Editar conteúdo
          </a>
        </div>
      </div>

      {expanded && previewDoc && (
        <div className="rounded border bg-slate-100 p-3 overflow-x-auto">
          <div
            className="prova-page bg-white shadow-sm"
            style={{ height: "auto", minHeight: "auto", overflow: "visible" }}
          >
            <div style={{ maxWidth: "18cm" }}>
              <QuestionRendererProva
                content={previewDoc}
                baseTextSections={
                  (() => {
                    const baseTextNode = normalizeBaseTextNode(bt.content);
                    const count = Array.isArray(baseTextNode?.content) ? baseTextNode.content.length : 0;
                    return bt.tag && count > 0
                      ? [{ id: bt.id, tag: bt.tag, blockCount: count }]
                      : undefined;
                  })()
                }
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Título</label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Autor</label>
          <Input value={autor} onChange={(e) => setAutor(e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Tema</label>
          <Input value={tema} onChange={(e) => setTema(e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Gênero</label>
          <Input value={genero} onChange={(e) => setGenero(e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      <Button size="sm" className="h-7 text-xs" disabled={!hasChanges || saving} onClick={save}>
        {saving && <Loader2 size={12} className="animate-spin mr-1" />}
        {savedOk ? "Salvo ✓" : "Salvar texto base"}
      </Button>
    </div>
  );
}

function DuplicateMetadataModal({
  open,
  onOpenChange,
  item,
  onApplyPatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DuplicateCandidate;
  onApplyPatch: (questionId: string, patch: FixPatch) => Promise<{ ok: boolean; error?: string }>;
}) {
  const existingMeta = item.existingQuestion?.metadata ?? {};
  const attemptedMeta = item.payload?.metadata ?? {};
  const [selection, setSelection] = useState<DuplicateMetaSelection>(() =>
    getFillMissingSelection(existingMeta, attemptedMeta)
  );
  const [drafts, setDrafts] = useState<DuplicateMetaDraft>(() => buildDraftFromMeta(attemptedMeta));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelection(getFillMissingSelection(existingMeta, attemptedMeta));
      setDrafts(buildDraftFromMeta(attemptedMeta));
      setError("");
      setSaving(false);
    }
  }, [open, item.existingId, item.idx]);

  const selectedPatch = useMemo(
    () => buildDraftMetadataPatch(selection, drafts, existingMeta, attemptedMeta),
    [selection, drafts, existingMeta, attemptedMeta]
  );
  const fillMissingPatch = useMemo(
    () => buildFillMissingMetadataPatch(existingMeta, attemptedMeta),
    [existingMeta, attemptedMeta]
  );
  const mergeTagsPatch = useMemo(
    () => buildMergeTagsPatch(existingMeta, attemptedMeta),
    [existingMeta, attemptedMeta]
  );

  async function runPatch(patch: FixPatch, closeAfter = true) {
    if (!patchHasChanges(patch)) return;
    setSaving(true);
    setError("");
    const result = await onApplyPatch(item.existingId, patch);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Falha ao aplicar alterações.");
      return;
    }
    if (closeAfter) onOpenChange(false);
  }

  async function applySelected() {
    await runPatch(selectedPatch);
  }

  async function fillMissingNow() {
    await runPatch(fillMissingPatch, false);
    setSelection({
      disciplina: false,
      assunto: false,
      dificuldade: false,
      tipo: false,
      tags: false,
      gabarito: false,
    });
  }

  async function mergeTagsNow() {
    if (!mergeTagsPatch) return;
    await runPatch(mergeTagsPatch, false);
    setSelection((prev) => ({ ...prev, tags: false }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1000px)] max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Comparar metadados da duplicata</DialogTitle>
          <DialogDescription>
            Compare os metadados da tentativa importada com a questão já existente e aplique apenas o que fizer sentido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={saving || !patchHasChanges(fillMissingPatch)}
            onClick={fillMissingNow}
          >
            {saving && <Loader2 size={12} className="animate-spin mr-1" />}
            Preencher vazios
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={saving}
            onClick={() => setSelection(getDifferentSelection(existingMeta, attemptedMeta))}
          >
            Selecionar divergentes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={saving || !mergeTagsPatch}
            onClick={mergeTagsNow}
          >
            Mesclar tags
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={saving}
            onClick={() =>
              setSelection({
                disciplina: false,
                assunto: false,
                dificuldade: false,
                tipo: false,
                tags: false,
                gabarito: false,
              })
            }
          >
            Limpar seleção
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          <div className="grid grid-cols-[auto,1fr,1fr,1fr] gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-1">
            <div>Campo</div>
            <div>Questão existente</div>
            <div>Tentativa importada</div>
            <div>Aplicar</div>
          </div>

          {DUPLICATE_META_FIELDS.map((field) => {
            const existingText = formatMetaFieldValue(existingMeta, field);
            const attemptedText = formatMetaFieldValue(attemptedMeta, field);
            const isDifferent = !areMetaFieldValuesEqual(existingMeta, attemptedMeta, field);
            const canSelect = !isMetaFieldEmpty(attemptedMeta, field) && isDifferent;

            return (
              <div
                key={field}
                className={`grid grid-cols-[auto,1fr,1fr,1fr] gap-2 rounded-lg border p-2 ${
                  isDifferent ? "border-orange-200 bg-orange-50/50" : "border-slate-200 bg-slate-50/70"
                }`}
              >
                <label className="flex items-start gap-2 text-sm pt-1 min-w-0">
                  <Checkbox
                    checked={selection[field]}
                    disabled={!canSelect || saving}
                    onCheckedChange={(checked) =>
                      setSelection((prev) => ({ ...prev, [field]: !!checked }))
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">{DUPLICATE_META_LABELS[field]}</div>
                    <div className="text-[11px] text-slate-500">
                      {isDifferent ? "Divergente" : "Igual"}
                    </div>
                  </div>
                </label>

                <div className="rounded border bg-white p-2 text-xs text-slate-700 whitespace-pre-wrap break-words">
                  {existingText}
                </div>

                <div className="rounded border bg-white p-2 text-xs text-slate-700 whitespace-pre-wrap break-words">
                  {attemptedText}
                </div>

                <div className="rounded border border-dashed bg-white/70 p-2">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Valor a aplicar
                  </label>
                  <Input
                    value={drafts[field]}
                    disabled={saving}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="h-8 text-xs"
                    placeholder={
                      field === "tags"
                        ? "tag1, tag2, tag3"
                        : field === "gabarito"
                          ? "A-E, C/E ou essay"
                          : "Editar valor"
                    }
                  />
                </div>
              </div>
            );
          })}

          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Fechar
          </Button>
          <Button disabled={saving || !patchHasChanges(selectedPatch)} onClick={applySelected}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            Aplicar selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateCard({
  item,
  onOpenEditor,
  onToggleReviewed,
  onApplyMetadataPatch,
  baseTextCache,
  reviewed,
}: {
  item: DuplicateCandidate;
  onOpenEditor: (question: QuestionItem) => void;
  onToggleReviewed: (duplicateKey: string, reviewed: boolean) => void;
  onApplyMetadataPatch: (questionId: string, patch: FixPatch) => Promise<{ ok: boolean; error?: string }>;
  baseTextCache: Map<string, BaseTextItem>;
  reviewed: boolean;
}) {
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [mergingTags, setMergingTags] = useState(false);
  const attemptedQuestion: QuestionItem = {
    id: item.payload.metadata?.id ?? `dup-${item.idx}`,
    metadata: item.payload.metadata ?? {},
    content: item.payload.content ?? null,
  };

  const attemptedRendered = useMemo(
    () => buildRenderableQuestion(attemptedQuestion, baseTextCache),
    [attemptedQuestion, baseTextCache]
  );

  const existingRendered = useMemo(
    () => (item.existingQuestion ? buildRenderableQuestion(item.existingQuestion, baseTextCache) : null),
    [item.existingQuestion, baseTextCache]
  );

  async function handleToggleReviewed() {
    onToggleReviewed(getDuplicateCandidateKey(item), !reviewed);
  }

  const mergeTagsPatch = useMemo(
    () => buildMergeTagsPatch(item.existingQuestion?.metadata ?? {}, item.payload?.metadata ?? {}),
    [item.existingQuestion?.metadata, item.payload?.metadata]
  );

  async function handleMergeTags() {
    if (!mergeTagsPatch) return;
    setMergingTags(true);
    await onApplyMetadataPatch(item.existingId, mergeTagsPatch);
    setMergingTags(false);
  }

  return (
    <>
    <div className="border rounded-lg bg-white p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-mono text-gray-500">#{item.idx}</span>
        <span className="rounded bg-orange-100 text-orange-700 px-1.5 py-0.5">
          Duplicata {Math.round(item.similarity * 100)}%
        </span>
        <span className="text-gray-500">{item.label}</span>
        <span className="text-gray-400">→</span>
        <span className="font-mono text-gray-500">{item.existingId.slice(0, 12)}…</span>
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
          <Checkbox
            checked={reviewed}
            disabled={false}
            onCheckedChange={() => handleToggleReviewed()}
            className="w-3.5 h-3.5"
          />
          Revisada
        </label>
        <div className="ml-auto flex items-center gap-2">
          {item.existingQuestion && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onOpenEditor(item.existingQuestion!)}
            >
              <Pencil size={12} className="mr-1" />
              Editar existente
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setMetadataModalOpen(true)}
          >
            Comparar metadados
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!mergeTagsPatch || mergingTags}
            onClick={handleMergeTags}
          >
            {mergingTags && <Loader2 size={12} className="animate-spin mr-1" />}
            <Tag size={12} className="mr-1" />
            Mesclar tags
          </Button>
          <a
            href={`/editor/questoes?id=${item.existingId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <Eye size={12} />
            Abrir página completa
          </a>
        </div>
      </div>

      <div className="text-xs text-gray-500">{item.preview}</div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Tentativa importada
          </div>
          <div className="rounded border bg-slate-100 p-3 overflow-x-auto">
            <div className="prova-page bg-white shadow-sm" style={{ height: "auto", minHeight: "auto", overflow: "visible" }}>
              <div style={{ maxWidth: "18cm" }}>
                <QuestionRendererProva
                  content={attemptedRendered.content}
                  baseTextSections={attemptedRendered.baseTextSections}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Questão existente
          </div>
          <div className="rounded border bg-slate-100 p-3 overflow-x-auto">
            {existingRendered ? (
              <div className="prova-page bg-white shadow-sm" style={{ height: "auto", minHeight: "auto", overflow: "visible" }}>
                <div style={{ maxWidth: "18cm" }}>
                  <QuestionRendererProva
                    content={existingRendered.content}
                    baseTextSections={existingRendered.baseTextSections}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Questão existente não carregada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
    <DuplicateMetadataModal
      open={metadataModalOpen}
      onOpenChange={setMetadataModalOpen}
      item={item}
      onApplyPatch={onApplyMetadataPatch}
    />
    </>
  );
}

function duplicateToAttemptedQuestion(item: DuplicateCandidate): QuestionItem {
  return {
    id: item.payload.metadata?.id ?? `dup-${item.idx}`,
    metadata: item.payload.metadata ?? {},
    content: item.payload.content ?? null,
  };
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FixesPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  const [batches, setBatches] = useState<{ batch: string; run_id: string; count: number }[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedBatchLabel, setSelectedBatchLabel] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [baseTexts, setBaseTexts] = useState<BaseTextItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [baseTextReviewed, setBaseTextReviewed] = useState<Record<string, boolean>>({});
  const [duplicateReviewed, setDuplicateReviewed] = useState<Record<string, boolean>>({});
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [deleteRunBusy, setDeleteRunBusy] = useState(false);
  const [deleteSelectedBusy, setDeleteSelectedBusy] = useState(false);
  const [deletingQuestionIds, setDeletingQuestionIds] = useState<Set<string>>(new Set());

  // Filtros locais
  const [searchText, setSearchText] = useState("");
  const [filterDisciplina, setFilterDisciplina] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState<"all" | WarningSeverity>("all");
  const [filterReviewed, setFilterReviewed] = useState<"all" | "reviewed" | "pending">("all");

  // Seleção múltipla
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"reviewed" | "tag" | "dificuldade" | "assunto">("reviewed");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<string>("");

  // Fix JSON
  const [fixJson, setFixJson] = useState('{\n  "ids": [],\n  "patch": {}\n}');
  const [dryRun, setDryRun] = useState(true);
  const [fixRunning, setFixRunning] = useState(false);
  const [fixResult, setFixResult] = useState<FixResponse | null>(null);
  const [fixError, setFixError] = useState<string>("");

  // Log
  const [log, setLog] = useState<LogEntry[]>([]);

  // Refs para scroll "próximo com warning"
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  // ID do card atualmente destacado/aberto pela navegação
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // ── Proteção admin ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/");
  }, [authLoading, isAdmin, router]);

  // ── Carrega batches ────────────────────────────────────────────────────────
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const map = new Map<string, { batch: string; run_id: string; count: number }>();

      const [dbRes, reportsRes] = await Promise.all([
        fetch(`${API_BASE}/list.php?limit=200&page=1`, {
          headers: phpHeaders(),
        }),
        fetch(`${API_BASE}/import-reports.php`, {
          headers: phpHeaders(),
        }),
      ]);

      const dbData = await dbRes.json();
      const dbItems: any[] = dbData.items ?? [];
      for (const item of dbItems) {
        const meta =
          typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata ?? {};
        const run = meta.import_run_id;
        const batch = meta.import_batch ?? "(sem label)";
        if (!run) continue;
        const key = `${batch}::${run}`;
        if (!map.has(key)) map.set(key, { batch, run_id: run, count: 0 });
        map.get(key)!.count++;
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        const reportItems: Array<{
          batch: string;
          run_id: string;
          summary?: {
            processed?: number;
            totalQueue?: number;
            imported?: number;
            duplicates?: number;
          };
        }> = reportsData.items ?? [];

        for (const item of reportItems) {
          if (!item.run_id) continue;
          const imported = Number(item.summary?.imported ?? 0);
          const duplicates = Number(item.summary?.duplicates ?? 0);
          const shouldExposeReportOnly = imported === 0 && duplicates > 0;
          const batch = item.batch ?? "(sem label)";
          const key = `${batch}::${item.run_id}`;
          const reportCount = Number(item.summary?.processed ?? item.summary?.totalQueue ?? 0);
          if (!map.has(key)) {
            if (!shouldExposeReportOnly) continue;
            map.set(key, {
              batch,
              run_id: item.run_id,
              count: reportCount,
            });
          } else if (reportCount > (map.get(key)?.count ?? 0)) {
            map.get(key)!.count = reportCount;
          }
        }
      }

      setBatches([...map.values()].reverse());
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadBatches();
  }, [isAdmin, loadBatches]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BASE_TEXT_REVIEW_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setBaseTextReviewed(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BASE_TEXT_REVIEW_KEY, JSON.stringify(baseTextReviewed));
    } catch {}
  }, [baseTextReviewed]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DUPLICATE_REVIEW_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setDuplicateReviewed(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DUPLICATE_REVIEW_KEY, JSON.stringify(duplicateReviewed));
    } catch {}
  }, [duplicateReviewed]);

  // ── Carrega questões do run ────────────────────────────────────────────────
  const loadQuestions = useCallback(async (runId: string) => {
    setLoading(true);
    setQuestions([]);
    setBaseTexts([]);
    setDuplicates([]);
    setSelected(new Set());
    cardRefs.current.clear();
    try {
      const rawItems: any[] = [];
      let page = 1;
      let total = Infinity;

      while (rawItems.length < total) {
        const res = await fetch(
          `${API_BASE}/list.php?import_run_id=${encodeURIComponent(runId)}&limit=${PAGE_SIZE}&page=${page}&includeContent=1`,
          { headers: phpHeaders() }
        );
        const data = await res.json();
        const pageItems: any[] = data.items ?? [];
        total = Number(data.total ?? pageItems.length);
        rawItems.push(...pageItems);
        if (pageItems.length === 0 || pageItems.length < PAGE_SIZE) break;
        page += 1;
      }

      const items: QuestionItem[] = rawItems.map((item: any) => ({
        id: item.id,
        metadata:
          typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata ?? {},
        content: item.content
          ? typeof item.content === "string"
            ? JSON.parse(item.content)
            : item.content
          : null,
      }));
      setQuestions(items);

      const btIds = new Set<string>();
      for (const q of items) {
        const meta = q.metadata;
        if (meta.baseTextIds) meta.baseTextIds.forEach((id: string) => btIds.add(id));
        if (meta.baseTextId) btIds.add(meta.baseTextId);
      }

      try {
        const reportRes = await fetch(
          `${API_BASE}/import-reports.php?run_id=${encodeURIComponent(runId)}&ts=${Date.now()}`,
          { headers: phpHeaders() }
        );
        if (reportRes.ok) {
          const report = await reportRes.json();
          const dupItems: DuplicateCandidate[] = Array.isArray(report?.duplicates) ? report.duplicates : [];

          for (const item of dupItems) {
            const meta = item.payload?.metadata ?? {};
            if (Array.isArray(meta.baseTextIds)) {
              meta.baseTextIds.forEach((id: string) => {
                if (id) btIds.add(id);
              });
            }
            if (meta.baseTextId) btIds.add(meta.baseTextId);
          }

          const uniqueExistingIds = [...new Set(dupItems.map((item) => item.existingId).filter(Boolean))];
          const existingMap = new Map<string, QuestionItem | null>();

          await Promise.all(
            uniqueExistingIds.map(async (id) => {
              try {
                const res = await fetch(`${API_BASE}/get.php?id=${encodeURIComponent(id)}&includeContent=1`, {
                  headers: phpHeaders(),
                });
                if (!res.ok) {
                  existingMap.set(id, null);
                  return;
                }
                const data = await res.json();
                const fetched = data?.item;
                existingMap.set(
                  id,
                  fetched
                    ? {
                        id: fetched.id,
                        metadata: fetched.metadata ?? {},
                        content: fetched.content ?? null,
                      }
                    : null
                );
              } catch {
                existingMap.set(id, null);
              }
            })
          );

          setDuplicates(
            dupItems.map((item) => ({
              ...item,
              existingQuestion: existingMap.get(item.existingId) ?? null,
            }))
          );
        }
      } catch {}

      if (btIds.size > 0) {
        const bts: BaseTextItem[] = [];
        for (const id of btIds) {
          try {
            const r = await fetch(`${API_BASE_TEXTS}/get.php?id=${encodeURIComponent(id)}`, {
              headers: phpHeaders(),
            });
            if (!r.ok) continue;
            const d = await r.json();
            const bt = d.item ?? d;
            const m = typeof bt.metadata === "string" ? JSON.parse(bt.metadata) : bt.metadata ?? {};
            const lr = await fetch(`${API_BASE}/list.php?base_text_id=${encodeURIComponent(id)}&limit=1`, {
              headers: phpHeaders(),
            });
            const ld = await lr.json();
            bts.push({
              id,
              tag: m.tag,
              titulo: bt.titulo ?? m.titulo,
              autor: bt.autor ?? m.autor,
              tema: bt.tema ?? m.tema,
              genero: bt.genero ?? m.genero,
              disciplina: bt.disciplina ?? m.disciplina,
              totalLinked: ld.total ?? 0,
              content: bt.content,
            });
          } catch {}
        }
        setBaseTexts(bts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function selectRun(batch: string, runId: string) {
    setSelectedRunId(runId);
    setSelectedBatchLabel(batch);
    setFixJson(JSON.stringify({ filter: { import_run_id: runId }, patch: {} }, null, 2));
    loadQuestions(runId);
  }

  async function handleDeleteRun() {
    if (!selectedRunId || deleteRunBusy) return;

    setDeleteRunBusy(true);
    try {
      const previewRes = await fetch(`${API_BASE}/delete-import-run.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...phpHeaders(),
        },
        body: JSON.stringify({ run_id: selectedRunId, dry_run: true }),
      });
      const preview: DeleteRunPreview | { error: string } = await previewRes.json();
      if (!previewRes.ok || !("summary" in preview)) {
        throw new Error(("error" in preview && preview.error) || "Falha ao gerar prévia.");
      }

      const ok = window.confirm(
        [
          `Excluir a importação do run ${selectedRunId}?`,
          "",
          `Questões: ${preview.summary.questions ?? 0}`,
          `Textos base vinculados: ${preview.summary.uniqueBaseTexts ?? 0}`,
          "",
          "Serão apagadas as questões do run.",
          "Textos base só serão apagados se não estiverem vinculados a outras questões.",
        ].join("\n")
      );
      if (!ok) return;

      const deleteRes = await fetch(`${API_BASE}/delete-import-run.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...phpHeaders(),
        },
        body: JSON.stringify({ run_id: selectedRunId, dry_run: false }),
      });
      const result: DeleteRunPreview | { error: string; failedQuestions?: any[]; failedBaseTexts?: any[] } =
        await deleteRes.json();
      if (!deleteRes.ok || !("summary" in result)) {
        throw new Error(("error" in result && result.error) || "Falha ao excluir run.");
      }

      window.alert(
        [
          `Importação removida: ${selectedBatchLabel || selectedRunId}`,
          `Questões apagadas: ${result.summary.deletedQuestions ?? 0}`,
          `Textos base apagados: ${result.summary.deletedBaseTexts ?? 0}`,
          `Textos base preservados: ${result.summary.preservedBaseTexts ?? 0}`,
          `Falhas em questões: ${result.summary.failedQuestions ?? 0}`,
          `Falhas em textos base: ${result.summary.failedBaseTexts ?? 0}`,
        ].join("\n")
      );

      setSelectedRunId("");
      setSelectedBatchLabel("");
      setQuestions([]);
      setBaseTexts([]);
      setDuplicates([]);
      setSelected(new Set());
      setFixResult(null);
      setFixError("");
      await loadBatches();
    } catch (e: any) {
      window.alert(e?.message ?? "Erro ao excluir importação.");
    } finally {
      setDeleteRunBusy(false);
    }
  }

  async function deleteQuestionIds(ids: string[], label: string) {
    if (ids.length === 0) return;

    const res = await fetch(`${API_BASE}/delete-bulk.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...phpHeaders(),
      },
      body: JSON.stringify({ ids }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error ?? `Falha ao excluir ${label}.`);
    }

    const failed = Array.isArray(data.failed) ? data.failed : [];
    if (failed.length > 0) {
      throw new Error(
        `${label}: ${data.deleted ?? 0} excluída(s), ${failed.length} falha(s).`
      );
    }

    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });

    if (selectedRunId) {
      await loadQuestions(selectedRunId);
    }

    const deletedCount = Number(data.deleted ?? ids.length);
    window.alert(`${label}: ${deletedCount} questão(ões) excluída(s).`);
  }

  async function handleDeleteSingleQuestion(question: QuestionItem) {
    const numero = question.metadata?.source?.numero ?? question.metadata?.numero ?? "sem número";
    const ok = window.confirm(
      [
        `Excluir a questão ${numero}?`,
        "",
        "Use isso para casos como questão anulada.",
        "A exclusão remove a questão e seus vínculos/variantes.",
      ].join("\n")
    );
    if (!ok) return;

    setDeletingQuestionIds((prev) => new Set(prev).add(question.id));
    try {
      await deleteQuestionIds([question.id], `Questão ${numero}`);
    } finally {
      setDeletingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(question.id);
        return next;
      });
    }
  }

  async function handleDeleteSelectedQuestions() {
    if (selected.size === 0 || deleteSelectedBusy) return;

    const ids = [...selected];
    const ok = window.confirm(
      [
        `Excluir ${ids.length} questão(ões) selecionada(s)?`,
        "",
        "Use isso para remover anuladas ou itens indevidos deste run.",
        "A exclusão remove as questões e seus vínculos/variantes.",
      ].join("\n")
    );
    if (!ok) return;

    setDeleteSelectedBusy(true);
    setDeletingQuestionIds(new Set(ids));
    try {
      await deleteQuestionIds(ids, "Seleção");
    } finally {
      setDeleteSelectedBusy(false);
      setDeletingQuestionIds(new Set());
    }
  }

  // ── Filtros locais ─────────────────────────────────────────────────────────
  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) => {
        const meta = q.metadata ?? {};
        const preview = getPreview(q.content).toLowerCase();
        const warnings = detectWarnings(q);
        const severity = worstSeverity(warnings);

        if (
          searchText &&
          !preview.includes(searchText.toLowerCase()) &&
          !meta.assunto?.toLowerCase().includes(searchText.toLowerCase()) &&
          !meta.source?.numero?.includes(searchText)
        )
          return false;
        if (filterDisciplina !== "all" && meta.disciplina !== filterDisciplina) return false;
        if (filterTipo !== "all" && meta.tipo !== filterTipo) return false;
        if (filterSeverity !== "all" && severity !== filterSeverity) return false;
        if (filterReviewed === "reviewed" && !meta.reviewed) return false;
        if (filterReviewed === "pending" && meta.reviewed) return false;
        return true;
      })
      .sort((a, b) => {
        const aMeta = a.q.metadata ?? {};
        const bMeta = b.q.metadata ?? {};
        const aNum = extractQuestionSortNumber(aMeta.source?.numero, aMeta.numero);
        const bNum = extractQuestionSortNumber(bMeta.source?.numero, bMeta.numero);
        return compareByQuestionNumber(aNum, bNum, a.index, b.index);
      })
      .map(({ q }) => q);
  }, [questions, searchText, filterDisciplina, filterTipo, filterSeverity, filterReviewed]);

  const filteredDuplicates = useMemo(() => {
    return duplicates
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const attempted = duplicateToAttemptedQuestion(item);
        const meta = attempted.metadata ?? {};
        const preview = getPreview(attempted.content).toLowerCase();
        const warnings = detectWarnings(attempted);
        const severity = worstSeverity(warnings);
        const reviewed = !!duplicateReviewed[getDuplicateCandidateKey(item)];

        if (
          searchText &&
          !preview.includes(searchText.toLowerCase()) &&
          !meta.assunto?.toLowerCase().includes(searchText.toLowerCase()) &&
          !meta.source?.numero?.includes(searchText)
        )
          return false;
        if (filterDisciplina !== "all" && meta.disciplina !== filterDisciplina) return false;
        if (filterTipo !== "all" && meta.tipo !== filterTipo) return false;
        if (filterSeverity !== "all" && severity !== filterSeverity) return false;
        if (filterReviewed === "reviewed" && !reviewed) return false;
        if (filterReviewed === "pending" && reviewed) return false;
        return true;
      })
      .sort((a, b) => {
        const aMeta = a.item.payload?.metadata ?? {};
        const bMeta = b.item.payload?.metadata ?? {};
        const aNum = extractQuestionSortNumber(aMeta.source?.numero, aMeta.numero, a.item.label);
        const bNum = extractQuestionSortNumber(bMeta.source?.numero, bMeta.numero, b.item.label);
        return compareByQuestionNumber(aNum, bNum, a.index, b.index);
      })
      .map(({ item }) => item);
  }, [duplicates, duplicateReviewed, searchText, filterDisciplina, filterTipo, filterSeverity, filterReviewed]);

  const filteredBaseTexts = useMemo(() => {
    return baseTexts.filter((bt) => {
      const reviewed = !!baseTextReviewed[bt.id];
      const haystack = [
        bt.tag,
        bt.titulo,
        bt.autor,
        bt.tema,
        bt.genero,
        bt.disciplina,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchText && !haystack.includes(searchText.toLowerCase())) return false;
      if (filterDisciplina !== "all" && bt.disciplina !== filterDisciplina) return false;
      if (filterReviewed === "reviewed" && !reviewed) return false;
      if (filterReviewed === "pending" && reviewed) return false;
      return true;
    });
  }, [baseTexts, baseTextReviewed, searchText, filterDisciplina, filterReviewed]);

  const disciplinas = useMemo(
    () => [
      ...new Set([
        ...questions.map((q) => q.metadata?.disciplina),
        ...duplicates.map((item) => item.payload?.metadata?.disciplina),
        ...baseTexts.map((bt) => bt.disciplina),
      ].filter(Boolean)),
    ],
    [questions, duplicates, baseTexts]
  );
  const tipos = useMemo(
    () => [
      ...new Set([
        ...questions.map((q) => q.metadata?.tipo),
        ...duplicates.map((item) => item.payload?.metadata?.tipo),
      ].filter(Boolean)),
    ],
    [questions, duplicates]
  );
  const baseTextCache = useMemo(
    () => new Map(baseTexts.map((bt) => [bt.id, bt] as const)),
    [baseTexts]
  );
  const editorQuestion = useMemo(
    () => (editingQuestion ? { metadata: editingQuestion.metadata, content: editingQuestion.content ?? null } : null),
    [editingQuestion]
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let errors = 0, attention = 0, reviewed = 0, images = 0, nonCanonic = 0;
    for (const q of questions) {
      const w = detectWarnings(q);
      if (w.some((x) => x.severity === "error")) errors++;
      if (w.some((x) => x.severity === "attention")) attention++;
      if (w.some((x) => x.type === "image_placeholder")) images++;
      if (w.some((x) => x.type === "assunto_nao_canonico")) nonCanonic++;
      if (q.metadata?.reviewed) reviewed++;
    }
    return { total: questions.length, errors, attention, reviewed, images, nonCanonic };
  }, [questions]);

  // ── Próximo com warning ────────────────────────────────────────────────────
  function goToNextWarning(fromId?: string) {
    const withWarnings = filteredQuestions.filter(
      (q) => !q.metadata?.reviewed && detectWarnings(q).length > 0
    );
    if (withWarnings.length === 0) return;

    const container = listRef.current;
    if (!container) return;

    let target: QuestionItem;
    if (fromId) {
      // Avança para o próximo após fromId
      const currentIndex = withWarnings.findIndex((q) => q.id === fromId);
      target = withWarnings[(currentIndex + 1) % withWarnings.length];
    } else {
      // Encontra o mais próximo abaixo do scroll atual
      const scrollTop = container.scrollTop;
      target = withWarnings[0];
      for (const q of withWarnings) {
        const el = cardRefs.current.get(q.id);
        if (el && el.offsetTop > scrollTop + 10) { target = q; break; }
      }
    }

    setActiveCardId(target.id);
    const el = cardRefs.current.get(target.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Revisar e avançar (callback do card) ───────────────────────────────────
  function handleReviewAndNext(reviewedId: string) {
    goToNextWarning(reviewedId);
  }

  // ── Seleção múltipla ───────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredQuestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredQuestions.map((q) => q.id)));
    }
  }

  async function applyBulk() {
    if (selected.size === 0) return;
    setBulkRunning(true);
    setBulkResult("");

    const ids = [...selected];
    let patch: any = {};

    if (bulkAction === "reviewed") {
      patch = { reviewed: true };
    } else if (bulkAction === "tag" && bulkValue.trim()) {
      patch = { tagsAdd: [bulkValue.trim()] };
    } else if (bulkAction === "dificuldade" && bulkValue) {
      patch = { dificuldade: bulkValue };
    } else if (bulkAction === "assunto" && bulkValue.trim()) {
      patch = { assunto: bulkValue.trim() };
    } else {
      setBulkRunning(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify({ ids, patch, dry_run: false }),
      });
      const data: FixResponse = await res.json();
      setBulkResult(`✓ ${data.summary.changed} alteradas, = ${data.summary.unchanged} sem mudança${data.summary.failed ? `, ✗ ${data.summary.failed} erros` : ""}`);
      setSelected(new Set());

      // Atualiza estado local otimista
      if (data.summary.changed > 0) {
        setQuestions((prev) =>
          prev.map((q) => {
            if (!ids.includes(q.id)) return q;
            const newMeta = { ...q.metadata };
            if (patch.reviewed !== undefined) newMeta.reviewed = patch.reviewed;
            if (patch.tagsAdd) newMeta.tags = [...new Set([...(newMeta.tags ?? []), ...patch.tagsAdd])];
            if (patch.dificuldade) newMeta.dificuldade = patch.dificuldade;
            if (patch.assunto) newMeta.assunto = patch.assunto;
            return { ...q, metadata: newMeta };
          })
        );
      }

      const entry: LogEntry = {
        ts: new Date().toLocaleString("pt-BR"),
        batchLabel: selectedBatchLabel,
        filter: `${ids.length} IDs selecionados (lote)`,
        dryRun: false,
        ...data.summary,
        details: data.results,
      };
      setLog((prev) => [entry, ...prev]);
    } finally {
      setBulkRunning(false);
    }
  }

  // ── Fix JSON ───────────────────────────────────────────────────────────────
  async function applyFix() {
    setFixRunning(true);
    setFixResult(null);
    setFixError("");
    try {
      let body: FixRequest;
      try {
        body = JSON.parse(fixJson);
      } catch {
        setFixError("JSON inválido");
        return;
      }
      body.dry_run = dryRun;

      const res = await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify(body),
      });
      const data: FixResponse = await res.json();
      setFixResult(data);

      if (!dryRun && data.summary.changed > 0 && selectedRunId) {
        await loadQuestions(selectedRunId);
      }

      const entry: LogEntry = {
        ts: new Date().toLocaleString("pt-BR"),
        batchLabel: selectedBatchLabel || "(avulso)",
        filter: (body as any).filter
          ? JSON.stringify((body as any).filter)
          : `${(body as any).ids?.length ?? 0} IDs`,
        dryRun,
        ...data.summary,
        details: data.results,
      };
      setLog((prev) => [entry, ...prev]);
    } catch (e: any) {
      setFixError(e.message);
    } finally {
      setFixRunning(false);
    }
  }

  function updateQuestion(id: string, updated: Partial<QuestionItem>) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, ...updated, metadata: { ...(q.metadata ?? {}), ...(updated.metadata ?? {}) } }
          : q
      )
    );
  }

  function handleQuestionSaved(updated: any, info: { questionId: string; kind: "base" | "variant" }) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === info.questionId
          ? {
              ...q,
              metadata: updated.metadata ?? q.metadata,
              content: updated.content ?? q.content,
            }
          : q
        )
    );
  }

  async function toggleReviewedByQuestionId(questionId: string, reviewed: boolean) {
    await fetch(`${API_BASE}/fix.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...phpHeaders() },
      body: JSON.stringify({ ids: [questionId], patch: { reviewed }, dry_run: false }),
    });

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, metadata: { ...(q.metadata ?? {}), reviewed } }
          : q
      )
    );

    setDuplicates((prev) =>
      prev.map((item) =>
        item.existingId === questionId && item.existingQuestion
          ? {
              ...item,
              existingQuestion: {
                ...item.existingQuestion,
                metadata: { ...(item.existingQuestion.metadata ?? {}), reviewed },
              },
            }
          : item
      )
    );
  }

  async function applyDuplicateMetadataPatch(
    questionId: string,
    patch: FixPatch
  ): Promise<{ ok: boolean; error?: string }> {
    if (!patchHasChanges(patch)) return { ok: true };

    try {
      const res = await fetch(`${API_BASE}/fix.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...phpHeaders() },
        body: JSON.stringify({ ids: [questionId], patch, dry_run: false }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, error: data?.error ?? "Falha ao aplicar patch de metadados." };
      }

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, metadata: applyFixPatchToMetadata(q.metadata ?? {}, patch) }
            : q
        )
      );

      setDuplicates((prev) =>
        prev.map((item) =>
          item.existingId === questionId && item.existingQuestion
            ? {
                ...item,
                existingQuestion: {
                  ...item.existingQuestion,
                  metadata: applyFixPatchToMetadata(item.existingQuestion.metadata ?? {}, patch),
                },
              }
            : item
        )
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao aplicar patch de metadados.",
      };
    }
  }

  function toggleReviewedByBaseTextId(baseTextId: string, reviewed: boolean) {
    setBaseTextReviewed((prev) => ({ ...prev, [baseTextId]: reviewed }));
  }

  function toggleReviewedByDuplicateKey(duplicateKey: string, reviewed: boolean) {
    setDuplicateReviewed((prev) => ({ ...prev, [duplicateKey]: reviewed }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!isAdmin) return null;

  const allSelected =
    filteredQuestions.length > 0 && selected.size === filteredQuestions.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Voltar
        </button>
        <h1 className="font-semibold text-gray-800">Fixes pós-import</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Admin</span>
      </header>

      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar — batches */}
        <aside className="w-64 border-r bg-white flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Batches
            </span>
            <button
              onClick={loadBatches}
              disabled={loadingBatches}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw size={13} className={loadingBatches ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {batches.length === 0 && !loadingBatches && (
              <p className="text-xs text-gray-400 p-3 leading-relaxed">
                Nenhum batch encontrado.
                <br />
                Use <code className="bg-gray-100 px-1">--batch</code> no bulk-import.
              </p>
            )}
            {batches.map((b) => (
              <button
                key={b.run_id}
                onClick={() => selectRun(b.batch, b.run_id)}
                className={`w-full text-left px-3 py-2 border-b text-xs hover:bg-gray-50 transition-colors ${
                  selectedRunId === b.run_id
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : ""
                }`}
              >
                <div className="font-medium text-gray-700 truncate">{b.batch}</div>
                <div className="text-gray-400 font-mono truncate text-[10px]">
                  {b.run_id.slice(0, 16)}…
                </div>
                <div className="text-gray-400">{b.count} questões</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {!selectedRunId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Selecione um batch à esquerda
            </div>
          ) : (
            <Tabs defaultValue="questoes" className="flex-1 flex flex-col overflow-hidden">
              {/* Stats + Tabs */}
              <div className="bg-white border-b px-4 pt-2">
                {/* Linha de stats */}
                <div className="flex flex-wrap gap-3 mb-2 text-xs">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteRun}
                    disabled={deleteRunBusy}
                    className="h-6 px-2 text-[11px]"
                    title="Excluir todas as questões deste run e apagar textos base não compartilhados"
                  >
                    {deleteRunBusy ? (
                      <Loader2 size={11} className="animate-spin mr-1" />
                    ) : (
                      <Trash2 size={11} className="mr-1" />
                    )}
                    Excluir importação
                  </Button>
                  <span className="text-gray-600 font-medium">{stats.total} questões</span>
                  <span className="text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={11} /> {duplicates.length} duplicadas
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <XCircle size={11} /> {stats.errors} errors
                  </span>
                  <span className="text-orange-600 flex items-center gap-1">
                    <AlertTriangle size={11} /> {stats.attention} atenção
                  </span>
                  <span className="text-orange-500 flex items-center gap-1">
                    🖼 {stats.images} imagens pendentes
                  </span>
                  <span className="text-purple-600 flex items-center gap-1">
                    <Tag size={11} /> {stats.nonCanonic} assuntos não canônicos
                  </span>
                  <span className="text-green-600 flex items-center gap-1 ml-auto">
                    <CheckCircle2 size={11} /> {stats.reviewed}/{stats.total} revisadas
                  </span>
                </div>
                <TabsList className="h-8 mb-0">
                  <TabsTrigger value="questoes" className="text-xs h-6">
                    Questões ({stats.total})
                  </TabsTrigger>
                  <TabsTrigger value="duplicadas" className="text-xs h-6">
                    Duplicadas ({duplicates.length})
                  </TabsTrigger>
                  <TabsTrigger value="textosbase" className="text-xs h-6">
                    Textos base ({baseTexts.length})
                  </TabsTrigger>
                  <TabsTrigger value="fixjson" className="text-xs h-6">
                    Fix JSON
                  </TabsTrigger>
                  <TabsTrigger value="log" className="text-xs h-6">
                    Log ({log.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Tab Questões ───────────────────────────────────────────── */}
              <TabsContent value="questoes" className="flex-1 overflow-hidden flex flex-col m-0">
                {/* Filtros */}
                <div className="bg-white border-b px-4 py-2 flex flex-wrap gap-2 items-center">
                  {/* Checkbox selecionar todos */}
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    className="w-3.5 h-3.5"
                  />

                  <div className="relative">
                    <Search size={13} className="absolute left-2 top-1.5 text-gray-400" />
                    <Input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-7 text-xs pl-7 w-44"
                      placeholder="Buscar…"
                    />
                  </div>

                  <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas disciplinas</SelectItem>
                      {disciplinas.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      {tipos.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro por severidade */}
                  <Select
                    value={filterSeverity}
                    onValueChange={(v) => setFilterSeverity(v as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos warnings</SelectItem>
                      <SelectItem value="error">🔴 Error</SelectItem>
                      <SelectItem value="attention">🟠 Atenção</SelectItem>
                      <SelectItem value="info">⚪ Info</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterReviewed}
                    onValueChange={(v) => setFilterReviewed(v as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="reviewed">Revisados</SelectItem>
                      <SelectItem value="pending">Não revisadas</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Próximo com warning */}
                  <button
                    onClick={() => goToNextWarning()}
                    title="Ir para próximo com warning"
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 border border-orange-200 rounded px-2 py-1 hover:bg-orange-50"
                  >
                    <SkipForward size={13} /> Próximo warning
                  </button>

                  <span className="ml-auto text-xs text-gray-400">
                    {filteredQuestions.length} / {questions.length}
                  </span>
                </div>

                {/* Lista */}
                <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin text-gray-400" />
                    </div>
                  )}
                  {!loading && filteredQuestions.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-12">
                      Nenhuma questão encontrada.
                    </p>
                  )}
                  {filteredQuestions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      selected={selected.has(q.id)}
                      onToggleSelect={toggleSelect}
                      onSaved={updateQuestion}
                      onReviewAndNext={handleReviewAndNext}
                      onOpenEditor={setEditingQuestion}
                      onDelete={handleDeleteSingleQuestion}
                      deleteBusy={deletingQuestionIds.has(q.id)}
                      baseTextCache={baseTextCache}
                      forceExpanded={activeCardId === q.id}
                      cardRef={(el) => {
                        if (el) cardRefs.current.set(q.id, el);
                        else cardRefs.current.delete(q.id);
                      }}
                    />
                  ))}
                </div>

                {/* Barra de ações em lote — fixada no rodapé */}
                {selected.size > 0 && (
                  <div className="absolute bottom-0 left-64 right-0 bg-white border-t shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap z-10">
                    <span className="text-sm font-medium text-gray-700">
                      {selected.size} selecionada{selected.size > 1 ? "s" : ""}
                    </span>

                    <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as any)}>
                      <SelectTrigger className="h-8 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviewed">Marcar como revisadas</SelectItem>
                        <SelectItem value="tag">Adicionar tag</SelectItem>
                        <SelectItem value="dificuldade">Ajustar dificuldade</SelectItem>
                        <SelectItem value="assunto">Trocar assunto</SelectItem>
                      </SelectContent>
                    </Select>

                    {bulkAction === "tag" && (
                      <Input
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        className="h-8 text-xs w-36"
                        placeholder="nome-da-tag"
                      />
                    )}
                    {bulkAction === "dificuldade" && (
                      <Select value={bulkValue} onValueChange={setBulkValue}>
                        <SelectTrigger className="h-8 text-xs w-28">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fácil">Fácil</SelectItem>
                          <SelectItem value="Média">Média</SelectItem>
                          <SelectItem value="Difícil">Difícil</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {bulkAction === "assunto" && (
                      <Input
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        className="h-8 text-xs w-48"
                        placeholder="Assunto canônico"
                        list="assuntos-list-bulk"
                      />
                    )}
                    <datalist id="assuntos-list-bulk">
                      {ASSUNTOS_CANONICOS.slice(0, 150).map((a) => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>

                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={applyBulk}
                      disabled={bulkRunning || deleteSelectedBusy}
                    >
                      {bulkRunning && <Loader2 size={12} className="animate-spin mr-1" />}
                      Aplicar
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      onClick={handleDeleteSelectedQuestions}
                      disabled={bulkRunning || deleteSelectedBusy}
                    >
                      {deleteSelectedBusy && <Loader2 size={12} className="animate-spin mr-1" />}
                      <Trash2 size={12} className="mr-1" />
                      Excluir selecionadas
                    </Button>

                    {bulkResult && (
                      <span className="text-xs text-green-700">{bulkResult}</span>
                    )}

                    <button
                      onClick={() => setSelected(new Set())}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      <X size={12} /> Limpar seleção
                    </button>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="duplicadas"
                className="flex-1 overflow-hidden flex flex-col m-0"
              >
                <div className="bg-white border-b px-4 py-2 flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <Search size={13} className="absolute left-2 top-1.5 text-gray-400" />
                    <Input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-7 text-xs pl-7 w-44"
                      placeholder="Buscar…"
                    />
                  </div>

                  <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas disciplinas</SelectItem>
                      {disciplinas.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      {tipos.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterSeverity}
                    onValueChange={(v) => setFilterSeverity(v as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos warnings</SelectItem>
                      <SelectItem value="error">🔴 Error</SelectItem>
                      <SelectItem value="attention">🟠 Atenção</SelectItem>
                      <SelectItem value="info">⚪ Info</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterReviewed}
                    onValueChange={(v) => setFilterReviewed(v as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="reviewed">Revisados</SelectItem>
                      <SelectItem value="pending">Não revisadas</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="ml-auto text-xs text-gray-400">
                    {filteredDuplicates.length} / {duplicates.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto m-0 p-4 space-y-3">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin text-gray-400" />
                    </div>
                  )}
                  {!loading && duplicates.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-12">
                      Nenhuma duplicata registrada para este batch.
                    </p>
                  )}
                  {!loading && duplicates.length > 0 && filteredDuplicates.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-12">
                      Nenhuma duplicata encontrada com os filtros atuais.
                    </p>
                  )}
                  {!loading &&
                    filteredDuplicates.map((item, index) => (
                    <DuplicateCard
                      key={`${item.payload?.metadata?.id ?? "dup"}-${item.existingId}-${item.idx}-${index}`}
                      item={item}
                      onOpenEditor={setEditingQuestion}
                      onToggleReviewed={toggleReviewedByDuplicateKey}
                      onApplyMetadataPatch={applyDuplicateMetadataPatch}
                      baseTextCache={baseTextCache}
                      reviewed={!!duplicateReviewed[getDuplicateCandidateKey(item)]}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* ── Tab Textos Base ─────────────────────────────────────────── */}
              <TabsContent
                value="textosbase"
                className="flex-1 overflow-hidden flex flex-col m-0"
              >
                <div className="bg-white border-b px-4 py-2 flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <Search size={13} className="absolute left-2 top-1.5 text-gray-400" />
                    <Input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-7 text-xs pl-7 w-44"
                      placeholder="Buscar…"
                    />
                  </div>

                  <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas disciplinas</SelectItem>
                      {disciplinas.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterReviewed}
                    onValueChange={(v) => setFilterReviewed(v as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="reviewed">Revisados</SelectItem>
                      <SelectItem value="pending">Não revisadas</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="ml-auto text-xs text-gray-400">
                    {filteredBaseTexts.length} / {baseTexts.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto m-0 p-4 space-y-2">
                  {baseTexts.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-12">
                      Nenhum texto base vinculado a este batch.
                    </p>
                  )}
                  {baseTexts.length > 0 && filteredBaseTexts.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-12">
                      Nenhum texto base encontrado com os filtros atuais.
                    </p>
                  )}
                  {filteredBaseTexts.map((bt) => (
                    <BaseTextCard
                      key={bt.id}
                      bt={bt}
                      reviewed={!!baseTextReviewed[bt.id]}
                      onToggleReviewed={toggleReviewedByBaseTextId}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* ── Tab Fix JSON ────────────────────────────────────────────── */}
              <TabsContent
                value="fixjson"
                className="flex-1 overflow-hidden flex flex-col m-0 p-4 gap-3"
              >
                <div>
                  <p className="text-xs text-gray-500 mb-1.5 font-medium">Presets:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() =>
                          setFixJson(
                            JSON.stringify(
                              { filter: { import_run_id: selectedRunId }, ...p.value },
                              null,
                              2
                            )
                          )
                        }
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-700"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  value={fixJson}
                  onChange={(e) => setFixJson(e.target.value)}
                  className="flex-1 font-mono text-xs resize-none"
                />

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} />
                    Dry-run (simular sem salvar)
                  </label>
                  <Button
                    onClick={applyFix}
                    disabled={fixRunning}
                    className={dryRun ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                    {fixRunning && <Loader2 size={14} className="animate-spin mr-2" />}
                    {dryRun ? "Simular" : "Aplicar fix"}
                  </Button>
                  {fixError && <span className="text-xs text-red-600">{fixError}</span>}
                </div>

                {fixResult && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 flex gap-4 text-xs font-medium border-b">
                      <span className="text-green-600">✓ {fixResult.summary.changed} alteradas</span>
                      <span className="text-gray-500">= {fixResult.summary.unchanged} sem mudança</span>
                      {fixResult.summary.failed > 0 && (
                        <span className="text-red-600">✗ {fixResult.summary.failed} erros</span>
                      )}
                      {dryRun && <span className="text-yellow-600">(dry-run)</span>}
                    </div>
                    <div className="overflow-y-auto max-h-64 divide-y">
                      {fixResult.results
                        .filter((r) => r.changed || r.error)
                        .map((r) => (
                          <div key={r.id} className="px-3 py-2 text-xs">
                            <div className="font-mono text-gray-400 mb-1">{r.id.slice(0, 12)}…</div>
                            {r.error ? (
                              <span className="text-red-600">✗ {r.error}</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {r.changes.map((c, i) => (
                                  <li key={i} className="text-gray-700">→ {c}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab Log ─────────────────────────────────────────────────── */}
              <TabsContent value="log" className="flex-1 overflow-y-auto m-0 p-4 space-y-2">
                {log.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-12">
                    Nenhuma operação nesta sessão.
                  </p>
                )}
                {log.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-3 text-xs bg-white space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-700">{entry.batchLabel}</span>
                      {entry.dryRun && (
                        <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          dry-run
                        </span>
                      )}
                      <span className="text-gray-400 ml-auto">{entry.ts}</span>
                    </div>
                    <div className="text-gray-500">Filtro: {entry.filter}</div>
                    <div className="flex gap-3">
                      <span className="text-green-600">✓ {entry.changed}</span>
                      <span className="text-gray-400">= {entry.unchanged}</span>
                      {entry.failed > 0 && (
                        <span className="text-red-600">✗ {entry.failed}</span>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>

      <QuestionEditorModal
        open={editingQuestion !== null}
        onOpenChange={(open) => {
          if (!open) setEditingQuestion(null);
        }}
        question={editorQuestion}
        onSaved={handleQuestionSaved}
      />
    </div>
  );
}
