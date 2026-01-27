// QuestionEditor.tsx
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

import "../../app/prosemirror.css";

const LINE_LIMIT = 10;

function estimateLines(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  let lineHeight = parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    const fontSize = parseFloat(style.fontSize) || 12;
    lineHeight = fontSize * 1.35;
  }

  const h = rect.height;
  if (!Number.isFinite(h) || h <= 0 || lineHeight <= 0) return 0;

  return Math.max(0, Math.round(h / lineHeight));
}

class MathInlineView {
  dom: HTMLSpanElement;
  private node: any;

  constructor(node: any) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.className = "math-inline";
    this.dom.setAttribute("data-math", node.attrs.latex || "");
    this.dom.contentEditable = "false";
    this.render();
  }

  private render() {
    const latex = (this.node?.attrs?.latex || "").toString();
    this.dom.innerHTML = "";
    try {
      katex.render(latex || "\\;", this.dom, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      this.dom.textContent = latex;
    }
  }

  update(node: any) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.setAttribute("data-math", node.attrs.latex || "");
    this.render();
    return true;
  }
}

type MathDialogState =
  | { open: false }
  | { open: true; mode: "new" | "edit"; pos: number | null; latex: string };

function buildPlugins(): Plugin[] {
  return [
    history(),
    placeholderPlugin({
      paragraph: "Digite aqui...",
    }),
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

function defaultDoc() {
  return schema.node("doc", null, [
    schema.node("question", null, [
      schema.node("statement", null, [
        schema.node("paragraph"),
      ]),
      schema.node("options", null, [
        schema.node("option", { letter: "A" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "B" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "C" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "D" }, [schema.node("paragraph")]),
      ]),
    ]),
  ]);
}

function newId() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
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
    gabarito: normalizeGabaritoForTipo("Múltipla Escolha"),
    source: { kind: "original" },
  };
}

type SavedQuestionV1 = { metadata: QuestionMetadataV1; content: any };

function isSavedQuestionV1(x: any): x is SavedQuestionV1 {
  return x && typeof x === "object" && x.metadata && x.content;
}

function hasEssentialMetadata(meta: QuestionMetadataV1): boolean {
  return !!(meta.disciplina && meta.assunto);
}

export function QuestionEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<EditorView | null>(null);
  const [, forceUpdate] = useState(0);
  const [mathDialog, setMathDialog] = useState<MathDialogState>({ open: false });
  const [metaDialog, setMetaDialog] = useState<{ open: boolean; saveAfter: boolean }>({
    open: false,
    saveAfter: false,
  });
  const [meta, setMeta] = useState<QuestionMetadataV1>(() => defaultMetadata());

  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const [textLines, setTextLines] = useState(0);

  const plugins = useMemo(() => buildPlugins(), []);

  const recomputeTextLines = (v: EditorView) => {
    requestAnimationFrame(() => {
      const root = v.dom as HTMLElement;

      const base = root.querySelector(".base-text") as HTMLElement | null;
      const stmt = root.querySelector(".statement") as HTMLElement | null;

      const total = (base ? estimateLines(base) : 0) + (stmt ? estimateLines(stmt) : 0);
      setTextLines(total);
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({ doc: defaultDoc(), plugins });

    const editorView = new EditorView(editorRef.current, {
      state,
      nodeViews: {
        math_inline(node) {
          return new MathInlineView(node);
        },
      },
      handleDOMEvents: {
        dblclick: (view, event) => {
          const e = event as MouseEvent;
          const coords = { left: e.clientX, top: e.clientY };
          const hit = view.posAtCoords(coords);
          if (!hit) return false;

          const $pos = view.state.doc.resolve(hit.pos);
          const after = $pos.nodeAfter;
          const before = $pos.nodeBefore;

          const isMathAfter = after && after.type === schema.nodes.math_inline;
          const isMathBefore = before && before.type === schema.nodes.math_inline;

          if (!isMathAfter && !isMathBefore) return false;

          const node = isMathAfter ? after : before;
          const nodePos = isMathAfter ? hit.pos : hit.pos - (before?.nodeSize ?? 0);

          setMathDialog({
            open: true,
            mode: "edit",
            pos: nodePos,
            latex: (node?.attrs?.latex || "").toString(),
          });

          return true;
        },
      },
      dispatchTransaction(transaction) {
        const newState = editorView.state.apply(transaction);
        editorView.updateState(newState);

        try {
          const payload: SavedQuestionV1 = {
            metadata: metaRef.current,
            content: newState.doc.toJSON(),
          };
          localStorage.setItem("pmeditor:last", JSON.stringify(payload));
        } catch {
          // ignore
        }

        recomputeTextLines(editorView);
        forceUpdate((n) => n + 1);
      },
    });

    setView(editorView);
    recomputeTextLines(editorView);

    return () => editorView.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins]);

  const openNewMath = () => {
    setMathDialog({ open: true, mode: "new", pos: null, latex: "\\frac{a}{b}" });
  };

  const upsertMath = (latex: string) => {
    if (!view) return;

    if (mathDialog.open && mathDialog.mode === "edit" && mathDialog.pos !== null) {
      const pos = mathDialog.pos;
      const node = view.state.doc.nodeAt(pos);

      if (node && node.type === schema.nodes.math_inline) {
        const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
        view.dispatch(tr);
        view.focus();
        return;
      }
    }

    const mathNode = schema.nodes.math_inline.create({ latex });
    view.dispatch(view.state.tr.replaceSelectionWith(mathNode));
    view.focus();
  };

  const performSave = () => {
    if (!view) return;

    const payload: SavedQuestionV1 = {
      metadata: meta,
      content: view.state.doc.toJSON(),
    };

    const text = JSON.stringify(payload, null, 2);

    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const safeDisc = (meta.disciplina ?? "disciplina").replace(/[^\w\-]+/g, "_");
    const safeAss = (meta.assunto ?? "assunto").replace(/[^\w\-]+/g, "_");
    a.download = `${safeDisc}_${safeAss}_${meta.id}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    try {
      localStorage.setItem("pmeditor:last", JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const handleSave = () => {
    if (!hasEssentialMetadata(meta)) {
      setMetaDialog({ open: true, saveAfter: true });
    } else {
      performSave();
    }
  };

  const handleLoad = () => fileInputRef.current?.click();

  const handleFilePicked = async (file: File | null) => {
    if (!file || !view) return;

    const text = await file.text();
    const json = JSON.parse(text);

    let nextMeta = defaultMetadata();
    let contentJson: any;

    if (isSavedQuestionV1(json)) {
      nextMeta = json.metadata as QuestionMetadataV1;
      contentJson = json.content;
    } else {
      contentJson = json;
    }

    const doc = schema.nodeFromJSON(contentJson);
    const newState = EditorState.create({ doc, plugins });
    view.updateState(newState);
    view.focus();

    setMeta(nextMeta);

    try {
      const payload: SavedQuestionV1 = { metadata: nextMeta, content: newState.doc.toJSON() };
      localStorage.setItem("pmeditor:last", JSON.stringify(payload));
    } catch {
      // ignore
    }

    recomputeTextLines(view);
    forceUpdate((n) => n + 1);
  };

  const handleNew = () => {
    if (!view) return;

    try {
      localStorage.removeItem("pmeditor:last");
    } catch {
      // ignore
    }

    const newState = EditorState.create({ doc: defaultDoc(), plugins });
    view.updateState(newState);
    view.focus();

    setMeta(defaultMetadata());
    recomputeTextLines(view);
    forceUpdate((n) => n + 1);
  };

  const handleRecover = () => {
    if (!view) return;

    try {
      const raw = localStorage.getItem("pmeditor:last");
      if (!raw) return;
      const json = JSON.parse(raw);

      if (isSavedQuestionV1(json)) {
        const doc = schema.nodeFromJSON(json.content);
        const newState = EditorState.create({ doc, plugins });
        view.updateState(newState);
        view.focus();
        setMeta(json.metadata);

        recomputeTextLines(view);
        forceUpdate((n) => n + 1);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!view) return;
    try {
      const payload: SavedQuestionV1 = {
        metadata: meta,
        content: view.state.doc.toJSON(),
      };
      localStorage.setItem("pmeditor:last", JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [meta, view]);

  return (
    <div className="w-full mx-auto p-4 lg:pr-64">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap lg:hidden mb-4">
          <EditorToolbar
            view={view}
            metadata={meta}
            onLoadedMetadata={(nextMeta) => setMeta(nextMeta)}
            onOpenMath={openNewMath}
            onNew={handleNew}
            onRecover={handleRecover}
            onOpenMetadata={() => setMetaDialog({ open: true, saveAfter: false })}
            onLoad={handleLoad}

          />

          {textLines > LINE_LIMIT && (
            <div className="text-xs px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200">
              {textLines} linhas (limite {LINE_LIMIT})
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <EditorToolbar
            view={view}
            metadata={meta}
            onLoadedMetadata={(nextMeta) => setMeta(nextMeta)}
            onOpenMath={openNewMath}
            onNew={handleNew}
            onRecover={handleRecover}
            onOpenMetadata={() => setMetaDialog({ open: true, saveAfter: false })}
            onLoad={handleLoad}

          />

          {textLines > LINE_LIMIT && (
            <div className="text-xs px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200 mb-4">
              {textLines} linhas (limite {LINE_LIMIT})
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            void handleFilePicked(f);
          }}
        />

        <div ref={editorRef} className="border rounded-lg min-h-[400px] focus:outline-none w-full max-w-full lg:max-w-[8.5cm] mx-auto" />

        <MathInsert
          open={mathDialog.open}
          onOpenChange={(open) => {
            if (!open) setMathDialog({ open: false });
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
              if (hasEssentialMetadata(meta)) {
                performSave();
              }
            } else {
              setMetaDialog({ ...metaDialog, open });
            }
          }}
          value={meta}
          onChange={setMeta}
          onSave={metaDialog.saveAfter ? performSave : undefined}
        />
      </div>
    </div>
  );
}
