#!/usr/bin/env tsx
// scripts/parse-tex.ts
// Uso: pnpm tsx scripts/parse-tex.ts caminho/arquivo.tex
//
// Lê um .tex (pacote exam) e gera src/data/import-queue.json
// com cada questão separada, tipo detectado e gabarito extraído.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
};

function sanitizeLatexForImport(latex: string): string {
  // R\$ → R$ (escapes de moeda fora de math travam parsers/regex do smartPaste)
  // No arquivo .tex, "R\$" são 3 chars: R, \, $
  // Na regex JS, \\ matcha \ literal, \$ matcha $ literal
  latex = latex.replace(/R\\\$/g, "R$");
  // \% → % , \_ → _ , \& → & (escapes comuns em texto fora de math)
  latex = latex.replace(/\\%/g, "%");
  latex = latex.replace(/\\_/g, "_");
  latex = latex.replace(/\\&/g, "&");
  return latex;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Uso: pnpm tsx scripts/parse-tex.ts <arquivo.tex>");
    process.exit(1);
  }

  const filePath = resolve(args[0]);
  const src = readFileSync(filePath, "utf-8");

  // Separa por \question — cada ocorrência inicia uma nova questão
  const chunks = src.split(/\\question\b/).slice(1); // ignora tudo antes do primeiro \question

  if (!chunks.length) {
    console.error("Nenhuma \\question encontrada no arquivo.");
    process.exit(1);
  }

  const queue: ImportItem[] = [];

  for (const raw of chunks) {
    // Remove parâmetro opcional [pontos] logo após \question
    const chunk = raw.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
    if (!chunk) continue;

    const hasChoices = /\\begin\{(choices|oneparchoices)\}/.test(chunk);
    const hasParts = /\\begin\{parts\}/.test(chunk);

    let tipo: ImportItem["tipo"];
    let gabarito: string | null = null;

    if (hasChoices) {
      tipo = "Múltipla Escolha";

      // Conta posição do \correctchoice pra determinar a letra
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

    // Reconstrói o LaTeX da questão com \question na frente
    // (necessário pro parseQuestionFromLatexText funcionar)
    let latex = "\\question " + chunk;
    latex = sanitizeLatexForImport(latex);

    queue.push({ latex, tipo, gabarito });
  }

  // Salva em public/data/import-queue.json (acessível via fetch estático)
  const outPath = resolve(__dirname, "../public/data/import-queue.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(queue, null, 2), "utf-8");

  console.log(`✓ ${queue.length} questões extraídas → public/data/import-queue.json`);

  // Resumo
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    const preview = q.latex.slice(0, 60).replace(/\n/g, " ");
    console.log(
      `  ${i + 1}. [${q.tipo}] gab=${q.gabarito ?? "—"} | ${preview}...`
    );
  }
}

main();
