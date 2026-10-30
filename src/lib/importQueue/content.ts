// src/lib/importQueue/content.ts
// Conversão LaTeX → ProseMirror JSON da fila de importação.
// Movido de scripts/bulk-import.ts para ser compartilhado por parse-tex, bulk-import
// e /dev/revisar. Mudar aqui muda o que vai pro banco.

import { schema } from "../../components/editor/schema";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
} from "../../components/editor/plugins/smartPastePlugin";
import { normalizeAssunto } from "../../data/assuntos";
import {
  isBaseTextEntry,
  isSetEntry,
  type QueueEntry,
  type QueueImportItem,
  type QueueSetItem,
} from "./types";

function makeTextDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export function parseRespostaToDoc(text: string): any {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const stmt = questionNode.firstChild;
      if (stmt && stmt.type === schema.nodes.statement) {
        const doc = schema.nodes.doc.create(null, stmt.content);
        return doc.toJSON();
      }
    }
  } catch {}
  return makeTextDoc(text);
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
  return schema.nodes.statement.create(null, [schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : [])]);
}

function parseToItemNodes(text: string): any[] {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      const nodes: any[] = [];
      (questionNode.content ?? []).forEach((n: any) => { if (n.type === schema.nodes.statement || n.type === schema.nodes.options) nodes.push(n); });
      if (nodes.length > 0) return nodes;
    }
  } catch {}
  return [schema.nodes.statement.create(null, [schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : [])])];
}

/** doc JSON de questão individual (antes em buildInitial). */
export function buildItemContent(item: { latex: string; embeddedBaseLatex?: string }): any {
  const fallbackContent = { type: "doc", content: [{ type: "question", attrs: { tipo: null }, content: [{ type: "statement", content: [{ type: "paragraph", content: [{ type: "text", text: item.latex }] }] }] }] };
  try {
    const parsed = parseQuestionFromLatexText(item.latex);
    if (!parsed) return fallbackContent;
    const node = buildQuestionNodeLatex(schema, parsed);
    // Modalidade B-MCQ: prepende nó base_text embutido como filho da question.
    if (item.embeddedBaseLatex) {
      const stmtNode = parseToStatementNode(item.embeddedBaseLatex);
      const baseTextNode = schema.nodes.base_text.create(null, stmtNode.content);
      const newQuestion = schema.nodes.question.create(node.attrs, [baseTextNode, ...(node.content as any)?.content ?? []]);
      return { type: "doc", content: [newQuestion.toJSON()] };
    }
    return { type: "doc", content: [node.toJSON()] };
  } catch {
    return fallbackContent;
  }
}

/** doc JSON de set_questions (antes em buildInitialSet). */
export function buildSetContent(item: Pick<QueueSetItem, "items">, embeddedBaseLatexes?: string[]): any {
  const questionItemNodes = item.items.map((it) => {
    const answerKey = it.gabarito && it.tipo === "Múltipla Escolha" ? { kind: "mcq", correct: it.gabarito } : it.meta?.resposta?.trim() ? { kind: "essay", rubric: parseRespostaToDoc(it.meta.resposta.trim()) } : { kind: "essay" };
    const itemNodes = parseToItemNodes(it.latex);
    const itemAssunto = normalizeAssunto(it.meta?.assunto ?? "") || null;
    return schema.nodes.question_item.create({ answerKey, assunto: itemAssunto, tags: it.meta?.tags ?? null }, itemNodes);
  });
  const hasChoices = item.items.some(it => it.tipo === "Múltipla Escolha");
  const embeddedBaseNodes = (embeddedBaseLatexes ?? []).map(latex => { const stmtNode = parseToStatementNode(latex); return schema.nodes.base_text.create(null, stmtNode.content); });
  const setNode = schema.nodes.set_questions.create({ mode: hasChoices ? "set" : null }, [...embeddedBaseNodes, ...questionItemNodes]);
  return schema.nodes.doc.create(null, [setNode]).toJSON();
}

/** base_text node JSON (antes buildBaseTextDoc). */
export function buildBaseTextContent(baseLatex: string): any {
  const stmtNode = parseToStatementNode(baseLatex);
  return schema.nodes.base_text.create(null, stmtNode.content).toJSON();
}

/**
 * Devolve cópia da fila com `content` em cada entrada conversível.
 * Não preenche o formato legado: questão com titulo_texto sem bloco \basetext
 * correspondente (o bulk-import ainda separa o texto base do corpo por heurística).
 */
export function attachQueueContent<T extends QueueEntry>(queue: T[]): T[] {
  const titulosBaseText = new Set(
    (queue as QueueEntry[]).filter(isBaseTextEntry).map(e => e.meta?.titulo_texto).filter((t): t is string => !!t)
  );
  return queue.map((entry) => {
    if (isBaseTextEntry(entry)) return { ...entry, content: buildBaseTextContent(entry.latex) };
    if (isSetEntry(entry)) {
      const bases = entry.baseLatexes?.length ? entry.baseLatexes : entry.baseLatex ? [entry.baseLatex] : [];
      const embutidos = entry.sharedMeta?.titulo_texto ? [] : bases;
      return { ...entry, content: buildSetContent(entry, embutidos) };
    }
    const titulo = (entry as QueueImportItem).meta?.titulo_texto;
    if (titulo && !titulosBaseText.has(titulo)) return entry;
    return { ...entry, content: buildItemContent(entry as QueueImportItem) };
  });
}
