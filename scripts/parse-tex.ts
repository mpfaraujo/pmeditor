#!/usr/bin/env tsx
// scripts/parse-tex.ts
// Uso: pnpm tsx scripts/parse-tex.ts caminho/arquivo.tex
//
// Lê um .tex (pacote exam) e gera public/data/import-queue.json
// com cada questão separada, tipo detectado, gabarito extraído,
// e metadados YAML (se houver bloco ---...--- antes de cada \question).
//
// Suporte a set_questions: use \setquestion para o texto-base e
// \questionitem para cada sub-item. O YAML pode ter campos por item:
//   assunto1, tags1, gabarito1, assunto2, tags2, gabarito2, ...

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

type YamlMeta = {
  tipo?: string;
  dificuldade?: string;
  nivel?: string;
  disciplina?: string;
  assunto?: string;
  gabarito?: string;
  tags?: string[];
  fonte?: string;
  concurso?: string;
  banca?: string;
  ano?: number;
  numero?: string;
  cargo?: string;
  prova?: string;
  // Por item (set_questions)
  items?: Array<{
    assunto?: string;
    tags?: string[];
    gabarito?: string;
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
  baseLatex: string;
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito">;
  }>;
  sharedMeta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem;

/** Parseia frontmatter YAML simples entre --- delimitadores */
function parseYamlBlock(block: string): YamlMeta {
  const result: YamlMeta = {};
  const itemsMap: Map<number, { assunto?: string; tags?: string[]; gabarito?: string }> = new Map();

  for (const line of block.split("\n")) {
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim().toLowerCase();
    const val = stripped.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

    if (!val && key !== "tags" && !key.startsWith("tags")) continue;

    // Campos por item: assunto1, tags1, gabarito1, assunto2, ...
    const itemMatch = key.match(/^(assunto|tags|gabarito)(\d+)$/);
    if (itemMatch) {
      const field = itemMatch[1] as "assunto" | "tags" | "gabarito";
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

/** Processa um bloco de \setquestion...\questionitem...\questionitem... */
function parseSetBlock(chunk: string, meta: YamlMeta | null): ImportSetItem {
  // Separa base text dos items
  const itemSplitRe = /\\questionitem\b/g;
  const splits: number[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = itemSplitRe.exec(chunk))) {
    splits.push(sm.index);
  }

  const baseLatex = chunk.slice(0, splits.length > 0 ? splits[0] : chunk.length).trim();

  const itemChunks: string[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i] + "\\questionitem".length;
    const end = i + 1 < splits.length ? splits[i + 1] : chunk.length;
    itemChunks.push(chunk.slice(start, end).trim());
  }

  const sharedTipo = meta?.tipo?.toLowerCase();
  const defaultTipo: "Múltipla Escolha" | "Discursiva" =
    sharedTipo?.includes("múltipla") || sharedTipo?.includes("multipla")
      ? "Múltipla Escolha"
      : "Discursiva";

  const items = itemChunks.map((itemChunk, idx) => {
    const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(itemChunk);
    const tipo: "Múltipla Escolha" | "Discursiva" = hasChoices ? "Múltipla Escolha" : defaultTipo;
    const gabarito = hasChoices
      ? extractGabaritoFromChoices(itemChunk)
      : (meta?.items?.[idx]?.gabarito?.toUpperCase() ?? null);

    const itemMeta = meta?.items?.[idx];
    return {
      latex: itemChunk,
      tipo,
      gabarito,
      ...(itemMeta ? { meta: itemMeta } : {}),
    };
  });

  return {
    isSet: true,
    baseLatex,
    items,
    ...(meta ? { sharedMeta: meta } : {}),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Uso: pnpm tsx scripts/parse-tex.ts <arquivo.tex>");
    process.exit(1);
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
    blockText = blockText.replace(/\n\s*---\s*\n[\s\S]*?---\s*$/, "");
    blockText = blockText.replace(/\\section\*?\{[^}]*\}\s*$/, "");
    blockText = blockText.trim();

    if (isSet) {
      // Remove o marcador \setquestion
      const chunk = blockText.replace(/^\\setquestion\b\s*(\[[^\]]*\])?\s*/, "").trim();
      if (!chunk) continue;
      queue.push(parseSetBlock(chunk, meta));
    } else {
      // Questão individual — lógica original
      const chunk = blockText.replace(/^\\question\b\s*(\[[^\]]*\])?\s*/, "").trim();
      if (!chunk) continue;

      const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(chunk);
      let tipo: ImportItem["tipo"];
      let gabarito: string | null = null;

      if (hasChoices) {
        tipo = "Múltipla Escolha";
        gabarito = extractGabaritoFromChoices(chunk);
      } else {
        tipo = "Discursiva";
      }

      if (!gabarito && meta?.gabarito) {
        gabarito = meta.gabarito.toUpperCase();
      }

      if (meta?.tipo) {
        const t = meta.tipo.toLowerCase();
        if (t.includes("múltipla") || t.includes("multipla")) tipo = "Múltipla Escolha";
        else if (t.includes("discursiva")) tipo = "Discursiva";
      }

      const latex = "\\question " + chunk;
      queue.push({ latex, tipo, gabarito, ...(meta ? { meta } : {}) });
    }
  }

  // Salva em public/data/import-queue.json
  const outPath = resolve(__dirname, "../public/data/import-queue.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(queue, null, 2), "utf-8");

  const total = queue.length;
  const sets = queue.filter((q) => "isSet" in q).length;
  const individual = total - sets;
  console.log(`✓ ${total} entradas extraídas (${individual} individual, ${sets} set) → public/data/import-queue.json`);

  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    if ("isSet" in q && q.isSet) {
      const base = q.baseLatex.slice(0, 50).replace(/\n/g, " ");
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
