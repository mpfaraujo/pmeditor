import { describe, it, expect } from "vitest";
import { paraRevisao, deRevisao, coletarCaminhosLocais, DEV_IMG_PREFIX } from "@/lib/importQueue/imagensRevisao";

const comPlaceholder = {
  type: "doc",
  content: [{ type: "question", content: [{ type: "statement", content: [{
    type: "paragraph",
    content: [{ type: "text", text: "Veja [[IMG_PENDENTE: C:/x/fig.png]] acima" }],
  }] }] }],
};
const para = (d: any) => d.content[0].content[0].content[0];

describe("imagensRevisao", () => {
  it("coleta caminhos de placeholder e de nó image local", () => {
    const d = { type: "doc", content: [para(comPlaceholder), { type: "image", attrs: { src: "C:/y/b.png" } }] };
    expect(coletarCaminhosLocais(d)).toEqual(["C:/x/fig.png", "C:/y/b.png"]);
  });

  it("placeholder no enunciado vira nó image centralizado com largura padrão (8–13 cm)", () => {
    // largura natural 950 px ≈ 10 cm impressos → 378 px de tela
    const r = paraRevisao(comPlaceholder, new Map([["C:/x/fig.png", 950]]));
    const p = para(r);
    expect(p.content.map((n: any) => n.type)).toEqual(["text", "image", "text"]);
    expect(p.content[1].attrs.src).toBe(DEV_IMG_PREFIX + encodeURIComponent("C:/x/fig.png"));
    expect(p.content[1].attrs.width).toBe(378);
    expect(p.content[1].attrs.align).toBe("center");
  });

  it("imagem pequena no enunciado sobe para o mínimo de 8 cm", () => {
    const p = para(paraRevisao(comPlaceholder, new Map([["C:/x/fig.png", 250]])));
    expect(p.content[1].attrs.width).toBe(302);
  });

  it("placeholder em alternativa: sem alinhamento e no máximo 8 cm", () => {
    const d = { type: "options", content: [{ type: "option", attrs: { letter: "A" }, content: [{
      type: "paragraph", content: [{ type: "text", text: "[[IMG_PENDENTE: C:/x/a.png]]" }],
    }] }] };
    const img = paraRevisao(d, new Map([["C:/x/a.png", 1000]])).content[0].content[0].content[0];
    expect(img.attrs.align).toBeNull();
    expect(img.attrs.width).toBe(302);
  });

  it("imagem já salva na revisão mantém largura e alinhamento escolhidos", () => {
    const salvo = { type: "image", attrs: { id: "i1", src: "C:/x/fig.png", width: 416, align: null } };
    const r = paraRevisao(salvo, new Map([["C:/x/fig.png", 950]]));
    expect(r.attrs.width).toBe(416);
    expect(r.attrs.align).toBeNull();
  });

  it("deRevisao devolve caminho local preservando largura", () => {
    const r = paraRevisao(comPlaceholder, new Map([["C:/x/fig.png", 950]]));
    const back = para(deRevisao(r));
    expect(back.content[1].attrs.src).toBe("C:/x/fig.png");
    expect(back.content[1].attrs.width).toBe(378);
  });

  it("placeholder sem caminho fica como texto", () => {
    const d = { type: "paragraph", content: [{ type: "text", text: "[[IMG_PENDENTE]]" }] };
    expect(paraRevisao(d, new Map())).toEqual(d);
  });
});
