#!/usr/bin/env tsx
// scripts/parse-tex.ts
// Uso: pnpm tsx scripts/parse-tex.ts caminho/arquivo.tex [--batch "Label do Lote"]
//
// Lê um .tex (pacote exam) e gera public/data/import-queue.json
// (e, se --batch for fornecido, também public/data/import-queue-<slug>.json)
// com cada questão separada, tipo detectado, gabarito extraído,
// e metadados YAML (se houver bloco ---...--- antes de cada \question).
//
// Suporte a set_questions: use \setquestion para o texto-base e
// \questionitem para cada sub-item. O YAML pode ter campos por item:
//   assunto1, tags1, gabarito1, assunto2, tags2, gabarito2, ...

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

/** Converte um label humano em slug de arquivo: "PUC-Rio 2017 G1" → "puc-rio-2017-g1" */
function toBatchSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")      // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, "");          // remove hífens nas pontas
}

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
  // Metadados do texto base (para banco de textos)
  autor_texto?: string;
  titulo_texto?: string;
  ano_publicacao?: number;
  tema?: string;
  genero?: string;
  movimento?: string;
  // Por item (set_questions)
  items?: Array<{
    assunto?: string;
    tags?: string[];
    gabarito?: string;
    resposta?: string;
    numero?: string;
  }>;
};

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
  meta?: YamlMeta;
};

type ImportSetItem = {
  isSet: true;
  /** Sempre array — use \newbasetext no .tex para separar múltiplos textos base. */
  baseLatexes: string[];
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito" | "resposta" | "numero">;
  }>;
  sharedMeta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem;

/** Parseia frontmatter YAML simples entre --- delimitadores */
function parseYamlBlock(block: string): YamlMeta {
  const result: YamlMeta = {};
  const itemsMap: Map<number, { assunto?: string; tags?: string[]; gabarito?: string; resposta?: string }> = new Map();

  const rawLines = block.split("\n");
  let lineIdx = 0;
  while (lineIdx < rawLines.length) {
    const line = rawLines[lineIdx++];
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim().toLowerCase();
    let val = stripped.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

    // Suporte a bloco multiline YAML (resposta: | ou resposta: |-)
    if (val === "|" || val === "|-") {
      const parts: string[] = [];
      while (lineIdx < rawLines.length && /^[ \t]/.test(rawLines[lineIdx])) {
        parts.push(rawLines[lineIdx++].trim());
      }
      // Remove linhas vazias no final
      while (parts.length && !parts[parts.length - 1]) parts.pop();
      val = parts.join(" ").trim();
      if (!val) continue;
    }

    if (!val && key !== "tags" && !key.startsWith("tags")) continue;

    // Campos por item: assunto1, tags1, gabarito1, assunto2, ...
    const itemMatch = key.match(/^(assunto|tags|gabarito|resposta|numero)(\d+)$/);
    if (itemMatch) {
      const field = itemMatch[1] as "assunto" | "tags" | "gabarito" | "resposta" | "numero";
      const idx = parseInt(itemMatch[2], 10) - 1; // 0-based
      if (!itemsMap.has(idx)) itemsMap.set(idx, {});
      const entry = itemsMap.get(idx)!;
      if (field === "tags") {
        let s = val;
        if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
        entry.tags = s.split(",").map(t => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      } else {
        entry[field] = val;
      }
      continue;
    }

    switch (key) {
      case "tipo": result.tipo = val; break;
      case "dificuldade": result.dificuldade = val; break;
      case "nivel": result.nivel = val; break;
      case "disciplina": result.disciplina = val; break;
      case "assunto": result.assunto = val; break;
      case "gabarito": result.gabarito = val; break;
      case "resposta": result.resposta = val; break;
      case "fonte": result.fonte = val; break;
      case "concurso": result.concurso = val; break;
      case "banca": result.banca = val; break;
      case "cargo": result.cargo = val; break;
      case "prova": result.prova = val; break;
      case "numero": result.numero = val; break;
      case "ano": {
        const n = parseInt(val, 10);
        if (!isNaN(n)) result.ano = n;
        break;
      }
      case "tags": {
        let s = val;
        if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
        result.tags = s.split(",").map(t => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        break;
      }
      case "autor_texto": result.autor_texto = val; break;
      case "titulo_texto": result.titulo_texto = val; break;
      case "tema": result.tema = val; break;
      case "genero": result.genero = val; break;
      case "movimento": result.movimento = val; break;
      case "ano_publicacao": {
        const n = parseInt(val, 10);
        if (!isNaN(n)) result.ano_publicacao = n;
        break;
      }
    }
  }

  // Converte itemsMap para array (preenche buracos com {})
  if (itemsMap.size > 0) {
    const maxIdx = Math.max(...itemsMap.keys());
    result.items = [];
    for (let i = 0; i <= maxIdx; i++) {
      result.items.push(itemsMap.get(i) ?? {});
    }
  }

  return result;
}

/**
 * Extrai YAML do INÍCIO de um bloco (logo após \question, \setquestion ou \questionitem).
 * Suporta formato direto (---...---) e verbatim.
 * Retorna o YAML e o latex restante sem o bloco YAML.
 */
function extractLeadingYaml(text: string): { meta: YamlMeta | null; latex: string } {
  const directM = text.match(/^---\s*\n([\s\S]*?)\n?\s*---\s*\n?([\s\S]*)$/);
  if (directM) {
    return { meta: parseYamlBlock(directM[1]), latex: directM[2].trim() };
  }
  const verbatimM = text.match(
    /^\\begin\{verbatim\}\s*\n?\s*---\s*\n([\s\S]*?)\n\s*---\s*\n?\s*\\end\{verbatim\}\s*\n?([\s\S]*)$/
  );
  if (verbatimM) {
    return { meta: parseYamlBlock(verbatimM[1]), latex: verbatimM[2].trim() };
  }
  return { meta: null, latex: text };
}

/**
 * Extrai YAML do formato {YAML} com chaves (formato inline do pmeditor).
 * Só considera YAML se o conteúdo tiver pelo menos um campo reconhecido.
 */
function extractCurlyYaml(text: string): { meta: YamlMeta | null; latex: string } {
  const m = text.match(/^\{([\s\S]*?)\}\s*([\s\S]*)$/);
  if (!m) return { meta: null, latex: text };
  const parsed = parseYamlBlock(m[1]);
  // Só trata como YAML se tiver campos reconhecidos (evita confundir com conteúdo de questionitem)
  if (!parsed.tipo && !parsed.disciplina && !parsed.gabarito && !parsed.concurso && !parsed.banca) {
    return { meta: null, latex: text };
  }
  return { meta: parsed, latex: m[2].trim() };
}

/** Extrai o bloco YAML de dentro de \begin{verbatim}---...---\end{verbatim} OU direto ---...--- */
function extractVerbatimYaml(text: string): { meta: YamlMeta | null; yamlText: string | null } {
  // Primeiro tenta pegar YAML direto (sem verbatim): ---...---
  const directRe = /---\s*\n([\s\S]*?)\n\s*---/g;
  let lastDirectMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(text))) {
    lastDirectMatch = m;
  }

  if (lastDirectMatch) {
    return {
      meta: parseYamlBlock(lastDirectMatch[1]),
      yamlText: lastDirectMatch[0].trim(),
    };
  }

  // Se não encontrou YAML direto, tenta dentro de verbatim
  const verbatimRe = /\\begin\{verbatim\}\s*\n?\s*---\s*\n([\s\S]*?)\n\s*---\s*\n?\s*\\end\{verbatim\}/g;
  let lastMatch: RegExpExecArray | null = null;
  while ((m = verbatimRe.exec(text))) {
    lastMatch = m;
  }
  if (!lastMatch) return { meta: null, yamlText: null };

  return {
    meta: parseYamlBlock(lastMatch[1]),
    yamlText: `---\n${lastMatch[1]}\n---`,
  };
}

type FormulaImageWarning = {
  label: string;
  match: string;
  reason: string;
};

/**
 * Detecta \includegraphics que provavelmente são fórmulas renderizadas como imagem.
 * Sinais: (1) height pequena no argumento opcional; (2) ocorre inline no meio de texto.
 */
function detectFormulaImages(latex: string, label: string): FormulaImageWarning[] {
  const out: FormulaImageWarning[] = [];
  const re = /\\includegraphics(\[[^\]]*\])?\{[^}]+\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    const optArg = m[1] ?? "";
    const fullMatch = m[0];
    const pos = m.index;

    // Sinal 1: height pequena → fórmula inline
    const hm = optArg.match(/height\s*=\s*([\d.,]+)\s*(cm|mm|pt|in)/i);
    if (hm) {
      const val = parseFloat(hm[1].replace(",", "."));
      const unit = hm[2].toLowerCase();
      let cm = val;
      if (unit === "mm") cm /= 10;
      else if (unit === "pt") cm *= 0.0352778;
      else if (unit === "in") cm *= 2.54;
      if (cm < 1.5) {
        out.push({ label, match: fullMatch, reason: `height pequena (${val}${unit})` });
        continue;
      }
    }

    // Sinal 2: aparece inline (texto antes na mesma linha sem quebra de parágrafo)
    const before = latex.slice(Math.max(0, pos - 200), pos);
    const lastNl = before.lastIndexOf("\n");
    const sameLine = before.slice(lastNl + 1).trimStart();
    const isInline = sameLine.length > 0
      && !sameLine.startsWith("%")
      && !/^\\(begin|centering|noindent|hfill|vspace|vskip)\b/.test(sameLine);
    if (isInline) {
      const snip = sameLine.length > 60 ? "…" + sameLine.slice(-60) : sameLine;
      out.push({ label, match: fullMatch, reason: `inline após "${snip}"` });
    }
  }
  return out;
}

/** Detecta o gabarito de um bloco de choices LaTeX */
function extractGabaritoFromChoices(chunk: string): string | null {
  const choicesMatch = chunk.match(
    /\\begin\{(?:choices|oneparchoices)\}([\s\S]*?)\\end\{(?:choices|oneparchoices)\}/
  );
  if (!choicesMatch) return null;
  const body = choicesMatch[1];
  const re = /\\(CorrectChoice|correctchoice|choice)\b/g;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1] === "CorrectChoice" || m[1] === "correctchoice") {
      return String.fromCharCode("A".charCodeAt(0) + idx);
    }
    idx++;
  }
  return null;
}

/** Processa um bloco de \question com \begin{parts}...\end{parts} */
function parsePartsBlock(chunk: string, meta: YamlMeta | null): ImportSetItem {
  const partsMatch = chunk.match(/^([\s\S]*?)\\begin\{parts\}([\s\S]*?)\\end\{parts\}([\s\S]*)$/);
  if (!partsMatch) {
    return { isSet: true, baseLatexes: [chunk], items: [], ...(meta ? { sharedMeta: meta } : {}) };
  }

  const beforeParts = partsMatch[1].trim();
  const partsBody = partsMatch[2];
  const afterParts = partsMatch[3].trim();
  const baseLatexRaw = afterParts ? `${beforeParts}\n\n${afterParts}` : beforeParts;
  const baseLatexes = baseLatexRaw.split(/\\newbasetext\b/).map(s => s.trim()).filter(Boolean);

  // Divide pelos \part
  const partSplitRe = /\\part\b/g;
  const splits: number[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = partSplitRe.exec(partsBody))) splits.push(sm.index);

  const itemChunks: string[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i] + "\\part".length;
    const end = i + 1 < splits.length ? splits[i + 1] : partsBody.length;
    itemChunks.push(partsBody.slice(start, end).trim());
  }

  const items = itemChunks.map((itemChunk, idx) => {
    const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(itemChunk);
    const tipo: "Múltipla Escolha" | "Discursiva" = hasChoices ? "Múltipla Escolha" : "Discursiva";
    const gabarito = hasChoices
      ? extractGabaritoFromChoices(itemChunk)
      : (meta?.items?.[idx]?.gabarito?.toUpperCase() ?? null);
    const itemMeta = meta?.items?.[idx];
    return { latex: itemChunk, tipo, gabarito, ...(itemMeta ? { meta: itemMeta } : {}) };
  });

  return { isSet: true, baseLatexes, items, ...(meta ? { sharedMeta: meta } : {}) };
}

/** Processa um bloco de \setquestion...\questionitem...\questionitem... */
function parseSetBlock(chunk: string, metaFromBefore: YamlMeta | null): ImportSetItem | null {
  // Suporte a YAML inline logo após \setquestion
  // Tenta formato ---...--- primeiro, depois formato {YAML}
  const { meta: inlineMeta, latex: chunkClean } = extractLeadingYaml(chunk);
  let meta = inlineMeta ?? metaFromBefore;
  let effectiveChunk = inlineMeta ? chunkClean : chunk;

  if (!inlineMeta) {
    const { meta: curlyMeta, latex: curlyClean } = extractCurlyYaml(effectiveChunk);
    if (curlyMeta) {
      meta = curlyMeta;
      effectiveChunk = curlyClean;
    }
  }

  // Separa base text dos items (\questionitem)
  const tokenRe = /\\questionitem\b/g;
  type Token = { index: number; len: number };
  const tokens: Token[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tokenRe.exec(effectiveChunk))) {
    tokens.push({ index: tm.index, len: tm[0].length });
  }

  const firstTokenIdx = tokens.length > 0 ? tokens[0].index : effectiveChunk.length;
  const baseLatexRaw = effectiveChunk.slice(0, firstTokenIdx).trim();
  const baseLatexes = baseLatexRaw.split(/\\newbasetext\b/).map(s => s.trim()).filter(Boolean);

  // Extrai chunk de texto de um \questionitem, desembrulhando {conteúdo} se necessário
  function extractItemChunk(i: number): string {
    const tok = tokens[i];
    const start = tok.index + tok.len;
    const end = i + 1 < tokens.length ? tokens[i + 1].index : effectiveChunk.length;
    let raw = effectiveChunk.slice(start, end).trim();
    if (raw.startsWith('{')) {
      let depth = 0;
      let closeIdx = -1;
      for (let ci = 0; ci < raw.length; ci++) {
        if (raw[ci] === '\\') { ci++; continue; }
        if (raw[ci] === '{') depth++;
        else if (raw[ci] === '}') { depth--; if (depth === 0) { closeIdx = ci; break; } }
      }
      if (closeIdx !== -1) raw = raw.slice(1, closeIdx).trim();
    }
    return raw;
  }

  const sharedTipo = meta?.tipo?.toLowerCase();
  const defaultTipo: "Múltipla Escolha" | "Discursiva" =
    sharedTipo?.includes("múltipla") || sharedTipo?.includes("multipla")
      ? "Múltipla Escolha"
      : "Discursiva";

  function parseItemChunk(itemChunk: string, idx: number) {
    const { meta: itemYaml, latex: itemLatex } = extractLeadingYaml(itemChunk);
    const sharedItemMeta = meta?.items?.[idx];
    const assunto = itemYaml?.assunto ?? sharedItemMeta?.assunto;
    const tags = itemYaml?.tags ?? sharedItemMeta?.tags;
    const gabaritoFromYaml = itemYaml?.gabarito ?? sharedItemMeta?.gabarito;
    const resposta = itemYaml?.resposta ?? sharedItemMeta?.resposta;
    const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(itemLatex);
    const tipo: "Múltipla Escolha" | "Discursiva" = hasChoices ? "Múltipla Escolha" : defaultTipo;
    const gabarito = hasChoices
      ? extractGabaritoFromChoices(itemLatex)
      : (gabaritoFromYaml?.toUpperCase() ?? null);
    const numero = itemYaml?.numero ?? sharedItemMeta?.numero;
    const itemMeta = assunto || tags?.length || resposta || numero
      ? { assunto, tags, gabarito: gabarito ?? undefined, resposta, numero }
      : undefined;
    return { latex: itemLatex, tipo, gabarito, ...(itemMeta ? { meta: itemMeta } : {}) };
  }

  const items = tokens.map((_, i) => parseItemChunk(extractItemChunk(i), i));

  if (items.length > 0 && items.every(it => it.tipo === "Múltipla Escolha")) {
    const preview = (baseLatexes[0] ?? "").slice(0, 100).replace(/\n/g, " ");
    console.error(`\n❌  \\setquestion com ${items.length} item(ns) de Múltipla Escolha — PROIBIDO.`);
    console.error(`    Use \\question individual com titulo_texto: no YAML para cada questão.`);
    console.error(`    Texto base: "${preview}..."\n`);
    return null;
  }

  return {
    isSet: true as const,
    baseLatexes,
    items,
    ...(meta ? { sharedMeta: meta } : {}),
  };
}

function main() {
  const rawArgs = process.argv.slice(2);
  if (!rawArgs.length) {
    console.error("Uso: pnpm tsx scripts/parse-tex.ts <arquivo.tex> [--batch \"Label\"]");
    process.exit(1);
  }

  // Extrai --batch (pode vir em qualquer posição após o arquivo)
  let batchLabel: string | undefined;
  const args: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === "--batch" && i + 1 < rawArgs.length) {
      batchLabel = rawArgs[++i];
    } else {
      args.push(rawArgs[i]);
    }
  }

  const filePath = resolve(args[0]);
  const src = readFileSync(filePath, "utf-8");

  // Encontra todas as posições de \question e \setquestion no texto
  const markerRe = /\\(setquestion|question)\b/g;
  const markers: Array<{ index: number; isSet: boolean }> = [];
  let qm: RegExpExecArray | null;
  while ((qm = markerRe.exec(src))) {
    markers.push({ index: qm.index, isSet: qm[1] === "setquestion" });
  }

  if (!markers.length) {
    console.error("Nenhuma \\question ou \\setquestion encontrada no arquivo.");
    process.exit(1);
  }

  const queue: QueueEntry[] = [];
  let skippedMcqSets = 0;

  for (let i = 0; i < markers.length; i++) {
    const { index: qStart, isSet } = markers[i];
    const qEnd = i + 1 < markers.length ? markers[i + 1].index : src.length;

    // Texto antes deste marcador (entre o marcador anterior e este)
    const prevStart = i > 0 ? markers[i - 1].index : 0;
    const textBefore = src.slice(prevStart, qStart);

    // Extrai YAML do bloco que aparece antes deste marcador
    const { meta } = extractVerbatimYaml(textBefore);

    // Texto do bloco: do marcador até o próximo
    let blockText = src.slice(qStart, qEnd);
    // Remove YAML/verbatim que esteja no final (pertence ao próximo bloco)
    blockText = blockText.replace(
      /\\begin\{verbatim\}\s*\n?\s*---[\s\S]*?---\s*\n?\s*\\end\{verbatim\}\s*$/,
      ""
    );
    // Greedy: encontra o ÚLTIMO \n---...---$ (não o primeiro), evitando engolir
    // YAMLs inline de \questionitem que ficam no meio do bloco
    blockText = blockText.replace(/^([\s\S]*)\n(\s*---\s*\n[\s\S]*?---\s*)$/, "$1");
    blockText = blockText.replace(/\\section\*?\{[^}]*\}\s*$/, "");
    blockText = blockText.trim();

    if (isSet) {
      // Remove o marcador \setquestion
      const chunk = blockText.replace(/^\\setquestion\b\s*(\[[^\]]*\])?\s*/, "").trim();
      if (!chunk) continue;
      const setEntry = parseSetBlock(chunk, meta);
      if (setEntry === null) { skippedMcqSets++; continue; }
      queue.push(setEntry);
    } else {
      // Questão individual
      let chunk = blockText.replace(/^\\question\b\s*(\[[^\]]*\])?\s*/, "").trim();
      if (!chunk) continue;

      // Suporte a YAML inline (logo após \question): prioridade sobre textBefore
      // Tenta formato ---...--- primeiro, depois formato {YAML}
      const { meta: inlineMeta, latex: cleanChunk } = extractLeadingYaml(chunk);
      let effectiveMeta = inlineMeta ?? meta;
      if (inlineMeta) chunk = cleanChunk;
      if (!inlineMeta) {
        const { meta: curlyMeta, latex: curlyClean } = extractCurlyYaml(chunk);
        if (curlyMeta) {
          effectiveMeta = curlyMeta;
          chunk = curlyClean;
        }
      }

      // Detecta \begin{parts} → set_questions discursivo
      if (/\\begin\{parts\}/.test(chunk)) {
        queue.push(parsePartsBlock(chunk, effectiveMeta));
        continue;
      }

      const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(chunk);
      let tipo: ImportItem["tipo"];
      let gabarito: string | null = null;

      if (hasChoices) {
        tipo = "Múltipla Escolha";
        gabarito = extractGabaritoFromChoices(chunk);
      } else {
        tipo = "Discursiva";
      }

      if (!gabarito && effectiveMeta?.gabarito) {
        gabarito = effectiveMeta.gabarito.toUpperCase();
      }

      if (effectiveMeta?.tipo) {
        const t = effectiveMeta.tipo.toLowerCase();
        if (t.includes("múltipla") || t.includes("multipla")) tipo = "Múltipla Escolha";
        else if (t.includes("discursiva")) tipo = "Discursiva";
        else if (t.includes("certo") || t.includes("errado")) tipo = "Discursiva"; // C/E → discursiva
      }

      const latex = "\\question " + chunk;
      queue.push({ latex, tipo, gabarito, ...(effectiveMeta ? { meta: effectiveMeta } : {}) });
    }
  }

  // Detecta imagens que provavelmente são fórmulas matemáticas
  const formulaWarnings: FormulaImageWarning[] = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const entry = queue[qi];
    const qLabel = `Q${qi + 1}`;
    if ("isSet" in entry && entry.isSet) {
      const s = entry as ImportSetItem;
      for (const base of (s.baseLatexes ?? [])) {
        formulaWarnings.push(...detectFormulaImages(base, `${qLabel} (base)`));
      }
      s.items.forEach((it, ii) =>
        formulaWarnings.push(...detectFormulaImages(it.latex, `${qLabel} item ${ii + 1}`))
      );
    } else {
      formulaWarnings.push(...detectFormulaImages((entry as ImportItem).latex, qLabel));
    }
  }

  // Salva arquivos de fila
  const dataDir = resolve(__dirname, "../public/data");
  mkdirSync(dataDir, { recursive: true });

  const defaultPath = resolve(dataDir, "import-queue.json");
  const json = JSON.stringify(queue, null, 2);
  writeFileSync(defaultPath, json, "utf-8");

  const total = queue.length;
  const sets = queue.filter((q) => "isSet" in q).length;
  const individual = total - sets;

  if (batchLabel) {
    const slug = toBatchSlug(batchLabel);
    const batchFile = `import-queue-${slug}.json`;
    const batchPath = resolve(dataDir, batchFile);

    // Aviso de colisão — não silencia sobreescrita
    if (existsSync(batchPath)) {
      console.warn(`⚠️  Arquivo já existe e será sobrescrito: public/data/${batchFile}`);
    }
    writeFileSync(batchPath, json, "utf-8");

    // Manifest — artefato auditável junto com a fila nomeada
    const runId = crypto.randomUUID();
    const manifest = {
      batch: batchLabel,
      slug,
      run_id: runId,
      source: basename(filePath),
      source_path: filePath,
      generated_at: new Date().toISOString(),
      total,
      individual,
      sets,
      skipped_mcq_sets: skippedMcqSets,
      warnings: {
        with_images: queue.filter((q) =>
          ("isSet" in q && q.isSet
            ? (q.baseLatexes ?? []).some((b: string) => /\\includegraphics/.test(b)) ||
              q.items.some((it: { latex: string }) => /\\includegraphics/.test(it.latex))
            : /\\includegraphics/.test((q as ImportItem).latex))
        ).length,
        with_fixme: queue.filter((q) =>
          ("isSet" in q && q.isSet
            ? q.items.some((it: { latex: string }) => /FIXME/i.test(it.latex))
            : /FIXME/i.test((q as ImportItem).latex))
        ).length,
        possible_formula_images: formulaWarnings.length,
      },
    };
    const manifestPath = resolve(dataDir, `import-queue-${slug}.manifest.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    if (skippedMcqSets > 0)
      console.log(`\n❌  ${skippedMcqSets} \\setquestion MCQ ignorado(s) — ver erros acima\n`);
    console.log(`✓ ${total} entradas extraídas (${individual} individual, ${sets} set)`);
    console.log(`  → public/data/import-queue.json           (padrão / UI)`);
    console.log(`  → public/data/${batchFile}  (batch persistente)`);
    console.log(`  → public/data/import-queue-${slug}.manifest.json`);
    if (manifest.warnings.with_images > 0)
      console.log(`  ⚠️  ${manifest.warnings.with_images} questão(ões) com \\includegraphics`);
    if (manifest.warnings.with_fixme > 0)
      console.log(`  ⚠️  ${manifest.warnings.with_fixme} questão(ões) com FIXME`);
    if (formulaWarnings.length > 0) {
      console.log(`  ⚠️  ${formulaWarnings.length} imagem(ns) possivelmente fórmula — converter para LaTeX:`);
      for (const w of formulaWarnings)
        console.log(`     ${w.label}: ${w.reason}\n       ${w.match}`);
    }
  } else {
    console.log(`✓ ${total} entradas extraídas (${individual} individual, ${sets} set) → public/data/import-queue.json`);
  }

  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    if ("isSet" in q && q.isSet) {
      const base = (q.baseLatexes[0] ?? "").slice(0, 50).replace(/\n/g, " ");
      console.log(`  ${i + 1}. [SET ${q.items.length} itens] disciplina=${q.sharedMeta?.disciplina ?? "—"} | ${base}...`);
    } else {
      const item = q as ImportItem;
      const assunto = item.meta?.assunto || "—";
      const preview = item.latex.slice(0, 50).replace(/\n/g, " ");
      console.log(`  ${i + 1}. [${item.tipo}] gab=${item.gabarito ?? "—"} assunto=${assunto} | ${preview}...`);
    }
  }
}

main();
