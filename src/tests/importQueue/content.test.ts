import { describe, it, expect } from "vitest";
import {
  buildItemContent,
  buildSetContent,
  buildBaseTextContent,
  attachQueueContent,
} from "@/lib/importQueue/content";

const MCQ = String.raw`\question Quanto é 1+1?
\begin{choices}
\choice 1
\correctchoice 2
\choice 3
\choice 4
\end{choices}`;

describe("buildItemContent", () => {
  it("MCQ vira doc > question > statement + options", () => {
    const c = buildItemContent({ latex: MCQ });
    expect(c.type).toBe("doc");
    const q = c.content[0];
    expect(q.type).toBe("question");
    expect(q.content.map((n: any) => n.type)).toEqual(["statement", "options"]);
    expect(q.content[1].content).toHaveLength(4);
  });

  it("texto base embutido vira primeiro filho base_text", () => {
    const c = buildItemContent({ latex: MCQ, embeddedBaseLatex: "Leia o texto." });
    expect(c.content[0].content[0].type).toBe("base_text");
  });
});

describe("buildBaseTextContent", () => {
  it("devolve nó base_text", () => {
    expect(buildBaseTextContent("Um texto.").type).toBe("base_text");
  });
});

describe("buildSetContent", () => {
  it("set sem titulo_texto embute os textos base", () => {
    const c = buildSetContent(
      {
        items: [
          { latex: "\\question Primeiro item", tipo: "Discursiva", gabarito: null },
          { latex: "\\question Segundo item", tipo: "Discursiva", gabarito: null },
        ],
      },
      ["Base."]
    );
    const set = c.content[0];
    expect(set.type).toBe("set_questions");
    expect(set.content.map((n: any) => n.type)).toEqual(["base_text", "question_item", "question_item"]);
  });
});

describe("attachQueueContent", () => {
  it("preenche content, exceto no formato legado", () => {
    const fila: any[] = [
      { isBaseText: true, latex: "Texto.", meta: { titulo_texto: "T1" } },
      { latex: MCQ, tipo: "Múltipla Escolha", gabarito: "B", meta: { titulo_texto: "T1" } },
      { latex: MCQ, tipo: "Múltipla Escolha", gabarito: "B", meta: { titulo_texto: "Legado" } },
      { latex: MCQ, tipo: "Múltipla Escolha", gabarito: "B" },
    ];
    const out: any[] = attachQueueContent(fila);
    expect(out[0].content.type).toBe("base_text");
    expect(out[1].content.type).toBe("doc");
    expect(out[2].content).toBeUndefined();
    expect(out[3].content.type).toBe("doc");
    expect(fila[1].content).toBeUndefined(); // não muta a entrada
  });
});
