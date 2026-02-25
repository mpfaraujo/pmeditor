import { Schema, type NodeSpec, type MarkSpec, type DOMOutputSpec, type ParseRule } from "prosemirror-model";

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: "question | set_questions",
  },

question: {
  // ALTERAÇÃO PARA DISCURSIVA: options?
  content: "base_text? statement options?",
  attrs: {
    tipo: {
      default: null as null | "Múltipla Escolha" | "Certo/Errado" | "Discursiva",
    },
  },
  toDOM(node): DOMOutputSpec {
    const attrs: Record<string, any> = { class: "question" };
    if (node.attrs?.tipo) attrs["data-tipo"] = node.attrs.tipo;
    return ["div", attrs, 0];
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
  
set_questions: {
  // contexto obrigatório e compartilhado
  content: "base_text question_item+",
  attrs: {
    mode: { default: null }, // "essay" | null
  },
  toDOM(node): DOMOutputSpec {
    const attrs: Record<string, any> = { class: "set-questions" };
    if (node.attrs?.mode) attrs["data-mode"] = node.attrs.mode;
    return ["div", attrs, 0];
  },
},


question_item: {
  // uma pergunta sobre o mesmo contexto
  content: "statement options?",
  attrs: {
    answerKey: { default: null },
    assunto: { default: null as string | null },
    tags: { default: null as string[] | null },
  },
  toDOM(): DOMOutputSpec {
    return ["div", { class: "question-item" }, 0];
  },
},


paragraph: {
  content: "inline*",
  group: "block",
  attrs: {
    textAlign: { default: null as null | "left" | "center" | "right" | "justify" },
  },
  parseDOM: [
    {
      tag: "p",
      getAttrs(dom: Node | string) {
        const el = dom as HTMLElement;
        const a = (el.style?.textAlign || "").trim();
        const textAlign =
          a === "left" || a === "center" || a === "right" || a === "justify" ? a : null;
        return { textAlign };
      },
    },
  ],
  toDOM(node): DOMOutputSpec {
    const attrs: Record<string, string> = {};
    const a = node.attrs.textAlign;
    if (a) attrs.style = `text-align:${a};`;
    return ["p", attrs, 0];
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

  roman_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ol.roman-list" }],
    toDOM(): DOMOutputSpec {
      return ["ol", { class: "roman-list" }, 0];
    },
  },

  alpha_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ol.alpha-list" }],
    toDOM(): DOMOutputSpec {
      return ["ol", { class: "alpha-list" }, 0];
    },
  },

  assertive_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul.assertive-list" }],
    toDOM(): DOMOutputSpec {
      return ["ul", { class: "assertive-list" }, 0];
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
  atom: true,
  attrs: {
    id:{default : null},
    src: {},
    width: { default: null },  // px
    align: { default: null as null | "left" | "center" | "right" },
  },
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom: Node | string) {
        const el = dom as HTMLImageElement;
        const id = el.getAttribute("data-id");


        const dw = el.getAttribute("data-width");
        const wAttr = el.getAttribute("width");
        const styleW = el.style?.width || "";
        const stylePx = styleW.endsWith("px") ? styleW.slice(0, -2) : "";
        const width = dw || wAttr || stylePx || null;

        const da = el.getAttribute("data-align");
        const align = da === "left" || da === "center" || da === "right" ? da : null;

        return {
          id: id || null,
          src: el.getAttribute("src"),
          width,
          align,
          
        };
      },
    },
  ],
  toDOM(node): DOMOutputSpec {
    const attrs: Record<string, string> = { src: String(node.attrs.src) };

    const styles: string[] = ["height:auto;"];

    const w = node.attrs.width;
    if (w !== null && w !== undefined && String(w).trim() !== "") {
      const px = Math.max(1, Math.round(Number(w)));
      attrs["data-width"] = String(px);
      attrs["width"] = String(px);
      styles.push(`width:${px}px;`);
    }

    const align = node.attrs.align as any;
    if (align) {
      attrs["data-align"] = String(align);
      // torna bloco pra alinhar por margem
      styles.push("display:block;");
      if (align === "center") styles.push("margin-left:auto;margin-right:auto;");
      if (align === "left") styles.push("margin-left:0;margin-right:auto;");
      if (align === "right") styles.push("margin-left:auto;margin-right:0;");
    }
    if (node.attrs.id) {
  attrs["data-id"] = node.attrs.id;
}

    if (styles.length) attrs["style"] = styles.join("");

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

  poem: {
    content: "verse+",
    group: "block",
    attrs: {
      numbered: { default: false },
    },
    parseDOM: [
      {
        tag: "div.poem",
        getAttrs(dom: Node | string) {
          const el = dom as HTMLElement;
          return { numbered: el.getAttribute("data-numbered") === "true" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = { class: "poem" };
      if (node.attrs.numbered) attrs["data-numbered"] = "true";
      return ["div", attrs, 0];
    },
  },

  verse: {
    // Linha individual de poema — só válido dentro de poem
    content: "inline*",
    parseDOM: [{ tag: "div.verse" }],
    toDOM(): DOMOutputSpec {
      return ["div", { class: "verse" }, 0];
    },
  },

  credits: {
    // Créditos de texto — usável em qq contexto de bloco
    content: "inline*",
    group: "block",
    marks: "strong em",
    parseDOM: [{ tag: "p.credits" }],
    toDOM(): DOMOutputSpec {
      return ["p", { class: "credits" }, 0];
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
