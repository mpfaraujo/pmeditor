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

import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import { miniSchema } from "./miniSchema";
import { placeholderPlugin } from "./placeholder-plugin";
import { MathInsert } from "./MathInsert";
import { ImageUpload } from "./ImageUpload";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Superscript,
  Subscript,
  Sigma,
  Image,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

/* ---------- MathInlineView (same as QuestionEditor) ---------- */

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
  title,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-1 rounded hover:bg-gray-200 transition-colors ${active ? "bg-gray-200 text-blue-600" : "text-gray-600"}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ---------- component ---------- */

interface RichTextMiniEditorProps {
  value?: any;
  onChange: (doc: any) => void;
}

export function RichTextMiniEditor({ value, onChange }: RichTextMiniEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [, forceUpdate] = useState(0);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathLatex, setMathLatex] = useState("\\frac{a}{b}");
  const [mathEditPos, setMathEditPos] = useState<number | null>(null);
  const [imageOpen, setImageOpen] = useState(false);

  // Suppress external value updates while the user is editing
  const suppressRef = useRef(false);

  const createDoc = useCallback((json?: any) => {
    if (json && typeof json === "object" && json.type === "doc") {
      try {
        return miniSchema.nodeFromJSON(json);
      } catch {
        // fallback to empty
      }
    }
    return miniSchema.node("doc", null, [miniSchema.node("paragraph")]);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const doc = createDoc(value);

    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        placeholderPlugin({ paragraph: "Resposta-modelo..." }),
        keymap({
          Enter: splitListItem(miniSchema.nodes.list_item),
          Tab: sinkListItem(miniSchema.nodes.list_item),
          "Shift-Tab": liftListItem(miniSchema.nodes.list_item),
        }),
        keymap({ "Mod-z": undo, "Mod-y": redo }),
        keymap(baseKeymap),
      ],
    });

    const ev = new EditorView(editorRef.current, {
      state,
      nodeViews: {
        math_inline: (n) => new MathInlineView(n),
      },
      handleDOMEvents: {
        dblclick(view, e) {
          const hit = view.posAtCoords({
            left: (e as MouseEvent).clientX,
            top: (e as MouseEvent).clientY,
          });
          if (!hit) return false;

          const $pos = view.state.doc.resolve(hit.pos);
          const node =
            $pos.nodeAfter?.type === miniSchema.nodes.math_inline
              ? $pos.nodeAfter
              : $pos.nodeBefore?.type === miniSchema.nodes.math_inline
                ? $pos.nodeBefore
                : null;

          if (!node) return false;

          const pos = node === $pos.nodeAfter ? hit.pos : hit.pos - node.nodeSize;
          setMathEditPos(pos);
          setMathLatex((node.attrs?.latex || "").toString());
          setMathOpen(true);
          return true;
        },
      },
      dispatchTransaction(tr) {
        const ns = ev.state.apply(tr);
        ev.updateState(ns);
        suppressRef.current = true;
        onChangeRef.current(ns.doc.toJSON());
        forceUpdate((n) => n + 1);
      },
    });

    viewRef.current = ev;
    forceUpdate((n) => n + 1);

    return () => {
      ev.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. initial load)
  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const v = viewRef.current;
    if (!v) return;

    const doc = createDoc(value);
    const currentJSON = JSON.stringify(v.state.doc.toJSON());
    const newJSON = JSON.stringify(doc.toJSON());
    if (currentJSON === newJSON) return;

    const state = EditorState.create({
      doc,
      plugins: v.state.plugins,
    });
    v.updateState(state);
  }, [value, createDoc]);

  const view = viewRef.current;

  const toggleMarkCmd = (markName: string) => {
    if (!view) return;
    const mark = miniSchema.marks[markName];
    if (!mark) return;
    toggleMark(mark)(view.state, view.dispatch);
    view.focus();
  };

  const hasMark = (markName: string): boolean => {
    if (!view) return false;
    const mark = miniSchema.marks[markName];
    if (!mark) return false;
    const { from, $from, to, empty } = view.state.selection;
    if (empty) return !!mark.isInSet(view.state.storedMarks || $from.marks());
    let found = false;
    view.state.doc.nodesBetween(from, to, (node) => {
      if (mark.isInSet(node.marks)) found = true;
    });
    return found;
  };

  const insertMath = (latex: string) => {
    if (!view) return;

    if (mathEditPos != null) {
      const node = view.state.doc.nodeAt(mathEditPos);
      if (node?.type === miniSchema.nodes.math_inline) {
        view.dispatch(
          view.state.tr.setNodeMarkup(mathEditPos, undefined, { ...node.attrs, latex })
        );
        view.focus();
        setMathEditPos(null);
        return;
      }
    }

    view.dispatch(
      view.state.tr.replaceSelectionWith(miniSchema.nodes.math_inline.create({ latex }))
    );
    view.focus();
    setMathEditPos(null);
  };

  const insertImage = (url: string, _widthCm: number, id?: string) => {
    if (!view) return;
    const widthPx = Math.round(_widthCm * 37.8);
    const node = miniSchema.nodes.image.create({ src: url, width: widthPx, id: id || null });
    view.dispatch(view.state.tr.replaceSelectionWith(node));
    view.focus();
  };

  const wrapList = (listType: "bullet_list" | "ordered_list") => {
    if (!view) return;
    wrapInList(miniSchema.nodes[listType])(view.state, view.dispatch);
    view.focus();
  };

  return (
    <div className="border rounded-md overflow-hidden bg-white">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-gray-50 flex-wrap">
        <TBtn icon={Bold} title="Negrito" active={hasMark("strong")} onClick={() => toggleMarkCmd("strong")} />
        <TBtn icon={Italic} title="Itálico" active={hasMark("em")} onClick={() => toggleMarkCmd("em")} />
        <TBtn icon={UnderlineIcon} title="Sublinhado" active={hasMark("underline")} onClick={() => toggleMarkCmd("underline")} />
        <TBtn icon={Superscript} title="Sobrescrito" active={hasMark("superscript")} onClick={() => toggleMarkCmd("superscript")} />
        <TBtn icon={Subscript} title="Subscrito" active={hasMark("subscript")} onClick={() => toggleMarkCmd("subscript")} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <TBtn
          icon={Sigma}
          title="Fórmula matemática"
          onClick={() => {
            setMathEditPos(null);
            setMathLatex("\\frac{a}{b}");
            setMathOpen(true);
          }}
        />
        <TBtn icon={Image} title="Imagem" onClick={() => setImageOpen(true)} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <TBtn icon={List} title="Lista" onClick={() => wrapList("bullet_list")} />
        <TBtn icon={ListOrdered} title="Lista numerada" onClick={() => wrapList("ordered_list")} />

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <TBtn
          icon={Undo2}
          title="Desfazer"
          onClick={() => {
            if (!view) return;
            undo(view.state, view.dispatch);
            view.focus();
          }}
        />
        <TBtn
          icon={Redo2}
          title="Refazer"
          onClick={() => {
            if (!view) return;
            redo(view.state, view.dispatch);
            view.focus();
          }}
        />
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        className="overflow-y-auto text-xs [&_.ProseMirror]:!w-auto [&_.ProseMirror]:!max-w-none [&_.ProseMirror]:!min-h-[40px] [&_.ProseMirror]:!max-h-[70px] [&_.ProseMirror]:!p-[6px_1cm] [&_.ProseMirror]:!m-0 [&_.ProseMirror]:!shadow-none [&_.ProseMirror]:!text-xs [&_.ProseMirror]:!leading-snug [&_.ProseMirror]:!font-sans [&_.ProseMirror]:outline-none [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror_p]:my-0 [&_.ProseMirror_p]:leading-snug [&_.math-inline]:bg-blue-50 [&_.math-inline]:px-0.5 [&_.math-inline]:rounded [&_.math-inline]:cursor-pointer [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-4 [&_.ProseMirror_li]:my-0 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto"
      />

      <MathInsert
        open={mathOpen}
        onOpenChange={(o) => {
          if (!o) {
            setMathOpen(false);
            setMathEditPos(null);
          }
        }}
        onInsert={(latex) => {
          insertMath(latex);
          setMathOpen(false);
        }}
        initialLatex={mathLatex}
        title={mathEditPos != null ? "Editar fórmula" : "Inserir fórmula"}
      />

      <ImageUpload
        open={imageOpen}
        onOpenChange={setImageOpen}
        onImageInsert={insertImage}
      />
    </div>
  );
}
