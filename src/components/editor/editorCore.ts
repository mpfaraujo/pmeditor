// src/components/editor/editorCore.ts
//
// Núcleo único do editor ProseMirror: plugins, NodeView de fórmula e o
// duplo-clique que abre a edição de fórmula. Usado pelo QuestionEditor e pelo
// BlocosEditor (texto base, resposta-modelo, resolução) — qualquer mudança de
// comportamento de edição se faz AQUI, para valer nos dois.

import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { gapCursor } from "prosemirror-gapcursor";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import { schema } from "./schema";
import { placeholderPlugin } from "./placeholder-plugin";
import { createSmartPastePlugin } from "./plugins/smartPastePlugin";
import { verseNumberingPlugin } from "./plugins/verseNumberingPlugin";

export class MathInlineView {
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

export const editorNodeViews = {
  math_inline: (n: any) => new MathInlineView(n),
};

/** Duplo-clique numa fórmula inline → devolve posição e latex para abrir o diálogo de edição. */
export function mathAtDblClick(view: EditorView, e: Event): { pos: number; latex: string } | null {
  const hit = view.posAtCoords({ left: (e as MouseEvent).clientX, top: (e as MouseEvent).clientY });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  const node =
    $pos.nodeAfter?.type === schema.nodes.math_inline
      ? $pos.nodeAfter
      : $pos.nodeBefore?.type === schema.nodes.math_inline
        ? $pos.nodeBefore
        : null;
  if (!node) return null;
  const pos = node === $pos.nodeAfter ? hit.pos : hit.pos - node.nodeSize;
  return { pos, latex: (node.attrs?.latex || "").toString() };
}

/** Insere uma fórmula nova na seleção ou atualiza a fórmula em `editPos`. */
export function upsertMathInline(view: EditorView, latex: string, editPos: number | null) {
  if (editPos != null) {
    const node = view.state.doc.nodeAt(editPos);
    if (node?.type === schema.nodes.math_inline) {
      view.dispatch(view.state.tr.setNodeMarkup(editPos, undefined, { ...node.attrs, latex }));
      view.focus();
      return;
    }
  }
  view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.math_inline.create({ latex })));
  view.focus();
}

export function buildEditorPlugins(opts: {
  placeholder?: string;
  onYamlMetadata?: (meta: any) => void;
  onMathShortcut?: () => void;
  toolbarCallbackRef?: { current: (() => void) | null };
}): Plugin[] {
  const { placeholder = "Digite aqui...", onYamlMetadata, onMathShortcut, toolbarCallbackRef } = opts;
  return [
    history(),
    placeholderPlugin({ paragraph: placeholder }),
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
      maxImageWidthCm: 16,
      stripAllHtmlImages: false,
      onYamlMetadata,
    }),
    keymap({
      "Mod-b": toggleMark(schema.marks.strong),
      "Mod-i": toggleMark(schema.marks.em),
      "Mod-u": toggleMark(schema.marks.underline),
      "Mod-.": toggleMark(schema.marks.superscript),
      "Mod-,": toggleMark(schema.marks.subscript),
      "Mod-k": () => {
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

/* ---------- conteúdo "solto" (blocos) ↔ doc do editor ---------- */

/** Blocos soltos (texto base, resposta) viram doc > question > statement(blocos) para o editor. */
export function blocksToEditorDoc(blocks: any[] | null | undefined): any {
  return {
    type: "doc",
    content: [{
      type: "question",
      attrs: { tipo: null },
      content: [{
        type: "statement",
        content: blocks && blocks.length > 0 ? blocks : [{ type: "paragraph", attrs: { textAlign: null } }],
      }],
    }],
  };
}

/** Inverso de blocksToEditorDoc. */
export function editorDocToBlocks(doc: any): any[] {
  return doc?.content?.[0]?.content?.[0]?.content ?? [];
}
