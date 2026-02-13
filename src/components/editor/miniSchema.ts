import { Schema } from "prosemirror-model";
import { marks as fullMarks } from "./schema";

/**
 * Schema reduzido para o RichTextMiniEditor.
 * Suporta: paragraph, text, math_inline, math_block, image, listas, marks.
 * Sem: question, statement, options, option, set_questions, question_item,
 *      base_text, code_block, table.
 */
export const miniSchema = new Schema({
  nodes: {
    doc: { content: "block+" },

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
      toDOM(node) {
        const attrs: Record<string, string> = {};
        const a = node.attrs.textAlign;
        if (a) attrs.style = `text-align:${a};`;
        return ["p", attrs, 0] as const;
      },
    },

    text: { group: "inline" },

    math_inline: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: { latex: { default: "" } },
      parseDOM: [
        {
          tag: "span.math-inline",
          getAttrs(dom: Node | string) {
            const el = dom as HTMLElement;
            return { latex: el.getAttribute("data-latex") || "" };
          },
        },
      ],
      toDOM(node) {
        return ["span", { class: "math-inline", "data-latex": node.attrs.latex }] as const;
      },
    },

    math_block: {
      group: "block",
      atom: true,
      attrs: { latex: { default: "" } },
      parseDOM: [
        {
          tag: "div.math-block",
          getAttrs(dom: Node | string) {
            const el = dom as HTMLElement;
            return { latex: el.getAttribute("data-latex") || "" };
          },
        },
      ],
      toDOM(node) {
        return ["div", { class: "math-block", "data-latex": node.attrs.latex }] as const;
      },
    },

    image: {
      inline: true,
      group: "inline",
      draggable: true,
      atom: true,
      attrs: {
        id: { default: null },
        src: {},
        width: { default: null },
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
            return { id: id || null, src: el.getAttribute("src"), width, align };
          },
        },
      ],
      toDOM(node) {
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
          styles.push("display:block;");
          if (align === "center") styles.push("margin-left:auto;margin-right:auto;");
          if (align === "left") styles.push("margin-left:0;margin-right:auto;");
          if (align === "right") styles.push("margin-left:auto;margin-right:0;");
        }
        if (node.attrs.id) attrs["data-id"] = node.attrs.id;
        if (styles.length) attrs["style"] = styles.join("");
        return ["img", attrs] as const;
      },
    },

    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM() { return ["ul", 0] as const; },
    },

    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: "ol",
          getAttrs(dom: Node | string) {
            const el = dom as HTMLOListElement;
            return { order: el.start || 1 };
          },
        },
      ],
      toDOM(node) { return ["ol", { start: node.attrs.order }, 0] as const; },
    },

    list_item: {
      content: "paragraph block*",
      defining: true,
      parseDOM: [{ tag: "li" }],
      toDOM() { return ["li", 0] as const; },
    },
  },

  marks: {
    strong: fullMarks.strong,
    em: fullMarks.em,
    underline: fullMarks.underline,
    subscript: fullMarks.subscript,
    superscript: fullMarks.superscript,
  },
});
