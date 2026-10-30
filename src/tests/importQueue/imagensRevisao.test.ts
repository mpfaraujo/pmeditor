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

  it("placeholder vira nó image com src da rota dev e largura", () => {
    const r = paraRevisao(comPlaceholder, new Map([["C:/x/fig.png", 250]]));
    const p = para(r);
    expect(p.content.map((n: any) => n.type)).toEqual(["text", "image", "text"]);
    expect(p.content[1].attrs.src).toBe(DEV_IMG_PREFIX + encodeURIComponent("C:/x/fig.png"));
    expect(p.content[1].attrs.width).toBe(250);
  });

  it("deRevisao devolve caminho local preservando largura", () => {
    const r = paraRevisao(comPlaceholder, new Map([["C:/x/fig.png", 250]]));
    const back = para(deRevisao(r));
    expect(back.content[1].attrs.src).toBe("C:/x/fig.png");
    expect(back.content[1].attrs.width).toBe(250);
  });

  it("placeholder sem caminho fica como texto", () => {
    const d = { type: "paragraph", content: [{ type: "text", text: "[[IMG_PENDENTE]]" }] };
    expect(paraRevisao(d, new Map())).toEqual(d);
  });
});
