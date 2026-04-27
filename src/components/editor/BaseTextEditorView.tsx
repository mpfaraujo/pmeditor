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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import { schema } from "./schema";
import { placeholderPlugin } from "./placeholder-plugin";
import { createSmartPastePlugin } from "./plugins/smartPastePlugin";
import { MathInsert } from "./MathInsert";
import { ImageUpload } from "./ImageUpload";
import { SymbolPicker } from "./toolbar/SymbolPicker";
import { ensureImageIds } from "./ensureImageIds";
import { buildPoemFromSelection } from "./poemUtils";
import "../../app/prosemirror.css";
import { gapCursor } from "prosemirror-gapcursor";

import {
  Bold, Italic, Underline as UnderlineIcon,
  Superscript, Subscript, Sigma, Image, Omega,
  List, ListOrdered, Undo2, Redo2, Save,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Quote, Box, Code, BookOpen, Hash,
  ChevronDown, Heading2, PlusCircle, MapPin, Tag, X,
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
  const base = "inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-md border border-transparent transition-colors";
  const styles =
    variant === "save"
      ? `${base} bg-slate-900 text-white hover:bg-slate-800 shadow-sm`
      : `${base} hover:bg-slate-100 hover:text-slate-900 ${active ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm" : "text-slate-600"}`;

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

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-1.5 py-1 shadow-sm">
      {children}
    </div>
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
  onChange?: (baseTextContent: any) => void;
  closeAfterSave?: boolean;
  saving?: boolean;
}

export function BaseTextEditorView({ value, onSave, onChange, closeAfterSave = false, saving = false }: BaseTextEditorViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [, forceUpdate] = useState(0);

  const [mathDialog, setMathDialog] = useState<{ open: boolean; pos: number | null; latex: string }>({
    open: false, pos: null, latex: "",
  });
  const [imageOpen, setImageOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);

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
        gapCursor(),
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
        onChange?.(docToBaseTextContent(ns.doc.toJSON()));
        forceUpdate((n) => n + 1);
      },
    });

    viewRef.current = ev;
    onChange?.(docToBaseTextContent(ev.state.doc.toJSON()));
    forceUpdate((n) => n + 1);

    return () => { ev.destroy(); viewRef.current = null; };
  }, [createEditorDoc, onChange, value]);

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

  const setTextAlign = (align: "left" | "center" | "right" | "justify") => {
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

  const isInTitle = (): boolean => {
    if (!view) return false;
    const { $from } = view.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.title) return true;
    }
    return false;
  };

  const insertPoem = () => {
    if (!view) return;

    const selectionPoem = buildPoemFromSelection(view.state, schema);
    if (selectionPoem) {
      view.dispatch(view.state.tr.replaceSelectionWith(selectionPoem));
      view.focus();
      return;
    }

    const { $from } = view.state.selection;
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

  const toggleTitle = () => {
    if (!view) return;
    const { $from } = view.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      const pos = $from.before(d);
      if (node.type === schema.nodes.title) {
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, schema.nodes.paragraph, {
            textAlign: "center",
            numbered: false,
          })
        );
        view.focus();
        return;
      }
      if (node.isTextblock) {
        view.dispatch(view.state.tr.setNodeMarkup(pos, schema.nodes.title, {}));
        view.focus();
        return;
      }
    }
  };

  const insertSymbol = (symbol: string) => {
    if (!view) return;
    view.dispatch(view.state.tr.replaceSelectionWith(schema.text(symbol)));
    view.focus();
  };

  const markAnchor = () => {
    if (!view) return;
    const { from, to } = view.state.selection;
    if (from === to) {
      window.alert("Selecione o texto que deseja marcar como referência de linha.");
      return;
    }
    const selectedText = view.state.doc.textBetween(from, to);
    const suggested = selectedText
      .slice(0, 40)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const id = window.prompt("Nome da referência (ID):", suggested);
    if (!id?.trim()) return;
    const mark = schema.marks.text_anchor.create({ id: id.trim() });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    view.focus();
  };

  const removeAnchor = () => {
    if (!view) return;
    const { from, to, empty } = view.state.selection;

    if (empty) {
      const $pos = view.state.doc.resolve(from);
      const mark = $pos.marks().find((m) => m.type === schema.marks.text_anchor);
      if (!mark) {
        window.alert("Cursor não está sobre uma expressão marcada.");
        return;
      }
      let start = from;
      let end = from;
      view.state.doc.nodesBetween(0, view.state.doc.content.size, (node, pos) => {
        if (
          node.isText &&
          node.marks.some(
            (m) => m.type === schema.marks.text_anchor && m.attrs.id === mark.attrs.id
          )
        ) {
          start = Math.min(start, pos);
          end = Math.max(end, pos + node.nodeSize);
        }
      });
      view.dispatch(view.state.tr.removeMark(start, end, schema.marks.text_anchor));
      view.focus();
      return;
    }

    view.dispatch(view.state.tr.removeMark(from, to, schema.marks.text_anchor));
    view.focus();
  };

  const insertLineRef = () => {
    if (!view) return;
    const anchors: string[] = [];
    view.state.doc.descendants((node) => {
      node.marks?.forEach((mark) => {
        if (
          mark.type === schema.marks.text_anchor &&
          mark.attrs.id &&
          !anchors.includes(mark.attrs.id)
        ) {
          anchors.push(mark.attrs.id);
        }
      });
    });

    if (anchors.length === 0) {
      window.alert("Nenhuma expressão marcada encontrada.");
      return;
    }

    const choices = anchors.map((a, i) => `${i + 1}. ${a}`).join("\n");
    const input = window.prompt(`Qual referência inserir?\n\n${choices}\n\nDigite o número ou o ID:`);
    if (!input?.trim()) return;

    const num = parseInt(input.trim(), 10);
    const anchorId =
      Number.isFinite(num) && num >= 1 && num <= anchors.length
        ? anchors[num - 1]
        : input.trim();

    view.dispatch(
      view.state.tr.replaceSelectionWith(schema.nodes.line_ref.create({ anchorId }))
    );
    view.focus();
  };

  const handleSave = () => {
    if (!view) return;
    const doc = ensureImageIds(view.state.doc, view.state.schema);
    onSave(docToBaseTextContent(doc.toJSON()));
  };

  const textAlign = getTextAlign();
  const titleActive = isInTitle();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-50 px-3 py-2 flex-wrap">
        <ToolbarGroup>
          <TBtn icon={Undo2} title="Desfazer" onClick={() => { if (!view) return; undo(view.state, view.dispatch); view.focus(); }} />
          <TBtn icon={Redo2} title="Refazer" onClick={() => { if (!view) return; redo(view.state, view.dispatch); view.focus(); }} />
        </ToolbarGroup>

        <ToolbarGroup>
          <TBtn icon={Bold} title="Negrito" active={hasMark("strong")} onClick={() => toggleMarkCmd("strong")} />
          <TBtn icon={Italic} title="Itálico" active={hasMark("em")} onClick={() => toggleMarkCmd("em")} />
          <TBtn icon={UnderlineIcon} title="Sublinhado" active={hasMark("underline")} onClick={() => toggleMarkCmd("underline")} />
          <TBtn icon={Superscript} title="Sobrescrito" active={hasMark("superscript")} onClick={() => toggleMarkCmd("superscript")} />
          <TBtn icon={Subscript} title="Subscrito" active={hasMark("subscript")} onClick={() => toggleMarkCmd("subscript")} />
          <TBtn icon={Heading2} title={titleActive ? "Remover título" : "Formatar como título"} active={titleActive} onClick={toggleTitle} />
        </ToolbarGroup>

        <ToolbarGroup>
          <TBtn icon={AlignLeft} title="Alinhar à esquerda" active={textAlign === "left" || textAlign === null} onClick={() => setTextAlign("left")} />
          <TBtn icon={AlignCenter} title="Centralizar" active={textAlign === "center"} onClick={() => setTextAlign("center")} />
          <TBtn icon={AlignRight} title="Alinhar à direita" active={textAlign === "right"} onClick={() => setTextAlign("right")} />
          <TBtn icon={AlignJustify} title="Justificar" active={textAlign === "justify"} onClick={() => setTextAlign("justify")} />
          <TBtn icon={Hash} title="Numerar linhas selecionadas" active={isLineNumbered()} onClick={toggleLineNumbers} />
        </ToolbarGroup>

        <ToolbarGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                onMouseDown={(e) => e.preventDefault()}
                title="Inserir"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Inserir</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setImageOpen(true)}>
                <Image className="mr-2 h-4 w-4" /> Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMathDialog({ open: true, pos: null, latex: "" })}>
                <Sigma className="mr-2 h-4 w-4" /> Fórmula
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSymbolPickerOpen(true)}>
                <Omega className="mr-2 h-4 w-4" /> Símbolos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertPoem}>
                <BookOpen className="mr-2 h-4 w-4" /> Poema / Verso
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTitle}>
                <Heading2 className="mr-2 h-4 w-4" /> Título
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertCredits}>
                <Quote className="mr-2 h-4 w-4" /> Créditos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertDataBox}>
                <Box className="mr-2 h-4 w-4" /> Caixa de dados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertCodeBlock}>
                <Code className="mr-2 h-4 w-4" /> Bloco de código
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <List className="mr-2 h-4 w-4" /> Listas
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => wrapList("bullet_list")}>
                    <List className="mr-2 h-4 w-4" /> Lista •
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapList("ordered_list")}>
                    <ListOrdered className="mr-2 h-4 w-4" /> Lista 1, 2, 3…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapList("roman_list")}>
                    <ListOrdered className="mr-2 h-4 w-4" /> Lista I, II, III…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapList("alpha_list")}>
                    <ListOrdered className="mr-2 h-4 w-4" /> Lista a, b, c…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapList("assertive_list")}>
                    <ListOrdered className="mr-2 h-4 w-4" /> Lista VF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MapPin className="mr-2 h-4 w-4" /> Ref. de linha
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={markAnchor}>
                    <Tag className="mr-2 h-4 w-4" /> Marcar expressão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={removeAnchor}>
                    <X className="mr-2 h-4 w-4" /> Remover marcador
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={insertLineRef}>
                    <Hash className="mr-2 h-4 w-4" /> Inserir referência
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolbarGroup>

        <div className="flex-1" />

        <TBtn icon={Save} title={closeAfterSave ? "Salvar e fechar" : "Salvar"} variant="save" onClick={handleSave} />
        {saving && <span className="ml-1 text-xs text-slate-500">Salvando…</span>}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className="base-text-editor w-full [&_.ProseMirror]:!w-full [&_.ProseMirror]:!max-w-none [&_.ProseMirror]:!min-h-[400px] [&_.ProseMirror]:!shadow-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:cursor-text"
      />

      <MathInsert
        open={mathDialog.open}
        onOpenChange={(o) => { if (!o) setMathDialog({ open: false, pos: null, latex: "" }); }}
        onInsert={(latex) => { upsertMath(latex); setMathDialog({ open: false, pos: null, latex: "" }); }}
        initialLatex={mathDialog.open ? mathDialog.latex : undefined}
        title={mathDialog.pos != null ? "Editar fórmula" : "Inserir fórmula"}
      />

      <ImageUpload open={imageOpen} onOpenChange={setImageOpen} onImageInsert={insertImage} />
      <SymbolPicker open={symbolPickerOpen} onOpenChange={setSymbolPickerOpen} onSelect={insertSymbol} />
    </div>
  );
}
