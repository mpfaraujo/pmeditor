import { Node as PMNode, Schema } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

function splitInlineTextIntoVerses(
  state: EditorState,
  schema: Schema,
  from: number,
  to: number
): PMNode[] {
  const verseType = schema.nodes.verse;
  if (!verseType) return [];

  const verses: PMNode[] = [];
  let currentLine: PMNode[] = [];
  let sawInlineContent = false;

  const flushLine = () => {
    verses.push(verseType.create(null, currentLine.length > 0 ? currentLine : undefined));
    currentLine = [];
  };

  state.doc.slice(from, to).content.forEach((child) => {
    if (child.isText) {
      sawInlineContent = true;
      const chunks = (child.text ?? "").split("\n");
      chunks.forEach((chunk, index) => {
        if (chunk) currentLine.push(schema.text(chunk, child.marks));
        if (index < chunks.length - 1) flushLine();
      });
      return;
    }

    if (child.isInline) {
      sawInlineContent = true;
      currentLine.push(child);
    }
  });

  if (currentLine.length > 0 || (sawInlineContent && verses.length === 0)) flushLine();

  return verses;
}

export function buildPoemFromSelection(state: EditorState, schema: Schema): PMNode | null {
  if (state.selection.empty) return null;

  const poemType = schema.nodes.poem;
  const verseType = schema.nodes.verse;
  if (!poemType || !verseType) return null;

  const verses: PMNode[] = [];

  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (!node.isTextblock) return true;

    const contentStart = pos + 1;
    const contentEnd = pos + node.content.size;
    const from = Math.max(state.selection.from, contentStart);
    const to = Math.min(state.selection.to, contentEnd);

    if (from > to) return false;

    const blockVerses = splitInlineTextIntoVerses(state, schema, from, to);
    if (blockVerses.length > 0) verses.push(...blockVerses);
    else verses.push(verseType.create());

    return false;
  });

  if (verses.length === 0) return null;
  return poemType.create(null, verses);
}
