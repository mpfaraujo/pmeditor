// src/lib/importQueue/fila.ts
// Operações da tela /dev/revisar sobre a fila de importação.
import { isBaseTextEntry, isSetEntry, type QueueEntry } from "./types";

export type ChaveRecorte = { numero: number; ocorrencia: number };

function numerosDaEntrada(e: QueueEntry): number[] {
  if (isBaseTextEntry(e)) return [];
  const brutos = isSetEntry(e) ? e.items.map(it => it.meta?.numero) : [e.meta?.numero];
  return brutos
    .map(n => parseInt(String(n ?? ""), 10))
    .filter(n => Number.isFinite(n));
}

/** Para cada entrada, as chaves (numero, ocorrência na ordem da fila) dos recortes do PDF. */
export function chavesRecorte(fila: QueueEntry[]): ChaveRecorte[][] {
  const vistos = new Map<number, number>();
  return fila.map(e =>
    numerosDaEntrada(e).map(numero => {
      const ocorrencia = (vistos.get(numero) ?? 0) + 1;
      vistos.set(numero, ocorrencia);
      return { numero, ocorrencia };
    })
  );
}

export function rotuloEntrada(e: QueueEntry): string {
  if (isBaseTextEntry(e)) return `Texto base: ${e.meta?.titulo_texto ?? "sem título"}`;
  const nums = numerosDaEntrada(e);
  if (isSetEntry(e)) return nums.length ? `Q${nums[0]}–${nums[nums.length - 1]} (set)` : "Set";
  return nums.length ? `Q${nums[0]}` : "Questão sem número";
}

/**
 * Vínculo de uma questão com texto base, pelo titulo_texto (é assim que o bulk-import vincula).
 * `indice` = entrada \basetext da fila com o mesmo título, ou null se não houver (formato legado).
 */
export function vinculoTextoBase(fila: QueueEntry[], index: number): { titulo: string; indice: number | null } | null {
  const e = fila[index];
  if (!e || isBaseTextEntry(e)) return null;
  const titulo = isSetEntry(e) ? e.sharedMeta?.titulo_texto : e.meta?.titulo_texto;
  if (!titulo) return null;
  const indice = fila.findIndex(x => isBaseTextEntry(x) && x.meta?.titulo_texto === titulo);
  return { titulo, indice: indice === -1 ? null : indice };
}

/** Só letras/dígitos, sem acento e minúsculo — o texto do PDF vem com quebras e hifenização. */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function paragrafos(node: any, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (node.type === "paragraph") {
    const texto = (node.content ?? []).map((c: any) => (c.type === "text" ? c.text : "")).join("");
    out.push(texto.replace(/\[\[IMG_PENDENTE[^\]]*\]\]/g, ""));
    return out;
  }
  if (Array.isArray(node.content)) for (const c of node.content) paragrafos(c, out);
  return out;
}

/**
 * Página (1-based) do PDF onde está o texto (texto base sem número de questão).
 * Usa o primeiro parágrafo longo — títulos curtos se repetem em cabeçalhos.
 */
export function paginaDoTexto(content: any, textoPaginas: string[]): number | null {
  const ps = paragrafos(content).map(normalizar).filter(p => p.length >= 30);
  if (ps.length === 0) return null;
  const trecho = ps[0].slice(0, 60);
  const paginas = textoPaginas.map(normalizar);
  const i = paginas.findIndex(p => p.includes(trecho));
  return i === -1 ? null : i + 1;
}

export function aplicarEdicao(fila: QueueEntry[], index: number, content: any): QueueEntry[] {
  if (!Number.isInteger(index) || index < 0 || index >= fila.length) throw new Error(`índice inválido: ${index}`);
  if (!fila[index].content) throw new Error("entrada no formato legado não é editável");
  return fila.map((e, i) => (i === index ? { ...e, content } : e));
}
