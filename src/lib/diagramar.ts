import type { Selection } from "@/contexts/ProvaContext";

type Q = { metadata: any; content: any };

/** Move o item de `from` para a posição `to` (0-based); os demais deslizam. */
export function moverPara<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const alvo = Math.max(0, Math.min(list.length - 1, to));
  if (alvo === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(alvo, 0, item);
  return next;
}

export type NumeracaoItem = {
  /** chave usada em provaConfig.pontuacoes (mesmo id que o /montar usa) */
  key: string;
  numero: number;
  /** índice da questão em selectedQuestions */
  pos: number;
  rotulo: string;
};

function isDiscursiva(q: Q): boolean {
  const tipo = String(q?.metadata?.tipo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return tipo.includes("discursiva");
}

/**
 * Numeração prevista com a ordem travada (trilha diagramar).
 * Espelha a expansão do /montar: conjunto objetivo com 2+ itens vira uma questão
 * por item (ids `id#n`); conjunto discursivo e questão individual contam 1.
 */
export function numeracaoPrevista(questions: Q[], selections: Selection[]): NumeracaoItem[] {
  const out: NumeracaoItem[] = [];
  let numero = 0;
  questions.forEach((q, pos) => {
    const id: string | undefined = q?.metadata?.id;
    if (!id) return;
    const sel = selections.find((s) => s.id === id);
    if (sel?.kind === "set" && sel.itemIndexes.length >= 2 && !isDiscursiva(q)) {
      sel.itemIndexes.forEach((itemIdx, k) => {
        numero++;
        out.push({ key: `${id}#${itemIdx + 1}`, numero, pos, rotulo: `item ${k + 1}` });
      });
      return;
    }
    numero++;
    out.push({ key: id, numero, pos, rotulo: "" });
  });
  return out;
}

/** Primeiros caracteres de texto do doc ProseMirror, para identificar a questão na lista. */
export function trechoInicial(content: any, max = 90): string {
  let doc: any = content;
  if (typeof content === "string") {
    try {
      doc = JSON.parse(content);
    } catch {
      return "";
    }
  }
  let texto = "";
  const visitar = (n: any) => {
    if (!n || texto.length >= max) return;
    if (n.type === "text" && typeof n.text === "string") texto += n.text;
    else if (n.type === "math_inline") texto += "[fórmula]";
    else if (n.type === "image") texto += "[imagem]";
    if (Array.isArray(n.content)) {
      for (const c of n.content) {
        visitar(c);
        if (n.type === "paragraph" || n.type === "list_item") texto += " ";
      }
    }
  };
  visitar(doc);
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

/** Soma pontuações em texto livre ("1,5", "2 pts"). Retorna null se alguma não for numérica. */
export function somarPontos(valores: string[]): number | null {
  let total = 0;
  for (const v of valores) {
    const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    total += Number(m[0]);
  }
  return Math.round(total * 100) / 100;
}
