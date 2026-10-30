import { describe, it, expect } from "vitest";
import { aplicarEdicao, chavesRecorte, rotuloEntrada } from "@/lib/importQueue/fila";

const MC = "Múltipla Escolha" as const;
const fila: any[] = [
  { isBaseText: true, latex: "", meta: { titulo_texto: "Salgado" }, content: { type: "base_text" } },
  { latex: "", tipo: MC, gabarito: "A", meta: { numero: "23" }, content: { type: "doc" } },
  { latex: "", tipo: MC, gabarito: "B", meta: { numero: "23" }, content: { type: "doc" } },
  { isSet: true, items: [
    { latex: "", tipo: "Discursiva", gabarito: null, meta: { numero: "24" } },
    { latex: "", tipo: "Discursiva", gabarito: null, meta: { numero: "25" } },
  ], content: { type: "doc" } },
  { latex: "", tipo: MC, gabarito: "C", meta: { numero: "07", titulo_texto: "Legado" } },
];

describe("chavesRecorte", () => {
  it("numera ocorrências repetidas e expande sets", () => {
    expect(chavesRecorte(fila)).toEqual([
      [],
      [{ numero: 23, ocorrencia: 1 }],
      [{ numero: 23, ocorrencia: 2 }],
      [{ numero: 24, ocorrencia: 1 }, { numero: 25, ocorrencia: 1 }],
      [{ numero: 7, ocorrencia: 1 }],
    ]);
  });
});

describe("rotuloEntrada", () => {
  it("rotula texto base, questão e set", () => {
    expect(rotuloEntrada(fila[0])).toBe("Texto base: Salgado");
    expect(rotuloEntrada(fila[1])).toBe("Q23");
    expect(rotuloEntrada(fila[3])).toBe("Q24–25 (set)");
  });
});

describe("aplicarEdicao", () => {
  it("troca o content sem mutar a fila original", () => {
    const novo = { type: "doc", content: [] };
    const out = aplicarEdicao(fila, 1, novo);
    expect(out[1].content).toBe(novo);
    expect(fila[1].content).toEqual({ type: "doc" });
  });
  it("recusa índice inválido e formato legado", () => {
    expect(() => aplicarEdicao(fila, 99, {})).toThrow();
    expect(() => aplicarEdicao(fila, 4, {})).toThrow(/legado/);
  });
});
