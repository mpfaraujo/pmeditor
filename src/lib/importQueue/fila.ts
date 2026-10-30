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

export function aplicarEdicao(fila: QueueEntry[], index: number, content: any): QueueEntry[] {
  if (!Number.isInteger(index) || index < 0 || index >= fila.length) throw new Error(`índice inválido: ${index}`);
  if (!fila[index].content) throw new Error("entrada no formato legado não é editável");
  return fila.map((e, i) => (i === index ? { ...e, content } : e));
}
