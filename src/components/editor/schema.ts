import { Schema, Node as ProseMirrorNode } from "prosemirror-model";

// Definição dos nodes
const nodes = {
  // Node raiz do documento ProseMirror (obrigatório)
  doc: {
    content: "question",
  },

  // Node raiz da nossa estrutura de questão
  question: {
    content: "base_text? statement options",
    toDOM() {
      return ["div", { class: "question" }, 0] as const;
    },
  },

  // Texto-base da questão (opcional)
  base_text: {
    content: "block+",
    toDOM() {
      return ["div", { class: "base-text" }, 0] as const;
    },
  },

  // Enunciado da questão (obrigatório)
  statement: {
    content: "block+",
    toDOM() {
      return ["div", { class: "statement" }, 0] as const;
    },
  },

  // Container das opções
  options: {
    content: "option{2,5}",
    toDOM() {
      return ["div", { class: "options" }, 0] as const;
    },
  },

  // Uma opção individual (A, B, C, D, E)
  option: {
    content: "block+",
    attrs: {
      letter: { default: "A" },
    },
    toDOM(node: ProseMirrorNode) {
      return ["div", { class: "option", "data-letter": node.attrs.letter }, 0] as const;
    },
  },

  // Parágrafo (bloco de texto básico)
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM() {
      return ["p", 0] as const;
    },
  },

  // Imagem
  image: {
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      align: { default: "center" },
    },
    group: "block",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs(dom: HTMLElement) {
          return {
            src: dom.getAttribute("src"),
            alt: dom.getAttribute("alt"),
            title: dom.getAttribute("title"),
            width: dom.getAttribute("width"),
            height: dom.getAttribute("height"),
            align: dom.getAttribute("data-align") || "center",
          };
        },
      },
    ],
    toDOM(node: ProseMirrorNode) {
      const { src, alt, title, width, height, align } = node.attrs;
      return [
        "img",
        {
          src,
          alt,
          title,
          width,
          height,
          "data-align": align,
        },
      ] as const;
    },
  },

  // Fórmula inline (KaTeX)
  // Atom inline com LaTeX no atributo `latex`
  math_inline: {
    inline: true,
    group: "inline",
    atom: true,
    selectable: true,
    attrs: {
      latex: { default: "" },
    },
    parseDOM: [
      {
        tag: "span[data-math]",
        getAttrs(dom: HTMLElement) {
          return { latex: dom.getAttribute("data-math") || "" };
        },
      },
    ],
    toDOM(node: ProseMirrorNode) {
      return [
        "span",
        {
          class: "math-inline",
          "data-math": node.attrs.latex,
        },
      ] as const;
    },
  },

  // Bloco de código
  code_block: {
    content: "text*",
    group: "block",
    code: true, // Preserva whitespace
    attrs: {
      showLineNumbers: { default: false },
    },
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full" as const,
      },
    ],
    toDOM(node: ProseMirrorNode) {
      return [
        "pre",
        {
          "data-line-numbers": node.attrs.showLineNumbers ? "true" : "false",
        },
        ["code", 0],
      ] as const;
    },
  },

  // Lista não ordenada (bullet)
  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM() {
      return ["ul", 0] as const;
    },
  },

  // Lista ordenada
  ordered_list: {
    content: "list_item+",
    group: "block",
    attrs: { order: { default: 1 } },
    parseDOM: [
      {
        tag: "ol",
        getAttrs(dom: HTMLElement) {
          return {
            order: dom.hasAttribute("start")
              ? parseInt(dom.getAttribute("start")!, 10)
              : 1,
          };
        },
      },
    ],
    toDOM(node: ProseMirrorNode) {
      return node.attrs.order === 1
        ? (["ol", 0] as const)
        : (["ol", { start: node.attrs.order }, 0] as const);
    },
  },

  // Lista com números romanos
  roman_list: {
    content: "list_item+",
    group: "block",
    attrs: { order: { default: 1 } },
    parseDOM: [
      {
        tag: "ol.roman-list",
        getAttrs(dom: HTMLElement) {
          return {
            order: dom.hasAttribute("start")
              ? parseInt(dom.getAttribute("start")!, 10)
              : 1,
          };
        },
      },
    ],
    toDOM(node: ProseMirrorNode) {
      return [
        "ol",
        {
          class: "roman-list",
          start: node.attrs.order !== 1 ? node.attrs.order : undefined,
        },
        0,
      ] as const;
    },
  },

  // Lista alfabética
  alpha_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ol.alpha-list" }],
    toDOM() {
      return ["ol", { class: "alpha-list" }, 0] as const;
    },
  },

  // Lista de assertivas (parênteses)
  assertive_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul.assertive-list" }],
    toDOM() {
      return ["ul", { class: "assertive-list" }, 0] as const;
    },
  },

  // Item de lista
  list_item: {
    content: "paragraph block*",
    parseDOM: [{ tag: "li" }],
    toDOM() {
      return ["li", 0] as const;
    },
    defining: true,
  },

  // Texto (node obrigatório no ProseMirror)
  text: {
    group: "inline",
  },
};

// Definição dos marks (formatação inline)
const marks = {
  // Negrito
  strong: {
    parseDOM: [
      { tag: "strong" },
      {
        tag: "b",
        getAttrs: (node: HTMLElement) =>
          node.style.fontWeight !== "normal" && null,
      },
      {
        style: "font-weight",
        getAttrs: (value: string) =>
          /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
      },
    ],
    toDOM() {
      return ["strong", 0] as const;
    },
  },

  // Itálico
  em: {
    parseDOM: [
      { tag: "i" },
      { tag: "em" },
      { style: "font-style=italic" },
    ],
    toDOM() {
      return ["em", 0] as const;
    },
  },

  // Sublinhado
  underline: {
    parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
    toDOM() {
      return ["u", 0] as const;
    },
  },

  // Código inline
  code: {
    parseDOM: [{ tag: "code" }],
    toDOM() {
      return ["code", 0] as const;
    },
  },
  // Sobrescrito
  superscript: {
    parseDOM: [{ tag: "sup" }, { style: "vertical-align=super" }],
    toDOM() {
      return ["sup", 0] as const;
    },
    excludes: "subscript",
  },

  // Subscrito
  subscript: {
    parseDOM: [{ tag: "sub" }, { style: "vertical-align=sub" }],
    toDOM() {
      return ["sub", 0] as const;
    },
    excludes: "superscript",
  },
};

// Criar e exportar o schema
export const schema = new Schema({ nodes, marks });
