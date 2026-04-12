export type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

export function safeParseQuestionDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object") return null;
    if (doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
}

export function questionDocHasBaseText(node: PMNode | null): boolean {
  if (!node) return false;
  if (node.type === "base_text") return true;
  return (node.content ?? []).some((child) => questionDocHasBaseText(child));
}

export function wrapNodesAsQuestionDoc(nodes: PMNode[]): PMNode {
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

export function buildExternalBaseTextPreviewDoc(baseTextContent: PMNode | null): PMNode | null {
  if (!baseTextContent) return null;
  return wrapNodesAsQuestionDoc([
    {
      type: "base_text",
      content: baseTextContent.content ?? [],
    },
  ]);
}
