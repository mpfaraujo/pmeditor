// src/lib/importQueue/imagensRevisao.ts
// Na fila, imagem é placeholder [[IMG_PENDENTE: C:/...]] (saída do parse-tex) ou nó image
// com src local (saída da revisão). Na tela /dev/revisar viram nó image servido pela rota dev;
// ao salvar, o src volta a ser o caminho local. O bulk-import sobe os dois formatos.

export const DEV_IMG_PREFIX = "/api/dev/arquivo?path=";
const PLACEHOLDER_RE = /\[\[IMG_PENDENTE(?::\s*([^\]]+))?\]\]/g;

function isLocalPath(s: string): boolean {
  return /^([A-Za-z]:[/\\]|\/)/.test(s) && !s.startsWith(DEV_IMG_PREFIX);
}

export function coletarCaminhosLocais(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (node.type === "text" && typeof node.text === "string") {
    for (const m of node.text.matchAll(PLACEHOLDER_RE)) {
      const p = String(m[1] ?? "").trim();
      if (p && !out.includes(p)) out.push(p);
    }
  }
  if (node.type === "image" && typeof node.attrs?.src === "string" && isLocalPath(node.attrs.src)) {
    if (!out.includes(node.attrs.src)) out.push(node.attrs.src);
  }
  if (Array.isArray(node.content)) for (const c of node.content) coletarCaminhosLocais(c, out);
  return out;
}

function imagemDev(path: string, larguras: Map<string, number>, attrs?: any) {
  return {
    type: "image",
    attrs: {
      id: attrs?.id ?? crypto.randomUUID(),
      src: DEV_IMG_PREFIX + encodeURIComponent(path),
      width: attrs?.width ?? larguras.get(path) ?? null,
      align: attrs?.align ?? null,
    },
  };
}

function dividirTexto(node: any, larguras: Map<string, number>): any[] {
  const out: any[] = [];
  let last = 0;
  for (const m of node.text.matchAll(PLACEHOLDER_RE)) {
    const p = String(m[1] ?? "").trim();
    if (!p) continue;
    const idx = m.index!;
    if (idx > last) out.push({ ...node, text: node.text.slice(last, idx) });
    out.push(imagemDev(p, larguras));
    last = idx + m[0].length;
  }
  if (out.length === 0) return [node];
  if (last < node.text.length) out.push({ ...node, text: node.text.slice(last) });
  return out;
}

/** Fila → editor: placeholders e src locais viram src da rota dev. */
export function paraRevisao(node: any, larguras: Map<string, number>): any {
  if (!node || typeof node !== "object") return node;
  if (node.type === "image" && typeof node.attrs?.src === "string" && isLocalPath(node.attrs.src)) {
    return imagemDev(node.attrs.src, larguras, node.attrs);
  }
  if (!Array.isArray(node.content)) return node;
  const content: any[] = [];
  for (const c of node.content) {
    if (c?.type === "text" && typeof c.text === "string" && c.text.includes("[[IMG_PENDENTE")) content.push(...dividirTexto(c, larguras));
    else content.push(paraRevisao(c, larguras));
  }
  return { ...node, content };
}

/** Editor → fila: src da rota dev volta a ser caminho local. */
export function deRevisao(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src.startsWith(DEV_IMG_PREFIX)) {
    return { ...node, attrs: { ...node.attrs, src: decodeURIComponent(node.attrs.src.slice(DEV_IMG_PREFIX.length)) } };
  }
  if (!Array.isArray(node.content)) return node;
  return { ...node, content: node.content.map(deRevisao) };
}
