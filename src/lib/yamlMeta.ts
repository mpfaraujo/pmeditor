import type {
  QuestionMetadataV1,
  QuestionType,
  Difficulty,
  AnswerKey,
} from "@/components/editor/QuestionMetaBar";

const VALID_TIPOS: QuestionType[] = [
  "Múltipla Escolha",
  "Certo/Errado",
  "Discursiva",
];
const VALID_DIFICULDADES: Difficulty[] = ["Fácil", "Média", "Difícil"];
const MCQ_LETTERS = ["A", "B", "C", "D", "E"] as const;
const TF_LETTERS = ["C", "E"] as const;

/** Extrai o bloco entre --- delimitadores */
function extractFrontmatter(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("---")) return null;

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) return null;

  return trimmed.slice(3, endIdx).trim();
}

/** Parseia valor entre colchetes [a, b, c] ou "a, b, c" como array */
function parseTags(raw: string): string[] {
  let s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    s = s.slice(1, -1);
  }
  return s
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Parseia gabarito string → AnswerKey */
function parseGabarito(
  raw: string,
  tipo?: QuestionType
): AnswerKey | undefined {
  const v = raw.trim().toUpperCase();

  if (!v || v === "VAZIO" || v === '""' || v === "''") {
    if (tipo === "Discursiva") return { kind: "essay" };
    return undefined;
  }

  if ((MCQ_LETTERS as readonly string[]).includes(v)) {
    return { kind: "mcq", correct: v as "A" | "B" | "C" | "D" | "E" };
  }

  if ((TF_LETTERS as readonly string[]).includes(v)) {
    return { kind: "tf", correct: v as "C" | "E" };
  }

  return undefined;
}

/**
 * Parseia frontmatter YAML simples (key: value) para metadados parciais.
 * Retorna null se o texto não contiver frontmatter válido.
 */
export function parseYamlMeta(
  text: string
): Partial<QuestionMetadataV1> | null {
  const block = extractFrontmatter(text);
  if (!block) return null;

  const result: Partial<QuestionMetadataV1> = {};
  const source: NonNullable<QuestionMetadataV1["source"]> = {};
  let hasSource = false;

  for (const line of block.split("\n")) {
    // Ignora comentários e linhas vazias
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim().toLowerCase();
    const val = stripped.slice(colonIdx + 1).trim();

    // Ignora valores vazios (exceto tags que pode ser [])
    if (!val && key !== "tags") continue;

    switch (key) {
      case "tipo": {
        const match = VALID_TIPOS.find(
          (t) => t.toLowerCase() === val.toLowerCase()
        );
        if (match) result.tipo = match;
        break;
      }
      case "dificuldade": {
        const match = VALID_DIFICULDADES.find(
          (d) => d.toLowerCase() === val.toLowerCase()
        );
        if (match) result.dificuldade = match;
        break;
      }
      case "disciplina":
        if (val && val !== '""' && val !== "''") result.disciplina = val;
        break;
      case "assunto":
        if (val && val !== '""' && val !== "''") result.assunto = val;
        break;
      case "gabarito": {
        const gab = parseGabarito(val, result.tipo);
        if (gab) result.gabarito = gab;
        break;
      }
      case "tags": {
        const tags = parseTags(val);
        if (tags.length) result.tags = tags;
        break;
      }
      case "fonte": {
        hasSource = true;
        if (val === "original" || val === "concurso") source.kind = val;
        break;
      }
      case "concurso":
        if (val && val !== '""') {
          hasSource = true;
          source.concurso = val;
        }
        break;
      case "banca":
        if (val && val !== '""') {
          hasSource = true;
          source.banca = val;
        }
        break;
      case "ano": {
        const n = parseInt(val, 10);
        if (!isNaN(n)) {
          hasSource = true;
          source.ano = n;
        }
        break;
      }
      case "cargo":
        if (val && val !== '""') {
          hasSource = true;
          source.cargo = val;
        }
        break;
      case "prova":
        if (val && val !== '""') {
          hasSource = true;
          source.prova = val;
        }
        break;
      case "numero":
        if (val && val !== '""') {
          hasSource = true;
          source.numero = val;
        }
        break;
    }
  }

  if (hasSource) result.source = source;

  // Retorna null se nada foi parseado
  const keys = Object.keys(result);
  if (keys.length === 0) return null;

  return result;
}

/**
 * Gera o template YAML modelo.
 */
export function generateYamlTemplate(defaults?: {
  disciplina?: string;
}): string {
  const disc = defaults?.disciplina
    ? `"${defaults.disciplina}"`
    : '""';

  return `---
tipo: Múltipla Escolha        # Múltipla Escolha | Certo/Errado | Discursiva
dificuldade: Média             # Fácil | Média | Difícil
disciplina: ${disc.padEnd(20)}# Ex: Matemática
assunto: ""                    # Ex: Álgebra Linear
gabarito: A                    # Letra: A-E ou C/E (deixe vazio se for discursiva)
tags: []                       # Ex: [ENEM, 2024, geometria]

# Fonte (opcional — preencher se for questão de concurso)
fonte: original                # original | concurso
concurso: ""
banca: ""
ano:
numero: ""
---`;
}
