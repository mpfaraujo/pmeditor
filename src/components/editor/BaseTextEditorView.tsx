"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap } from "prosemirror-commands";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { toggleMark } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { inputRules } from "prosemirror-inputrules";

import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import { schema } from "./schema";
import { placeholderPlugin } from "./placeholder-plugin";
import { createSmartPastePlugin } from "./plugins/smartPastePlugin";
import { MathInsert } from "./MathInsert";
import { ImageUpload } from "./ImageUpload";
import { ensureImageIds } from "./ensureImageIds";
import "../../app/prosemirror.css";

import {
  Bold, Italic, Underline as UnderlineIcon,
  Superscript, Subscript, Sigma, Image,
  List, ListOrdered, Undo2, Redo2, Save,
  AlignLeft, AlignCenter, AlignJustify, Quote, Box, Code, BookOpen, Hash,
} from "lucide-react";

/* ---------- MathInlineView ---------- */

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

/* ---------- toolbar button ---------- */

function TBtn({
  icon: Icon,
  label,
  title,
  active,
  onClick,
  variant = "default",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  title: string;
  active?: boolean;
  onClick: () => void;
  variant?: "default" | "save";
}) {
  const base = "p-1.5 rounded transition-colors";
  const styles =
    variant === "save"
      ? `${base} bg-primary text-white hover:bg-primary/90`
      : `${base} hover:bg-gray-200 ${active ? "bg-gray-200 text-blue-600" : "text-gray-600"}`;

  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={styles}
    >
      {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-mono leading-none">{label}</span>}
    </button>
  );
}

/* ---------- helpers de doc ---------- */

/** base_text node → doc editável (doc > question > statement(blocks)) */
function baseTextToDoc(content: any): any {
  const blocks: any[] = content?.content ?? [];
  return {
    type: "doc",
    content: [{
      type: "question",
      attrs: { tipo: null },
      content: [{
        type: "statement",
        content: blocks.length > 0 ? blocks : [{ type: "paragraph", attrs: { textAlign: null } }],
      }],
    }],
  };
}

/** doc → base_text node para salvar */
export function docToBaseTextContent(doc: any): any {
  const blocks = doc?.content?.[0]?.content?.[0]?.content ?? [];
  return { type: "base_text", content: blocks };
}

/* ---------- component ---------- */

interface BaseTextEditorViewProps {
  /** base_text node JSON (content armazenado no banco) */
  value?: any;
  onSave: (baseTextContent: any) => void;
  saving?: boolean;
}

export function BaseTextEditorView({ value, onSave, saving = false }: BaseTextEditorViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [, forceUpdate] = useState(0);

  const [mathDialog, setMathDialog] = useState<{ open: boolean; pos: number | null; latex: string }>({
    open: false, pos: null, latex: "",
  });
  const [imageOpen, setImageOpen] = useState(false);

  const createEditorDoc = useCallback((content: any) => {
    const json = baseTextToDoc(content);
    try {
      return schema.nodeFromJSON(json);
    } catch {
      return schema.nodeFromJSON(baseTextToDoc(null));
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const doc = createEditorDoc(value);

    const state = EditorState.create({
      doc,
      plugins: [
        createSmartPastePlugin({
          uploadEndpoint: "https://mpfaraujo.com.br/guardafiguras/api/upload.php",
          uploadToken: "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes",
          maxImageWidthCm: 8,
          stripAllHtmlImages: false,
        }),
        history(),
        placeholderPlugin({ paragraph: "Conteúdo do texto base…" }),
        keymap({
          Enter: splitListItem(schema.nodes.list_item),
          Tab: sinkListItem(schema.nodes.list_item),
          "Shift-Tab": liftListItem(schema.nodes.list_item),
        }),
        keymap({ "Mod-z": undo, "Mod-y": redo }),
        keymap(baseKeymap),
        inputRules({ rules: [] }),
      ],
    });

    const ev = new EditorView(editorRef.current, {
      state,
      nodeViews: {
        math_inline: (n) => new MathInlineView(n),
      },
      handleDOMEvents: {
        dblclick(view, e) {
          const hit = view.posAtCoords({ left: (e as MouseEvent).clientX, top: (e as MouseEvent).clientY });
          if (!hit) return false;
          const $pos = view.state.doc.resolve(hit.pos);
          const node =
            $pos.nodeAfter?.type === schema.nodes.math_inline ? $pos.nodeAfter :
            $pos.nodeBefore?.type === schema.nodes.math_inline ? $pos.nodeBefore : null;
          if (!node) return false;
          const pos = node === $pos.nodeAfter ? hit.pos : hit.pos - node.nodeSize;
          setMathDialog({ open: true, pos, latex: (node.attrs?.latex || "").toString() });
          return true;
        },
      },
      dispatchTransaction(tr) {
        const ns = ev.state.apply(tr);
        ev.updateState(ns);
        forceUpdate((n) => n + 1);
      },
    });

    viewRef.current = ev;
    forceUpdate((n) => n + 1);

    return () => { ev.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = viewRef.current;

  const toggleMarkCmd = (markName: string) => {
    if (!view) return;
    const mark = schema.marks[markName];
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  };

  const hasMark = (markName: string): boolean => {
    if (!view) return false;
    const mark = schema.marks[markName];
    if (!mark) return false;
    const { from, $from, to, empty } = view.state.selection;
    if (empty) return !!mark.isInSet(view.state.storedMarks || $from.marks());
    let found = false;
    view.state.doc.nodesBetween(from, to, (node) => { if (mark.isInSet(node.marks)) found = true; });
    return found;
  };

  const upsertMath = (latex: string) => {
    if (!view) return;
    if (mathDialog.pos != null) {
      const node = view.state.doc.nodeAt(mathDialog.pos);
      if (node?.type === schema.nodes.math_inline) {
        view.dispatch(view.state.tr.setNodeMarkup(mathDialog.pos, undefined, { ...node.attrs, latex }));
        view.focus();
        return;
      }
    }
    view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.math_inline.create({ latex })));
    view.focus();
  };

  const insertImage = (url: string, _widthCm: number, id?: string) => {
    if (!view) return;
    const widthPx = Math.round(_widthCm * 37.8);
    const node = schema.nodes.image.create({ src: url, width: widthPx, id: id || null });
    view.dispatch(view.state.tr.replaceSelectionWith(node));
    view.focus();
  };

  const toggleLineNumbers = () => {
    if (!view) return;
    const { from, to } = view.state.selection;
    // Verifica se todos os nós selecionados já estão numerados
    let allNumbered = true;
    let found = false;
    view.state.doc.nodesBetween(from, to, (node) => {
      if (node.type === schema.nodes.paragraph || node.type === schema.nodes.verse) {
        found = true;
        if (!node.attrs.numbered) allNumbered = false;
      }
    });
    if (!found) return;
    const newValue = !allNumbered;
    const tr = view.state.tr;
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === schema.nodes.paragraph || node.type === schema.nodes.verse) {
        const isEmpty = node.textContent.trim() === "";
        // Versos/parágrafos vazios nunca são numerados (separam estrofes)
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, numbered: newValue && !isEmpty });
      }
    });
    view.dispatch(tr);
    view.focus();
  };

  const isLineNumbered = (): boolean => {
    if (!view) return false;
    const { from, to } = view.state.selection;
    let found = false;
    view.state.doc.nodesBetween(from, to, (node) => {
      if ((node.type === schema.nodes.paragraph || node.type === schema.nodes.verse) && node.attrs.numbered) {
        found = true;
      }
    });
    return found;
  };

  const setTextAlign = (align: "left" | "center" | "justify") => {
    if (!view) return;
    const { from, to } = view.state.selection;
    const tr = view.state.tr;
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === schema.nodes.paragraph) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: align });
      }
    });
    view.dispatch(tr);
    view.focus();
  };

  const getTextAlign = (): string | null => {
    if (!view) return null;
    const { $from } = view.state.selection;
    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type === schema.nodes.paragraph) return node.attrs.textAlign ?? null;
    }
    return null;
  };

  const wrapList = (listType: "bullet_list" | "ordered_list" | "roman_list" | "alpha_list" | "assertive_list") => {
    if (!view) return;
    wrapInList(schema.nodes[listType])(view.state, view.dispatch);
    view.focus();
  };

  const insertPoem = () => {
    if (!view) return;
    const { $from, $to } = view.state.selection;
    const sharedDepth = $from.sharedDepth($to.pos);
    if (sharedDepth >= $from.depth) {
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.isTextblock) {
          const blockStart = $from.before(d);
          const verse = schema.nodes.verse.create(null, n.content);
          const poem = schema.nodes.poem.create(null, [verse]);
          view.dispatch(view.state.tr.replaceWith(blockStart, blockStart + n.nodeSize, poem));
          view.focus();
          return;
        }
      }
    }
    const verse = schema.nodes.verse.create();
    const poem = schema.nodes.poem.create(null, [verse]);
    view.dispatch(view.state.tr.replaceSelectionWith(poem));
    view.focus();
  };

  const insertCredits = () => {
    if (!view) return;
    const { $from } = view.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.isTextblock) {
        const blockStart = $from.before(d);
        const credits = schema.nodes.credits.create(null, n.content);
        view.dispatch(view.state.tr.replaceWith(blockStart, blockStart + n.nodeSize, credits));
        view.focus();
        return;
      }
    }
    const credits = schema.nodes.credits.create();
    view.dispatch(view.state.tr.replaceSelectionWith(credits));
    view.focus();
  };

  const insertDataBox = () => {
    if (!view) return;
    const para = schema.nodes.paragraph.create();
    const dataBox = schema.nodes.data_box.create(null, [para]);
    view.dispatch(view.state.tr.replaceSelectionWith(dataBox));
    view.focus();
  };

  const insertCodeBlock = () => {
    if (!view) return;
    const codeBlock = schema.nodes.code_block.create();
    view.dispatch(view.state.tr.replaceSelectionWith(codeBlock));
    view.focus();
  };

  const handleSave = () => {
    if (!view) return;
    const doc = ensureImageIds(view.state.doc, view.state.schema);
    onSave(docToBaseTextContent(doc.toJSON()));
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-gray-50 flex-wrap">
        {/* Formatação de texto */}
        <TBtn icon={Bold} title="Negrito" active={hasMark("strong")} onClick={() => toggleMarkCmd("strong")} />
        <TBtn icon={Italic} title="Itálico" active={hasMark("em")} onClick={() => toggleMarkCmd("em")} />
        <TBtn icon={UnderlineIcon} title="Sublinhado" active={hasMark("underline")} onClick={() => toggleMarkCmd("underline")} />
        <TBtn icon={Superscript} title="Sobrescrito" active={hasMark("superscript")} onClick={() => toggleMarkCmd("superscript")} />
        <TBtn icon={Subscript} title="Subscrito" active={hasMark("subscript")} onClick={() => toggleMarkCmd("subscript")} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Alinhamento */}
        <TBtn icon={AlignLeft} title="Alinhar à esquerda" active={getTextAlign() === "left" || getTextAlign() === null} onClick={() => setTextAlign("left")} />
        <TBtn icon={AlignCenter} title="Centralizar" active={getTextAlign() === "center"} onClick={() => setTextAlign("center")} />
        <TBtn icon={AlignJustify} title="Justificar" active={getTextAlign() === "justify"} onClick={() => setTextAlign("justify")} />
        <TBtn icon={Hash} title="Numerar linhas selecionadas" active={isLineNumbered()} onClick={toggleLineNumbers} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Inserções */}
        <TBtn icon={Sigma} title="Fórmula matemática" onClick={() => setMathDialog({ open: true, pos: null, latex: "" })} />
        <TBtn icon={Image} title="Imagem" onClick={() => setImageOpen(true)} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Listas */}
        <TBtn icon={List} title="Lista com marcadores" onClick={() => wrapList("bullet_list")} />
        <TBtn icon={ListOrdered} title="Lista numerada" onClick={() => wrapList("ordered_list")} />
        <TBtn label="i ii" title="Lista em algarismos romanos" onClick={() => wrapList("roman_list")} />
        <TBtn label="a b" title="Lista alfabética (a, b, c…)" onClick={() => wrapList("alpha_list")} />
        <TBtn label="( )" title="Lista VF (assertiva)" onClick={() => wrapList("assertive_list")} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* Blocos especiais */}
        <TBtn icon={BookOpen} title="Poema / Verso" onClick={insertPoem} />
        <TBtn icon={Quote} title="Créditos" onClick={insertCredits} />
        <TBtn icon={Box} title="Caixa de dados" onClick={insertDataBox} />
        <TBtn icon={Code} title="Bloco de código" onClick={insertCodeBlock} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <TBtn icon={Undo2} title="Desfazer" onClick={() => { if (!view) return; undo(view.state, view.dispatch); view.focus(); }} />
        <TBtn icon={Redo2} title="Refazer" onClick={() => { if (!view) return; redo(view.state, view.dispatch); view.focus(); }} />

        <div className="flex-1" />

        <TBtn icon={Save} title="Salvar" variant="save" onClick={handleSave} />
        {saving && <span className="text-xs text-muted-foreground ml-1">Salvando…</span>}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className="base-text-editor w-full [&_.ProseMirror]:!w-full [&_.ProseMirror]:!max-w-none [&_.ProseMirror]:!min-h-[400px] [&_.ProseMirror]:!shadow-none [&_.ProseMirror]:!p-6 [&_.ProseMirror]:outline-none [&_.ProseMirror]:cursor-text"
      />

      <MathInsert
        open={mathDialog.open}
        onOpenChange={(o) => { if (!o) setMathDialog({ open: false, pos: null, latex: "" }); }}
        onInsert={(latex) => { upsertMath(latex); setMathDialog({ open: false, pos: null, latex: "" }); }}
        initialLatex={mathDialog.open ? mathDialog.latex : undefined}
        title={mathDialog.pos != null ? "Editar fórmula" : "Inserir fórmula"}
      />

      <ImageUpload open={imageOpen} onOpenChange={setImageOpen} onImageInsert={insertImage} />
    </div>
  );
}
