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
    // importante: para evitar CORS travar em alguns casos, mas naturalWidth normalmente funciona sem canvas
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

  const reNumeric = /^\s*\d{1,4}\s*(?:[\)\.\-:]+)\s+\S/;
  const reQuestao = /^\s*quest(?:a|ã)o\s*(?:n[ºo]\s*)?\d{1,4}\s*(?:[:\)\.\-]+)?\s+\S/i;
  const reQ = /^\s*q\s*[\.\-]?\s*\d{1,4}\s*(?:[:\)\.\-]+)?\s+\S/i;

  return reNumeric.test(t) || reQuestao.test(t) || reQ.test(t);
}

function stripQuestionHeaderFromLine(s: string) {
  let t = s.trim();
  t = t.replace(/^\s*quest(?:a|ã)o\s*(?:n[ºo]\s*)?\d{1,4}\s*(?:[:\)\.\-]+)?\s*/i, "");
  t = t.replace(/^\s*q\s*[\.\-]?\s*\d{1,4}\s*(?:[:\)\.\-]+)?\s*/i, "");
  t = t.replace(/^\s*\d{1,4}\s*(?:[\)\.\-:]+)\s*/i, "");
  return t.trim();
}

function matchOptionLine(line: string) {
  const s = line.trim();
  const m = s.match(/^\(?\s*([A-Ea-e])\s*\)?\s*(?:[\)\.\-:]+)\s+([\s\S]+)$/);
  if (!m) return null;
  return { letter: m[1].toUpperCase(), text: m[2].trim() };
}

export function parseQuestionFromText(input: string): ParsedQuestion | null {
  const raw = normalizePastedText(input);
  if (!raw) return null;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const stmtLines: string[] = [];
  const options: Array<{ letter: string; text: string }> = [];

  const firstLine = looksLikeQuestionHeader(lines[0])
    ? stripQuestionHeaderFromLine(lines[0])
    : lines[0];

  if (firstLine) stmtLines.push(firstLine);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const opt = matchOptionLine(line);
    if (opt) {
      options.push(opt);
      continue;
    }
    if (options.length > 0) options[options.length - 1].text += ` ${line}`;
    else stmtLines.push(line);
  }

  const statement = stmtLines.join("\n").trim();
  if (!statement && options.length === 0) return null;

  if (options.length >= 2) return { statement, options };
  if (looksLikeQuestionHeader(raw)) return { statement };

  return null;
}

async function uploadImageFile(file: File, cfg: SmartPasteConfig): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(cfg.uploadEndpoint, {
    method: "POST",
    headers: { "X-Upload-Token": cfg.uploadToken },
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`[smartPaste] Upload falhou: HTTP ${res.status} ${txt}`);
  }

  const json = (await res.json()) as any;
  if (!json?.success || typeof json?.url !== "string") {
    throw new Error(`[smartPaste] Resposta inválida do upload: ${JSON.stringify(json)}`);
  }
  return json.url;
}

async function insertInlineImageAtSelectionCapped(view: EditorView, url: string, maxWidthPx: number) {
  const schema = getRuntimeSchema(view);
  const image = ensureNode(schema, "image");

  let widthPx: number | null = null;
  try {
    const natural = await getImageNaturalWidth(url);
    if (natural > 0) widthPx = Math.min(natural, maxWidthPx);
    else widthPx = maxWidthPx;
  } catch {
    widthPx = maxWidthPx; // fallback seguro
  }

  const node = image.create({ src: url, width: widthPx });

  const tr = view.state.tr.replaceSelectionWith(node);
  view.dispatch(tr.scrollIntoView());
}

function buildBlocksFromText(schema: Schema, raw: string): PMNode[] {
  const paragraph = ensureNode(schema, "paragraph");
  const mathInline = ensureNode(schema, "math_inline");
  const mathBlock = ensureNode(schema, "math_block");
  const textNode = (s: string) => schema.text(s);

  const blocks: PMNode[] = [];
  const src = normalizePastedText(raw ?? "");

  const reBlock = /\$\$([\s\S]*?)\$\$/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const pushTextAsParagraphs = (txt: string) => {
    const lines = txt.replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
      if (line.trim().length === 0) continue;

      const inlines: PMNode[] = [];
      const reInline = /\$(?!\$)([\s\S]*?)\$(?!\$)/g;

      let li = 0;
      let mi: RegExpExecArray | null;
      while ((mi = reInline.exec(line))) {
        const before = line.slice(li, mi.index);
        if (before) inlines.push(textNode(before));
        const latex = (mi[1] ?? "").trim();
        inlines.push(mathInline.create({ latex }));
        li = mi.index + mi[0].length;
      }
      const after = line.slice(li);
      if (after) inlines.push(textNode(after));

      blocks.push(paragraph.create(null, inlines.length ? inlines : null));
    }
  };

  while ((m = reBlock.exec(src))) {
    const before = src.slice(lastIndex, m.index);
    if (before) pushTextAsParagraphs(before);

    const latex = (m[1] ?? "").trim();
    blocks.push(mathBlock.create({ latex }));

    lastIndex = m.index + m[0].length;
  }

  const rest = src.slice(lastIndex);
  if (rest) pushTextAsParagraphs(rest);

  if (blocks.length === 0) blocks.push(paragraph.create());
  return blocks;
}

function buildQuestionNode(schema: Schema, parsed: ParsedQuestion): PMNode {
  const question = ensureNode(schema, "question");
  const statement = ensureNode(schema, "statement");

  const statementBlocks = buildBlocksFromText(schema, parsed.statement);
  const statementNode = statement.create(null, statementBlocks);

  if (!parsed.options || parsed.options.length === 0) {
    return question.create(null, [statementNode]);
  }

  const options = ensureNode(schema, "options");
  const option = ensureNode(schema, "option");

  const optionNodes = parsed.options.map((o) => {
    const blocks = buildBlocksFromText(schema, o.text);
    return option.create({ letter: o.letter }, blocks);
  });

  const optionsNode = options.create(null, optionNodes);
  return question.create(null, [statementNode, optionsNode]);
}

function replaceDocWithSingleQuestion(view: EditorView, questionNode: PMNode) {
  const { state } = view;
  let tr = state.tr.replaceWith(0, state.doc.content.size, questionNode);

  const endPos = tr.doc.content.size;
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)));

  view.dispatch(tr.scrollIntoView());
}

function extractClipboardHTML(e: ClipboardEvent) {
  const dt = e.clipboardData;
  if (!dt) return "";
  return dt.getData("text/html") || "";
}

function extractClipboardText(e: ClipboardEvent) {
  const dt = e.clipboardData;
  if (!dt) return "";

  const plain = dt.getData("text/plain") || "";
  if (plain.trim()) return normalizePastedText(plain);

  const html = dt.getData("text/html") || "";
  if (html.trim()) {
    const cleaned = isProbablyWordHTML(html) ? cleanWordHTML(html, { stripAllHtmlImages: false }) : html;
    return normalizePastedText(htmlToPlainText(cleaned));
  }

  return "";
}

function collectClipboardImages(e: ClipboardEvent): File[] {
  const dt = e.clipboardData;
  if (!dt?.items?.length) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

function dataUrlToFile(dataUrl: string, filename = "pasted-image") {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;

  const mime = m[1];
  const b64 = m[2];

  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/webp"
          ? "webp"
          : "bin";

  return new File([u8], `${filename}.${ext}`, { type: mime });
}

function extractDataImageFilesFromHTML(html: string): File[] {
  if (!html.trim()) return [];
  const cleaned = isProbablyWordHTML(html) ? cleanWordHTML(html, { stripAllHtmlImages: false }) : html;

  const files: File[] = [];
  const re = /<img\b[^>]*\bsrc=(["'])(data:image\/[^"']+)\1[^>]*>/gi;

  let m: RegExpExecArray | null;
  let idx = 1;
  while ((m = re.exec(cleaned))) {
    const dataUrl = m[2];
    const f = dataUrlToFile(dataUrl, `pasted-${idx}`);
    if (f) files.push(f);
    idx++;
  }
  return files;
}

export function createSmartPastePlugin(cfg: SmartPasteConfig) {
  const maxCm = cfg.maxImageWidthCm ?? 8;
  const maxPx = cmToPx(maxCm);

  return new Plugin({
    key: smartPastePluginKey,
    props: {
      transformPastedHTML(html: string) {
        if (!isProbablyWordHTML(html)) return html;
        return cleanWordHTML(html, { stripAllHtmlImages: cfg.stripAllHtmlImages ?? false });
      },

      handlePaste(view: EditorView, event: ClipboardEvent) {
        const schema = getRuntimeSchema(view);

        const text = extractClipboardText(event);

        const itemFiles = collectClipboardImages(event);
        const html = extractClipboardHTML(event);
        const dataFiles = itemFiles.length ? [] : extractDataImageFilesFromHTML(html);

        const images = itemFiles.length ? itemFiles : dataFiles;

        const parsed = text ? parseQuestionFromText(text) : null;

        if (parsed) {
          event.preventDefault();

          const questionNode = buildQuestionNode(schema, parsed);
          replaceDocWithSingleQuestion(view, questionNode);

          if (images.length) {
            (async () => {
              for (const file of images) {
                try {
                  const url = await uploadImageFile(file, cfg);
                  await insertInlineImageAtSelectionCapped(view, url, maxPx);
                } catch (err) {
                  console.error(err);
                }
              }
            })();
          }

          return true;
        }

        if (images.length && !text.trim()) {
          event.preventDefault();
          (async () => {
            for (const file of images) {
              try {
                const url = await uploadImageFile(file, cfg);
                await insertInlineImageAtSelectionCapped(view, url, maxPx);
              } catch (err) {
                console.error(err);
              }
            }
          })();
          return true;
        }

        if (images.length) {
          (async () => {
            for (const file of images) {
              try {
                const url = await uploadImageFile(file, cfg);
                await insertInlineImageAtSelectionCapped(view, url, maxPx);
              } catch (err) {
                console.error(err);
              }
            }
          })();
        }

        return false;
      },
    },
  });
}
