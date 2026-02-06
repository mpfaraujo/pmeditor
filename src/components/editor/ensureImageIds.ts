import { Node as PMNode, Schema, Fragment } from "prosemirror-model";

function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ensureImageIds(doc: PMNode, schema: Schema): PMNode {
  const imageType = schema.nodes.image;
  if (!imageType) return doc;

  let changed = false;

  function mapNode(node: PMNode): PMNode {
    if (node.type === imageType) {
      const id = node.attrs?.id ?? null;
      if (!id) {
        changed = true;
        return imageType.create(
          { ...node.attrs, id: newUuid() },
          null,
          node.marks
        );
      }
      return node;
    }

    if (node.childCount === 0) return node;

    const children: PMNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
      children.push(mapNode(node.child(i)));
    }

    // só reconstrói se algo mudou em algum ponto do documento
    return changed ? node.type.create(node.attrs, Fragment.fromArray(children), node.marks) : node;
  }

  const next = mapNode(doc);
  return changed ? next : doc;
}