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

/* ========= NOVO: PROPS ========= */
type QuestionEditorProps = {
  /** se true: não navega, não alerta, só emite callback */
  modal?: boolean;
  /** chamado após save bem-sucedido (base ou variante) */
  onSaved?: (info: {
    questionId: string;
    kind: "base" | "variant";
  }) => void;
  /** carregar questão ativa (base ou variante) */
  initial?: {
    metadata: QuestionMetadataV1;
    content: any;
  };
};
/* =============================== */

const LINE_LIMIT = 10;
const LETTERS = ["A", "B", "C", "D", "E"] as const;

/* -------- utilidades (inalteradas) -------- */
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
      katex.render(latex || "\\;", this.dom, { throwOnError: false, displayMode: false });
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
    placeholderPlugin({ paragraph: "Digite aqui..." }),
    inputRules({
      rules: [
        wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
        wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list),
        wrappingInputRule(/^(I{1,3}|IV|V|VI{0,3}|IX|X)\.\s$/i, schema.nodes.roman_list),
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

function defaultDoc() {
  return schema.node("doc", null, [
    schema.node("question", null, [
      schema.node("statement", null, [schema.node("paragraph")]),
      schema.node("options", null, [
        schema.node("option", { letter: "A" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "B" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "C" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "D" }, [schema.node("paragraph")]),
        schema.node("option", { letter: "E" }, [schema.node("paragraph")]),
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
    tipo: "Múltipla Escolha" as QuestionMetadataV1["tipo"],
    dificuldade: "Média",
    tags: [],
    gabarito: normalizeGabaritoForTipo("Múltipla Escolha" as any),
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
function isDiscursiveTipo(tipo: QuestionMetadataV1["tipo"]): boolean {
  const t = (tipo ?? "").toString().toLowerCase();
  return t.includes("discurs");
}

/* ===================== COMPONENTE ===================== */
export function QuestionEditor({ modal, onSaved, initial }: QuestionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<EditorView | null>(null);
  const [, forceUpdate] = useState(0);
  const [mathDialog, setMathDialog] = useState<MathDialogState>({ open: false });
  const [metaDialog, setMetaDialog] = useState<{ open: boolean; saveAfter: boolean }>({
    open: false,
    saveAfter: false,
  });

  const [meta, setMeta] = useState<QuestionMetadataV1>(() => initial?.metadata ?? defaultMetadata());
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const [textLines, setTextLines] = useState(0);
  const [editorMaxWidthCm, setEditorMaxWidthCm] = useState<8.5 | 18>(8.5);
  const [optionCount, setOptionCount] = useState(5);

  const plugins = useMemo(() => buildPlugins(), []);

  /* -------- editor init -------- */
  useEffect(() => {
    if (!editorRef.current) return;

    const doc =
      initial?.content ? schema.nodeFromJSON(initial.content) : defaultDoc();

    const state = EditorState.create({ doc, plugins });

    const editorView = new EditorView(editorRef.current, {
      state,
      nodeViews: {
        math_inline(node) {
          return new MathInlineView(node);
        },
      },
      dispatchTransaction(tr) {
        const ns = editorView.state.apply(tr);
        editorView.updateState(ns);
        try {
          localStorage.setItem(
            "pmeditor:last",
            JSON.stringify({ metadata: metaRef.current, content: ns.doc.toJSON() })
          );
        } catch {}
        forceUpdate((n) => n + 1);
      },
    });

    setView(editorView);
    return () => editorView.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins]);

  /* -------- SAVE (AJUSTADO) -------- */
  const performSaveApi = async () => {
    if (!view) return;

    const metaToSend = { ...meta, updatedAt: new Date().toISOString() };
    const content = view.state.doc.toJSON();

    try {
      await createQuestion({ metadata: metaToSend, content });
      setMeta(metaToSend);

      onSaved?.({ questionId: metaToSend.id, kind: "base" });
      if (!modal) window.alert("Salvo.");
    } catch (e: any) {
      if (e?.status === 409) {
        await proposeQuestion({
          questionId: meta.id,
          metadata: metaToSend,
          content,
        });
        onSaved?.({ questionId: meta.id, kind: "variant" });
        if (!modal) window.alert("Salvo como variante.");
        return;
      }
      if (!modal) window.alert("Erro ao salvar.");
    }
  };

  const handleSave = () => {
    if (!hasEssentialMetadata(meta)) {
      setMetaDialog({ open: true, saveAfter: true });
    } else {
      void performSaveApi();
    }
  };

  /* -------- render -------- */
  return (
    <div className="w-full mx-auto p-4">
      <EditorToolbar
        view={view}
        metadata={meta}
        onLoadedMetadata={setMeta}
        onOpenMath={() => setMathDialog({ open: true, mode: "new", pos: null, latex: "\\frac{a}{b}" })}
        onOpenMetadata={() => setMetaDialog({ open: true, saveAfter: false })}
        onSave={handleSave}
      />

      <div
        ref={editorRef}
        className="border rounded-lg min-h-[400px] w-full mx-auto"
        style={{ maxWidth: `${editorMaxWidthCm}cm` }}
      />

      <MathInsert
        open={mathDialog.open}
        onOpenChange={(open) => !open && setMathDialog({ open: false })}
        onInsert={() => {}}
      />

      <QuestionMetadataModal
        open={metaDialog.open}
        onOpenChange={(open) => {
          if (!open && metaDialog.saveAfter) {
            setMetaDialog({ open: false, saveAfter: false });
            void performSaveApi();
          } else {
            setMetaDialog({ ...metaDialog, open });
          }
        }}
        value={meta}
        onChange={setMeta}
      />
    </div>
  );
}
