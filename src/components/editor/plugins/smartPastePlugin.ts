// src/components/editor/plugins/smartPastePlugin.ts
// Smart Paste (Word/PDF/LaTeX -> questão) + upload automático de imagens do clipboard para sua API PHP.
//
// IMAGEM: aplica width em px como min(naturalWidth, maxWidthCm) (não trava em 8cm).
// - carrega a imagem pela URL retornada, lê naturalWidth
// - widthPx = min(naturalWidth, cmToPx(maxWidthCm))
// - se falhar o load, usa widthPx = cmToPx(maxWidthCm) como fallback

import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Schema, Node as PMNode, Mark } from "prosemirror-model";

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

export type ParsedLatexQuestion = {
  statementLatex: string;
  options?: Array<{ letter: string; latex: string; correct?: boolean }>;
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

/* ---------------- PDF text normalization (clipboard) ---------------- */

function looksLikePdfText(raw: string) {
  const s = raw ?? "";
  const nl = (s.match(/\n/g) || []).length;
  if (nl < 3) return false;
  // evita interferir em LaTeX fonte
  if (isProbablyLatexSource(s)) return false;
  return true;
}

function normalizePdfText(input: string) {
  let s = normalizePastedText(input);

  // de-hifenização: "exem-\nplo" => "exemplo"
  s = s.replace(/([A-Za-zÀ-ÿ])-[ \t]*\n[ \t]*([A-Za-zÀ-ÿ])/g, "$1$2");

  const lines = s.split("\n");

  const out: string[] = [];
  let cur = "";

  const isOptionStart = (line: string) => {
    const t = line.trim();
    if (/^\(?\s*[A-Ea-e]\s*\)?\s*[\)\.\-:]/.test(t)) return true;
    if (/^\(?\s*[A-Ea-e]\s*\)?$/.test(t)) return true;
    if (/^\(?\s*[A-Ea-e]\s*\)?\s+\S/.test(t)) return true;
    return false;
  };

  const endsHard = (t: string) => /[\.!\?;:,]$/.test(t);
  const startsNewPara = (t: string) => t.trim() === "";

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i];
    const line = lineRaw.trimEnd();
    const t = line.trim();

    if (startsNewPara(t)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }

    if (!cur) {
      cur = t;
      continue;
    }

    if (isOptionStart(t)) {
      out.push(cur.trim());
      cur = t;
      continue;
    }

    const prev = cur.trim();
    if (!endsHard(prev)) {
      cur = prev + " " + t;
    } else {
      out.push(prev);
      cur = t;
    }
  }

  if (cur.trim()) out.push(cur.trim());
  return out.join("\n");
}

/* ---------------- Word HTML cleaning ---------------- */

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

export function cleanWordHTML(
  rawHtml: string,
  opts?: { stripAllHtmlImages?: boolean }
) {
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
    .replace(
      /\s(lang|x:|xmlns(:\w+)?|xml:|v:|o:|w:)[^=]*=(["'])[\s\S]*?\3/gi,
      ""
    );

  if (opts?.stripAllHtmlImages ?? false) {
    html = html.replace(/<img\b[^>]*>/gi, "");
  } else {
    html = html.replace(
      /<img\b[^>]*\bsrc=(["'])file:\/\/[^"']*\1[^>]*>/gi,
      ""
    );
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

function matchOptionLineClassic(line: string) {
  const t = line.trim();

  let m = t.match(/^\(?\s*([A-Ea-e])\s*\)?\s*[\)\.\-:]\s*(.+)$/);
  if (m) return { letter: m[1].toUpperCase(), text: (m[2] ?? "").trim() };

  m = t.match(/^\(?\s*([A-Ea-e])\s*\)?\s{2,}(.+)$/);
  if (m) return { letter: m[1].toUpperCase(), text: (m[2] ?? "").trim() };

  return null;
}

function splitInlineOptionsInLineClassic(line: string) {
  const t = line.trim();
  const re = /\(?\s*([A-Ea-e])\s*\)?\s*[\)\.\-:]\s*/g;
  const hits: Array<{ letter: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    hits.push({ letter: m[1].toUpperCase(), start: m.index, end: re.lastIndex });
  }
  if (hits.length < 2) return null;

  const out: Array<{ letter: string; text: string }> = [];
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const text = t.slice(cur.end, next ? next.start : t.length).trim();
    if (text) out.push({ letter: cur.letter, text });
  }
  return out.length ? out : null;
}

/* ---------------- ENEM options (no marker) ---------------- */

function isSoloLetter(line: string) {
  return /^\(?\s*([A-Ea-e])\s*\)?$/.test(line.trim());
}

function getSoloLetter(line: string) {
  const m = line.trim().match(/^\(?\s*([A-Ea-e])\s*\)?$/);
  return m ? m[1].toUpperCase() : null;
}

function parseLetterPlusTextLoose(line: string) {
  // aceita 1+ espaços: "A 4." / "A texto..."
  const m = line
    .trim()
    .match(/^\(?\s*([A-Ea-e])\s*\)?\s+([\s\S]+)$/);
  if (!m) return null;
  return { letter: m[1].toUpperCase(), text: (m[2] ?? "").trim() };
}

function splitInlineOptionsNoMarker(line: string) {
  const t = line.trim();
  const re = /\b([A-Ea-e])\s+(?=\S)/g;
  const hits: Array<{ letter: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    hits.push({ letter: m[1].toUpperCase(), start: m.index, end: re.lastIndex });
  }
  if (hits.length < 3) return null;

  const letters = hits.map((h) => h.letter);
  if (letters[0] !== "A") return null;
  if (!letters.includes("B") || !letters.includes("C")) return null;

  const out: Array<{ letter: string; text: string }> = [];
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const text = t.slice(cur.end, next ? next.start : t.length).trim();
    if (text) out.push({ letter: cur.letter, text });
  }

  const idxA = out.findIndex((o) => o.letter === "A");
  const idxB = out.findIndex((o) => o.letter === "B");
  const idxC = out.findIndex((o) => o.letter === "C");
  if (idxA !== 0 || idxB === -1 || idxC === -1) return null;
  if (!(idxA < idxB && idxB < idxC)) return null;

  return out.length ? out : null;
}

function tryParseEnemOptions(lines: string[], startIndex: number) {
  const expected = ["A", "B", "C", "D", "E"] as const;

  let i = startIndex;
  const out: Array<{ letter: string; text: string }> = [];

  for (let k = 0; k < expected.length && i < lines.length; k++) {
    const exp = expected[k];

    const line = lines[i].trim();

    let letter: string | null = null;
    let text = "";

    const solo = getSoloLetter(line);
    const lp = parseLetterPlusTextLoose(line);

    if (solo) {
      letter = solo;
      i++;
      const buf: string[] = [];
      while (i < lines.length) {
        const next = lines[i].trim();

        if (isSoloLetter(next)) break;
        if (parseLetterPlusTextLoose(next)) break;
        if (matchOptionLineClassic(next)) break;
        const multiClassic = splitInlineOptionsInLineClassic(next);
        if (multiClassic) break;

        buf.push(next);
        i++;
      }
      text = buf.join(" ").trim();
    } else if (lp) {
      letter = lp.letter;
      text = lp.text;
      i++;

      const buf: string[] = [];
      while (i < lines.length) {
        const next = lines[i].trim();

        if (isSoloLetter(next)) break;
        if (parseLetterPlusTextLoose(next)) break;
        if (matchOptionLineClassic(next)) break;
        const multiClassic = splitInlineOptionsInLineClassic(next);
        if (multiClassic) break;

        buf.push(next);
        i++;
      }
      if (buf.length) text = (text + " " + buf.join(" ")).trim();
    } else {
      break;
    }

    if (letter !== exp) break;
    out.push({ letter, text });
  }

  const idxA = out.findIndex((o) => o.letter === "A");
  const idxB = out.findIndex((o) => o.letter === "B");
  const idxC = out.findIndex((o) => o.letter === "C");
  if (idxA !== 0 || idxB === -1 || idxC === -1) return null;
  if (!(idxA < idxB && idxB < idxC)) return null;
  if (out.length < 3) return null;

  return { options: out, nextIndex: i };
}

export function parseQuestionFromText(input: string): ParsedQuestion | null {
  const raw = normalizePastedText(input);
  if (!raw) return null;

  const linesAll = raw.split("\n").map((l) => l.trim());
  const lines = linesAll.filter(Boolean);
  if (!lines.length) return null;

  // 1) primeiro, tenta achar o começo das alternativas por sequência A,B,C
  //    (evita falso-positivo em "A montanha..." porque exige A->B->C)
  let optionsStart: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const isAStart =
      t === "A" ||
      t === "(A)" ||
      /^\(?\s*A\s*\)?\s+\S/.test(t) || // "A 4." / "A texto"
      /^\(?\s*A\s*\)?$/.test(t);

    if (!isAStart) continue;

    const parsed = tryParseEnemOptions(lines, i);
    if (parsed) {
      optionsStart = i;
      break;
    }
  }

  // 2) se achou bloco ENEM, statement = tudo antes; options = do bloco
  if (optionsStart !== null) {
    const stmtLines = lines.slice(0, optionsStart);

    const firstStmt =
      stmtLines.length && looksLikeQuestionHeader(stmtLines[0])
        ? stripQuestionHeaderFromLine(stmtLines[0])
        : stmtLines[0] ?? "";

    const stmt: string[] = [];
    if (firstStmt) stmt.push(firstStmt);
    for (let i = 1; i < stmtLines.length; i++) stmt.push(stmtLines[i]);

    const parsed = tryParseEnemOptions(lines, optionsStart);
    if (parsed) {
      return {
        statement: stmt.join("\n").trim(),
        options: parsed.options,
      };
    }
    // se por algum motivo falhar aqui, cai pro fluxo antigo abaixo
  }

  // 3) fallback: fluxo antigo (Word clássico com A) / A. / A - / A: / inline etc)
  const stmt: string[] = [];
  const options: Array<{ letter: string; text: string }> = [];

  const first = looksLikeQuestionHeader(lines[0])
    ? stripQuestionHeaderFromLine(lines[0])
    : lines[0];

  if (first) stmt.push(first);

  for (let i = 1; i < lines.length; i++) {
    const multiClassic = splitInlineOptionsInLineClassic(lines[i]);
    if (multiClassic) {
      options.push(...multiClassic);
      continue;
    }

    const optClassic = matchOptionLineClassic(lines[i]);
    if (optClassic) {
      options.push(optClassic);
      continue;
    }

    const multiNoMarker = splitInlineOptionsNoMarker(lines[i]);
    if (multiNoMarker) {
      options.push(...multiNoMarker);
      continue;
    }

    if (options.length) {
      options[options.length - 1].text =
        (options[options.length - 1].text + " " + lines[i]).trim();
    } else {
      stmt.push(lines[i]);
    }
  }

  if (!stmt.length && options.length < 2) return null;
  return {
    statement: stmt.join("\n"),
    options: options.length ? options : undefined,
  };
}


function stripLatexComments(src: string) {
  const lines = (src ?? "").replace(/\r\n/g, "\n").split("\n");
  return lines
    .map((line) => {
      let out = "";
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escaped) {
          out += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          out += ch;
          escaped = true;
          continue;
        }
        if (ch === "%") break;
        out += ch;
      }
      return out;
    })
    .join("\n");
}

function replaceLatexTableEnvsWithPlaceholder(src: string) {
  let s = src;
  s = s.replace(
    /\\begin\{table\*?\}[\s\S]*?\\end\{table\*?\}/g,
    "\n\n[[TAB_PENDENTE]]\n\n"
  );
  s = s.replace(
    /\\begin\{tabular\*?\}[\s\S]*?\\end\{tabular\*?\}/g,
    "\n\n[[TAB_PENDENTE]]\n\n"
  );
  return s;
}

function replaceIncludeGraphicsWithPlaceholder(src: string) {
  return src.replace(
    /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g,
    (_, p1) => {
      const name = String(p1 ?? "").trim();
      return `[[IMG_PENDENTE${name ? `: ${name}` : ""}]]`;
    }
  );
}

function stripLatexQuestionCommand(stmt: string) {
  return stmt
    .replace(/\\begin\{questions\}/g, "")
    .replace(/\\end\{questions\}/g, "")
    .replace(/\\question\s*(\[[^\]]*\])?\s*/g, "")
    .trim();
}

export function parseQuestionFromLatexText(input: string): ParsedLatexQuestion | null {
  let src = input ?? "";
  src = stripLatexComments(src);
  src = src.replace(/\r\n/g, "\n");
  src = replaceLatexTableEnvsWithPlaceholder(src);
  src = replaceIncludeGraphicsWithPlaceholder(src);

  const mBegin = src.match(/\\begin\{(choices|oneparchoices)\}/);

  // Sem choices → questão discursiva (só enunciado)
  if (!mBegin) {
    const stmtPart = stripLatexQuestionCommand(src.trim());
    if (!stmtPart) return null;
    return { statementLatex: stmtPart };
  }

  const env = mBegin[1];
  const beginIdx = mBegin.index ?? 0;
  const beginLen = mBegin[0].length;

  const endRe = new RegExp(`\\\\end\\{${env}\\}`);
  const mEnd = endRe.exec(src.slice(beginIdx + beginLen));
  if (!mEnd) return null;

  const stmtPart = stripLatexQuestionCommand(src.slice(0, beginIdx).trim());
  const choicesPart = src
    .slice(beginIdx + beginLen, beginIdx + beginLen + mEnd.index)
    .trim();

  const options: Array<{ letter: string; latex: string; correct?: boolean }> = [];

  const reChoice = /\\(CorrectChoice|correctchoice|choice)\b/g;
  const hits: Array<{
    kind: "CorrectChoice" | "correctchoice" | "choice";
    idx: number;
    end: number;
  }> = [];
  let mm: RegExpExecArray | null;
  while ((mm = reChoice.exec(choicesPart))) {
    hits.push({
      kind: (mm[1] as any) ?? "choice",
      idx: mm.index,
      end: reChoice.lastIndex,
    });
  }
  if (!hits.length) return null;

  const letterFor = (i: number) => {
    const code = "A".charCodeAt(0) + i;
    return String.fromCharCode(code);
  };

  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const body = choicesPart
      .slice(cur.end, next ? next.idx : choicesPart.length)
      .trim();
    options.push({
      letter: letterFor(i),
      latex: body || "",
      correct: cur.kind === "CorrectChoice" || cur.kind === "correctchoice",
    });
  }

  return {
    statementLatex: stmtPart,
    options: options.length ? options : undefined,
  };
}

/* ---------------- LaTeX -> ProseMirror blocks ---------------- */

function getMark(schema: Schema, name: string): Mark | null {
  const m = schema.marks?.[name];
  return m ? m.create() : null;
}

function skipSpaces(s: string, i: number) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}

function findNextLatexTokenIndex(s: string, from: number) {
  const tokens = [
    "$$",
    "\\[",
    "\\(",
    "$",
    "\\textbf",
    "\\textit",
    "\\emph",
    "\\underline",
    "[[",
  ];
  let best = -1;
  for (const t of tokens) {
    const idx = s.indexOf(t, from);
    if (idx === -1) continue;
    if (best === -1 || idx < best) best = idx;
  }
  return best;
}

function parseInlineLatex(
  schema: Schema,
  input: string,
  active: Mark[] = []
): PMNode[] {
  const mathInline = ensureNode(schema, "math_inline");
  const strong = getMark(schema, "strong");
  const em = getMark(schema, "em");
  const underline = getMark(schema, "underline");

  const textNode = (s: string, marks: Mark[]) => {
    if (!s) return null;
    return schema.text(s, marks.length ? marks : undefined);
  };

  const nodes: PMNode[] = [];
  let i = 0;
  const s = input ?? "";

  const pushText = (t: string, marks: Mark[]) => {
    const n = textNode(t, marks);
    if (n) nodes.push(n);
  };

  const readBraced = (start: number) => {
    if (s[start] !== "{") return null;
    let depth = 0;
    for (let j = start; j < s.length; j++) {
      const ch = s[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return { content: s.slice(start + 1, j), end: j + 1 };
      }
    }
    return null;
  };

  const readUntil = (start: number, endToken: string) => {
    const idx = s.indexOf(endToken, start);
    if (idx === -1) return null;
    return { content: s.slice(start, idx), end: idx + endToken.length };
  };

  while (i < s.length) {
    if (s.startsWith("$$", i)) {
      const r = readUntil(i + 2, "$$");
      if (r) {
        nodes.push(mathInline.create({ latex: r.content.trim() }));
        i = r.end;
        continue;
      }
    }

    if (s.startsWith("\\[", i)) {
      const r = readUntil(i + 2, "\\]");
      if (r) {
        nodes.push(mathInline.create({ latex: r.content.trim() }));
        i = r.end;
        continue;
      }
    }

    if (s.startsWith("\\(", i)) {
      const r = readUntil(i + 2, "\\)");
      if (r) {
        nodes.push(mathInline.create({ latex: r.content.trim() }));
        i = r.end;
        continue;
      }
    }

    if (s[i] === "$") {
      const r = readUntil(i + 1, "$");
      if (r) {
        nodes.push(mathInline.create({ latex: r.content.trim() }));
        i = r.end;
        continue;
      }
    }

    if (s.startsWith("\\textbf", i)) {
      const j = i + "\\textbf".length;
      const br = readBraced(skipSpaces(s, j));
      if (br && strong) {
        nodes.push(...parseInlineLatex(schema, br.content, [...active, strong]));
        i = br.end;
        continue;
      }
    }

    if (s.startsWith("\\textit", i)) {
      const j = i + "\\textit".length;
      const br = readBraced(skipSpaces(s, j));
      if (br && em) {
        nodes.push(...parseInlineLatex(schema, br.content, [...active, em]));
        i = br.end;
        continue;
      }
    }

    if (s.startsWith("\\emph", i)) {
      const j = i + "\\emph".length;
      const br = readBraced(skipSpaces(s, j));
      if (br && em) {
        nodes.push(...parseInlineLatex(schema, br.content, [...active, em]));
        i = br.end;
        continue;
      }
    }

    if (s.startsWith("\\underline", i)) {
      const j = i + "\\underline".length;
      const br = readBraced(skipSpaces(s, j));
      if (br && underline) {
        nodes.push(
          ...parseInlineLatex(schema, br.content, [...active, underline])
        );
        i = br.end;
        continue;
      }
    }

    if (s.startsWith("[[", i)) {
      const end = s.indexOf("]]", i + 2);
      if (end !== -1) {
        pushText(s.slice(i, end + 2), active);
        i = end + 2;
        continue;
      }
    }

    const next = findNextLatexTokenIndex(s, i);
    const chunk = next === -1 ? s.slice(i) : s.slice(i, next);
    pushText(chunk, active);
    i = next === -1 ? s.length : next;
  }

  return nodes;
}

function findNextListBegin(src: string, from: number) {
  const a = src.indexOf("\\begin{enumerate}", from);
  const b = src.indexOf("\\begin{itemize}", from);
  if (a === -1 && b === -1) return null;
  if (a === -1) return { idx: b, env: "itemize" as const };
  if (b === -1) return { idx: a, env: "enumerate" as const };
  return a < b
    ? { idx: a, env: "enumerate" as const }
    : { idx: b, env: "itemize" as const };
}

function parseLatexListEnv(src: string, beginIdx: number) {
  const isEnum = src.startsWith("\\begin{enumerate}", beginIdx);
  const isItem = src.startsWith("\\begin{itemize}", beginIdx);
  if (!isEnum && !isItem) return null;

  const env = isEnum ? "enumerate" : "itemize";
  const beginTag = `\\begin{${env}}`;
  const endTag = `\\end{${env}}`;

  const start = beginIdx + beginTag.length;
  const endPos = src.indexOf(endTag, start);
  if (endPos === -1) return null;

  const body = src.slice(start, endPos);

  const items = body
    .split(/\\item\b/g)
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    kind: isEnum ? ("ordered" as const) : ("bullet" as const),
    items,
    end: endPos + endTag.length,
  };
}

function buildBlocksFromLatex(schema: Schema, rawLatex: string): PMNode[] {
  const paragraph = ensureNode(schema, "paragraph");
  const orderedList = schema.nodes["ordered_list"];
  const bulletList = schema.nodes["bullet_list"];
  const listItem = schema.nodes["list_item"];

  const src = normalizePastedText(rawLatex ?? "");
  if (!src) return [paragraph.create()];

  const blocks: PMNode[] = [];

  const pushTextAsParagraphs = (chunk: string) => {
    const parts = chunk
      .replace(/\\par\b/g, "\n\n")
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of parts) {
      blocks.push(paragraph.create(null, parseInlineLatex(schema, p)));
    }
  };

  let i = 0;
  while (i < src.length) {
    const nextList = findNextListBegin(src, i);
    if (!nextList) {
      pushTextAsParagraphs(src.slice(i));
      break;
    }

    if (nextList.idx > i) pushTextAsParagraphs(src.slice(i, nextList.idx));

    const parsed = parseLatexListEnv(src, nextList.idx);
    if (!parsed) {
      pushTextAsParagraphs(src.slice(nextList.idx, nextList.idx + 20));
      i = nextList.idx + 20;
      continue;
    }

    const { kind, items, end } = parsed;
    i = end;

    if (!orderedList || !bulletList || !listItem) {
      const marker = kind === "ordered" ? "1." : "-";
      const fallback = items.map((it) => `${marker} ${it}`).join("\n");
      pushTextAsParagraphs(fallback);
      continue;
    }

    const listNode = kind === "ordered" ? orderedList : bulletList;
    const itemNodes = items.map((it) =>
      listItem.create(null, buildBlocksFromLatex(schema, it))
    );
    blocks.push(listNode.create(null, itemNodes));
  }

  return blocks.length ? blocks : [paragraph.create()];
}

/* ---------------- Upload / image insertion ---------------- */

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
  if (!json?.success || typeof json?.url !== "string")
    throw new Error("Resposta inválida");
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

/* ---------------- Builders (Word/PDF text) ---------------- */

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

  const statementNode = statement.create(
    null,
    buildBlocksFromText(schema, parsed.statement)
  );

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

export function buildQuestionNodeLatex(schema: Schema, parsed: ParsedLatexQuestion): PMNode {
  const question = ensureNode(schema, "question");
  const statement = ensureNode(schema, "statement");

  const stmtBlocks = buildBlocksFromLatex(schema, parsed.statementLatex || "");
  const statementNode = statement.create(null, stmtBlocks);

  if (!parsed.options?.length) {
    return question.create(null, [statementNode]);
  }

  const options = ensureNode(schema, "options");
  const option = ensureNode(schema, "option");

  const optionNodes = parsed.options.map((o) =>
    option.create({ letter: o.letter }, buildBlocksFromLatex(schema, o.latex))
  );

  return question.create(null, [statementNode, options.create(null, optionNodes)]);
}

/* ---------------- AnswerKey (LaTeX exam) ---------------- */

export function extractLatexAnswerKey(parsed: ParsedLatexQuestion) {
  const correct = parsed.options?.find((o) => o.correct)?.letter;
  if (!correct) return null;
  return { kind: "mcq", correct };
}

/**
 * - Se o cursor estiver dentro de question_item → substitui só o item
 * - Caso contrário → substitui o doc inteiro
 * + Se vier answerKey e estiver dentro de question_item: seta attrs.answerKey
 */
function replaceDocWithSingleQuestion(
  view: EditorView,
  questionNode: PMNode,
  opts?: { answerKey?: any }
) {
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

    const innerNodes = questionNode.content.content; // PMNode[]
    const prevAttrs = ($from.node(itemDepth).attrs ?? {}) as any;
    const nextAttrs =
      opts?.answerKey !== undefined
        ? { ...prevAttrs, answerKey: opts.answerKey }
        : prevAttrs;

    const newItem = questionItem.create(nextAttrs, innerNodes);

    let tr = state.tr.replaceWith(from, to, newItem);

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
        const textRaw = extractClipboardText(event);

        const latexParsed =
          textRaw && isProbablyLatexSource(textRaw)
            ? parseQuestionFromLatexText(textRaw)
            : null;

        const textForTextParse = latexParsed
          ? ""
          : looksLikePdfText(textRaw)
            ? normalizePdfText(textRaw)
            : textRaw;

        const parsed = latexParsed
          ? null
          : textForTextParse
            ? parseQuestionFromText(textForTextParse)
            : null;

        const images = collectClipboardImages(event);
        const html = extractClipboardHTML(event);
        if (!images.length) images.push(...extractDataImageFilesFromHTML(html));

        if (latexParsed) {
          event.preventDefault();

          const answerKey = extractLatexAnswerKey(latexParsed);
          const questionNode = buildQuestionNodeLatex(getRuntimeSchema(view), latexParsed);

          replaceDocWithSingleQuestion(view, questionNode, { answerKey });

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

        if (images.length && !textRaw.trim()) {
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

/* ---------------- LaTeX detection ---------------- */

function isProbablyLatexSource(text: string) {
  const t = text ?? "";
  return (
    /\\begin\{(choices|oneparchoices|enumerate|itemize|tabular|table)\}/.test(t) ||
    /\\(textbf|textit|emph|underline|includegraphics)\b/.test(t) ||
    /\\(choice|correctchoice|CorrectChoice)\b/.test(t) ||
    /\$[^\$]+\$/.test(t) ||
    /\\\(|\\\)|\\\[|\\\]/.test(t) ||
    /\\question\b/.test(t)
  );
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
