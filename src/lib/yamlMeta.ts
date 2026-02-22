import type {
  QuestionMetadataV1,
  QuestionType,
  Difficulty,
  AnswerKey,
} from "@/components/editor/QuestionMetaBar";
import { normalizeAssunto } from "@/data/assuntos";

/** Mapa de nomes aceitos no YAML → QuestionType interno */
const TIPO_MAP: Record<string, QuestionType> = {
  "múltipla escolha": "Múltipla Escolha",
  "v/f": "Certo/Errado",
  "vf": "Certo/Errado",
  "verdadeiro/falso": "Certo/Errado",
  "certo/errado": "Certo/Errado",
  "discursiva": "Discursiva",
};
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

  // V/F → C/E
  if (v === "V") return { kind: "tf", correct: "C" };
  if (v === "F") return { kind: "tf", correct: "E" };

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
        const match = TIPO_MAP[val.toLowerCase()];
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
      case "disciplina": {
        const d = val.replace(/^["']|["']$/g, "").trim();
        if (d) result.disciplina = d;
        break;
      }
      case "assunto": {
        const a = val.replace(/^["']|["']$/g, "").trim();
        if (a) result.assunto = normalizeAssunto(a) || a;
        break;
      }
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
      case "concurso": {
        const c = val.replace(/^["']|["']$/g, "").trim();
        if (c) {
          hasSource = true;
          source.concurso = c;
        }
        break;
      }
      case "banca": {
        const b = val.replace(/^["']|["']$/g, "").trim();
        if (b) {
          hasSource = true;
          source.banca = b;
        }
        break;
      }
      case "ano": {
        const n = parseInt(val, 10);
        if (!isNaN(n)) {
          hasSource = true;
          source.ano = n;
        }
        break;
      }
      case "cargo": {
        const cg = val.replace(/^["']|["']$/g, "").trim();
        if (cg) {
          hasSource = true;
          source.cargo = cg;
        }
        break;
      }
      case "prova": {
        const p = val.replace(/^["']|["']$/g, "").trim();
        if (p) {
          hasSource = true;
          source.prova = p;
        }
        break;
      }
      case "numero": {
        const num = val.replace(/^["']|["']$/g, "").trim();
        if (num) {
          hasSource = true;
          source.numero = num;
        }
        break;
      }
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
  const disc = defaults?.disciplina ?? "";

  return `---
tipo: Múltipla Escolha        # Múltipla Escolha | V/F | Discursiva
dificuldade: Média             # Fácil | Média | Difícil
disciplina: ${disc.padEnd(22)}# Ex: Matemática
assunto:                       # Ex: Álgebra Linear
gabarito: A                    # Letra: A-E ou V/F (deixe vazio se for discursiva)
tags: []                       # Ex: [ENEM, 2024, geometria]

# Fonte (opcional — preencher se for questão de concurso)
fonte: original                # original | concurso
concurso:
banca:
ano:
numero:
---`;
}
