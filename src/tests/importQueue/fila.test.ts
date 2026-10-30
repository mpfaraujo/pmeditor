import { describe, it, expect } from "vitest";
import { aplicarEdicao, chavesRecorte, rotuloEntrada, paginaDoTexto, vinculoTextoBase } from "@/lib/importQueue/fila";

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

describe("vinculoTextoBase", () => {
  const f: any[] = [
    { isBaseText: true, latex: "", meta: { titulo_texto: "Salgado" } },
    { latex: "", tipo: MC, gabarito: "A", meta: { titulo_texto: "Salgado" } },
    { latex: "", tipo: MC, gabarito: "A", meta: { titulo_texto: "Legado" } },
    { latex: "", tipo: MC, gabarito: "A", meta: {} },
    { isSet: true, items: [], sharedMeta: { titulo_texto: "Salgado" } },
  ];
  it("acha a entrada \\basetext pelo titulo_texto", () => {
    expect(vinculoTextoBase(f, 1)).toEqual({ titulo: "Salgado", indice: 0 });
    expect(vinculoTextoBase(f, 4)).toEqual({ titulo: "Salgado", indice: 0 });
  });
  it("título sem \\basetext na fila → indice null; sem título ou texto base → null", () => {
    expect(vinculoTextoBase(f, 2)).toEqual({ titulo: "Legado", indice: null });
    expect(vinculoTextoBase(f, 3)).toBeNull();
    expect(vinculoTextoBase(f, 0)).toBeNull();
  });
});

describe("paginaDoTexto", () => {
  const base = { type: "base_text", content: [
    { type: "paragraph", content: [{ type: "text", text: "A GEOPOLÍTICA NAS LENTES" }] },
    { type: "paragraph", content: [{ type: "text", text: "A ausência de Sebastião Salgado deixará um profundo " }, { type: "text", text: "vazio no panorama", marks: [{ type: "em" }] }] },
  ] };
  it("acha a página pelo começo do texto, ignorando quebras e acentos do PDF", () => {
    const paginas = ["capa", "instruções", "A ausencia de Sebastiao\nSalgado deixará um pro-\nfundo vazio no panorama", "QUESTÃO 01"];
    expect(paginaDoTexto(base, paginas)).toBe(3);
  });
  it("ignora parágrafo que é só placeholder de imagem", () => {
    const comImagem = { type: "base_text", content: [
      { type: "paragraph", content: [{ type: "text", text: "[[IMG_PENDENTE: C:/Projetos/pmeditor/scripts/tmp/img-027-040.png]]" }] },
      { type: "paragraph", content: [{ type: "text", text: "A baunilha é uma especiaria bastante apreciada, sendo um de seus componentes" }] },
    ] };
    expect(paginaDoTexto(comImagem, ["x", "A baunilha é uma especiaria bastante apreciada, sendo um de seus componentes"])).toBe(2);
  });
  it("devolve null quando não acha", () => {
    expect(paginaDoTexto(base, ["nada aqui"])).toBeNull();
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
