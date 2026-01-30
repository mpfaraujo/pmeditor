import { Schema, type NodeSpec, type MarkSpec, type DOMOutputSpec, type ParseRule } from "prosemirror-model";

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: "question",
  },

  question: {
    // ALTERAÇÃO PARA DISCURSIVA: options?
    content: "base_text? statement options?",
    toDOM(): DOMOutputSpec {
      return ["div", { class: "question" }, 0];
    },
  },

  base_text: {
    content: "block+",
    toDOM(): DOMOutputSpec {
      return ["div", { class: "base-text" }, 0];
    },
  },

  statement: {
    content: "block+",
    toDOM(): DOMOutputSpec {
      return ["div", { class: "statement" }, 0];
    },
  },

  options: {
    // Mantém seu limite atual (2..5) quando options existir
    content: "option{2,5}",
    toDOM(): DOMOutputSpec {
      return ["div", { class: "options" }, 0];
    },
  },

  option: {
    content: "block+",
    attrs: {
      letter: { default: "A" },
    },
    toDOM(node): DOMOutputSpec {
      return ["div", { class: "option", "data-letter": node.attrs.letter }, 0];
    },
  },

  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM(): DOMOutputSpec {
      return ["p", 0];
    },
  },

  text: {
    group: "inline",
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM(): DOMOutputSpec {
      return ["ul", 0];
    },
  },

  ordered_list: {
    content: "list_item+",
    group: "block",
    attrs: {
      order: { default: 1 },
    },
    parseDOM: [
      {
        tag: "ol",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLOListElement;
          const start = el.start;
          return { order: start || 1 };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return ["ol", { start: node.attrs.order }, 0];
    },
  },

  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM(): DOMOutputSpec {
      return ["li", 0];
    },
  },

  code_block: {
    content: "text*",
    group: "block",
    marks: "",
    code: true,
    defining: true,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full" as const, // <-- FIX: literal
      },
    ],
    toDOM(): DOMOutputSpec {
      return ["pre", ["code", 0]];
    },
  },

  image: {
    inline: true,
    group: "inline",
    draggable: true,
    attrs: {
      src: {},
      width: { default: null },
    },
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLImageElement;
          return {
            src: el.getAttribute("src"),
            width: el.getAttribute("data-width") || null,
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = { src: String(node.attrs.src) };
      if (node.attrs.width) attrs["data-width"] = String(node.attrs.width);
      return ["img", attrs];
    },
  },

  table: {
    content: "table_row+",
    group: "block",
    isolating: true,
    parseDOM: [{ tag: "table" }],
    toDOM(): DOMOutputSpec {
      return ["table", ["tbody", 0]];
    },
  },

  table_row: {
    content: "table_cell+",
    parseDOM: [{ tag: "tr" }],
    toDOM(): DOMOutputSpec {
      return ["tr", 0];
    },
  },

  table_cell: {
    content: "block+",
    parseDOM: [{ tag: "td" }],
    toDOM(): DOMOutputSpec {
      return ["td", 0];
    },
  },

  math_inline: {
    inline: true,
    group: "inline",
    atom: true,
    attrs: {
      latex: { default: "" },
    },
    parseDOM: [
      {
        tag: "span.math-inline",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLElement;
          return { latex: el.getAttribute("data-latex") || "" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return ["span", { class: "math-inline", "data-latex": node.attrs.latex }];
    },
  },

  math_block: {
    group: "block",
    atom: true,
    attrs: {
      latex: { default: "" },
    },
    parseDOM: [
      {
        tag: "div.math-block",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLElement;
          return { latex: el.getAttribute("data-latex") || "" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return ["div", { class: "math-block", "data-latex": node.attrs.latex }];
    },
  },
};

export const marks: Record<string, MarkSpec> = {
  strong: {
    parseDOM: [
      { tag: "strong" },
      {
        tag: "b",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLElement;
          return el.style.fontWeight !== "normal" ? null : false;
        },
      },
      {
        style: "font-weight",
        getAttrs(value: string) {
          return /^(bold(er)?|[5-9]\d{2,})$/.test(value) ? null : false;
        },
      },
    ] as readonly ParseRule[],
    toDOM(): DOMOutputSpec {
      return ["strong", 0];
    },
  },

  em: {
    parseDOM: [
      { tag: "i" },
      { tag: "em" },
      {
        style: "font-style",
        getAttrs(value: string) {
          return value === "italic" ? null : false;
        },
      },
    ] as readonly ParseRule[],
    toDOM(): DOMOutputSpec {
      return ["em", 0];
    },
  },

  underline: {
    parseDOM: [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs(value: string) {
          return value.includes("underline") ? null : false;
        },
      },
    ] as readonly ParseRule[],
    toDOM(): DOMOutputSpec {
      return ["u", 0];
    },
  },

  subscript: {
    parseDOM: [
      { tag: "sub" },
      {
        style: "vertical-align",
        getAttrs(value: string) {
          return value === "sub" ? null : false;
        },
      },
    ] as readonly ParseRule[],
    toDOM(): DOMOutputSpec {
      return ["sub", 0];
    },
  },

  superscript: {
    parseDOM: [
      { tag: "sup" },
      {
        style: "vertical-align",
        getAttrs(value: string) {
          return value === "super" ? null : false;
        },
      },
    ] as readonly ParseRule[],
    toDOM(): DOMOutputSpec {
      return ["sup", 0];
    },
  },
};


export const schema = new Schema({ nodes, marks });

// Helper opcional
export function extractPlainText(doc: any): string {
  let out = "";
  doc.descendants((node: any) => {
    if (node.isText) out += node.text ?? "";
    if (node.isBlock) out += "\n";
  });
  return out.trim();
}
