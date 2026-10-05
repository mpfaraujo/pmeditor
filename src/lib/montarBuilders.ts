// Funções puras compartilhadas entre /montar e /diagramar.

export const PAGE_HEIGHT = 1183;
export const SAFETY_PX = 100;

export type Alt = "A" | "B" | "C" | "D" | "E";

export function parseAlt(x: unknown): Alt | null {
  const s = (x ?? "").toString().trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D" || s === "E") return s;
  return null;
}

export function extractAltFromMetadata(meta: any): Alt | null {
  if (!meta) return null;

  const g = meta.gabarito;

  if (g && typeof g === "object") {
    const kind = (g.kind ?? "").toString();
    if (kind === "mcq") return parseAlt(g.correct);
    if (kind === "tf") return parseAlt(g.correct);
    if (kind === "essay") return null;
  }

  const direct = parseAlt(g);
  if (direct) return direct;

  const nested = parseAlt(g?.letra ?? g?.answer ?? g?.value ?? g?.correct);
  if (nested) return nested;

  return null;
}

export function extractEssayRubric(meta: any): any | null {
  if (!meta) return null;
  const g = meta.gabarito;
  if (!g || typeof g !== "object") return null;
  if (g.kind !== "essay") return null;
  if (!g.rubric || typeof g.rubric !== "object" || g.rubric.type !== "doc") return null;
  return g.rubric;
}

/** Extrai rubrics dos question_items dentro do conteúdo de um set_questions */
export function extractItemRubrics(content: any): any[] {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || doc.type !== "doc") return [];
    const setNode = doc.content?.find((n: any) => n?.type === "set_questions");
    if (!setNode) return [];
    const items: any[] = [];
    for (const child of (setNode.content ?? [])) {
      if (child.type === "question_item") items.push(child);
      else if (child.type === "question_group")
        (child.content ?? []).forEach((qi: any) => { if (qi.type === "question_item") items.push(qi); });
    }
    const rubrics: any[] = [];
    for (const item of items) {
      const ak = item.attrs?.answerKey;
      if (ak && ak.kind === "essay" && ak.rubric && typeof ak.rubric === "object" && ak.rubric.type === "doc") {
        rubrics.push(ak.rubric);
      }
    }
    return rubrics;
  } catch {
    return [];
  }
}

export type PMNode = {
  type: string;
  attrs?: any;
  content?: PMNode[];
  text?: string;
  marks?: any[];
};

export function safeParseDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object") return null;
    if (doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
}

export function findSetNode(doc: PMNode | null): PMNode | null {
  return doc?.content?.find((n) => n?.type === "set_questions") ?? null;
}

export function splitSetNode(setNode: PMNode | null): {
  baseText: PMNode | null;
  items: PMNode[];
  groups: PMNode[] | null;
} {
  const content = setNode?.content ?? [];
  const baseText = content.find((n) => n?.type === "base_text") ?? null;
  const hasGroups = content.some((n) => n?.type === "question_group");
  const items: PMNode[] = [];
  const groups: PMNode[] = [];
  for (const child of content) {
    if (child.type === "question_item") items.push(child);
    else if (child.type === "question_group") {
      groups.push(child);
      (child.content ?? []).forEach((qi: PMNode) => { if (qi.type === "question_item") items.push(qi); });
    }
  }
  return { baseText, items, groups: hasGroups ? groups : null };
}

export function wrapAsQuestionDoc(nodes: PMNode[]): PMNode {
  return {
    type: "doc",
    content: [
      {
        type: "question",
        content: nodes,
      },
    ],
  };
}

export function buildBaseDoc(baseText: PMNode | null): PMNode | null {
  if (!baseText) return null;
  return wrapAsQuestionDoc([baseText]);
}

export function stripBaseTextFromQuestionDoc(content: any): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "question") return n;
      return {
        ...n,
        content: (n.content ?? []).filter((child) => child?.type !== "base_text"),
      };
    }),
  };
}

export function buildCombinedBaseTextNode(
  ids: string[],
  cache: Map<string, PMNode>
): PMNode | null {
  const combinedContent: PMNode[] = [];
  for (const id of ids) {
    const bt = cache.get(id);
    if (!bt) return null;
    const btContent = (bt as any).content ?? bt;
    const nodes: PMNode[] = Array.isArray(btContent.content) ? btContent.content : [];
    combinedContent.push(...nodes);
  }
  if (combinedContent.length === 0) return null;
  return { type: "base_text", content: combinedContent };
}

export type BaseTextSection = {
  id: string;
  tag: string;
  blockCount: number;
};

export function buildBaseTextSections(
  ids: string[],
  cache: Map<string, PMNode>
): BaseTextSection[] {
  return ids.flatMap((id) => {
    const bt = cache.get(id);
    if (!bt) return [];
    const btContent = (bt as any).content ?? bt;
    const nodes: PMNode[] = Array.isArray(btContent.content) ? btContent.content : [];
    const tag = (bt as any).tag;
    if (!tag || nodes.length === 0) return [];
    return [{ id, tag, blockCount: nodes.length }];
  });
}

export function injectBaseTextIntoSetDoc(content: any, baseTextNode: PMNode): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "set_questions") return n;
      const withoutBase = (n.content ?? []).filter((child) => child?.type !== "base_text");
      return { ...n, content: [baseTextNode, ...withoutBase] };
    }),
  };
}

export function stripBaseTextFromSetDoc(content: any): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "set_questions") return n;
      return { ...n, content: (n.content ?? []).filter((child) => child?.type !== "base_text") };
    }),
  };
}


export function buildItemDoc(item: PMNode | null): PMNode | null {
  if (!item) return null;

  const nodes: PMNode[] = [];
  (item.content ?? []).forEach((n) => {
    if (n.type === "statement" || n.type === "options") nodes.push(n);
  });

  if (nodes.length === 0) return null;
  return wrapAsQuestionDoc(nodes);
}
