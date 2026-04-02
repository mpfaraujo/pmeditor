#!/usr/bin/env tsx
/**
 * scripts/bulk-import.ts
 *
 * Importa em massa questões do import-queue.json direto para o banco,
 * sem passar pelo editor manual. Ideal para lotes sem imagens.
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
 *   --com-imagens        Inclui questões com \includegraphics (padrão: pula)
 *   --so-imagens         Importa APENAS questões com \includegraphics
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Imports do projeto (funciona em Node pois não há deps de browser) ────────
import { schema } from "../src/components/editor/schema";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
  extractLatexAnswerKey,
} from "../src/components/editor/plugins/smartPastePlugin";
import { normalizeDisciplina, normalizeAssunto } from "../src/data/assuntos";

// ─── Tipos (copiados de importar/page.tsx e questions.ts) ────────────────────

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
  isMcqSet?: boolean;
  baseLatex: string;
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito" | "resposta" | "numero">;
  }>;
  sharedMeta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem;

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

function hasImage(latex: string): boolean {
  return /\\includegraphics|\\begin\{tabular/.test(latex);
}

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

// ─── Builders (equivalentes ao buildInitial/buildInitialSet do importar/page) ─

function buildInitial(
  item: ImportItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string }
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
  };

  return { metadata, content };
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
  return schema.nodes.statement.create(null, [
    schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : []),
  ]);
}

/** Retorna [statement, options?] para um item de conjunto — preserva as alternativas MCQ */
function parseToItemNodes(text: string): PMNode[] {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const nodes: PMNode[] = [];
      (questionNode.content ?? []).forEach((n: PMNode) => {
        if (n.type === schema.nodes.statement || n.type === schema.nodes.options) nodes.push(n);
      });
      if (nodes.length > 0) return nodes;
    }
  } catch {}
  return [schema.nodes.statement.create(null, [
    schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : []),
  ])];
}

function buildInitialSet(
  item: ImportSetItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string }
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

  const baseStmt = parseToStatementNode(item.baseLatex);
  const baseTextNode = schema.nodes.base_text.create(null, baseStmt.content);

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

  const setChildren = [baseTextNode, ...questionItemNodes];

  const setNode = schema.nodes.set_questions.create(
    { mode: hasChoices ? "set" : null },
    setChildren
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
  };

  return { metadata, content };
}

// ─── Banco de textos base ────────────────────────────────────────────────────

/** Converte baseLatex em doc ProseMirror JSON (só os blocos, sem wrapper) */
function buildBaseTextDoc(baseLatex: string): any {
  const stmtNode = parseToStatementNode(baseLatex);
  const baseTextNode = schema.nodes.base_text.create(null, stmtNode.content);
  const baseTextJson = baseTextNode.toJSON();
  return {
    type: "doc",
    content: baseTextJson.content ?? [],
  };
}

/** Cria uma questão MCQ simples com baseTextId */
function buildMcqQuestion(
  it: ImportSetItem["items"][number],
  parent: ImportSetItem,
  baseTextId: string,
  batch: BatchConfig,
  author?: { id?: string; name?: string }
) {
  const now = new Date().toISOString();
  const m = parent.sharedMeta;

  const itemNodes = parseToItemNodes(it.latex);
  const questionNode = schema.nodes.question.create(
    { tipo: "Múltipla Escolha", baseTextId },
    itemNodes
  );
  const doc = schema.nodes.doc.create(null, [questionNode]);
  const content = doc.toJSON();

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
          numero: it.meta?.numero || m?.numero || undefined,
          prova: m?.prova || undefined,
        }
      : { ...batch.source };

  const tags = [
    ...(m?.tags ?? []),
    ...(it.meta?.tags ?? []),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const metadata = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: "Múltipla Escolha",
    disciplina: normalizeDisciplina(m?.disciplina || batch.disciplina),
    dificuldade,
    assunto: normalizeAssunto(it.meta?.assunto || m?.assunto || batch.assunto || "") || undefined,
    gabarito: it.gabarito
      ? { kind: "mcq" as const, correct: it.gabarito as "A"|"B"|"C"|"D"|"E" }
      : { kind: "mcq" as const, correct: null },
    tags,
    source,
    author,
    baseTextId,
  };

  return { metadata, content };
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.get("dry-run") === true;
  const includeImages = args.get("com-imagens") === true;
  const onlyImages = args.get("so-imagens") === true;

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

  if (!token && !dryRun) {
    console.error("❌ Token não encontrado. Passe --token TOKEN ou configure .env.local");
    process.exit(1);
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

  // Lê fila
  const queuePath = resolve(process.cwd(), "public/data/import-queue.json");
  if (!existsSync(queuePath)) {
    console.error(`❌ Fila não encontrada: ${queuePath}`);
    console.error("   Execute: pnpm tsx scripts/parse-tex.ts <arquivo.tex>");
    process.exit(1);
  }

  const queue: QueueEntry[] = JSON.parse(readFileSync(queuePath, "utf-8"));

  // Filtra por presença de imagem
  const entryHasImage = (entry: QueueEntry) =>
    "isSet" in entry && entry.isSet
      ? hasImage(entry.baseLatex) || entry.items.some(it => hasImage(it.latex))
      : hasImage((entry as ImportItem).latex);

  const filtered = onlyImages
    ? queue.filter(entryHasImage)
    : includeImages
    ? queue
    : queue.filter(entry => !entryHasImage(entry));

  const skipped = queue.length - filtered.length;

  console.log(`\n📋 Fila: ${queue.length} entradas`);
  if (onlyImages) console.log(`   🖼  Modo --so-imagens: apenas questões com \\includegraphics`);
  else if (skipped > 0) console.log(`   ⏭  ${skipped} puladas por terem imagens`);
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
  const errors: Array<{ idx: number; id: string; error: string }> = [];
  const dupList: Array<{ idx: number; existingId: string; similarity: number }> = [];

  // Cache de deduplicação de textos base dentro do batch (baseLatex → baseTextId)
  const baseTextCache = new Map<string, string>();

  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isSet = "isSet" in entry && entry.isSet;
    const isMcqSet = isSet && !!(entry as ImportSetItem).isMcqSet;
    const label = isSet
      ? isMcqSet
        ? `[MCQ-SET ${(entry as ImportSetItem).items.length}]`
        : `[SET ${(entry as ImportSetItem).items.length}]`
      : `[${(entry as ImportItem).tipo === "Múltipla Escolha" ? "MCQ" : "DIS"}]`;

    const preview = isSet
      ? (entry as ImportSetItem).baseLatex.slice(0, 50).replace(/\n/g, " ")
      : (entry as ImportItem).latex.slice(0, 50).replace(/\n/g, " ");

    // ── Caminho MCQ com texto base ────────────────────────────────────────────
    if (isMcqSet) {
      const setEntry = entry as ImportSetItem;

      // 1. Resolve baseTextId (cache ou POST)
      const cacheKey = setEntry.baseLatex.trim();
      let baseTextId = baseTextCache.get(cacheKey);

      if (!baseTextId) {
        baseTextId = newId();
        if (!dryRun) {
          const m = setEntry.sharedMeta;
          const btResult = await postBaseText(
            {
              id: baseTextId,
              content: buildBaseTextDoc(setEntry.baseLatex),
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
          if (!btResult.ok) {
            fail++;
            errors.push({ idx: i + 1, id: "?", error: `base_text error: ${btResult.error}` });
            console.log(`  ✗ ${i + 1}/${filtered.length} ${label} base_text error: ${btResult.error}`);
            continue;
          }
          baseTextId = btResult.baseTextId;
          console.log(`  📄 ${i + 1}/${filtered.length} ${label} texto base ${btResult.tag ?? "?"} | ${preview}…`);
        }
        baseTextCache.set(cacheKey, baseTextId);
      }

      // 2. Cria N questões simples com baseTextId
      let batchOk = 0;
      for (const it of setEntry.items) {
        let payload: { metadata: any; content: any };
        try {
          payload = buildMcqQuestion(it, setEntry, baseTextId!, batch, author);
        } catch (e: any) {
          fail++;
          errors.push({ idx: i + 1, id: "?", error: `build error: ${e.message}` });
          console.log(`  ✗ ${i + 1}/${filtered.length} ${label} build error: ${e.message}`);
          continue;
        }

        if (dryRun) {
          batchOk++;
          continue;
        }

        const result = await postQuestion(payload, apiBase, token);
        if (result.ok) {
          batchOk++;
        } else if (result.duplicate) {
          dups++;
          dupList.push({ idx: i + 1, existingId: result.duplicate.existingId, similarity: result.duplicate.similarity });
          console.log(`  ⚠ ${i + 1}/${filtered.length} ${label} DUPLICATA → ${result.duplicate.existingId.slice(0, 8)}… — pulada`);
        } else {
          fail++;
          errors.push({ idx: i + 1, id: result.id, error: result.error ?? "?" });
          console.log(`  ✗ ${i + 1}/${filtered.length} ${label} ${result.error}`);
        }
      }

      if (batchOk > 0) {
        ok += batchOk;
        if (dryRun) {
          console.log(`  ✓ ${i + 1}/${filtered.length} ${label} [dry] ${batchOk} questões | ${preview}…`);
        } else {
          console.log(`  ✓ ${i + 1}/${filtered.length} ${label} ${batchOk} questões importadas | ${preview}…`);
        }
      }
      continue;
    }

    // ── Caminho normal (discursivo set ou questão individual) ─────────────────
    let payload: { metadata: any; content: any };
    try {
      if (isSet) {
        payload = buildInitialSet(entry as ImportSetItem, batch, author);
      } else {
        payload = buildInitial(entry as ImportItem, batch, author);
      }
    } catch (e: any) {
      fail++;
      errors.push({ idx: i + 1, id: "?", error: `build error: ${e.message}` });
      console.log(`  ✗ ${i + 1}/${filtered.length} ${label} build error: ${e.message}`);
      continue;
    }

    if (dryRun) {
      ok++;
      console.log(`  ✓ ${i + 1}/${filtered.length} ${label} [dry] ${preview}…`);
      continue;
    }

    const result = await postQuestion(payload, apiBase, token);
    if (result.ok) {
      ok++;
      console.log(`  ✓ ${i + 1}/${filtered.length} ${label} ${result.id.slice(0, 8)}… | ${preview}…`);
    } else if (result.duplicate) {
      dups++;
      dupList.push({ idx: i + 1, existingId: result.duplicate.existingId, similarity: result.duplicate.similarity });
      console.log(`  ⚠ ${i + 1}/${filtered.length} ${label} DUPLICATA (${Math.round(result.duplicate.similarity * 100)}%) → ${result.duplicate.existingId.slice(0, 8)}… — pulada`);
    } else {
      fail++;
      errors.push({ idx: i + 1, id: result.id, error: result.error ?? "?" });
      console.log(`  ✗ ${i + 1}/${filtered.length} ${label} ${result.error}`);
    }
  }

  // Resumo
  console.log(`\n─── Resultado ───────────────────────────────`);
  console.log(`  ✓ ${ok} importadas com sucesso`);
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
  if (!onlyImages && skipped > 0) {
    console.log(`  ⏭  ${skipped} puladas (têm imagens — use --com-imagens para incluir, --so-imagens para só elas)`);
  }
  console.log();
}

main().catch(e => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
