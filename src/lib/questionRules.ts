// src/lib/questionRules.ts

export type QuestionType = "Múltipla Escolha" | "Certo/Errado" | "Discursiva";

/**
 * O mesmo question_set pode operar em dois modos:
 * - "group": texto-base + N questões numeradas
 * - "essay": discursiva multipartes (1 número + subitens a), b), c) ...)
 */
export type QuestionSetMode = "group" | "essay";

export interface QuestionSetConstraints {
  mode: QuestionSetMode;
  minItems: number;
}

export function getQuestionSetConstraints(tipo: QuestionType): QuestionSetConstraints {
  if (tipo === "Discursiva") return { mode: "essay", minItems: 1 };
  return { mode: "group", minItems: 2 };
}

/**
 * Regra de render:
 * - group com 1 item: renderizar como questão normal (base_text + statement), sem banner.
 * - essay: nunca “vira questão normal”; é sempre 1 número + partes (mesmo com 1 parte).
 */
export function shouldRenderGroupSetAsSingleQuestion(itemsCount: number): boolean {
  return itemsCount === 1;
}

export function canRemoveQuestionItem(tipo: QuestionType, currentItemsCount: number): boolean {
  const { minItems } = getQuestionSetConstraints(tipo);
  return currentItemsCount > minItems;
}

export function shouldShowEssayPartLabels(itemsCount: number): boolean {
  return itemsCount > 1;
}

/**
 * a), b), c) ... (até z)
 * Depois disso: aa), ab)...
 */
export function essayPartLabel(indexZeroBased: number): string {
  const n = indexZeroBased + 1;
  return `${toExcelLetters(n).toLowerCase()})`;
}

function toExcelLetters(n: number): string {
  let x = n;
  let s = "";
  while (x > 0) {
    x -= 1;
    const r = x % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor(x / 26);
  }
  return s;
}

export function groupBaseTextTitle(itemsCount: number): string {
  // só deve ser usado quando itemsCount >= 2
  return `Use o texto a seguir para responder às próximas ${itemsCount} questões.`;
}
