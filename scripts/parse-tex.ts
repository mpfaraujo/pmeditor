#!/usr/bin/env tsx
// scripts/parse-tex.ts
// Uso: pnpm tsx scripts/parse-tex.ts caminho/arquivo.tex
//
// Lê um .tex (pacote exam) e gera public/data/import-queue.json
// com cada questão separada, tipo detectado, gabarito extraído,
// e metadados YAML (se houver bloco \begin{verbatim}---...---\end{verbatim}).

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

type YamlMeta = {
  tipo?: string;
  dificuldade?: string;
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
};

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
  meta?: YamlMeta;
};

function sanitizeLatexForImport(latex: string): string {
  latex = latex.replace(/R\\\$/g, "R$");
  latex = latex.replace(/\\%/g, "%");
  latex = latex.replace(/\\_/g, "_");
  latex = latex.replace(/\\&/g, "&");
  return latex;
}

/** Parseia frontmatter YAML simples entre --- delimitadores */
function parseYamlBlock(block: string): YamlMeta {
  const result: YamlMeta = {};

  for (const line of block.split("\n")) {
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim().toLowerCase();
    const val = stripped.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

    if (!val && key !== "tags") continue;

    switch (key) {
      case "tipo": result.tipo = val; break;
      case "dificuldade": result.dificuldade = val; break;
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

  return result;
}

/** Extrai o bloco YAML de dentro de \begin{verbatim}---...---\end{verbatim} OU direto ---...--- */
function extractVerbatimYaml(text: string): { meta: YamlMeta | null; yamlText: string | null } {
  // Primeiro tenta pegar YAML direto (sem verbatim): ---...---
  // Usa regex global para pegar TODOS os blocos e depois pega o último
  const directRe = /---\s*\n([\s\S]*?)\n\s*---/g;
  let lastDirectMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(text))) {
    lastDirectMatch = m;
  }

  if (lastDirectMatch) {
    return {
      meta: parseYamlBlock(lastDirectMatch[1]),
      yamlText: lastDirectMatch[0].trim(), // Retorna o bloco completo com ---
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
    yamlText: `---\n${lastMatch[1]}\n---`, // Extrai só o YAML, sem o verbatim
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

  // Encontra todas as posições de \question no texto
  const questionRe = /\\question\b/g;
  const positions: number[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = questionRe.exec(src))) {
    positions.push(qm.index);
  }

  if (!positions.length) {
    console.error("Nenhuma \\question encontrada no arquivo.");
    process.exit(1);
  }

  const queue: ImportItem[] = [];

  for (let i = 0; i < positions.length; i++) {
    const qStart = positions[i];
    const qEnd = i + 1 < positions.length ? positions[i + 1] : src.length;

    // Texto antes deste \question (entre o \question anterior e este)
    const prevStart = i > 0 ? positions[i - 1] : 0;
    const textBefore = src.slice(prevStart, qStart);

    // Extrai YAML do verbatim que aparece antes deste \question
    const { meta } = extractVerbatimYaml(textBefore);

    // Texto da questão: do \question até o próximo \question (ou fim)
    // Remove o \begin{verbatim}...---...\end{verbatim} que pertence à PRÓXIMA questão
    let questionText = src.slice(qStart, qEnd);
    // Remove verbatim/yaml que esteja no final (pertence à próxima questão)
    questionText = questionText.replace(
      /\\begin\{verbatim\}\s*\n?\s*---[\s\S]*?---\s*\n?\s*\\end\{verbatim\}\s*$/,
      ""
    );
    // Remove YAML direto que esteja no final (pertence à próxima questão)
    // IMPORTANTE: Sem flag 'm' para casar com fim da STRING, não fim de linha
    questionText = questionText.replace(/\n\s*---\s*\n[\s\S]*?---\s*$/, "");
    // Remove \section* que possa estar no final (pertence à próxima questão)
    questionText = questionText.replace(/\\section\*?\{[^}]*\}\s*$/, "");
    questionText = questionText.trim();

    // Remove \question e parâmetro opcional [pontos]
    const chunk = questionText
      .replace(/^\\question\s*(\[[^\]]*\])?\s*/, "")
      .trim();
    if (!chunk) continue;

    const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(chunk);

    let tipo: ImportItem["tipo"];
    let gabarito: string | null = null;

    if (hasChoices) {
      tipo = "Múltipla Escolha";

      // Gabarito do \correctchoice
      const choicesMatch = chunk.match(
        /\\begin\{(?:choices|oneparchoices)\}([\s\S]*?)\\end\{(?:choices|oneparchoices)\}/
      );
      if (choicesMatch) {
        const body = choicesMatch[1];
        const re = /\\(CorrectChoice|correctchoice|choice)\b/g;
        let idx = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body))) {
          if (m[1] === "CorrectChoice" || m[1] === "correctchoice") {
            gabarito = String.fromCharCode("A".charCodeAt(0) + idx);
            break;
          }
          idx++;
        }
      }
    } else {
      tipo = "Discursiva";
    }

    // Gabarito do YAML tem prioridade se não veio do \correctchoice
    if (!gabarito && meta?.gabarito) {
      gabarito = meta.gabarito.toUpperCase();
    }

    // Tipo do YAML pode sobrescrever
    if (meta?.tipo) {
      const t = meta.tipo.toLowerCase();
      if (t.includes("múltipla") || t.includes("multipla")) tipo = "Múltipla Escolha";
      else if (t.includes("discursiva")) tipo = "Discursiva";
    }

    // Monta o LaTeX: apenas \question + conteúdo (sem YAML)
    // O YAML já foi extraído para item.meta, não precisa duplicar no latex
    let latex = "\\question " + chunk;
    latex = sanitizeLatexForImport(latex);

    queue.push({ latex, tipo, gabarito, ...(meta ? { meta } : {}) });
  }

  // Salva em public/data/import-queue.json
  const outPath = resolve(__dirname, "../public/data/import-queue.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(queue, null, 2), "utf-8");

  console.log(`✓ ${queue.length} questões extraídas → public/data/import-queue.json`);

  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    const assunto = q.meta?.assunto || "—";
    const preview = q.latex.slice(0, 50).replace(/\n/g, " ");
    console.log(
      `  ${i + 1}. [${q.tipo}] gab=${q.gabarito ?? "—"} assunto=${assunto} | ${preview}...`
    );
  }
}

main();
