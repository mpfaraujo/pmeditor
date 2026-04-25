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
 *
 * Opções:
 *   --dry-run            Simula sem enviar nada ao banco
 *   --token    <TOKEN>   Token da API (padrão: lê .env.local)
 *   --assunto  <str>     Assunto padrão do lote
 *   --dific    <str>     Dificuldade padrão: Fácil | Média | Difícil (padrão: Média)
 *   --concurso <str>     Nome do concurso (ex: ENEM)
 *   --banca    <str>     Banca (ex: INEP)
 *   --ano      <num>     Ano
 *   --disciplina <str>   Disciplina padrão (padrão: Matemática)
 *   --autor-id   <str>   Google ID do autor
 *   --autor-nome <str>   Nome do autor
 *   --sem-imagens        Pula questões com \includegraphics (padrão: inclui)
 *   --propose-duplicates Quando uma questão é detectada como duplicata, envia propose.php com
 *                        o novo payload em vez de pular — cria uma variante pendente (não
 *                        sobrescreve a original). Útil para submeter correção de metadados
 *                        de questões já importadas (ex: assunto1:/tags1:/resposta1:).
 *   --so-imagens         Importa APENAS questões com \includegraphics
 *   --batch    <str>     Label humano do lote (ex: "PUC-Rio 2017 G1") — salvo em metadata.import_batch
 *                        Também resolve automaticamente o arquivo de fila: import-queue-<slug>.json
 *   --run-id   <str>     ID técnico único da rodada (auto-gerado se omitido) — salvo em metadata.import_run_id
 *   --queue    <file>    Caminho do arquivo de fila (padrão: public/data/import-queue.json)
 *                        Aceita caminho absoluto ou relativo à raiz do projeto
 *   --html-url <url>     URL da página HTML de origem; pode ser repetida para lotes com múltiplas páginas
 *   --html-url-b64 <b64> URL da página HTML de origem em Base64 (alternativa segura para PowerShell);
 *                        também pode ser repetida
 *   --upload-endpoint <url> Endpoint de upload de imagens (padrão: upload.php do projeto)
 *   --upload-token <str> Token do upload de imagens
 *   --images-dir <dir>  Diretório com imagens salvas localmente (ex: ~/Desktop/imgs).
 *                        O script procura pelo nome do arquivo igual ao da URL antes de tentar baixar.
 *                        Útil quando o servidor de origem bloqueia downloads automáticos.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { basename, extname, resolve } from "path";

/** Converte label em slug de arquivo (mesma lógica do parse-tex.ts) */
function toBatchSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Imports do projeto (funciona em Node pois não há deps de browser) ────────
import { schema } from "../src/components/editor/schema";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
  extractLatexAnswerKey,
} from "../src/components/editor/plugins/smartPastePlugin";
import { normalizeDisciplina, normalizeAssunto } from "../src/data/assuntos";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  // Metadados do texto base
  autor_texto?: string;
  titulo_texto?: string;
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
};

type ImportSetItem = {
  isSet: true;
  /** Texto base único (legado). Use baseLatexes para múltiplos textos base. */
  baseLatex?: string;
  /** Múltiplos textos base separados — cada um vira uma entrada independente no banco. */
  baseLatexes?: string[];
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito" | "resposta" | "numero">;
  }>;
  sharedMeta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem;

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID();
}

function makeTextDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

/** Parseia texto com LaTeX (ex: respostas discursivas) em doc ProseMirror com math_inline */
function parseRespostaToDoc(text: string): any {
  try {
    const stmtNode = parseToStatementNode(text);
    const doc = schema.nodes.doc.create(null, stmtNode.content);
    return doc.toJSON();
  } catch {
    return makeTextDoc(text);
  }
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

// ─── Suporte a imagens remotas ────────────────────────────────────────────────

const DEFAULT_UPLOAD_ENDPOINT = "https://mpfaraujo.com.br/guardafiguras/api/upload.php";
const DEFAULT_UPLOAD_TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";
const IMAGE_PLACEHOLDER_RE = /\[\[IMG_PENDENTE(?::\s*([^\]]+))?\]\]/g;

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
};

function registerImageSourceCandidate(map: Map<string, string>, key: string, url: string) {
  const normalized = key.trim();
  if (!normalized || map.has(normalized)) return;
  map.set(normalized, url);
}

function registerImageSource(map: Map<string, string>, rawSrc: string, absoluteUrl: string) {
  registerImageSourceCandidate(map, rawSrc, absoluteUrl);
  const decoded = decodeURIComponent(rawSrc);
  registerImageSourceCandidate(map, decoded, absoluteUrl);

  const rawBase = basename(rawSrc);
  const decodedBase = basename(decoded);
  registerImageSourceCandidate(map, rawBase, absoluteUrl);
  registerImageSourceCandidate(map, decodedBase, absoluteUrl);

  const rawStem = rawBase.replace(/\.[^.]+$/, "");
  const decodedStem = decodedBase.replace(/\.[^.]+$/, "");
  registerImageSourceCandidate(map, rawStem, absoluteUrl);
  registerImageSourceCandidate(map, decodedStem, absoluteUrl);
}

function looksLikeFormulaAlt(alt: string): boolean {
  if (!alt || alt.length > 200) return false;
  // Comandos LaTeX típicos de fórmulas
  if (/\\(frac|sqrt|sum|int|lim|infty|alpha|beta|gamma|delta|theta|pi|sigma|mu|lambda|cdot|times|div|pm|leq|geq|neq|partial|nabla)\b/.test(alt)) return true;
  // Delimitadores de math
  if (/\$[^$]+\$/.test(alt) || /\\\(.*\\\)/.test(alt)) return true;
  // Expoente/subscrito numérico junto de variável
  if (/[a-zA-Z]\^[\d{]/.test(alt) || /[a-zA-Z]_[\d{]/.test(alt)) return true;
  // Símbolos matemáticos unicode
  if (/[²³⁴⁵⁶⁷⁸⁹₀₁₂₃∑∫∏√∞±≤≥≠∈∉⊂⊃∩∪·×÷]/.test(alt)) return true;
  return false;
}

async function buildImageSourceMapFromHtml(
  htmlUrl?: string
): Promise<{ sourceMap: Map<string, string>; altMap: Map<string, string> }> {
  const sourceMap = new Map<string, string>();
  const altMap = new Map<string, string>();
  if (!htmlUrl) return { sourceMap, altMap };

  const res = await fetch(htmlUrl);
  if (!res.ok) throw new Error(`Falha ao carregar HTML (${res.status})`);
  const html = await res.text();

  const imgRe = /<img([^>]+)>/gi;
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

  return { sourceMap, altMap };
}

async function buildImageSourceMapFromHtmls(
  htmlUrls: string[]
): Promise<{ sourceMap: Map<string, string>; altMap: Map<string, string> }> {
  const sourceMap = new Map<string, string>();
  const altMap = new Map<string, string>();
  for (const htmlUrl of htmlUrls) {
    const result = await buildImageSourceMapFromHtml(htmlUrl);
    for (const [key, value] of result.sourceMap.entries()) {
      if (!sourceMap.has(key)) sourceMap.set(key, value);
    }
    for (const [key, value] of result.altMap.entries()) {
      if (!altMap.has(key)) altMap.set(key, value);
    }
  }
  return { sourceMap, altMap };
}

function resolveRemoteImageUrl(name: string, cfg: ImageImportConfig): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return cfg.sourceMap.get(trimmed) ?? null;
}

function guessUploadFilename(imageUrl: string, fallbackStem: string): string {
  try {
    const pathname = new URL(imageUrl).pathname;
    const base = basename(decodeURIComponent(pathname));
    if (base) return base;
  } catch {}
  const safeStem = fallbackStem.replace(/[^\w.-]+/g, "_") || "image";
  const ext = extname(safeStem);
  return ext ? safeStem : `${safeStem}.jpg`;
}

async function uploadRemoteImage(
  name: string,
  imageUrl: string,
  cfg: ImageImportConfig
): Promise<string> {
  const cached = cfg.uploadCache.get(imageUrl);
  if (cached) return cached;

  const filename = guessUploadFilename(imageUrl, name);

  // Tenta carregar do disco local antes de baixar da internet
  let blob: Blob | undefined;
  if (cfg.imagesDir) {
    const localPath = resolve(cfg.imagesDir, filename);
    if (existsSync(localPath)) {
      const buf = readFileSync(localPath);
      const mime = filename.endsWith(".png") ? "image/png"
        : filename.endsWith(".gif") ? "image/gif"
        : filename.endsWith(".webp") ? "image/webp"
        : "image/jpeg";
      blob = new Blob([buf], { type: mime });
      console.log(`   📁 imagem do disco: ${localPath}`);
    }
  }

  if (!blob) {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`download ${imageRes.status}`);
    blob = await imageRes.blob();
  }

  const fd = new FormData();
  fd.append("image", blob, filename);

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

async function materializeTextWithRemoteImages(
  text: string,
  cfg: ImageImportConfig
): Promise<any[]> {
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
      // Checa alt text para detectar fórmulas renderizadas como imagem
      const alt = cfg.altMap.get(name) ?? "";
      if (alt && looksLikeFormulaAlt(alt)) {
        cfg.possibleFormulaImages.push({ name, alt });
      }

      const remoteUrl = resolveRemoteImageUrl(name, cfg);
      if (remoteUrl) {
        try {
          const uploadedUrl = await uploadRemoteImage(name, remoteUrl, cfg);
          nodes.push({
            type: "image",
            attrs: {
              id: crypto.randomUUID(),
              src: uploadedUrl,
              width: null,
              align: null,
            },
          });
          replaced = true;
        } catch {
          cfg.unresolved.add(name);
        }
      } else {
        cfg.unresolved.add(name);
      }
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
  if (Array.isArray(node.content)) {
    for (const child of node.content) count += countImageNodesInNode(child);
  }
  return count;
}

function countImagePlaceholdersInNode(node: any): number {
  if (!node || typeof node !== "object") return 0;
  let count = 0;
  if (node.type === "text" && typeof node.text === "string") {
    const matches = node.text.match(IMAGE_PLACEHOLDER_RE);
    count += matches ? matches.length : 0;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) count += countImagePlaceholdersInNode(child);
  }
  return count;
}

// ─── Utilitários de CLI ───────────────────────────────────────────────────────

/** Lê .env.local e retorna um map de variáveis */
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

/** Parseia args de linha de comando simples: --key value ou --flag */
function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, true);
      }
    }
  }
  return args;
}

function getRepeatedArgValues(argv: string[], key: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== `--${key}`) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      values.push(next);
      i++;
    }
  }
  return values;
}

// ─── Separa texto base do enunciado em \question individual com titulo_texto ──

function findClosingBrace(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Dado o latex completo de um \question individual que tem titulo_texto,
 * separa o texto base (tudo até e incluindo \credits{}) do enunciado específico.
 * Retorna null se não conseguir identificar o ponto de corte.
 */
function splitBaseFromQuestion(
  latex: string
): { baseLatex: string; questionLatex: string } | null {
  const body = latex.replace(/^\\question\s*/, "");

  // Prioridade 1: \credits{...} — marcador mais confiável de fim de texto base
  let lastCreditsEnd = -1;
  let search = 0;
  while (true) {
    const idx = body.indexOf("\\credits{", search);
    if (idx === -1) break;
    const braceEnd = findClosingBrace(body, idx + "\\credits".length);
    if (braceEnd !== -1) { lastCreditsEnd = braceEnd + 1; search = lastCreditsEnd; }
    else break;
  }
  if (lastCreditsEnd !== -1) {
    return {
      baseLatex: body.slice(0, lastCreditsEnd).trim(),
      questionLatex: "\\question " + body.slice(lastCreditsEnd).trim(),
    };
  }

  // Prioridade 2: \end{poem} sem \credits
  const poemEnd = body.lastIndexOf("\\end{poem}");
  if (poemEnd !== -1) {
    const after = poemEnd + "\\end{poem}".length;
    return {
      baseLatex: body.slice(0, after).trim(),
      questionLatex: "\\question " + body.slice(after).trim(),
    };
  }

  // Prioridade 3: último parágrafo antes de \begin{choices}
  const choicesIdx = body.indexOf("\\begin{choices}");
  if (choicesIdx !== -1) {
    const beforeChoices = body.slice(0, choicesIdx);
    const paraBreak = beforeChoices.lastIndexOf("\n\n");
    if (paraBreak > 0) {
      const baseLatex = beforeChoices.slice(0, paraBreak).trim();
      if (baseLatex) {
        return {
          baseLatex,
          questionLatex:
            "\\question " +
            beforeChoices.slice(paraBreak).trim() +
            "\n" +
            body.slice(choicesIdx),
        };
      }
    }
  }

  return null;
}

// ─── Builders ────────────────────────────────────────────────────────────────

function parseToStatementNode(text: string) {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const stmt = questionNode.firstChild;
      if (stmt && stmt.type === schema.nodes.statement) return stmt;
    }
  } catch {}
  return schema.nodes.statement.create(null, [
    schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : []),
  ]);
}

/** Retorna [statement, options?] para um item de conjunto — preserva as alternativas MCQ */
function parseToItemNodes(text: string): any[] {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const nodes: any[] = [];
      (questionNode.content ?? []).forEach((n: any) => {
        if (n.type === schema.nodes.statement || n.type === schema.nodes.options) nodes.push(n);
      });
      if (nodes.length > 0) return nodes;
    }
  } catch {}
  return [schema.nodes.statement.create(null, [
    schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : []),
  ])];
}

function buildInitial(
  item: ImportItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string },
  importBatch?: string,
  importRunId?: string,
  baseTextIds?: string[]
) {
  const fallbackContent = {
    type: "doc",
    content: [
      {
        type: "question",
        attrs: { tipo: null },
        content: [
          {
            type: "statement",
            content: [
              { type: "paragraph", content: [{ type: "text", text: item.latex }] },
            ],
          },
        ],
      },
    ],
  };

  let content: any;
  try {
    const parsed = parseQuestionFromLatexText(item.latex);
    if (parsed) {
      const node = buildQuestionNodeLatex(schema, parsed);
      content = { type: "doc", content: [node.toJSON()] };
    } else {
      content = fallbackContent;
    }
  } catch {
    content = fallbackContent;
  }

  const now = new Date().toISOString();
  const m = item.meta;

  let gabarito: any;
  if (item.tipo === "Múltipla Escolha") {
    let parsed2: any = null;
    try { parsed2 = parseQuestionFromLatexText(item.latex); } catch {}
    const rawKey = parsed2 ? extractLatexAnswerKey(parsed2) : null;
    const letter = rawKey?.correct ?? item.gabarito;
    gabarito = letter
      ? { kind: "mcq" as const, correct: letter as "A" | "B" | "C" | "D" | "E" }
      : null;
  } else {
    gabarito = m?.resposta?.trim()
      ? { kind: "essay" as const, rubric: parseRespostaToDoc(m.resposta.trim()) }
      : null;
  }

  const VALID_DIFIC = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade =
    (m?.dificuldade && VALID_DIFIC.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())) ||
    batch.dificuldade;

  const source =
    m?.concurso || m?.banca || m?.ano || m?.fonte
      ? {
          kind: (m.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso",
          concurso: m.concurso || batch.source.concurso,
          banca: m.banca || batch.source.banca,
          ano: m.ano || batch.source.ano,
          cargo: m.cargo || batch.source.cargo,
          numero: m.numero || undefined,
          prova: m.prova || undefined,
        }
      : { ...batch.source };

  const tags = m?.tags?.length ? [...m.tags] : batch.tags.length ? [...batch.tags] : [];

  const metadata = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: item.tipo,
    disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina),
    assunto: normalizeAssunto(m?.assunto || batch.assunto || "") || undefined,
    dificuldade,
    gabarito: gabarito ?? normalizeGabaritoForTipo(item.tipo),
    tags,
    source,
    author,
    ...(baseTextIds?.length ? { baseTextIds, baseTextId: baseTextIds[0] } : {}),
    ...(importBatch  ? { import_batch:  importBatch  } : {}),
    ...(importRunId  ? { import_run_id: importRunId  } : {}),
  };

  return { metadata, content };
}

/**
 * Monta um set_questions para importação.
 *
 * Dois modos:
 * - baseTextIds não-vazio → texto base no banco externo (banco de textos base).
 *   O set_questions não embute base_text; o render injeta pelo baseTextId.
 * - baseTextIds vazio + embeddedBaseLatexes → texto base curto (cenário, dados)
 *   embutido diretamente como base_text node dentro do set_questions.
 *   Não cria entrada no banco de textos.
 */
function buildInitialSet(
  item: ImportSetItem,
  batch: BatchConfig,
  baseTextIds: string[],
  author?: { id?: string; name?: string },
  importBatch?: string,
  importRunId?: string,
  embeddedBaseLatexes?: string[]
) {
  const now = new Date().toISOString();
  const m = item.sharedMeta;

  const VALID_DIFIC = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade =
    (m?.dificuldade && VALID_DIFIC.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())) ||
    batch.dificuldade;

  const source =
    m?.concurso || m?.banca || m?.ano || m?.fonte
      ? {
          kind: (m!.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso",
          concurso: m!.concurso || batch.source.concurso,
          banca: m!.banca || batch.source.banca,
          ano: m!.ano || batch.source.ano,
          cargo: m!.cargo || batch.source.cargo,
        }
      : { ...batch.source };

  const questionItemNodes = item.items.map((it) => {
    const answerKey =
      it.gabarito && it.tipo === "Múltipla Escolha"
        ? { kind: "mcq", correct: it.gabarito }
        : it.meta?.resposta?.trim()
        ? { kind: "essay", rubric: parseRespostaToDoc(it.meta.resposta.trim()) }
        : { kind: "essay" };

    const itemNodes = parseToItemNodes(it.latex);
    const itemAssunto = normalizeAssunto(it.meta?.assunto ?? "") || null;
    return schema.nodes.question_item.create(
      { answerKey, assunto: itemAssunto, tags: it.meta?.tags ?? null },
      itemNodes
    );
  });

  const hasChoices = item.items.some(it => it.tipo === "Múltipla Escolha");

  // Monta o set_questions com base_text embutido (modo inline) ou sem (modo banco externo)
  const embeddedBaseNodes = (embeddedBaseLatexes ?? []).map(latex => {
    const stmtNode = parseToStatementNode(latex);
    return schema.nodes.base_text.create(null, stmtNode.content);
  });

  const setNode = schema.nodes.set_questions.create(
    { mode: hasChoices ? "set" : null },
    [...embeddedBaseNodes, ...questionItemNodes]
  );
  const doc = schema.nodes.doc.create(null, [setNode]);
  const content = doc.toJSON();

  const allItemTags = item.items.flatMap(it => it.meta?.tags ?? []);
  const mergedTags = m?.tags?.length
    ? [...m.tags]
    : allItemTags.length
    ? [...new Set(allItemTags)]
    : batch.tags.length
    ? [...batch.tags]
    : [];

  const metadata = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: m?.tipo ?? "Discursiva",
    disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina),
    dificuldade,
    assunto: normalizeAssunto(m?.assunto || item.items[0]?.meta?.assunto || batch.assunto || "") || undefined,
    gabarito: null,
    tags: mergedTags,
    source,
    author,
    ...(baseTextIds.length ? { baseTextIds, baseTextId: baseTextIds[0] } : {}),
    ...(importBatch  ? { import_batch:  importBatch  } : {}),
    ...(importRunId  ? { import_run_id: importRunId  } : {}),
  };

  return { metadata, content };
}

// ─── Banco de textos base ────────────────────────────────────────────────────

/** Converte baseLatex em doc ProseMirror JSON (só os blocos, sem wrapper) */
function buildBaseTextDoc(baseLatex: string): any {
  const stmtNode = parseToStatementNode(baseLatex);
  const baseTextNode = schema.nodes.base_text.create(null, stmtNode.content);
  // Persiste como "base_text" (formato canônico) — não como "doc"
  return baseTextNode.toJSON();
}

async function postBaseText(
  payload: {
    id: string;
    content: any;
    autor?: string;
    titulo?: string;
    ano_pub?: number;
    disciplina?: string;
    tema?: string;
    genero?: string;
    movimento?: string;
    tags?: string[];
    source?: any;
    author?: any;
  },
  apiBase: string,
  token: string
): Promise<{ ok: boolean; baseTextId: string; tag?: string; error?: string }> {
  try {
    const res = await fetch(`${apiBase}/create.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Questions-Token": token },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json();
    if (json.success) return { ok: true, baseTextId: payload.id, tag: json.tag };
    if (json.duplicate) return { ok: true, baseTextId: json.existing_id, tag: json.existing_tag };
    return { ok: false, baseTextId: payload.id, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, baseTextId: payload.id, error: e.message };
  }
}

/**
 * Resolve os IDs dos textos base de um set, criando entradas no banco se necessário.
 * Suporta baseLatex (único, legado) e baseLatexes (múltiplos textos separados).
 */
async function resolveBaseTextIds(
  setEntry: ImportSetItem,
  baseTextCache: Map<string, string>,
  batch: BatchConfig,
  apiBaseTexts: string,
  token: string,
  dryRun: boolean,
  author?: { id?: string; name?: string },
  imageCfg?: ImageImportConfig
): Promise<{ ids: string[] | null; error?: string }> {
  const latexList = setEntry.baseLatexes?.length
    ? setEntry.baseLatexes
    : setEntry.baseLatex
    ? [setEntry.baseLatex]
    : [];

  if (latexList.length === 0) return { ids: null, error: "sem baseLatex" };

  const m = setEntry.sharedMeta;
  const ids: string[] = [];

  for (const latex of latexList) {
    const cacheKey = latex.trim();
    let id = baseTextCache.get(cacheKey);
    if (!id) {
      id = newId();
      if (!dryRun) {
        const baseTextContent = await materializeImagesInPayloadContent(
          buildBaseTextDoc(latex),
          imageCfg
        );
        const btResult = await postBaseText(
          {
            id,
            content: baseTextContent,
            autor: m?.autor_texto,
            titulo: m?.titulo_texto,
            ano_pub: m?.ano_publicacao,
            disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina),
            tema: m?.tema,
            genero: m?.genero,
            movimento: m?.movimento,
            tags: m?.tags,
            source: m?.concurso || m?.banca || m?.ano
              ? { concurso: m?.concurso, banca: m?.banca, ano: m?.ano, prova: m?.prova }
              : undefined,
            author,
          },
          apiBaseTexts,
          token
        );
        if (!btResult.ok) return { ids: null, error: `base_text error: ${btResult.error}` };
        id = btResult.baseTextId;
      }
      baseTextCache.set(cacheKey, id);
    }
    ids.push(id);
  }

  return { ids };
}

// ─── POST para create.php ────────────────────────────────────────────────────

async function postQuestion(
  payload: { metadata: any; content: any },
  apiBase: string,
  token: string
): Promise<{ ok: boolean; id: string; duplicate?: { existingId: string; similarity: number }; error?: string }> {
  const id = payload.metadata.id as string;
  try {
    const res = await fetch(`${apiBase}/create.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Questions-Token": token,
      },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json();
    if (json.success) return { ok: true, id };
    if (json.duplicate) {
      return { ok: false, id, duplicate: { existingId: json.existing_id, similarity: json.similarity } };
    }
    return { ok: false, id, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, id, error: e.message };
  }
}

// ─── POST para propose.php (atualização de questão existente) ────────────────

async function proposeQuestion(
  existingId: string,
  payload: { metadata: any; content: any },
  apiBase: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase}/propose.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Questions-Token": token,
      },
      body: JSON.stringify({ questionId: existingId, ...payload }),
    });
    const json: any = await res.json();
    if (json.success) return { ok: true };
    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const dryRun = args.get("dry-run") === true;
  const skipImages = args.get("sem-imagens") === true;
  const onlyImages = args.get("so-imagens") === true;
  const forcePropose = args.get("propose-duplicates") === true;

  // Token e API base
  const envLocal = loadEnvLocal();
  const token =
    (args.get("token") as string) ||
    process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ||
    envLocal.get("NEXT_PUBLIC_QUESTIONS_TOKEN") ||
    "";
  const apiBase =
    process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ||
    envLocal.get("NEXT_PUBLIC_QUESTIONS_API_BASE") ||
    "https://mpfaraujo.com.br/guardafiguras/api/questoes";
  const apiBaseTexts = apiBase.replace(/\/questoes\/?$/, "/base_texts");
  const uploadEndpoint = (args.get("upload-endpoint") as string) || DEFAULT_UPLOAD_ENDPOINT;
  const uploadToken = (args.get("upload-token") as string) || DEFAULT_UPLOAD_TOKEN;

  // Suporte a --html-url repetido e --html-url-b64 repetido
  const htmlUrlsRaw = getRepeatedArgValues(argv, "html-url");
  const htmlUrlsB64 = getRepeatedArgValues(argv, "html-url-b64").map(value =>
    Buffer.from(value, "base64").toString("utf-8")
  );
  const htmlUrls = [...htmlUrlsRaw, ...htmlUrlsB64];
  if (htmlUrls.length === 0) {
    const htmlUrlB64 = (args.get("html-url-b64") as string | undefined) || undefined;
    const htmlUrl = htmlUrlB64
      ? Buffer.from(htmlUrlB64, "base64").toString("utf-8")
      : (args.get("html-url") as string | undefined) || undefined;
    if (htmlUrl) htmlUrls.push(htmlUrl);
  }

  if (!token && !dryRun) {
    console.error("❌ Token não encontrado. Passe --token TOKEN ou configure .env.local");
    process.exit(1);
  }

  const { sourceMap, altMap } = htmlUrls.length > 0
    ? await buildImageSourceMapFromHtmls(htmlUrls)
    : { sourceMap: new Map<string, string>(), altMap: new Map<string, string>() };

  const imagesDirRaw = args.get("images-dir") as string | undefined;
  const imagesDir = imagesDirRaw ? resolve(imagesDirRaw) : undefined;

  const imageCfg: ImageImportConfig = {
    htmlUrls,
    uploadEndpoint,
    uploadToken,
    sourceMap,
    altMap,
    uploadCache: new Map<string, string>(),
    unresolved: new Set<string>(),
    uploaded: new Set<string>(),
    possibleFormulaImages: [],
    imagesDir,
  };

  if (imagesDir) {
    console.log(`📁 Imagens locais: ${imagesDir}`);
  }

  if (htmlUrls.length > 0) {
    console.log(`🖼  HTML(s) de origem: ${htmlUrls.length}`);
    for (const htmlUrl of htmlUrls) console.log(`   - ${htmlUrl}`);
    console.log(`   ${sourceMap.size} chave(s) de imagem resolvidas do HTML`);
  }

  // Batch config
  const dificRaw = (args.get("dific") as string) ?? "Média";
  const VALID_DIFIC = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade =
    VALID_DIFIC.find(d => d.toLowerCase() === dificRaw.toLowerCase()) ?? "Média";

  const batch: BatchConfig = {
    assunto: (args.get("assunto") as string) ?? "",
    dificuldade,
    disciplina: (args.get("disciplina") as string) ?? "Matemática",
    tags: [],
    source: {
      kind: args.has("concurso") ? "concurso" : "original",
      concurso: args.get("concurso") as string | undefined,
      banca: args.get("banca") as string | undefined,
      ano: args.has("ano") ? Number(args.get("ano")) : undefined,
    },
  };

  const author =
    args.has("autor-id") || args.has("autor-nome")
      ? {
          id: args.get("autor-id") as string | undefined,
          name: args.get("autor-nome") as string | undefined,
        }
      : undefined;

  // Import batch — para rastreamento pós-import na página de fixes
  const importBatch  = (args.get("batch") as string | undefined) || undefined;
  const importRunId  = (args.get("run-id") as string | undefined) || crypto.randomUUID();
  if (importBatch) console.log(`\n🏷  Batch: "${importBatch}"  |  run: ${importRunId}`);

  // Lê fila — resolve caminho com prioridade: --queue > --batch (slug) > padrão
  const dataDir = resolve(process.cwd(), "public/data");
  let queuePath: string;
  const queueArg = args.get("queue") as string | undefined;
  if (queueArg) {
    queuePath = resolve(process.cwd(), queueArg);
  } else if (importBatch) {
    const slug = toBatchSlug(importBatch);
    const batchPath = resolve(dataDir, `import-queue-${slug}.json`);
    if (existsSync(batchPath)) {
      queuePath = batchPath;
      console.log(`   📄 Fila por batch: public/data/import-queue-${slug}.json`);
    } else {
      queuePath = resolve(dataDir, "import-queue.json");
      console.log(`   📄 Arquivo por batch não encontrado, usando: public/data/import-queue.json`);
    }
  } else {
    queuePath = resolve(dataDir, "import-queue.json");
  }

  if (!existsSync(queuePath)) {
    console.error(`❌ Fila não encontrada: ${queuePath}`);
    console.error("   Execute: pnpm tsx scripts/parse-tex.ts <arquivo.tex> [--batch \"Label\"]");
    process.exit(1);
  }

  const queue: QueueEntry[] = JSON.parse(readFileSync(queuePath, "utf-8"));

  // Filtra por presença de imagem
  const entryHasImage = (entry: QueueEntry) => {
    if ("isSet" in entry && entry.isSet) {
      const s = entry as ImportSetItem;
      const bases = s.baseLatexes?.length ? s.baseLatexes : s.baseLatex ? [s.baseLatex] : [];
      return bases.some(hasImage) || s.items.some(it => hasImage(it.latex));
    }
    return hasImage((entry as ImportItem).latex);
  };

  const filtered = onlyImages
    ? queue.filter(entryHasImage)
    : skipImages
    ? queue.filter(entry => !entryHasImage(entry))
    : queue;

  const skipped = queue.length - filtered.length;

  console.log(`\n📋 Fila: ${queue.length} entradas`);
  if (onlyImages) console.log(`   🖼  Modo --so-imagens: apenas questões com \\includegraphics`);
  else if (skipImages && skipped > 0) console.log(`   ⏭  ${skipped} puladas por terem imagens (--sem-imagens)`);
  console.log(`   ✉  ${filtered.length} para importar`);
  if (dryRun) console.log("   🔍 DRY RUN — nada será enviado\n");
  else console.log(`   🌐 API: ${apiBase}\n`);

  if (filtered.length === 0) {
    console.log("Nada para importar.");
    return;
  }

  // Processa
  let ok = 0;
  let fail = 0;
  let dups = 0;
  let dryRunImageNodes = 0;
  let dryRunImagePlaceholders = 0;
  const errors: Array<{ idx: number; id: string; error: string }> = [];
  const dupList: DuplicateReportItem[] = [];

  // Cache de deduplicação de textos base dentro do batch (baseLatex → baseTextId)
  const baseTextCache = new Map<string, string>();

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isSet = "isSet" in entry && entry.isSet;
    const label = isSet
      ? `[SET ${(entry as ImportSetItem).items.length}]`
      : `[${(entry as ImportItem).tipo === "Múltipla Escolha" ? "MCQ" : "DIS"}]`;

    const setEntryForPreview = entry as ImportSetItem;
    const previewBase = isSet
      ? (setEntryForPreview.baseLatexes?.[0] ?? setEntryForPreview.baseLatex ?? "")
      : "";
    const preview = isSet
      ? previewBase.slice(0, 50).replace(/\n/g, " ")
      : (entry as ImportItem).latex.slice(0, 50).replace(/\n/g, " ");

    let payload: { metadata: any; content: any };
    try {
      if (isSet) {
        const setEntry = entry as ImportSetItem;
        const hasRealBaseText = !!setEntry.sharedMeta?.titulo_texto;

        if (hasRealBaseText) {
          // Texto base real (com título/autor) → banco externo de textos base
          const btResolved = await resolveBaseTextIds(
            setEntry, baseTextCache, batch, apiBaseTexts, token, dryRun, author, imageCfg
          );
          if (!btResolved.ids) {
            fail++;
            errors.push({ idx: i + 1, id: "?", error: btResolved.error ?? "sem texto base" });
            console.log(`  ✗ ${i + 1}/${filtered.length} ${label} ${btResolved.error}`);
            continue;
          }
          if (!dryRun) {
            console.log(`  📄 ${i + 1}/${filtered.length} ${label} texto(s) base | ${preview}…`);
          }
          payload = buildInitialSet(setEntry, batch, btResolved.ids, author, importBatch, importRunId);
        } else {
          // Texto base curto (cenário, dados) → embutido diretamente no set_questions
          const latexList = setEntry.baseLatexes?.length
            ? setEntry.baseLatexes
            : setEntry.baseLatex ? [setEntry.baseLatex] : [];
          if (!dryRun) {
            console.log(`  📝 ${i + 1}/${filtered.length} ${label} texto embutido | ${preview}…`);
          }
          payload = buildInitialSet(setEntry, batch, [], author, importBatch, importRunId, latexList);
        }
        payload.content = await materializeImagesInPayloadContent(payload.content, imageCfg);
      } else {
        const singleItem = entry as ImportItem;
        if (singleItem.meta?.titulo_texto) {
          // Questão individual com texto base — separa e salva no banco de textos
          const split = splitBaseFromQuestion(singleItem.latex);
          if (split) {
            const syntheticEntry = {
              isSet: true as const,
              baseLatexes: [split.baseLatex],
              baseLatex: split.baseLatex,
              items: [],
              sharedMeta: singleItem.meta,
            } as ImportSetItem;
            const btResolved = await resolveBaseTextIds(
              syntheticEntry, baseTextCache, batch, apiBaseTexts, token, dryRun, author, imageCfg
            );
            if (!btResolved.ids) {
              fail++;
              errors.push({ idx: i + 1, id: "?", error: btResolved.error ?? "sem texto base" });
              console.log(`  ✗ ${i + 1}/${filtered.length} ${label} ${btResolved.error}`);
              continue;
            }
            const modifiedItem = { ...singleItem, latex: split.questionLatex };
            payload = buildInitial(modifiedItem, batch, author, importBatch, importRunId, btResolved.ids);
            payload.content = await materializeImagesInPayloadContent(payload.content, imageCfg);
          } else {
            // Não foi possível separar — importa com texto embutido (fallback)
            payload = buildInitial(singleItem, batch, author, importBatch, importRunId);
            payload.content = await materializeImagesInPayloadContent(payload.content, imageCfg);
          }
        } else {
          payload = buildInitial(singleItem, batch, author, importBatch, importRunId);
          payload.content = await materializeImagesInPayloadContent(payload.content, imageCfg);
        }
      }
    } catch (e: any) {
      fail++;
      errors.push({ idx: i + 1, id: "?", error: `build error: ${e.message}` });
      console.log(`  ✗ ${i + 1}/${filtered.length} ${label} build error: ${e.message}`);
      continue;
    }

    if (dryRun) {
      dryRunImageNodes += countImageNodesInNode(payload.content);
      dryRunImagePlaceholders += countImagePlaceholdersInNode(payload.content);
      ok++;
      console.log(`  ✓ ${i + 1}/${filtered.length} ${label} [dry] ${preview}…`);
      continue;
    }

    const result = await postQuestion(payload, apiBase, token);
    if (result.ok) {
      ok++;
      console.log(`  ✓ ${i + 1}/${filtered.length} ${label} ${result.id.slice(0, 8)}… | ${preview}…`);
    } else if (result.duplicate) {
      if (forcePropose) {
        const propResult = await proposeQuestion(result.duplicate.existingId, payload, apiBase, token);
        if (propResult.ok) {
          ok++;
          console.log(`  ✓ ${i + 1}/${filtered.length} ${label} variante proposta → ${result.duplicate.existingId.slice(0, 8)}… (--propose-duplicates)`);
        } else {
          fail++;
          errors.push({ idx: i + 1, id: result.duplicate.existingId, error: propResult.error ?? "?" });
          console.log(`  ✗ ${i + 1}/${filtered.length} ${label} propose falhou: ${propResult.error}`);
        }
      } else {
        dups++;
        dupList.push({
          idx: i + 1,
          existingId: result.duplicate.existingId,
          similarity: result.duplicate.similarity,
          label,
          preview,
          payload,
        });
        console.log(`  ⚠ ${i + 1}/${filtered.length} ${label} DUPLICATA (${Math.round(result.duplicate.similarity * 100)}%) → ${result.duplicate.existingId.slice(0, 8)}… — pulada`);
      }
    } else {
      fail++;
      errors.push({ idx: i + 1, id: result.id, error: result.error ?? "?" });
      console.log(`  ✗ ${i + 1}/${filtered.length} ${label} ${result.error}`);
    }
  }

  // Resumo
  console.log(`\n─── Resultado ───────────────────────────────`);
  console.log(`  ✓ ${ok} importadas com sucesso`);
  if (imageCfg) {
    console.log(`  🖼 ${imageCfg.uploaded.size} imagem(ns) remota(s) materializada(s)`);
    if (imageCfg.unresolved.size > 0) {
      console.log(`  ⚠ ${imageCfg.unresolved.size} placeholder(s) sem resolução/upload`);
      for (const name of imageCfg.unresolved) {
        console.log(`     - ${name}`);
      }
    }
    if (imageCfg.possibleFormulaImages.length > 0) {
      console.log(`  ⚠ ${imageCfg.possibleFormulaImages.length} imagem(ns) com alt de fórmula — verificar e converter para LaTeX:`);
      for (const f of imageCfg.possibleFormulaImages) {
        console.log(`     - ${f.name}  alt: "${f.alt}"`);
      }
    }
    if (dryRun) {
      console.log(`  🔎 Dry-run: ${dryRunImageNodes} image node(s) no payload final`);
      console.log(`  🔎 Dry-run: ${dryRunImagePlaceholders} placeholder(s) restantes no payload final`);
    }
  }
  if (dups > 0) {
    console.log(`  ⚠ ${dups} duplicatas detectadas e puladas`);
    for (const d of dupList) {
      console.log(`     #${d.idx} → existente ${d.existingId.slice(0, 8)}… (${Math.round(d.similarity * 100)}%)`);
    }
  }
  if (fail > 0) {
    console.log(`  ✗ ${fail} erros`);
    for (const e of errors) {
      console.log(`     #${e.idx} ${e.id}: ${e.error}`);
    }
  }
  if (skipImages && skipped > 0) {
    console.log(`  ⏭  ${skipped} puladas (têm imagens — use --so-imagens para importar só elas)`);
  }
  console.log();

  const report: ImportReport = {
    batch: importBatch,
    runId: importRunId,
    queuePath,
    createdAt: new Date().toISOString(),
    dryRun,
    summary: {
      imported: ok,
      duplicates: dups,
      failed: fail,
      skipped,
      totalQueue: queue.length,
      processed: filtered.length,
    },
    duplicates: dupList,
    errors,
  };

  const reportPath = resolve(dataDir, `import-report-${importRunId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`📝 Relatório salvo em public/data/import-report-${importRunId}.json`);

  if (token) {
    try {
      const syncRes = await fetch(`${apiBase}/import-reports.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Questions-Token": token,
        },
        body: JSON.stringify(report),
      });

      if (syncRes.ok) {
        console.log(`☁️  Relatório sincronizado no backend (${importRunId})`);
      } else {
        const err = await syncRes.text();
        console.warn(`⚠ Não foi possível sincronizar relatório no backend (${syncRes.status}): ${err}`);
      }
    } catch (e: any) {
      console.warn(`⚠ Falha ao sincronizar relatório no backend: ${e?.message ?? e}`);
    }
  }
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
