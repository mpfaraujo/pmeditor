export const REVIEW_FLAGS = [
  "visual_reconstruction",
  "visual_formula",
  "visual_image",
  "ocr_missing_content",
  "ocr_boundary",
  "visual_failed",
] as const;

export type ReviewFlag = typeof REVIEW_FLAGS[number];
export type ReviewSeverity = "attention" | "error";

export type TranscriptionReviewHint = {
  numero: string;
  pagina: number;
  severity: ReviewSeverity;
  flags: ReviewFlag[];
  details: string[];
};

export type TranscriptionReviewReport = {
  schemaVersion: 1;
  transcriptionRun: string;
  generatedAt: string;
  questions: TranscriptionReviewHint[];
};

export type ImportedReviewHint = TranscriptionReviewHint & {
  questionId?: string;
  queueIndex: number;
};

const FLAG_SET = new Set<string>(REVIEW_FLAGS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseTranscriptionReviewReport(raw: unknown): TranscriptionReviewReport {
  if (!isRecord(raw) || raw.schemaVersion !== 1) throw new Error("review report: schemaVersion 1 obrigatório");
  if (typeof raw.transcriptionRun !== "string" || !raw.transcriptionRun.trim()) throw new Error("review report: transcriptionRun obrigatório");
  if (typeof raw.generatedAt !== "string" || Number.isNaN(Date.parse(raw.generatedAt))) throw new Error("review report: generatedAt inválido");
  if (!Array.isArray(raw.questions)) throw new Error("review report: questions deve ser uma lista");

  const questions = raw.questions.map((item, index): TranscriptionReviewHint => {
    if (!isRecord(item)) throw new Error(`review report: questions[${index}] inválido`);
    const numero = typeof item.numero === "string" ? item.numero.trim() : "";
    if (!numero) throw new Error(`review report: questions[${index}].numero obrigatório`);
    if (typeof item.pagina !== "number" || !Number.isInteger(item.pagina) || item.pagina < 1) throw new Error(`review report: questions[${index}].pagina inválida`);
    if (item.severity !== "attention" && item.severity !== "error") throw new Error(`review report: questions[${index}].severity inválida`);
    if (!Array.isArray(item.flags) || item.flags.length === 0 || item.flags.some((flag) => typeof flag !== "string" || !FLAG_SET.has(flag))) {
      throw new Error(`review report: questions[${index}].flags inválidas`);
    }
    if (!Array.isArray(item.details) || item.details.some((detail) => typeof detail !== "string")) throw new Error(`review report: questions[${index}].details inválidos`);
    return {
      numero,
      pagina: item.pagina,
      severity: item.severity,
      flags: [...new Set(item.flags)] as ReviewFlag[],
      details: item.details.map((detail) => detail.trim()).filter(Boolean),
    };
  });
  const numeros = new Set<string>();
  for (const hint of questions) {
    if (numeros.has(hint.numero)) throw new Error(`review report: número duplicado ${hint.numero}`);
    numeros.add(hint.numero);
  }
  return { schemaVersion: 1, transcriptionRun: raw.transcriptionRun, generatedAt: raw.generatedAt, questions };
}

function numeroDaEntrada(entry: any): string | null {
  if (entry?.isSet) return null;
  const numero = entry?.meta?.numero;
  if (typeof numero === "number" && Number.isFinite(numero)) return String(numero);
  if (typeof numero === "string" && numero.trim()) return numero.trim();
  return null;
}

export function associateReviewHints(queue: unknown[], report: TranscriptionReviewReport): Map<number, TranscriptionReviewHint> {
  const indicesPorNumero = new Map<string, number[]>();
  queue.forEach((entry, index) => {
    const numero = numeroDaEntrada(entry);
    if (!numero) return;
    const indices = indicesPorNumero.get(numero) ?? [];
    indices.push(index);
    indicesPorNumero.set(numero, indices);
  });
  const result = new Map<number, TranscriptionReviewHint>();
  for (const hint of report.questions) {
    if (hint.flags.includes("visual_failed")) throw new Error(`review report: questão ${hint.numero} tem visual_failed e não pode ser importada`);
    const indices = indicesPorNumero.get(hint.numero) ?? [];
    if (indices.length === 0) throw new Error(`review report: questão ${hint.numero} não encontrada na fila`);
    if (indices.length > 1) throw new Error(`review report: questão ${hint.numero} é ambígua na fila`);
    result.set(indices[0], hint);
  }
  return result;
}

