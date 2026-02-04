// src/components/editor/plugins/smartPastePlugin.ts
// Smart Paste (Word -> questão) + upload automático de imagens do clipboard para sua API PHP.
//
// IMAGEM: aplica width em px como min(naturalWidth, maxWidthCm) (não trava em 8cm).
// - carrega a imagem pela URL retornada, lê naturalWidth
// - widthPx = min(naturalWidth, cmToPx(maxWidthCm))
// - se falhar o load, usa widthPx = cmToPx(maxWidthCm) como fallback

import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Schema, Node as PMNode } from "prosemirror-model";

import { schema as appSchema } from "../schema";

export const smartPastePluginKey = new PluginKey("smartPastePlugin");

export type SmartPasteConfig = {
  uploadEndpoint: string;
  uploadToken: string;

  // Recomendado: false (mantém <img data:image/...> para capturar imagens do HTML)
  stripAllHtmlImages?: boolean;

  // default: 8cm como limite máximo para imagens inseridas automaticamente
  maxImageWidthCm?: number;
};

type ParsedQuestion = {
  statement: string;
  options?: Array<{ letter: string; text: string }>;
};

function getRuntimeSchema(view: EditorView): Schema {
  return (view?.state?.schema as Schema) ?? appSchema;
}

function ensureNode(schema: Schema, name: string) {
  const n = schema.nodes[name];
  if (!n) throw new Error(`[smartPaste] Node ausente no schema: "${name}"`);
  return n;
}

function cmToPx(cm: number) {
  return Math.round((cm / 2.54) * 96);
}

async function getImageNaturalWidth(url: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth || 0);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

function isProbablyWordHTML(html: string) {
  return /class=["']?Mso|mso-|<!--\s*\[if\s+g(te|l)\s+mso/i.test(html);
}

function normalizePastedText(input: string) {
  return (input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function protectLatexBlocks(rawHtml: string) {
  const stash: string[] = [];
  const token = (i: number) => `__PM_LATEX_BLOCK_${i}__`;

  let html = rawHtml.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
    const i = stash.push(m) - 1;
    return token(i);
  });

  html = html.replace(/\$(?!\$)[\s\S]*?\$(?!\$)/g, (m) => {
    const i = stash.push(m) - 1;
    return token(i);
  });

  const restore = (cleaned: string) =>
    cleaned.replace(/__PM_LATEX_BLOCK_(\d+)__/g, (_, n) => stash[Number(n)] ?? _);

  return { html, restore };
}

export function cleanWordHTML(rawHtml: string, opts?: { stripAllHtmlImages?: boolean }) {
  const { html: protectedHtml, restore } = protectLatexBlocks(rawHtml);
  let html = protectedHtml;

  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*\/?\s*o:p\s*>/gi, "")
    .replace(/<\s*\/?\s*w:[^>]*>/gi, "")
    .replace(/<\s*\/?\s*o:[^>]*>/gi, "")
    .replace(/<\s*\/?\s*v:[^>]*>/gi, "")
    .replace(/<\s*\/?\s*m:[^>]*>/gi, "");

  html = html
    .replace(/\sclass=(["'])?Mso[a-zA-Z0-9]+(\1)?/g, "")
    .replace(/\sstyle=(["'])[\s\S]*?\1/g, "")
    .replace(/\s(lang|x:|xmlns(:\w+)?|xml:|v:|o:|w:)[^=]*=(["'])[\s\S]*?\3/gi, "");

  if (opts?.stripAllHtmlImages ?? false) {
    html = html.replace(/<img\b[^>]*>/gi, "");
  } else {
    html = html.replace(/<img\b[^>]*\bsrc=(["'])file:\/\/[^"']*\1[^>]*>/gi, "");
  }

  html = html.replace(/\u00A0/g, " ").replace(/\s+\n/g, "\n");
  return restore(html);
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function looksLikeQuestionHeader(text: string) {
  const t = normalizePastedText(text);
  return (
    /^\s*\d{1,4}[\)\.\-:]+\s+\S/.test(t) ||
    /^\s*quest(?:a|ã)o\s*\d{1,4}/i.test(t) ||
    /^\s*q\s*[\.\-]?\s*\d{1,4}/i.test(t)
  );
}

function stripQuestionHeaderFromLine(s: string) {
  return s
    .replace(/^\s*quest(?:a|ã)o\s*\d{1,4}[\)\.\-:]*/i, "")
    .replace(/^\s*q\s*[\.\-]?\s*\d{1,4}[\)\.\-:]*/i, "")
    .replace(/^\s*\d{1,4}[\)\.\-:]*/, "")
    .trim();
}

function matchOptionLine(line: string) {
  const m = line.match(/^\(?\s*([A-Ea-e])\s*\)?[\)\.\-:]+\s+(.+)$/);
  if (!m) return null;
  return { letter: m[1].toUpperCase(), text: m[2].trim() };
}

export function parseQuestionFromText(input: string): ParsedQuestion | null {
  const raw = normalizePastedText(input);
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const stmt: string[] = [];
  const options: Array<{ letter: string; text: string }> = [];

  const first = looksLikeQuestionHeader(lines[0])
    ? stripQuestionHeaderFromLine(lines[0])
    : lines[0];

  if (first) stmt.push(first);

  for (let i = 1; i < lines.length; i++) {
    const opt = matchOptionLine(lines[i]);
    if (opt) options.push(opt);
    else if (options.length) options[options.length - 1].text += " " + lines[i];
    else stmt.push(lines[i]);
  }

  if (!stmt.length && options.length < 2) return null;
  return { statement: stmt.join("\n"), options: options.length ? options : undefined };
}

async function uploadImageFile(file: File, cfg: SmartPasteConfig): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(cfg.uploadEndpoint, {
    method: "POST",
    headers: { "X-Upload-Token": cfg.uploadToken },
    body: fd,
  });

  if (!res.ok) throw new Error("Upload falhou");
  const json = await res.json();
  if (!json?.success || typeof json?.url !== "string") throw new Error("Resposta inválida");
  return json.url;
}

async function insertInlineImageAtSelectionCapped(
  view: EditorView,
  url: string,
  maxWidthPx: number
) {
  const schema = getRuntimeSchema(view);
  const image = ensureNode(schema, "image");

  let widthPx = maxWidthPx;
  try {
    const natural = await getImageNaturalWidth(url);
    if (natural > 0) widthPx = Math.min(natural, maxWidthPx);
  } catch {}

  const node = image.create({ src: url, width: widthPx });
  const tr = view.state.tr.replaceSelectionWith(node);
  view.dispatch(tr.scrollIntoView());
}

function buildBlocksFromText(schema: Schema, raw: string): PMNode[] {
  const paragraph = ensureNode(schema, "paragraph");
  const mathInline = ensureNode(schema, "math_inline");
  const textNode = (s: string) => schema.text(s);

  const blocks: PMNode[] = [];
  const lines = normalizePastedText(raw).split("\n");

  for (const line of lines) {
    const inlines: PMNode[] = [];
    const re = /\$(?!\$)(.*?)\$(?!\$)/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(line))) {
      if (m.index > last) inlines.push(textNode(line.slice(last, m.index)));
      inlines.push(mathInline.create({ latex: m[1].trim() }));
      last = m.index + m[0].length;
    }
    if (last < line.length) inlines.push(textNode(line.slice(last)));

    blocks.push(paragraph.create(null, inlines));
  }

  return blocks.length ? blocks : [paragraph.create()];
}

function buildQuestionNode(schema: Schema, parsed: ParsedQuestion): PMNode {
  const question = ensureNode(schema, "question");
  const statement = ensureNode(schema, "statement");

  const statementNode = statement.create(null, buildBlocksFromText(schema, parsed.statement));

  if (!parsed.options?.length) {
    return question.create(null, [statementNode]);
  }

  const options = ensureNode(schema, "options");
  const option = ensureNode(schema, "option");

  const optionNodes = parsed.options.map((o) =>
    option.create({ letter: o.letter }, buildBlocksFromText(schema, o.text))
  );

  return question.create(null, [statementNode, options.create(null, optionNodes)]);
}

/**
 * ***CORREÇÃO PRINCIPAL***
 * - Se o cursor estiver dentro de question_item → substitui só o item
 * - Caso contrário → comportamento antigo (substitui o doc inteiro)
 */
function replaceDocWithSingleQuestion(view: EditorView, questionNode: PMNode) {
  const { state } = view;
  const { $from } = state.selection;

  let itemDepth: number | null = null;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "question_item") {
      itemDepth = d;
      break;
    }
  }

  if (itemDepth !== null) {
    const from = $from.before(itemDepth);
    const to = $from.after(itemDepth);

    const schema = getRuntimeSchema(view);
    const questionItem = ensureNode(schema, "question_item");

    // coloca statement+options dentro de um novo question_item
 const innerNodes = questionNode.content.content; // PMNode[]
    const newItem = questionItem.create($from.node(itemDepth).attrs ?? null, innerNodes);

    let tr = state.tr.replaceWith(from, to, newItem);

    // cursor no fim do item
    const end = tr.doc.resolve(tr.mapping.map(from) + newItem.nodeSize - 1);
    tr = tr.setSelection(TextSelection.near(end));

    view.dispatch(tr.scrollIntoView());
    return;
  }


  let tr = state.tr.replaceWith(0, state.doc.content.size, questionNode);
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(tr.doc.content.size)));
  view.dispatch(tr.scrollIntoView());
}

export function createSmartPastePlugin(cfg: SmartPasteConfig) {
  const maxPx = cmToPx(cfg.maxImageWidthCm ?? 8);

  return new Plugin({
    key: smartPastePluginKey,
    props: {
      transformPastedHTML(html: string) {
        return isProbablyWordHTML(html)
          ? cleanWordHTML(html, { stripAllHtmlImages: cfg.stripAllHtmlImages })
          : html;
      },

      handlePaste(view: EditorView, event: ClipboardEvent) {
        const text = extractClipboardText(event);
        const parsed = text ? parseQuestionFromText(text) : null;

        const images = collectClipboardImages(event);
        const html = extractClipboardHTML(event);
        if (!images.length) images.push(...extractDataImageFilesFromHTML(html));

        if (parsed) {
          event.preventDefault();
          const questionNode = buildQuestionNode(getRuntimeSchema(view), parsed);
          replaceDocWithSingleQuestion(view, questionNode);

          if (images.length) {
            (async () => {
              for (const f of images) {
                const url = await uploadImageFile(f, cfg);
                await insertInlineImageAtSelectionCapped(view, url, maxPx);
              }
            })();
          }
          return true;
        }

        if (images.length && !text.trim()) {
          event.preventDefault();
          (async () => {
            for (const f of images) {
              const url = await uploadImageFile(f, cfg);
              await insertInlineImageAtSelectionCapped(view, url, maxPx);
            }
          })();
          return true;
        }

        return false;
      },
    },
  });
}

/* -------- helpers finais -------- */

function extractClipboardHTML(e: ClipboardEvent) {
  return e.clipboardData?.getData("text/html") || "";
}

function extractClipboardText(e: ClipboardEvent) {
  const dt = e.clipboardData;
  if (!dt) return "";
  const plain = dt.getData("text/plain") || "";
  if (plain.trim()) return normalizePastedText(plain);
  const html = dt.getData("text/html") || "";
  return html ? normalizePastedText(htmlToPlainText(html)) : "";
}

function collectClipboardImages(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = e.clipboardData?.items ?? [];
  for (const it of items) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

function extractDataImageFilesFromHTML(html: string): File[] {
  const files: File[] = [];
  const re = /<img[^>]+src=["'](data:image\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  let i = 1;
  while ((m = re.exec(html))) {
    const f = dataUrlToFile(m[1], `pasted-${i++}`);
    if (f) files.push(f);
  }
  return files;
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new File([u8], filename, { type: m[1] });
}
