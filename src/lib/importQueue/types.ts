// src/lib/importQueue/types.ts
// Tipos da fila gerada por scripts/parse-tex.ts e consumida por scripts/bulk-import.ts
// e pela tela /dev/revisar. `content` é o ProseMirror JSON pronto para o banco.

export type QueueMeta = {
  tipo?: string;
  disciplina?: string;
  assunto?: string;
  numero?: string;
  titulo_texto?: string;
  resposta?: string;
  tags?: string[];
  [k: string]: unknown;
};

export type QueueItemMeta = {
  assunto?: string;
  tags?: string[];
  gabarito?: string;
  resposta?: string;
  numero?: string;
};

export type QueueImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
  meta?: QueueMeta;
  embeddedBaseLatex?: string;
  /** doc JSON (doc > question). Ausente no formato legado. */
  content?: any;
};

export type QueueSetItem = {
  isSet: true;
  baseLatex?: string;
  baseLatexes?: string[];
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: QueueItemMeta;
  }>;
  sharedMeta?: QueueMeta;
  /** doc JSON (doc > set_questions). */
  content?: any;
};

export type QueueBaseTextItem = {
  isBaseText: true;
  latex: string;
  meta?: QueueMeta;
  /** base_text node JSON. */
  content?: any;
};

export type QueueEntry = QueueImportItem | QueueSetItem | QueueBaseTextItem;

export function isBaseTextEntry(e: QueueEntry): e is QueueBaseTextItem {
  return "isBaseText" in e && e.isBaseText === true;
}

export function isSetEntry(e: QueueEntry): e is QueueSetItem {
  return "isSet" in e && e.isSet === true;
}
