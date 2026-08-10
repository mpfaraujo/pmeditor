#!/usr/bin/env tsx
/**
 * scripts/bulk-import.ts
 *
 * Importa em massa questões do import-queue.json direto para o banco.
 * Suporta imagens remotas: resolve \includegraphics{...} a partir de uma
 * página HTML de origem, faz upload para upload.php e salva as questões
 * já com image nodes.
 *
 * Uso:
 *   pnpm tsx scripts/bulk-import.ts [opções]
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { basename, extname, resolve } from "path";
import { schema } from "../src/components/editor/schema";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
  extractLatexAnswerKey,
} from "../src/components/editor/plugins/smartPastePlugin";
import { normalizeDisciplina, normalizeAssunto } from "../src/data/assuntos";
import {
  associateReviewHints,
  parseTranscriptionReviewReport,
  type ImportedReviewHint,
  type TranscriptionReviewHint,
} from "../src/lib/importReview";

type YamlMeta = {
  tipo?: string;
  dificuldade?: string;
  nivel?: string;
  disciplina?: string;
  assunto?: string;
  gabarito?: string;
  resposta?: string;
  tags?: string[];
  fonte?: string;
  concurso?: string;
  banca?: string;
  ano?: number;
  numero?: string;
  cargo?: string;
  prova?: string;
  autor_texto?: string;
  titulo_texto?: string;
  basetext?: string;
  ano_publicacao?: number;
  tema?: string;
  genero?: string;
  movimento?: string;
};

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
  meta?: YamlMeta;
  /** Texto base embutido na própria questão (MCQ ENEM-style, sem reuso, sem titulo_texto). */
  embeddedBaseLatex?: string;
};

type ImportSetItem = {
  isSet: true;
  baseLatex?: string;
  baseLatexes?: string[];
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito" | "resposta" | "numero">;
  }>;
  sharedMeta?: YamlMeta;
};

type ImportBaseTextItem = {
  isBaseText: true;
  latex: string;
  meta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem | ImportBaseTextItem;

type DuplicateReportItem = {
  idx: number;
  existingId: string;
  similarity: number;
  label: string;
  preview: string;
  payload: {
    metadata: any;
    content: any;
  };
};

type ImportReport = {
  batch?: string;
  runId: string;
  queuePath: string;
  createdAt: string;
  dryRun: boolean;
  summary: {
    imported: number;
    duplicates: number;
    failed: number;
    skipped: number;
    totalQueue: number;
    processed: number;
  };
  duplicates: DuplicateReportItem[];
  errors: Array<{ idx: number; id: string; error: string }>;
  reviewHints?: ImportedReviewHint[];
  unresolvedReviewHints?: Array<TranscriptionReviewHint & { queueIndex: number; outcome: "duplicate" | "error" }>;
};

type BatchConfig = {
  assunto: string;
  dificuldade: "Fácil" | "Média" | "Difícil";
  disciplina: string;
  tags: string[];
  source: {
    kind: "original" | "concurso";
    concurso?: string;
    banca?: string;
    ano?: number;
    cargo?: string;
  };
};

type ImageImportConfig = {
  htmlUrls: string[];
  uploadEndpoint: string;
  uploadToken: string;
  sourceMap: Map<string, string>;
  altMap: Map<string, string>;
  uploadCache: Map<string, string>;
  unresolved: Set<string>;
  uploaded: Set<string>;
  possibleFormulaImages: Array<{ name: string; alt: string }>;
  imagesDir?: string;
  dryRun: boolean;
};

const DEFAULT_UPLOAD_ENDPOINT = "https://mpfaraujo.com.br/guardafiguras/api/upload.php";
const DEFAULT_UPLOAD_TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";
const IMAGE_PLACEHOLDER_RE = /\[\[IMG_PENDENTE(?::\s*([^\]]+))?\]\]/g;

function newId(): string {
  return crypto.randomUUID();
}

function makeTextDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function parseRespostaToDoc(text: string): any {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
        const questionNode = buildQuestionNodeLatex(schema, parsed);
        const stmt = questionNode.firstChild;
        if (stmt && stmt.type === schema.nodes.statement) {
            const doc = schema.nodes.doc.create(null, stmt.content);
            return doc.toJSON();
        }
    }
  } catch {}
  return makeTextDoc(text);
}

function normalizeGabaritoForTipo(tipo: string): any {
  const t = tipo.toLowerCase();
  if (t.includes("múltipla") || t.includes("multipla"))
    return { kind: "mcq", correct: null };
  if (t.includes("certo") || t.includes("errado"))
    return { kind: "tf", correct: null };
  return { kind: "essay" };
}

function hasImage(latex: string | undefined): boolean {
  if (!latex) return false;
  return /\\includegraphics|\\begin\{tabular/.test(latex);
}

function registerImageSourceCandidate(map: Map<string, string>, key: string, url: string) {
  const normalized = key.trim();
  if (!normalized || map.has(normalized)) return;
  map.set(normalized, url);
}

function registerImageSource(map: Map<string, string>, rawSrc: string, absoluteUrl: string) {
  registerImageSourceCandidate(map, rawSrc, absoluteUrl);
  const decoded = decodeURIComponent(rawSrc);
  if (decoded !== rawSrc) registerImageSourceCandidate(map, decoded, absoluteUrl);
  const base = basename(decoded);
  if (base) {
    registerImageSourceCandidate(map, base, absoluteUrl);
    const stem = base.replace(/\.[^.]+$/, "");
    if (stem) registerImageSourceCandidate(map, stem, absoluteUrl);
  }
}

async function buildImageSourceMapFromHtml(htmlUrl: string) {
  const sourceMap = new Map<string, string>();
  const altMap = new Map<string, string>();
  try {
    const res = await fetch(htmlUrl);
    if (!res.ok) return { sourceMap, altMap };
    const html = await res.text();
    const imgRe = /<img\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(html))) {
      const attrs = match[1];
      const srcM = attrs.match(/src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      const altM = attrs.match(/alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i);
      const src = srcM ? String(srcM[1] ?? srcM[2] ?? srcM[3] ?? "").trim() : "";
      const alt = altM ? String(altM[1] ?? altM[2] ?? altM[3] ?? "").trim() : "";
      if (!src || src.startsWith("data:")) continue;
      const absoluteUrl = new URL(src, htmlUrl).href;
      registerImageSource(sourceMap, src, absoluteUrl);
      if (alt) {
        const rawBase = basename(src);
        const rawStem = rawBase.replace(/\.[^.]+$/, "");
        for (const key of [src.trim(), decodeURIComponent(src.trim()), rawBase, rawStem]) {
          if (key && !altMap.has(key)) altMap.set(key, alt);
        }
      }
    }
  } catch {}
  return { sourceMap, altMap };
}

async function buildImageSourceMapFromHtmls(htmlUrls: string[]) {
  const sourceMap = new Map<string, string>();
  const altMap = new Map<string, string>();
  for (const url of htmlUrls) {
    const result = await buildImageSourceMapFromHtml(url);
    for (const [k, v] of result.sourceMap) sourceMap.set(k, v);
    for (const [k, v] of result.altMap) altMap.set(k, v);
  }
  return { sourceMap, altMap };
}

function isLocalPath(s: string): boolean {
  return /^([A-Za-z]:[/\\]|\/)/.test(s);
}

function resolveRemoteImageUrl(name: string, cfg: ImageImportConfig): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (isLocalPath(trimmed)) return trimmed;
  return cfg.sourceMap.get(trimmed) ?? null;
}

function guessUploadFilename(imageUrl: string, fallbackStem: string): string {
  if (isLocalPath(imageUrl)) return basename(imageUrl);
  try {
    const pathname = new URL(imageUrl).pathname;
    const base = basename(decodeURIComponent(pathname));
    if (base) return base;
  } catch {}
  const safeStem = fallbackStem.replace(/[^\w.-]+/g, "_") || "image";
  const ext = extname(safeStem);
  return ext ? safeStem : `${safeStem}.jpg`;
}

function looksLikeFormulaAlt(alt: string): boolean {
  return /^[a-zA-Z0-9\s\+\-\*\/=()\^_{}\\]+$/.test(alt) && (alt.includes("\\") || alt.includes("^") || alt.includes("_"));
}

async function uploadRemoteImage(name: string, imageUrl: string, cfg: ImageImportConfig): Promise<string> {
  const cached = cfg.uploadCache.get(imageUrl);
  if (cached) return cached;
  const filename = guessUploadFilename(imageUrl, name);
  if (cfg.dryRun) {
    const simulatedUrl = `https://dry-run.invalid/${encodeURIComponent(filename)}`;
    cfg.uploadCache.set(imageUrl, simulatedUrl);
    cfg.uploaded.add(name);
    return simulatedUrl;
  }
  let blob: Blob | undefined;
  if (cfg.imagesDir) {
    const localPath = resolve(cfg.imagesDir, filename);
    if (existsSync(localPath)) {
      const buf = readFileSync(localPath);
      const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".gif") ? "image/gif" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
      blob = new Blob([buf], { type: mime });
      console.log(`   📁 imagem do disco: ${localPath}`);
    }
  }
  if (!blob) {
    if (isLocalPath(imageUrl)) {
      if (!existsSync(imageUrl)) throw new Error(`arquivo local não encontrado: ${imageUrl}`);
      const buf = readFileSync(imageUrl);
      const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".gif") ? "image/gif" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
      blob = new Blob([buf], { type: mime });
      console.log(`   📁 imagem do disco: ${imageUrl}`);
    } else {
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) throw new Error(`download ${imageRes.status}`);
      blob = await imageRes.blob();
    }
  }
  const fd = new FormData();
  fd.append("image", blob!, filename);
  const uploadRes = await fetch(cfg.uploadEndpoint, {
    method: "POST",
    headers: { "X-Upload-Token": cfg.uploadToken },
    body: fd,
  });
  const json: any = await uploadRes.json().catch(() => null);
  if (!uploadRes.ok || !json?.success || typeof json?.url !== "string") {
    throw new Error(json?.error ?? `upload ${uploadRes.status}`);
  }
  cfg.uploadCache.set(imageUrl, json.url);
  cfg.uploaded.add(name);
  return json.url;
}

async function materializeTextWithRemoteImages(text: string, cfg: ImageImportConfig): Promise<any[]> {
  const nodes: any[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  IMAGE_PLACEHOLDER_RE.lastIndex = 0;
  while ((match = IMAGE_PLACEHOLDER_RE.exec(text))) {
    const full = match[0];
    const name = String(match[1] ?? "").trim();
    const before = text.slice(lastIdx, match.index);
    if (before) nodes.push({ type: "text", text: before });
    let replaced = false;
    if (name) {
      const alt = cfg.altMap.get(name) ?? "";
      if (alt && looksLikeFormulaAlt(alt)) cfg.possibleFormulaImages.push({ name, alt });
      const remoteUrl = resolveRemoteImageUrl(name, cfg);
      if (remoteUrl) {
        try {
          const uploadedUrl = await uploadRemoteImage(name, remoteUrl, cfg);
          nodes.push({ type: "image", attrs: { id: crypto.randomUUID(), src: uploadedUrl, width: null, align: null } });
          replaced = true;
        } catch (e: any) { cfg.unresolved.add(name); console.warn(`   ⚠ imagem não subiu (${name.slice(0, 60)}): ${e?.message ?? e}`); }
      } else { cfg.unresolved.add(name); }
    }
    if (!replaced) nodes.push({ type: "text", text: full });
    lastIdx = match.index + full.length;
  }
  const after = text.slice(lastIdx);
  if (after) nodes.push({ type: "text", text: after });
  return nodes;
}

async function materializeImagesInNode(node: any, cfg: ImageImportConfig): Promise<any> {
  if (!node || typeof node !== "object") return node;
  if (node.type === "text" && typeof node.text === "string" && node.text.includes("[[IMG_PENDENTE")) {
    const replacement = await materializeTextWithRemoteImages(node.text, cfg);
    if (replacement.length === 1) return replacement[0];
    return replacement;
  }
  if (!Array.isArray(node.content)) return node;
  const nextContent: any[] = [];
  for (const child of node.content) {
    const mapped = await materializeImagesInNode(child, cfg);
    if (Array.isArray(mapped)) nextContent.push(...mapped);
    else nextContent.push(mapped);
  }
  return { ...node, content: nextContent };
}

async function materializeImagesInPayloadContent(content: any, cfg?: ImageImportConfig): Promise<any> {
  if (!cfg) return content;
  return materializeImagesInNode(content, cfg);
}

function countImageNodesInNode(node: any): number {
  if (!node || typeof node !== "object") return 0;
  let count = node.type === "image" ? 1 : 0;
  if (Array.isArray(node.content)) for (const child of node.content) count += countImageNodesInNode(child);
  return count;
}

function countImagePlaceholdersInNode(node: any): number {
  if (!node || typeof node !== "object") return 0;
  let count = 0;
  if (node.type === "text" && typeof node.text === "string") {
    const matches = node.text.match(IMAGE_PLACEHOLDER_RE);
    count += matches ? matches.length : 0;
  }
  if (Array.isArray(node.content)) for (const child of node.content) count += countImagePlaceholdersInNode(child);
  return count;
}

function loadEnvLocal(): Map<string, string> {
  const env = new Map<string, string>();
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return env;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    env.set(key, val);
  }
  return env;
}

function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { args.set(key, next); i++; }
      else args.set(key, true);
    }
  }
  return args;
}

function getRepeatedArgValues(argv: string[], key: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${key}`) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { values.push(next); i++; }
    }
  }
  return values;
}

function findClosingBrace(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function splitBaseFromQuestion(latex: string): { baseLatex: string; questionLatex: string } | null {
  const body = latex.replace(/^\\question\s*/, "");
  let lastCreditsEnd = -1;
  let search = 0;
  while (true) {
    const idx = body.indexOf("\\credits{", search);
    if (idx === -1) break;
    const braceEnd = findClosingBrace(body, idx + "\\credits".length);
    if (braceEnd !== -1) { lastCreditsEnd = braceEnd + 1; search = lastCreditsEnd; }
    else break;
  }
  if (lastCreditsEnd !== -1) return { baseLatex: body.slice(0, lastCreditsEnd).trim(), questionLatex: "\\question " + body.slice(lastCreditsEnd).trim() };
  const poemEnd = body.lastIndexOf("\\end{poem}");
  if (poemEnd !== -1) {
    const after = poemEnd + "\\end{poem}".length;
    return { baseLatex: body.slice(0, after).trim(), questionLatex: "\\question " + body.slice(after).trim() };
  }
  const choicesIdx = body.indexOf("\\begin{choices}");
  if (choicesIdx !== -1) {
    const beforeChoices = body.slice(0, choicesIdx).trimEnd();
    const paraBreak = beforeChoices.lastIndexOf("\n\n");
    if (paraBreak > 0) return { baseLatex: beforeChoices.slice(0, paraBreak).trim(), questionLatex: "\\question " + beforeChoices.slice(paraBreak).trim() + "\n" + body.slice(choicesIdx) };
  }
  return null;
}

function parseToStatementNode(text: string) {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const stmt = questionNode.firstChild;
      if (stmt && stmt.type === schema.nodes.statement) return stmt;
    }
  } catch {}
  return schema.nodes.statement.create(null, [schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : [])]);
}

function parseToItemNodes(text: string): any[] {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const nodes: any[] = [];
      (questionNode.content ?? []).forEach((n: any) => { if (n.type === schema.nodes.statement || n.type === schema.nodes.options) nodes.push(n); });
      if (nodes.length > 0) return nodes;
    }
  } catch {}
  return [schema.nodes.statement.create(null, [schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : [])])];
}

function buildInitial(item: ImportItem, batch: BatchConfig, author?: { id?: string; name?: string }, importBatch?: string, importRunId?: string, baseTextIds?: string[]) {
  const fallbackContent = { type: "doc", content: [{ type: "question", attrs: { tipo: null }, content: [{ type: "statement", content: [{ type: "paragraph", content: [{ type: "text", text: item.latex }] }] }] }] };
  let content: any;
  try {
    const parsed = parseQuestionFromLatexText(item.latex);
    if (parsed) {
      const node = buildQuestionNodeLatex(schema, parsed);
      // Modalidade B-MCQ: prepende nó base_text embutido como filho da question.
      if (item.embeddedBaseLatex) {
        const stmtNode = parseToStatementNode(item.embeddedBaseLatex);
        const baseTextNode = schema.nodes.base_text.create(null, stmtNode.content);
        const newQuestion = schema.nodes.question.create(node.attrs, [baseTextNode, ...(node.content as any)?.content ?? []]);
        content = { type: "doc", content: [newQuestion.toJSON()] };
      } else {
        content = { type: "doc", content: [node.toJSON()] };
      }
    } else content = fallbackContent;
  } catch { content = fallbackContent; }
  const now = new Date().toISOString();
  const m = item.meta;
  let gabarito: any;
  if (item.tipo === "Múltipla Escolha") {
    let parsed2: any = null;
    try { parsed2 = parseQuestionFromLatexText(item.latex); } catch {}
    const rawKey = parsed2 ? extractLatexAnswerKey(parsed2) : null;
    const letter = rawKey?.correct ?? item.gabarito;
    gabarito = letter ? { kind: "mcq" as const, correct: letter as "A" | "B" | "C" | "D" | "E" } : null;
  } else gabarito = m?.resposta?.trim() ? { kind: "essay" as const, rubric: parseRespostaToDoc(m.resposta.trim()) } : null;
  const VALID_DIFIC = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade = (m?.dificuldade && VALID_DIFIC.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())) || batch.dificuldade;
  const source = m?.concurso || m?.banca || m?.ano || m?.fonte ? { kind: (m.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso", concurso: m.concurso || batch.source.concurso, banca: m.banca || batch.source.banca, ano: m.ano || batch.source.ano, cargo: m.cargo || batch.source.cargo, numero: m.numero || undefined, prova: m.prova || undefined } : { ...batch.source };
  const tags = m?.tags?.length ? [...m.tags] : batch.tags.length ? [...batch.tags] : [];
  const metadata = { schemaVersion: 1, id: newId(), createdAt: now, updatedAt: now, tipo: item.tipo, disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina), assunto: normalizeAssunto(m?.assunto || batch.assunto || "") || undefined, dificuldade, gabarito: gabarito ?? normalizeGabaritoForTipo(item.tipo), tags, source, author, ...(baseTextIds?.length ? { baseTextIds, baseTextId: baseTextIds[0] } : {}), ...(importBatch ? { import_batch: importBatch } : {}), ...(importRunId ? { import_run_id: importRunId } : {}) };
  return { metadata, content };
}

function buildInitialSet(item: ImportSetItem, batch: BatchConfig, baseTextIds: string[], author?: { id?: string; name?: string }, importBatch?: string, importRunId?: string, embeddedBaseLatexes?: string[]) {
  const now = new Date().toISOString();
  const m = item.sharedMeta;
  const VALID_DIFIC = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade = (m?.dificuldade && VALID_DIFIC.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())) || batch.dificuldade;
  const source = m?.concurso || m?.banca || m?.ano || m?.fonte ? { kind: (m!.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso", concurso: m!.concurso || batch.source.concurso, banca: m!.banca || batch.source.banca, ano: m!.ano || batch.source.ano, cargo: m!.cargo || batch.source.cargo } : { ...batch.source };
  const questionItemNodes = item.items.map((it) => {
    const answerKey = it.gabarito && it.tipo === "Múltipla Escolha" ? { kind: "mcq", correct: it.gabarito } : it.meta?.resposta?.trim() ? { kind: "essay", rubric: parseRespostaToDoc(it.meta.resposta.trim()) } : { kind: "essay" };
    const itemNodes = parseToItemNodes(it.latex);
    const itemAssunto = normalizeAssunto(it.meta?.assunto ?? "") || null;
    return schema.nodes.question_item.create({ answerKey, assunto: itemAssunto, tags: it.meta?.tags ?? null }, itemNodes);
  });
  const hasChoices = item.items.some(it => it.tipo === "Múltipla Escolha");
  const embeddedBaseNodes = (embeddedBaseLatexes ?? []).map(latex => { const stmtNode = parseToStatementNode(latex); return schema.nodes.base_text.create(null, stmtNode.content); });
  const setNode = schema.nodes.set_questions.create({ mode: hasChoices ? "set" : null }, [...embeddedBaseNodes, ...questionItemNodes]);
  const doc = schema.nodes.doc.create(null, [setNode]);
  const content = doc.toJSON();
  const allItemTags = item.items.flatMap(it => it.meta?.tags ?? []);
  const mergedTags = m?.tags?.length ? [...m.tags] : allItemTags.length ? [...new Set(allItemTags)] : batch.tags.length ? [...batch.tags] : [];
  const metadata = { schemaVersion: 1, id: newId(), createdAt: now, updatedAt: now, tipo: m?.tipo ?? "Discursiva", disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina), dificuldade, assunto: normalizeAssunto(m?.assunto || item.items[0]?.meta?.assunto || batch.assunto || "") || undefined, gabarito: null, tags: mergedTags, source, author, ...(baseTextIds.length ? { baseTextIds, baseTextId: baseTextIds[0] } : {}), ...(importBatch ? { import_batch: importBatch } : {}), ...(importRunId ? { import_run_id: importRunId } : {}) };
  return { metadata, content };
}

function buildBaseTextDoc(baseLatex: string): any {
  const stmtNode = parseToStatementNode(baseLatex);
  const baseTextNode = schema.nodes.base_text.create(null, stmtNode.content);
  return baseTextNode.toJSON();
}

async function postBaseText(payload: any, apiBase: string, token: string) {
  try {
    const res = await fetch(`${apiBase}/create.php`, { method: "POST", headers: { "Content-Type": "application/json", "X-Questions-Token": token }, body: JSON.stringify(payload) });
    const json: any = await res.json();
    if (json.success) return { ok: true, baseTextId: payload.id, tag: json.tag };
    if (json.duplicate) return { ok: true, baseTextId: json.existing_id, tag: json.existing_tag };
    return { ok: false, baseTextId: payload.id, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) { return { ok: false, baseTextId: payload.id, error: e.message }; }
}

async function resolveBaseTextIds(setEntry: ImportSetItem, baseTextCache: Map<string, string>, batch: BatchConfig, apiBaseTexts: string, token: string, dryRun: boolean, author?: { id?: string; name?: string }, imageCfg?: ImageImportConfig) {
  const latexList = setEntry.baseLatexes?.length ? setEntry.baseLatexes : setEntry.baseLatex ? [setEntry.baseLatex] : [];
  if (latexList.length === 0) return { ids: null, error: "sem baseLatex" };
  const m = setEntry.sharedMeta;
  const ids: string[] = [];
  for (const latex of latexList) {
    const cacheKey = latex.trim();
    let id = baseTextCache.get(cacheKey);
    if (!id) {
      id = newId();
      if (!dryRun) {
        const baseTextContent = await materializeImagesInPayloadContent(buildBaseTextDoc(latex), imageCfg);
        const btResult = await postBaseText({ id, content: baseTextContent, autor: m?.autor_texto, titulo: m?.titulo_texto, ano_pub: m?.ano_publicacao, disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina), tema: m?.tema, genero: m?.genero, movimento: m?.movimento, tags: m?.tags, source: m?.concurso || m?.banca || m?.ano ? { concurso: m?.concurso, banca: m?.banca, ano: m?.ano, prova: m?.prova } : undefined, author }, apiBaseTexts, token);
        if (!btResult.ok) return { ids: null, error: `base_text error: ${btResult.error}` };
        id = btResult.baseTextId;
      }
      baseTextCache.set(cacheKey, id!);
    }
    ids.push(id!);
  }
  return { ids };
}

async function postQuestion(payload: any, apiBase: string, token: string) {
  const id = payload.metadata.id as string;
  try {
    const res = await fetch(`${apiBase}/create.php`, { method: "POST", headers: { "Content-Type": "application/json", "X-Questions-Token": token }, body: JSON.stringify(payload) });
    const json: any = await res.json();
    if (json.success) return { ok: true, id };
    if (json.duplicate) return { ok: false, id, duplicate: { existingId: json.existing_id, similarity: json.similarity } };
    return { ok: false, id, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) { return { ok: false, id, error: e.message }; }
}

async function proposeQuestion(existingId: string, payload: any, apiBase: string, token: string) {
  try {
    const res = await fetch(`${apiBase}/propose.php`, { method: "POST", headers: { "Content-Type": "application/json", "X-Questions-Token": token }, body: JSON.stringify({ questionId: existingId, ...payload }) });
    const json: any = await res.json();
    if (json.success) return { ok: true };
    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function postImportReport(report: ImportReport, apiBase: string, token: string): Promise<void> {
  const res = await fetch(`${apiBase}/import-reports.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Questions-Token": token },
    body: JSON.stringify(report),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
}

async function assertImportReportAbsent(runId: string, apiBase: string, token: string): Promise<void> {
  const res = await fetch(`${apiBase}/import-reports.php?run_id=${encodeURIComponent(runId)}`, {
    headers: { "X-Questions-Token": token },
  });
  if (res.status === 404) return;
  if (res.ok) throw new Error(`já existe relatório externo para run_id ${runId}; use um run_id novo para não sobrescrevê-lo`);
  const json: any = await res.json().catch(() => ({}));
  throw new Error(`não foi possível verificar o relatório externo: ${json.error ?? `HTTP ${res.status}`}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const dryRun = args.get("dry-run") === true;
  const skipImages = args.get("sem-imagens") === true;
  const onlyImages = args.get("so-imagens") === true;
  const forcePropose = args.get("propose-duplicates") === true;
  const reviewReportPath = args.get("review-report") as string | undefined;
  const envLocal = loadEnvLocal();
  const token = (args.get("token") as string) || process.env.NEXT_PUBLIC_QUESTIONS_TOKEN || envLocal.get("NEXT_PUBLIC_QUESTIONS_TOKEN") || "";
  const apiBase = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE || envLocal.get("NEXT_PUBLIC_QUESTIONS_API_BASE") || "https://mpfaraujo.com.br/guardafiguras/api/questoes";
  const apiBaseTexts = apiBase.replace(/\/questoes\/?$/, "/base_texts");
  const uploadEndpoint = (args.get("upload-endpoint") as string) || DEFAULT_UPLOAD_ENDPOINT;
  const uploadToken = (args.get("upload-token") as string) || DEFAULT_UPLOAD_TOKEN;
  const htmlUrlsRaw = getRepeatedArgValues(argv, "html-url");
  const htmlUrlsB64 = getRepeatedArgValues(argv, "html-url-b64").map(value => Buffer.from(value, "base64").toString("utf-8"));
  const htmlUrls = [...htmlUrlsRaw, ...htmlUrlsB64];
  if (htmlUrls.length === 0) {
    const htmlUrlB64 = (args.get("html-url-b64") as string | undefined) || undefined;
    const htmlUrl = htmlUrlB64 ? Buffer.from(htmlUrlB64, "base64").toString("utf-8") : (args.get("html-url") as string | undefined) || undefined;
    if (htmlUrl) htmlUrls.push(htmlUrl);
  }
  if (!token && !dryRun) { console.error("❌ Token não encontrado."); process.exit(1); }
  const { sourceMap, altMap } = htmlUrls.length > 0 ? await buildImageSourceMapFromHtmls(htmlUrls) : { sourceMap: new Map<string, string>(), altMap: new Map<string, string>() };
  const imagesDirRaw = args.get("images-dir") as string | undefined;
  const imagesDir = imagesDirRaw ? resolve(imagesDirRaw) : undefined;
  const imageCfg: ImageImportConfig = { htmlUrls, uploadEndpoint, uploadToken, sourceMap, altMap, uploadCache: new Map<string, string>(), unresolved: new Set<string>(), uploaded: new Set<string>(), possibleFormulaImages: [], imagesDir, dryRun };
  const dificRaw = (args.get("dific") as string) ?? "Média";
  const batch: BatchConfig = { assunto: (args.get("assunto") as string) ?? "", dificuldade: "Média", disciplina: (args.get("disciplina") as string) ?? "Matemática", tags: [], source: { kind: args.has("concurso") ? "concurso" : "original", concurso: args.get("concurso") as string | undefined, banca: args.get("banca") as string | undefined, ano: args.has("ano") ? Number(args.get("ano")) : undefined } };
  const author = args.has("autor-id") || args.has("autor-nome") ? { id: args.get("autor-id") as string | undefined, name: args.get("autor-nome") as string | undefined } : undefined;
  const importBatch = (args.get("batch") as string | undefined) || undefined;
  const importRunId = (args.get("run-id") as string | undefined) || crypto.randomUUID();
  const dataDir = resolve(process.cwd(), "public/data");
  let queuePath: string;
  const queueArg = args.get("queue") as string | undefined;
  if (queueArg) queuePath = resolve(process.cwd(), queueArg);
  else if (importBatch) {
    const slug = toBatchSlug(importBatch);
    const batchPath = resolve(dataDir, `import-queue-${slug}.json`);
    queuePath = existsSync(batchPath) ? batchPath : resolve(dataDir, "import-queue.json");
  } else queuePath = resolve(dataDir, "import-queue.json");
  if (!existsSync(queuePath)) { console.error(`❌ Fila não encontrada: ${queuePath}`); process.exit(1); }
  const queue: QueueEntry[] = JSON.parse(readFileSync(queuePath, "utf-8"));
  const reviewHintsByQueueIndex = reviewReportPath
    ? associateReviewHints(
        queue,
        parseTranscriptionReviewReport(JSON.parse(readFileSync(resolve(process.cwd(), reviewReportPath), "utf-8")))
      )
    : new Map<number, TranscriptionReviewHint>();
  if (reviewReportPath) {
    console.log(`   🔎 Review report: ${reviewHintsByQueueIndex.size} hints, ${reviewHintsByQueueIndex.size} associados, 0 ambíguos, 0 ausentes`);
  }
  const originalIndexByEntry = new Map<QueueEntry, number>(queue.map((entry, index) => [entry, index]));
  const entryHasImage = (entry: QueueEntry) => {
    if ("isSet" in entry && entry.isSet) {
      const s = entry as ImportSetItem;
      const bases = s.baseLatexes?.length ? s.baseLatexes : s.baseLatex ? [s.baseLatex] : [];
      return bases.some(hasImage) || s.items.some(it => hasImage(it.latex));
    }
    return hasImage((entry as ImportItem).latex);
  };
  const filtered = onlyImages ? queue.filter(entryHasImage) : skipImages ? queue.filter(entry => !entryHasImage(entry)) : queue;
  const skipped = queue.length - filtered.length;
  if (reviewReportPath) {
    const indicesProcessados = new Set(filtered.map((entry) => originalIndexByEntry.get(entry)!));
    const hintsIgnorados = [...reviewHintsByQueueIndex.keys()].filter((index) => !indicesProcessados.has(index));
    if (hintsIgnorados.length > 0) {
      throw new Error(`review report: ${hintsIgnorados.length} questão(ões) com sinal seriam ignoradas pelos filtros --so-imagens/--sem-imagens`);
    }
    if (!dryRun) await assertImportReportAbsent(importRunId, apiBase, token);
  }
  console.log(`\n📋 Fila: ${queue.length} entradas`);
  console.log(`   ✉  ${filtered.length} para importar\n`);
  let ok = 0, fail = 0, dups = 0;
  const errors: any[] = [], dupList: any[] = [], baseTextCache = new Map<string, string>();
  const importedReviewHints: ImportedReviewHint[] = [];
  const unresolvedReviewHints: Array<TranscriptionReviewHint & { queueIndex: number; outcome: "duplicate" | "error" }> = [];
  // Cache secundário: titulo_texto → base text ID (para questões que compartilham
  // o mesmo título mas só a primeira contém o texto no corpo)
  const baseTextTitleCache = new Map<string, string>();

  // Pré-passo: processa entradas \basetext antes das questões
  for (const entry of filtered) {
    if (!("isBaseText" in entry && (entry as ImportBaseTextItem).isBaseText)) continue;
    const bt = entry as ImportBaseTextItem;
    const titulo = bt.meta?.titulo_texto;
    if (!titulo) { console.log(`  ⚠ \basetext sem titulo_texto — ignorado`); continue; }
    if (baseTextTitleCache.has(titulo)) continue; // já processado
    if (!dryRun) {
      const btResolved = await resolveBaseTextIds(
        { isSet: true, baseLatexes: [bt.latex], items: [], sharedMeta: bt.meta },
        baseTextCache, batch, apiBaseTexts, token, dryRun, author, imageCfg
      );
      if (!btResolved.ids) { console.log(`  ✘ basetext "${titulo}": ${btResolved.error}`); continue; }
      baseTextTitleCache.set(titulo, btResolved.ids[0]);
      console.log(`  📄 texto-base "${titulo}" → ${btResolved.ids[0].slice(0, 8)}...`);
    } else {
      baseTextTitleCache.set(titulo, crypto.randomUUID());
    }
  }

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const queueIndex = originalIndexByEntry.get(entry)!;
    const reviewHint = reviewHintsByQueueIndex.get(queueIndex);
    if ("isBaseText" in entry && (entry as ImportBaseTextItem).isBaseText) continue; // já processado no pré-passo
    const isSet = "isSet" in entry && (entry as ImportSetItem).isSet;
    const label = isSet ? `[SET]` : `[${(entry as ImportItem).tipo === "Múltipla Escolha" ? "MCQ" : "DIS"}]`;
    let payload: any;
    const registrarErroDaEntrada = (error: string, id = "") => {
      fail++;
      errors.push({ idx: queueIndex, id, error, ...(reviewHint ? { reviewHint: { ...reviewHint, queueIndex } } : {}) });
      if (reviewHint) unresolvedReviewHints.push({ ...reviewHint, queueIndex, outcome: "error" });
    };
    try {
      if (isSet) {
        const setEntry = entry as ImportSetItem;
        if (setEntry.sharedMeta?.titulo_texto) {
          // \basetext pre-pass já criou o registro — usar ID do cache diretamente
          const setCachedId = baseTextTitleCache.get(setEntry.sharedMeta.titulo_texto);
          if (setCachedId) {
            payload = buildInitialSet(setEntry, batch, [setCachedId], author, importBatch, importRunId);
          } else {
            const btResolved = await resolveBaseTextIds(setEntry, baseTextCache, batch, apiBaseTexts, token, dryRun, author, imageCfg);
            if (!btResolved.ids) { registrarErroDaEntrada(btResolved.error ?? "falha ao resolver texto base"); console.log(`  ✘ ${i + 1} ${btResolved.error}`); continue; }
            if (setEntry.sharedMeta.titulo_texto && btResolved.ids[0]) baseTextTitleCache.set(setEntry.sharedMeta.titulo_texto, btResolved.ids[0]);
            payload = buildInitialSet(setEntry, batch, btResolved.ids, author, importBatch, importRunId);
          }
        } else {
          const latexList = setEntry.baseLatexes?.length ? setEntry.baseLatexes : setEntry.baseLatex ? [setEntry.baseLatex] : [];
          payload = buildInitialSet(setEntry, batch, [], author, importBatch, importRunId, latexList);
        }
      } else {
        const singleItem = entry as ImportItem;
        if (singleItem.meta?.titulo_texto) {
          // Caso 0: \basetext pre-pass já criou o registro — usar ID do cache, sem heurística
          const cachedId = baseTextTitleCache.get(singleItem.meta.titulo_texto);
          if (cachedId) {
            payload = buildInitial(singleItem, batch, author, importBatch, importRunId, [cachedId]);
          } else {
            // Caso 1: basetext: explícito no YAML ou heurística legada (texto base no corpo da Q1)
            const explicitBase = singleItem.meta.basetext;
            const baseLatexToUse = explicitBase ?? (() => { const s = splitBaseFromQuestion(singleItem.latex); return s?.baseLatex ?? null; })();
            const questionLatexToUse = explicitBase ? singleItem.latex : (() => { const s = splitBaseFromQuestion(singleItem.latex); return s?.questionLatex ?? singleItem.latex; })();

            if (baseLatexToUse) {
              const btResolved = await resolveBaseTextIds({ isSet: true, baseLatexes: [baseLatexToUse], items: [], sharedMeta: singleItem.meta }, baseTextCache, batch, apiBaseTexts, token, dryRun, author, imageCfg);
              if (!btResolved.ids) { registrarErroDaEntrada(btResolved.error ?? "falha ao resolver texto base"); console.log(`  ✘ ${i + 1} ${btResolved.error}`); continue; }
              baseTextTitleCache.set(singleItem.meta.titulo_texto, btResolved.ids[0]);
              payload = buildInitial({ ...singleItem, latex: questionLatexToUse }, batch, author, importBatch, importRunId, btResolved.ids);
            } else {
              // Caso 2: Q2/Q3 do formato legado — o ID foi criado pelo processamento da Q1
              const legacyCachedId = baseTextTitleCache.get(singleItem.meta.titulo_texto);
              payload = buildInitial(singleItem, batch, author, importBatch, importRunId, legacyCachedId ? [legacyCachedId] : undefined);
            }
          }
        } else payload = buildInitial(singleItem, batch, author, importBatch, importRunId);
      }
      payload.content = await materializeImagesInPayloadContent(payload.content, imageCfg);
    } catch (e: any) {
      registrarErroDaEntrada(`build error: ${e.message}`);
      console.log(`  ✘ ${i + 1} build error: ${e.message}`);
      continue;
    }
    if (dryRun) { ok++; continue; }
    const result = await postQuestion(payload, apiBase, token);
    if (result.ok) {
      ok++;
      if (reviewHint) importedReviewHints.push({ ...reviewHint, questionId: result.id, queueIndex });
      console.log(`  ✓ ${i + 1}/${filtered.length} ${label} ${result.id.slice(0, 8)}...`);
    }
    else if (result.duplicate) {
        if (forcePropose) {
            const propResult = await proposeQuestion(result.duplicate.existingId, payload, apiBase, token);
            if (propResult.ok) {
              ok++;
              if (reviewHint) unresolvedReviewHints.push({ ...reviewHint, queueIndex, outcome: "duplicate" });
              console.log(`  ✓ ${i + 1} variante proposta`);
            }
            else { registrarErroDaEntrada(propResult.error ?? "propose falhou", result.id); console.log(`  ✘ ${i + 1} propose falhou`); }
        } else {
          dups++;
          dupList.push({ idx: queueIndex, existingId: result.duplicate.existingId, similarity: result.duplicate.similarity, label, preview: JSON.stringify(payload.content).slice(0, 180), payload, ...(reviewHint ? { reviewHint: { ...reviewHint, queueIndex } } : {}) });
          if (reviewHint) unresolvedReviewHints.push({ ...reviewHint, queueIndex, outcome: "duplicate" });
          console.log(`  ⚠ ${i + 1} DUPLICATA`);
        }
    } else {
      registrarErroDaEntrada(result.error ?? "falha desconhecida", result.id);
      console.log(`  ✘ ${i + 1} ${result.error}`);
    }
  }
  console.log(`\n─── Resultado ───\n  ✓ ${ok} importadas\n  🖼  ${imageCfg.uploaded.size} imagens materializadas\n  ⚠  ${imageCfg.unresolved.size} pendentes\n`);
  console.log(`   run_id: ${importRunId}`);
  if (reviewReportPath && !dryRun) {
    const report: ImportReport = {
      batch: importBatch,
      runId: importRunId,
      queuePath,
      createdAt: new Date().toISOString(),
      dryRun,
      summary: { imported: ok, duplicates: dups, failed: fail, skipped, totalQueue: queue.length, processed: filtered.length },
      duplicates: dupList,
      errors,
      reviewHints: importedReviewHints,
      unresolvedReviewHints,
    };
    try {
      await postImportReport(report, apiBase, token);
      console.log(`   relatório externo salvo para run_id ${importRunId}`);
    } catch (error: any) {
      throw new Error(`questões importadas, mas falhou ao salvar relatório externo do run ${importRunId}: ${error.message}`);
    }
  }
}
function toBatchSlug(l: string): string { return l.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

main().catch(e => { console.error("Erro fatal:", e); process.exit(1); });
