// src/components/editor/QuestionEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema } from "./schema";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap } from "prosemirror-commands";
import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";

import "katex/dist/katex.min.css";
import katex from "katex";

import { EditorToolbar } from "./EditorToolbar";
import { MathInsert } from "./MathInsert";
import { QuestionMetadataModal } from "./QuestionMetadataModal";
import { QuestionMetadataV1, normalizeGabaritoForTipo } from "./QuestionMetaBar";
import { placeholderPlugin } from "./placeholder-plugin";
import { createSmartPastePlugin } from "@/components/editor/plugins/smartPastePlugin";

import { createQuestion, proposeQuestion } from "@/lib/questions";
import "../../app/prosemirror.css";

import { ensureImageIds } from "./ensureImageIds";
type QuestionEditorProps = {
  modal?: boolean;
  onSaved?: (info: { questionId: string; kind: "base" | "variant" }) => void;
  initial?: {
    metadata: QuestionMetadataV1;
    content: any;
  };
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

function buildPlugins(): Plugin[] {
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
    }),
    keymap({
      Enter: splitListItem(schema.nodes.list_item),
      Tab: sinkListItem(schema.nodes.list_item),
      "Shift-Tab": liftListItem(schema.nodes.list_item),
      "Mod-[": liftListItem(schema.nodes.list_item),
      "Mod-]": sinkListItem(schema.nodes.list_item),
    }),
    keymap({ "Mod-z": undo, "Mod-y": redo }),
    keymap(baseKeymap),
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
    tags: [],
    gabarito: normalizeGabaritoForTipo("Múltipla Escolha" as any),
    source: { kind: "original" },
  };
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

  if (isDiscursiveTipo(tipo)) removeOptionsInContainer(v, container);
  else ensureOptionsCountInContainer(v, container, 5);
}

/* ---------- set_questions helpers ---------- */

function isRootSetQuestions(doc: any) {
  const root = doc.childCount ? doc.child(0) : null;
  return !!root && schema.nodes.set_questions && root.type === schema.nodes.set_questions;
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

function addQuestionItem(v: EditorView) {
  if (!schema.nodes.set_questions || !schema.nodes.question_item) return;

  ensureSetQuestionsRoot(v);

  const root = v.state.doc.childCount ? v.state.doc.child(0) : null;
  if (!root || root.type !== schema.nodes.set_questions) return;

  const cur = findContainerAtSelection(v);

  let insertPos = Number(root.nodeSize) - 1;
  if (cur && cur.kind === "question_item") {
    insertPos = Number(cur.pos) + Number(cur.node.nodeSize);
  }

  const item = schema.nodes.question_item.create({ answerKey: null }, [
    schema.nodes.statement.create(null, [schema.nodes.paragraph.create()]),
    // options opcional; não cria
  ]);

  v.dispatch(v.state.tr.insert(insertPos, item));
  v.focus();
}

function removeCurrentQuestionItem(v: EditorView) {
  if (!schema.nodes.set_questions || !schema.nodes.question_item) return;

  const root = v.state.doc.childCount ? v.state.doc.child(0) : null;
  if (!root || root.type !== schema.nodes.set_questions) return;

  const cur = findContainerAtSelection(v);
  if (!cur || cur.kind !== "question_item") return;

  // conta itens (question_item+)
  let count = 0;
  root.forEach((child: any) => {
    if (child.type === schema.nodes.question_item) count += 1;
  });
  if (count <= 1) return;

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

function findAllQuestionItems(state: any): { pos: number; answerKey: any | null }[] {
  const items: { pos: number; answerKey: any | null }[] = [];
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === "question_item") {
      items.push({ pos, answerKey: node.attrs?.answerKey ?? null });
      return false;
    }
  });
  return items;
}

/* ---------- component ---------- */

export function QuestionEditor({ modal, onSaved, initial }: QuestionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<EditorView | null>(null);
  const [, force] = useState(0);

  const [meta, setMeta] = useState<QuestionMetadataV1>(() => initial?.metadata ?? defaultMetadata());
  const metaRef = useRef(meta);
  useEffect(() => void (metaRef.current = meta), [meta]);

  // FIX: quando abrir questão salva (initial chega depois), sincroniza meta
  useEffect(() => {
    if (initial?.metadata) setMeta(initial.metadata);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.metadata]);

  const [mathDialog, setMathDialog] = useState<MathDialogState>({ open: false });
  const [metaDialog, setMetaDialog] = useState({ open: false, saveAfter: false });

  const [textLines, setTextLines] = useState(0);
  const [optionCount, setOptionCount] = useState(5);
  const [editorMaxWidthCm, setEditorMaxWidthCm] = useState<8.5 | 18>(8.5);

  const plugins = useMemo(buildPlugins, []);

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
        force((n) => n + 1);
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

    try {
      await createQuestion(payload);
      setMeta(payload.metadata);
      onSaved?.({ questionId: meta.id, kind: "base" });
      if (!modal) window.alert("Salvo.");
    } catch (e: any) {
      if (e?.status === 409) {
        await proposeQuestion({
          questionId: meta.id,
          metadata: payload.metadata,
          content: payload.content,
        });
        onSaved?.({ questionId: meta.id, kind: "variant" });
        if (!modal) window.alert("Salvo como variante.");
        return;
      }
      if (!modal) window.alert("Erro ao salvar.");
    }
  };

  const handleSave = () => {
    if (!hasEssentialMetadata(meta)) setMetaDialog({ open: true, saveAfter: true });
    else void performSave();
  };

  const handleNew = () => {
    if (!view) return;

    try {
      localStorage.removeItem("pmeditor:last");
    } catch {}

    view.updateState(EditorState.create({ doc: defaultDoc(), plugins }));
    view.focus();

    setMeta(defaultMetadata());
    setMathDialog({ open: false });
    setMetaDialog({ open: false, saveAfter: false });

    setEditorMaxWidthCm(8.5);

    recompute(view);
    force((n) => n + 1);
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
      force((n) => n + 1);
    } catch {}
  };

  const handleToolbarAction = (action: string) => {
    if (!view) return;

    switch (action) {
      case "convert-to-setquestions": {
        ensureSetQuestionsRoot(view);
        recompute(view);
        force((n) => n + 1);
        return;
      }
      case "add-question-item": {
        addQuestionItem(view);
        recompute(view);
        force((n) => n + 1);
        return;
      }
      case "remove-question-item": {
        removeCurrentQuestionItem(view);
        recompute(view);
        force((n) => n + 1);
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
  // ----------------------------------------------------------------

    return (
    <div className="w-full min-h-screen bg-[#d3d3d3] p-4">
      <div className="w-full max-w-[210mm] mx-auto">
        {/* Toolbar Única no Topo */}
        <div className="mb-4 bg-white rounded-lg shadow-sm p-2">
          <EditorToolbar
            view={view}
            metadata={meta}
            onOpenMath={() =>
              setMathDialog({ open: true, mode: "new", pos: null, latex: "\\frac{a}{b}" })
            }
            onNew={handleNew}
            onRecover={handleRecover}
            onOpenMetadata={() => setMetaDialog({ open: true, saveAfter: false })}
            onSave={handleSave}
            onAction={handleToolbarAction}
            optionsCount={optionCount}
          />

          {textLines > LINE_LIMIT && (
            <div className="text-xs px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200">
              {textLines} linhas (limite {LINE_LIMIT})
            </div>
          )}
        </div>

        {/* Folha A4 Centralizada */}
        <div
          ref={editorRef}
          className="focus:outline-none shadow-2xl"
          style={{ width: "210mm" }}
        />

        {/* Modais Preservados Exatamente como estavam */}
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
        />
      </div>
    </div>
  );
}
