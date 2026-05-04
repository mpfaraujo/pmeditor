// src/components/editor/QuestionEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema } from "./schema";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";

import "katex/dist/katex.min.css";
import katex from "katex";
import "katex/contrib/mhchem";

import { EditorToolbar } from "./EditorToolbar";
import { MathInsert } from "./MathInsert";
import { QuestionMetadataModal } from "./QuestionMetadataModal";
import { QuestionMetadataV1, normalizeGabaritoForTipo, type QuestionType } from "./QuestionMetaBar";
import { placeholderPlugin } from "./placeholder-plugin";
import { createSmartPastePlugin } from "@/components/editor/plugins/smartPastePlugin";
import { verseNumberingPlugin } from "@/components/editor/plugins/verseNumberingPlugin";
import { gapCursor } from "prosemirror-gapcursor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { createQuestion, proposeQuestion, updateQuestion } from "@/lib/questions";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";
import { useAuth } from "@/contexts/AuthContext";
import "../../app/prosemirror.css";
import QuestionRendererProva from "@/components/Questions/QuestionRendererProva";
import "@/app/editor/prova/montar/prova.css";

import { ensureImageIds } from "./ensureImageIds";
import { BaseTextPickerModal } from "./BaseTextPickerModal";
import { getBaseText } from "@/lib/baseTexts";
import { useLineRefMeasure } from "@/hooks/useLineRefMeasure";
type QuestionEditorProps = {
  modal?: boolean;
  onSaved?: (info: { questionId: string; kind: "base" | "variant" }) => void;
  onNewRequest?: () => void;
  initial?: {
    metadata: QuestionMetadataV1;
    content: any;
  };
  overrideSave?: (doc: any) => Promise<void>;
};

const LINE_LIMIT = 10;
const LETTERS = ["A", "B", "C", "D", "E"] as const;

/* ---------- utils ---------- */

function estimateLines(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  let lineHeight = parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    const fontSize = parseFloat(style.fontSize) || 12;
    lineHeight = fontSize * 1.35;
  }

  if (!rect.height || !lineHeight) return 0;
  return Math.max(0, Math.round(rect.height / lineHeight));
}

/* ---------- Math NodeView ---------- */

class MathInlineView {
  dom: HTMLSpanElement;
  private node: any;

  constructor(node: any) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.className = "math-inline";
    this.dom.contentEditable = "false";
    this.render();
  }

  render() {
    const latex = (this.node.attrs?.latex || "").toString();
    this.dom.innerHTML = "";
    try {
      katex.render(latex || "\\;", this.dom, { throwOnError: false });
    } catch {
      this.dom.textContent = latex;
    }
  }

  update(node: any) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }
}

type MathDialogState =
  | { open: false }
  | { open: true; mode: "new" | "edit"; pos: number | null; latex: string };

/* ---------- plugins ---------- */

function buildPlugins(
  onYamlMetadata?: (meta: any) => void,
  onMathShortcut?: () => void,
  toolbarCallbackRef?: { current: (() => void) | null },
): Plugin[] {
  return [
    history(),
    placeholderPlugin({ paragraph: "Digite aqui..." }),
    inputRules({
      rules: [
        wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
        wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list),
        wrappingInputRule(
          /^(I{1,3}|IV|V|VI{0,3}|IX|X)\.\s$/i,
          schema.nodes.roman_list
        ),
        wrappingInputRule(/^([a-z])\.\s$/, schema.nodes.alpha_list),
        wrappingInputRule(/^\(VF\)\s$/i, schema.nodes.assertive_list),
      ],
    }),
    createSmartPastePlugin({
      uploadEndpoint: "https://mpfaraujo.com.br/guardafiguras/api/upload.php",
      uploadToken: "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes",
      maxImageWidthCm: 8,
      stripAllHtmlImages: false,
      onYamlMetadata,
    }),
    keymap({
      "Mod-b": toggleMark(schema.marks.strong),
      "Mod-i": toggleMark(schema.marks.em),
      "Mod-u": toggleMark(schema.marks.underline),
      "Mod-.": toggleMark(schema.marks.superscript),
      "Mod-,": toggleMark(schema.marks.subscript),
      "Mod-k": (_state, _dispatch, _view) => {
        onMathShortcut?.();
        return true;
      },
      Enter: splitListItem(schema.nodes.list_item),
      Tab: sinkListItem(schema.nodes.list_item),
      "Shift-Tab": liftListItem(schema.nodes.list_item),
      "Mod-[": liftListItem(schema.nodes.list_item),
      "Mod-]": sinkListItem(schema.nodes.list_item),
    }),
    keymap({ "Mod-z": undo, "Mod-y": redo }),
    keymap(baseKeymap),
    verseNumberingPlugin,
    gapCursor(),
    new Plugin({
      view() {
        return { update() { toolbarCallbackRef?.current?.(); } };
      },
    }),
  ];
}

/* ---------- defaults ---------- */

function defaultDoc() {
  return schema.node("doc", null, [
    schema.node("question", null, [
      schema.node("statement", null, [schema.node("paragraph")]),
      schema.node(
        "options",
        null,
        LETTERS.map((l) =>
          schema.nodes.option.create({ letter: l }, schema.nodes.paragraph.create())
        )
      ),
    ]),
  ]);
}

function newId() {
  // @ts-ignore
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function defaultMetadata(): QuestionMetadataV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: "Múltipla Escolha",
    dificuldade: "Média",
    nivel: "medio",
    tags: [],
    gabarito: normalizeGabaritoForTipo("Múltipla Escolha" as any),
    source: { kind: "original" },
  };
}

function collectTextAnchorIdsFromJson(node: any, acc = new Set<string>()): Set<string> {
  if (!node || typeof node !== "object") return acc;

  const marks = Array.isArray(node.marks) ? node.marks : [];
  for (const mark of marks) {
    if (mark?.type === "text_anchor" && typeof mark.attrs?.id === "string" && mark.attrs.id.trim()) {
      acc.add(mark.attrs.id.trim());
    }
  }

  const content = Array.isArray(node.content) ? node.content : [];
  for (const child of content) {
    collectTextAnchorIdsFromJson(child, acc);
  }

  return acc;
}

type SavedQuestionV1 = { metadata: QuestionMetadataV1; content: any };
const isSavedQuestionV1 = (x: any): x is SavedQuestionV1 => x && x.metadata && x.content;

const hasEssentialMetadata = (m: QuestionMetadataV1) => !!(m.disciplina && m.assunto);
const isDiscursiveTipo = (t?: string) => (t || "").toLowerCase().includes("discurs");

/* ---------- options helpers (por container) ---------- */

type ContainerHit = { kind: "question" | "question_item"; pos: number; node: any };

function findContainerAtSelection(v: EditorView): ContainerHit | null {
  const $from = v.state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (schema.nodes.question_item && n.type === schema.nodes.question_item) {
      return { kind: "question_item", pos: $from.before(d), node: n };
    }
    if (n.type === schema.nodes.question) {
      return { kind: "question", pos: $from.before(d), node: n };
    }
  }
  return null;
}

function countOptionsInNode(node: any): number {
  let n = 0;
  node.descendants((x: any) => {
    if (x.type === schema.nodes.option) n += 1;
  });
  return n;
}

function findOptionsInContainer(container: ContainerHit): { pos: number; node: any } | null {
  let found: { pos: number; node: any } | null = null;
  container.node.descendants((node: any, relPos: number) => {
    if (node.type === schema.nodes.options) {
      found = { pos: container.pos + relPos, node };
      return false;
    }
    return !found;
  });
  return found;
}

function removeOptionsInContainer(v: EditorView, container: ContainerHit) {
  const hit = findOptionsInContainer(container);
  if (!hit) return;
  const from = hit.pos;
  const to = hit.pos + Number(hit.node.nodeSize);
  v.dispatch(v.state.tr.delete(from, to));
}

function ensureOptionsCountInContainer(v: EditorView, container: ContainerHit, target: number) {
  const clamped = Math.max(2, Math.min(5, target));
  const hit = findOptionsInContainer(container);

  if (!hit) {
    const children = Array.from({ length: clamped }, (_, i) =>
      schema.nodes.option.create({ letter: LETTERS[i] }, schema.nodes.paragraph.create())
    );

    const optionsNode = schema.nodes.options.create(null, children);
    const insertPos = Number(container.pos) + Number(container.node.nodeSize) - 1;
    v.dispatch(v.state.tr.insert(insertPos, optionsNode));
    return;
  }

  const { pos, node } = hit;
  const current = Number(node.childCount);
  if (current === clamped) return;

  const tr = v.state.tr;

  if (current < clamped) {
    let insertPos = Number(pos) + Number(node.nodeSize) - 1;
    for (let i = current; i < clamped; i++) {
      const opt = schema.nodes.option.create(
        { letter: LETTERS[i] },
        schema.nodes.paragraph.create()
      );
      tr.insert(insertPos, opt);
      insertPos += Number(opt.nodeSize);
    }
  } else {
    let from = Number(pos) + 1;
    for (let i = 0; i < clamped; i++) {
      from += Number(node.child(i).nodeSize);
    }
    const to = Number(pos) + Number(node.nodeSize) - 1;
    tr.delete(from, to);
  }

  v.dispatch(tr);
}

function applyTipoToDoc(v: EditorView, tipo: QuestionMetadataV1["tipo"]) {
  const container = findContainerAtSelection(v);
  if (!container) return;

  if (isDiscursiveTipo(tipo)) {
    removeOptionsInContainer(v, container);
  } else {
    const hit = findOptionsInContainer(container);
    if (!hit) {
      ensureOptionsCountInContainer(v, container, 5);
      return;
    }
    // Conta só opções com conteúdo real (content.size > 2 funciona mesmo para options com só math)
    // Uma option vazia = apenas um parágrafo vazio = content.size exatamente 2
    let nonEmpty = 0;
    for (let i = 0; i < hit.node.childCount; i++) {
      if (hit.node.child(i).content.size > 2) nonEmpty++;
    }
    const target = nonEmpty > 0 ? nonEmpty : hit.node.childCount;
    ensureOptionsCountInContainer(v, container, target > 0 ? target : 5);
  }
}

/* ---------- set_questions helpers ---------- */

function isRootSetQuestions(doc: any) {
  const root = doc.childCount ? doc.child(0) : null;
  return !!root && schema.nodes.set_questions && root.type === schema.nodes.set_questions;
}

function docHasBaseText(doc: any): boolean {
  let found = false;
  try {
    doc.descendants((node: any) => {
      if (node.type === schema.nodes.base_text) {
        found = true;
        return false;
      }
      return true;
    });
  } catch {
    return false;
  }
  return found;
}

function ensureSetQuestionsRoot(v: EditorView) {
  if (!schema.nodes.set_questions || !schema.nodes.question_item) return;

  if (isRootSetQuestions(v.state.doc)) return;

  const root = v.state.doc.childCount ? v.state.doc.child(0) : null;
  if (!root || root.type !== schema.nodes.question) return;

  let base: any | null = null;
  let statement: any | null = null;
  let options: any | null = null;

  root.forEach((child: any) => {
    if (child.type === schema.nodes.base_text) base = child;
    else if (child.type === schema.nodes.statement) statement = child;
    else if (child.type === schema.nodes.options) options = child;
  });

  const baseTextNode =
    base ?? schema.nodes.base_text.create(null, [schema.nodes.paragraph.create()]);

  const itemChildren: any[] = [
    statement ?? schema.nodes.statement.create(null, [schema.nodes.paragraph.create()]),
  ];
  if (options) itemChildren.push(options);

  const item = schema.nodes.question_item.create(null, itemChildren);
  const setQuestions = schema.nodes.set_questions.create(null, [baseTextNode, item]);

  // FIX: troca o CONTEÚDO do doc (0..doc.content.size), sem offsets inventados
  const from = 0;
  const to = v.state.doc.content.size;
  v.dispatch(v.state.tr.replaceWith(from, to, setQuestions));
  v.focus();
}

function isSetInGroupMode(state: any): boolean {
  let found = false;
  state.doc.descendants((node: any) => {
    if (schema.nodes.question_group && node.type === schema.nodes.question_group) {
      found = true;
      return false;
    }
  });
  return found;
}

function countGroups(state: any): number {
  let count = 0;
  state.doc.descendants((node: any) => {
    if (schema.nodes.question_group && node.type === schema.nodes.question_group) count++;
  });
  return count;
}

function findCurrentGroup(state: any): { pos: number; node: any } | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (schema.nodes.question_group && n?.type === schema.nodes.question_group) {
      return { pos: $from.before(d), node: n };
    }
  }
  return null;
}

function addQuestionItem(v: EditorView) {
  if (!schema.nodes.set_questions || !schema.nodes.question_item) return;

  ensureSetQuestionsRoot(v);

  const root = v.state.doc.childCount ? v.state.doc.child(0) : null;
  if (!root || root.type !== schema.nodes.set_questions) return;

  const item = schema.nodes.question_item.create({ answerKey: null }, [
    schema.nodes.statement.create(null, [schema.nodes.paragraph.create()]),
  ]);

  const cur = findContainerAtSelection(v);
  if (cur && cur.kind === "question_item") {
    // Insert after current item — works for both flat and group mode:
    // in group mode the position is inside the group (before group's closing tag)
    v.dispatch(v.state.tr.insert(cur.pos + cur.node.nodeSize, item));
    v.focus();
    return;
  }

  // Fallback: add to last group (group mode) or end of set_questions (flat)
  if (isSetInGroupMode(v.state)) {
    let lastGroupInsertPos = -1;
    v.state.doc.descendants((node: any, pos: number) => {
      if (schema.nodes.question_group && node.type === schema.nodes.question_group) {
        lastGroupInsertPos = pos + node.nodeSize - 1;
      }
    });
    if (lastGroupInsertPos !== -1) {
      v.dispatch(v.state.tr.insert(lastGroupInsertPos, item));
      v.focus();
      return;
    }
  }

  v.dispatch(v.state.tr.insert(root.nodeSize - 1, item));
  v.focus();
}

function removeCurrentQuestionItem(v: EditorView) {
  if (!schema.nodes.set_questions || !schema.nodes.question_item) return;

  const root = v.state.doc.childCount ? v.state.doc.child(0) : null;
  if (!root || root.type !== schema.nodes.set_questions) return;

  const cur = findContainerAtSelection(v);
  if (!cur || cur.kind !== "question_item") return;

  // conta itens em qualquer profundidade (inclui question_group)
  const count = findAllQuestionItems(v.state).length;
  if (count <= 1) return;

  // Em modo grupos: se o grupo atual tem só 1 item, remove o grupo inteiro
  if (isSetInGroupMode(v.state)) {
    const grp = findCurrentGroup(v.state);
    if (grp && grp.node.childCount === 1 && countGroups(v.state) > 1) {
      v.dispatch(v.state.tr.delete(grp.pos, grp.pos + grp.node.nodeSize));
      v.focus();
      return;
    }
  }

  const from = cur.pos;
  const to = cur.pos + Number(cur.node.nodeSize);
  v.dispatch(v.state.tr.delete(from, to));
  v.focus();
}

/* ---------- answerKey helpers (set_questions) ---------- */

function findActiveQuestionItemPos(state: any): number | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n?.type?.name === "question_item") return $from.before(d);
  }
  return null;
}

function readItemAnswerKeyAtPos(state: any, pos: number): any | null {
  const n = state.doc.nodeAt(pos);
  if (!n || n.type.name !== "question_item") return null;
  return n.attrs?.answerKey ?? null;
}

function findAllQuestionItems(state: any): { pos: number; answerKey: any | null; assunto: string | null; tags: string[] | null }[] {
  const items: { pos: number; answerKey: any | null; assunto: string | null; tags: string[] | null }[] = [];
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === "question_item") {
      items.push({
        pos,
        answerKey: node.attrs?.answerKey ?? null,
        assunto: node.attrs?.assunto ?? null,
        tags: node.attrs?.tags ?? null,
      });
      return false;
    }
  });
  return items;
}

function writeItemMetaAtPos(v: EditorView, pos: number, patch: { assunto?: string | null; tags?: string[] | null }) {
  const node = v.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "question_item") return;
  const tr = v.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
  v.dispatch(tr);
}

/* ---------- component ---------- */

export function QuestionEditor({ modal, onSaved, onNewRequest, initial, overrideSave }: QuestionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const { user, isLoggedIn, defaultDisciplina, isAdmin } = useAuth();
  const [changeDescription, setChangeDescription] = useState("");
  const [changeDescriptionModal, setChangeDescriptionModal] = useState<{
    open: boolean;
    payload?: { metadata: any; content: any };
  }>({ open: false });

  const [view, setView] = useState<EditorView | null>(null);
  const toolbarCallbackRef = useRef<(() => void) | null>(null);

  const [meta, setMeta] = useState<QuestionMetadataV1>(() => {
    const m = defaultMetadata();
    if (user) {
      m.author = { id: user.googleId, name: user.nome };
      if (defaultDisciplina) m.disciplina = defaultDisciplina;
    }
    if (initial?.metadata) {
      // Merge: initial sobrescreve defaults, mas mantém campos obrigatórios
      const merged = { ...m, ...initial.metadata, id: initial.metadata.id || m.id, createdAt: initial.metadata.createdAt || m.createdAt, updatedAt: initial.metadata.updatedAt || m.updatedAt, schemaVersion: 1 as const };
      // Se o tipo veio do YAML mas o gabarito não, normaliza pro tipo correto
      if (initial.metadata.tipo && !initial.metadata.gabarito) {
        merged.gabarito = normalizeGabaritoForTipo(merged.tipo as QuestionType, m.gabarito);
      }
      return merged;
    }
    return m;
  });
  const metaRef = useRef(meta);
  useEffect(() => void (metaRef.current = meta), [meta]);

  // FIX: quando abrir questão salva (initial chega depois), sincroniza meta
  useEffect(() => {
    if (initial?.metadata) {
      setMeta((prev) => ({ ...prev, ...initial.metadata, id: initial.metadata.id || prev.id, createdAt: initial.metadata.createdAt || prev.createdAt, updatedAt: initial.metadata.updatedAt || prev.updatedAt, schemaVersion: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.metadata]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<1 | 2>(1);
  const [previewBaseTextContent, setPreviewBaseTextContent] = useState<any>(null);
  const [previewBaseTextTag, setPreviewBaseTextTag] = useState<string | null>(null);
  const [availableBaseTextAnchors, setAvailableBaseTextAnchors] = useState<string[]>([]);
  const previewContainerRef = useLineRefMeasure(previewOpen, [previewColumns]);
  const [mathDialog, setMathDialog] = useState<MathDialogState>({ open: false });
  const openMathDialogRef = useRef<() => void>(() => {});
  useEffect(() => {
    openMathDialogRef.current = () => setMathDialog({ open: true, mode: "new", pos: null, latex: "" });
  });
  const [metaDialog, setMetaDialog] = useState({ open: false, saveAfter: false });
  const [baseTextPickerOpen, setBaseTextPickerOpen] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    existingId: string;
    similarity: number;
    payload: any;
  }>({ open: false, existingId: "", similarity: 0, payload: null });

  const [textLines, setTextLines] = useState(0);
  const [optionCount, setOptionCount] = useState(5);
  const [editorMaxWidthCm, setEditorMaxWidthCm] = useState<8.5 | 18>(8.5);

  // Itens por-item do YAML aguardando aplicação no view (set_questions)
  const [pendingYamlItems, setPendingYamlItems] = useState<any[] | null>(null);

  // Callback para aplicar metadados YAML extraídos do paste
  const handleYamlMetadata = (yamlMeta: any) => {
    setMeta((prev) => {
      const merged = { ...prev };

      // Aplica campos do YAML, preservando os obrigatórios
      if (yamlMeta.tipo) merged.tipo = yamlMeta.tipo;
      if (yamlMeta.dificuldade) merged.dificuldade = yamlMeta.dificuldade;
      if (yamlMeta.disciplina) merged.disciplina = yamlMeta.disciplina;
      if (yamlMeta.assunto) merged.assunto = yamlMeta.assunto;
      if (yamlMeta.tags) merged.tags = yamlMeta.tags;
      if (yamlMeta.gabarito) merged.gabarito = yamlMeta.gabarito;
      if (yamlMeta.source) merged.source = { ...prev.source, ...yamlMeta.source };

      // Atualiza timestamp
      merged.updatedAt = new Date().toISOString();

      return merged;
    });

    // Guarda itens por-item para aplicar no view após re-render
    if (yamlMeta.items?.length) {
      setPendingYamlItems(yamlMeta.items);
    }
  };

  // Aplica dados por-item do YAML nos question_items quando o view estiver pronto
  useEffect(() => {
    if (!pendingYamlItems || !view) return;
    if (!isRootSetQuestions(view.state.doc)) return;

    const items = findAllQuestionItems(view.state);
    let tr = view.state.tr;
    let changed = false;

    pendingYamlItems.forEach((itemData: any, idx: number) => {
      if (idx >= items.length) return;
      const item = items[idx];
      const node = view.state.doc.nodeAt(item.pos);
      if (!node || node.type.name !== "question_item") return;

      const newAttrs: any = { ...node.attrs };
      if (itemData.assunto != null) newAttrs.assunto = itemData.assunto;
      if (itemData.tags != null) newAttrs.tags = itemData.tags;
      if (itemData.gabarito != null) newAttrs.answerKey = itemData.gabarito;

      tr = tr.setNodeMarkup(item.pos, undefined, newAttrs);
      changed = true;
    });

    if (changed) view.dispatch(tr);
    setPendingYamlItems(null);
  }, [pendingYamlItems, view]);

  const plugins = useMemo(
    () => buildPlugins(handleYamlMetadata, () => openMathDialogRef.current(), toolbarCallbackRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const recompute = (v: EditorView) => {
    requestAnimationFrame(() => {
      const rootEl = v.dom as HTMLElement;
      const base = rootEl.querySelector(".base-text") as HTMLElement | null;
      const stmt = rootEl.querySelector(".statement") as HTMLElement | null;
      setTextLines((base ? estimateLines(base) : 0) + (stmt ? estimateLines(stmt) : 0));

      const container = findContainerAtSelection(v);
      const n = container ? countOptionsInNode(container.node) : 0;
      setOptionCount(n);
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const doc = initial?.content ? schema.nodeFromJSON(initial.content) : defaultDoc();
    const state = EditorState.create({ doc, plugins });

    const ev = new EditorView(editorRef.current, {
      state,
      nodeViews: { math_inline: (n) => new MathInlineView(n) },
      handleDOMEvents: {
        dblclick(view, e) {
          const hit = view.posAtCoords({
            left: (e as MouseEvent).clientX,
            top: (e as MouseEvent).clientY,
          });
          if (!hit) return false;

          const $pos = view.state.doc.resolve(hit.pos);
          const node =
            $pos.nodeAfter?.type === schema.nodes.math_inline
              ? $pos.nodeAfter
              : $pos.nodeBefore?.type === schema.nodes.math_inline
                ? $pos.nodeBefore
                : null;

          if (!node) return false;

          const pos = node === $pos.nodeAfter ? hit.pos : hit.pos - node.nodeSize;

          setMathDialog({
            open: true,
            mode: "edit",
            pos,
            latex: (node.attrs?.latex || "").toString(),
          });
          return true;
        },
      },
      dispatchTransaction(tr) {
        const ns = ev.state.apply(tr);
        ev.updateState(ns);

        try {
          localStorage.setItem(
            "pmeditor:last",
            JSON.stringify({ metadata: metaRef.current, content: ns.doc.toJSON() })
          );
        } catch {}

        recompute(ev);
      },
    });

    setView(ev);
    recompute(ev);
    applyTipoToDoc(ev, (initial?.metadata ?? metaRef.current).tipo);

    return () => ev.destroy();
    // FIX: recria o editor quando o conteúdo inicial mudar (abrir questão salva)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins, initial?.content]);

  useEffect(() => {
    if (!view) return;
    applyTipoToDoc(view, meta.tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.tipo, view]);

  useEffect(() => {
    if (!view) return;
    try {
      localStorage.setItem(
        "pmeditor:last",
        JSON.stringify({ metadata: meta, content: view.state.doc.toJSON() })
      );
    } catch {}
  }, [meta, view]);

  useEffect(() => {
    let cancelled = false;

    const ids = Array.isArray(meta.baseTextIds) && meta.baseTextIds.length > 0
      ? meta.baseTextIds
      : (meta.baseTextId ? [meta.baseTextId] : []);

    if (ids.length === 0) {
      setAvailableBaseTextAnchors([]);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(ids.map((id) => getBaseText(id))).then((items) => {
      if (cancelled) return;

      const anchorSet = new Set<string>();
      for (const item of items) {
        if (!item?.content) continue;
        collectTextAnchorIdsFromJson(item.content, anchorSet);
      }

      setAvailableBaseTextAnchors(Array.from(anchorSet));
    });

    return () => {
      cancelled = true;
    };
  }, [meta.baseTextId, meta.baseTextIds]);

  const upsertMath = (latex: string) => {
    if (!view) return;

    if (mathDialog.open && mathDialog.mode === "edit" && mathDialog.pos != null) {
      const node = view.state.doc.nodeAt(mathDialog.pos);
      if (node?.type === schema.nodes.math_inline) {
        view.dispatch(
          view.state.tr.setNodeMarkup(mathDialog.pos, undefined, { ...node.attrs, latex })
        );
        view.focus();
        return;
      }
    }

    view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.math_inline.create({ latex })));
    view.focus();
  };

  const performSave = async () => {
    if (!view) return;

    const doc = ensureImageIds(view.state.doc, view.state.schema);

    const payload = {
      // OBS: para set_questions, metadata.gabarito fica irrelevante; o válido está no doc (question_item.attrs.answerKey)
      metadata: { ...meta, updatedAt: new Date().toISOString() },
      content: doc.toJSON(),
    };

    // Editando questão existente: vai direto ao caminho certo sem roundtrip create→409
    if (initial) {
      if (isAdmin) {
        try {
          await updateQuestion(payload);
          setMeta(payload.metadata);
          onSaved?.({ questionId: meta.id, kind: "base" });
          if (!modal) window.alert("Salvo.");
        } catch (e: any) {
          window.alert("Erro ao salvar: " + (e?.message ?? "erro desconhecido"));
        }
      } else {
        setChangeDescriptionModal({ open: true, payload });
      }
      return;
    }

    // Criando nova questão
    try {
      await createQuestion(payload);
      setMeta(payload.metadata);
      setChangeDescription("");
      onSaved?.({ questionId: meta.id, kind: "base" });
      if (!modal) window.alert("Salvo.");
    } catch (e: any) {
      if (e?.status === 409) {
        if (e?.body?.duplicate) {
          setDuplicateDialog({
            open: true,
            existingId: e.body.existing_id,
            similarity: e.body.similarity,
            payload,
          });
          return;
        }
      }
      window.alert("Erro ao salvar: " + (e?.message ?? "erro desconhecido"));
    }
  };

  const confirmForceSave = async () => {
    const payload = { ...duplicateDialog.payload, force: true };
    setDuplicateDialog({ open: false, existingId: "", similarity: 0, payload: null });
    try {
      await createQuestion(payload);
      setMeta(payload.metadata);
      setChangeDescription("");
      onSaved?.({ questionId: meta.id, kind: "base" });
      if (!modal) window.alert("Salvo.");
    } catch {
      if (!modal) window.alert("Erro ao salvar.");
    }
  };

  const confirmVariantSave = async () => {
    if (!changeDescriptionModal.payload) return;

    try {
      await proposeQuestion({
        questionId: meta.id,
        metadata: changeDescriptionModal.payload.metadata,
        content: changeDescriptionModal.payload.content,
        changeDescription: changeDescription.trim() || undefined,
      });
      onSaved?.({ questionId: meta.id, kind: "variant" });
      setChangeDescription(""); // Limpar após salvar
      setChangeDescriptionModal({ open: false });
      if (!modal) window.alert("Salvo como variante.");
    } catch (e) {
      if (!modal) window.alert("Erro ao salvar variante.");
    }
  };

  const handleSave = () => {
    if (overrideSave) {
      if (!view) return;
      const doc = ensureImageIds(view.state.doc, view.state.schema);
      void overrideSave(doc.toJSON());
      return;
    }
    if (!isLoggedIn) {
      window.alert("Faça login para salvar questões.");
      return;
    }
    if (!hasEssentialMetadata(meta)) setMetaDialog({ open: true, saveAfter: true });
    else void performSave();
  };

  const handleNew = () => {
    if (!view) return;

    try {
      localStorage.removeItem("pmeditor:last");
    } catch {}

    if (onNewRequest) { onNewRequest(); return; }

    view.updateState(EditorState.create({ doc: defaultDoc(), plugins }));
    view.focus();

    const newMeta = defaultMetadata();
    if (user) {
      newMeta.author = { id: user.googleId, name: user.nome };
      if (defaultDisciplina) newMeta.disciplina = defaultDisciplina;
    }
    setMeta(newMeta);
    setMathDialog({ open: false });
    setMetaDialog({ open: false, saveAfter: false });
    setChangeDescription(""); // Limpar descrição ao criar nova questão

    setEditorMaxWidthCm(8.5);

    recompute(view);
  };

  const handleRecover = () => {
    if (!view) return;

    try {
      const raw = localStorage.getItem("pmeditor:last");
      if (!raw) return;
      const json = JSON.parse(raw);
      if (!isSavedQuestionV1(json)) return;

      view.updateState(EditorState.create({ doc: schema.nodeFromJSON(json.content), plugins }));
      view.focus();
      setMeta(json.metadata);

      recompute(view);
    } catch {}
  };

  const handleToolbarAction = (action: string) => {
    if (!view) return;

    switch (action) {
      case "convert-to-setquestions": {
        ensureSetQuestionsRoot(view);
        recompute(view);
        return;
      }
      case "add-question-item": {
        addQuestionItem(view);
        recompute(view);
        return;
      }
      case "remove-question-item": {
        removeCurrentQuestionItem(view);
        recompute(view);
        return;
      }
      case "set-type-discursiva": {
        const nextTipo = "Discursiva" as QuestionMetadataV1["tipo"];
        setMeta((m) => ({ ...m, tipo: nextTipo, updatedAt: new Date().toISOString() }));
        applyTipoToDoc(view, nextTipo);
        return;
      }
      case "set-type-multipla": {
        const nextTipo = "Múltipla Escolha" as QuestionMetadataV1["tipo"];
        setMeta((m) => ({ ...m, tipo: nextTipo, updatedAt: new Date().toISOString() }));
        applyTipoToDoc(view, nextTipo);
        return;
      }

      case "set-width-narrow":
        setEditorMaxWidthCm(8.5);
        return;
      case "set-width-wide":
        setEditorMaxWidthCm(18);
        return;

      case "inc-options": {
        if (isDiscursiveTipo(metaRef.current.tipo)) {
          const nextTipo = "Múltipla Escolha" as QuestionMetadataV1["tipo"];
          setMeta((m) => ({ ...m, tipo: nextTipo, updatedAt: new Date().toISOString() }));
        }
        const c = findContainerAtSelection(view);
        if (!c) return;
        ensureOptionsCountInContainer(view, c, optionCount + 1);
        recompute(view);
        return;
      }
      case "dec-options": {
        if (isDiscursiveTipo(metaRef.current.tipo)) return;
        const c = findContainerAtSelection(view);
        if (!c) return;
        ensureOptionsCountInContainer(view, c, optionCount - 1);
        recompute(view);
        return;
      }

      case "toggle-options": {
        const c = findContainerAtSelection(view);
        if (!c) return;

        if (isDiscursiveTipo(metaRef.current.tipo)) {
          const nextTipo = "Múltipla Escolha" as QuestionMetadataV1["tipo"];
          setMeta((m) => ({ ...m, tipo: nextTipo, updatedAt: new Date().toISOString() }));
          ensureOptionsCountInContainer(view, c, 5);
          recompute(view);
          return;
        }

        const hit = findOptionsInContainer(c);
        if (hit) removeOptionsInContainer(view, c);
        else ensureOptionsCountInContainer(view, c, 5);

        recompute(view);
        return;
      }

      case "basetext":
        setBaseTextPickerOpen(true);
        return;

      default:
        return;
    }
  };

  // --------- answerKey plumbing (question vs set_questions) ---------
  const docType = view?.state.doc.type.name;
  const docKind: "question" | "set_questions" =
    view && isRootSetQuestions(view.state.doc) ? "set_questions" : "question";

  const activeItemPos =
    docKind === "set_questions" && view ? findActiveQuestionItemPos(view.state) : null;

  const activeItemAnswerKey =
    docKind === "set_questions" && view && activeItemPos != null
      ? readItemAnswerKeyAtPos(view.state, activeItemPos)
      : null;

  const allItems =
    docKind === "set_questions" && view ? findAllQuestionItems(view.state) : [];

  const writeActiveItemAnswerKey = (answerKey: any | null) => {
    if (!view) return;
    if (activeItemPos == null) return;

    const node = view.state.doc.nodeAt(activeItemPos);
    if (!node || node.type.name !== "question_item") return;

    const tr = view.state.tr.setNodeMarkup(activeItemPos, undefined, {
      ...node.attrs,
      answerKey,
    });

    view.dispatch(tr);
  };

  const writeItemAnswerKeyAtPos = (pos: number, answerKey: any | null) => {
    if (!view) return;
    const node = view.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "question_item") return;
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, answerKey })
    );
  };

  const handleItemMetaChangeAtPos = (pos: number, patch: { assunto?: string | null; tags?: string[] | null }) => {
    if (!view) return;
    writeItemMetaAtPos(view, pos, patch);
  };
  // ----------------------------------------------------------------

    return (
    <div className="w-full min-h-screen bg-[#d3d3d3] p-2 sm:p-3">
      {/* Toolbar — largura total em mobile, centralizada (max 210mm) em desktop */}
      <div className="mb-2 bg-white rounded-lg shadow p-2 sm:max-w-[210mm] sm:mx-auto border-b border-blue-100">
        <EditorToolbar
          view={view}
          toolbarCallbackRef={toolbarCallbackRef}
          metadata={meta}
          availableAnchors={availableBaseTextAnchors}
          onOpenMath={() =>
            setMathDialog({ open: true, mode: "new", pos: null, latex: "" })
          }
          onNew={handleNew}
          onRecover={handleRecover}
          onOpenMetadata={() => setMetaDialog({ open: true, saveAfter: false })}
          onSave={handleSave}
          onAction={handleToolbarAction}
          onPreview={() => {
            setPreviewBaseTextContent(null);
            setPreviewBaseTextTag(null);
            const btId = metaRef.current?.baseTextId;
            if (btId) {
              getBaseText(btId).then((bt) => {
                setPreviewBaseTextContent(bt?.content ?? null);
                setPreviewBaseTextTag(bt?.tag ?? null);
              });
            }
            setPreviewOpen(true);
          }}
          optionsCount={optionCount}
          isSetQuestions={docKind === "set_questions"}
          itemCount={allItems.length}
        />

        {textLines > LINE_LIMIT && (
          <div className="text-xs px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200">
            {textLines} linhas (limite {LINE_LIMIT})
          </div>
        )}
      </div>

      {/* Folha A4 — container com scroll horizontal em mobile */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={editorRef}
          className="question-editor-sheet focus:outline-none shadow-2xl mx-auto"
          style={{ width: "210mm" }}
        />
      </div>

      {/* Modais */}
        <MathInsert
          open={mathDialog.open}
          onOpenChange={(o) => {
            if (!o) setMathDialog({ open: false });
          }}
          onInsert={upsertMath}
          initialLatex={mathDialog.open ? mathDialog.latex : undefined}
          title={mathDialog.open && mathDialog.mode === "edit" ? "Editar fórmula" : "Inserir fórmula"}
        />

        <QuestionMetadataModal
          open={metaDialog.open}
          onOpenChange={(open) => {
            if (!open && metaDialog.saveAfter) {
              setMetaDialog({ open: false, saveAfter: false });
              if (hasEssentialMetadata(meta)) void performSave();
            } else {
              setMetaDialog({ ...metaDialog, open });
            }
          }}
          value={meta}
          onChange={setMeta}
          onSave={metaDialog.saveAfter ? () => void performSave() : undefined}
          docKind={docKind}
          itemAnswerKey={activeItemAnswerKey}
          onItemAnswerKeyChange={writeActiveItemAnswerKey}
          allItems={allItems}
          onItemAnswerKeyChangeAtPos={writeItemAnswerKeyAtPos}
          onItemMetaChangeAtPos={handleItemMetaChangeAtPos}
        />

        <BaseTextPickerModal
          open={baseTextPickerOpen}
          onOpenChange={setBaseTextPickerOpen}
          disciplina={meta.disciplina}
          onSelect={(id, _tag) => {
            setMeta((m) => {
              const prev = Array.isArray(m.baseTextIds) && m.baseTextIds.length > 0
                ? m.baseTextIds
                : (m.baseTextId ? [m.baseTextId] : []);
              const next = prev.includes(id) ? prev : [...prev, id];
              return { ...m, baseTextIds: next, baseTextId: next[0], updatedAt: new Date().toISOString() };
            });
          }}
        />

        {/* Modal de Descrição de Mudança (ao criar variante) */}
        <Dialog
          open={changeDescriptionModal.open}
          onOpenChange={(open) => {
            if (!open) {
              setChangeDescriptionModal({ open: false });
              setChangeDescription("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Descrever mudança</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Esta questão já existe no banco. Você está criando uma nova versão editada.
              </p>
              <div>
                <label htmlFor="change-desc" className="block text-sm font-medium mb-2">
                  O que você mudou nesta questão? <span className="text-red-600">*</span>
                </label>
                <Textarea
                  id="change-desc"
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  placeholder="ex: corrigiu gabarito de B para A&#10;ex: ajustou texto da alternativa C para maior clareza&#10;ex: corrigiu erro de digitação no enunciado"
                  rows={4}
                  className="w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setChangeDescriptionModal({ open: false });
                  setChangeDescription("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmVariantSave}
                disabled={!changeDescription.trim()}
              >
                Salvar variante
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de preview da renderização atual */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="w-[calc(21cm+4rem)] max-w-none max-h-[92vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 flex-row items-center justify-between">
              <DialogTitle className="text-base">Preview</DialogTitle>
              <div className="flex items-center gap-1 pr-8">
                <button
                  onClick={() => setPreviewColumns(1)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${previewColumns === 1 ? "bg-slate-800 text-white border-slate-800" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                >1 coluna</button>
                <button
                  onClick={() => setPreviewColumns(2)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${previewColumns === 2 ? "bg-slate-800 text-white border-slate-800" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                >2 colunas</button>
              </div>
            </DialogHeader>
            <div className="flex justify-center py-6 px-4 bg-slate-100">
              <div
                ref={previewContainerRef}
                className="prova-page bg-white shadow-md"
                style={{ height: "auto", minHeight: "auto", overflow: "visible" }}
              >
                <div style={{ maxWidth: previewColumns === 2 ? "8.5cm" : "18cm" }}>
                  {previewOpen && view && (
                    <>
                      {previewBaseTextContent && !docHasBaseText(view.state.doc) && (
                        <div className="mb-3 space-y-1">
                          {previewBaseTextTag && (
                            <div className="text-xs font-bold text-black">
                              Texto {previewBaseTextTag}
                            </div>
                          )}
                          <QuestionRendererProva content={{
                            type: "doc",
                            content: [{ type: "question", content: [{ type: "base_text", content: previewBaseTextContent?.content ?? [] }] }],
                          }} />
                        </div>
                      )}
                      <QuestionRendererProva content={view.state.doc.toJSON()} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DuplicateWarningDialog
          open={duplicateDialog.open}
          existingId={duplicateDialog.existingId}
          similarity={duplicateDialog.similarity}
          newContent={duplicateDialog.payload?.content}
          onConfirm={confirmForceSave}
          onCancel={() => setDuplicateDialog({ open: false, existingId: "", similarity: 0, payload: null })}
        />
    </div>
  );
}
