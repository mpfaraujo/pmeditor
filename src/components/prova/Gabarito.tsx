"use client";

type Alt = "A" | "B" | "C" | "D" | "E";
const ALTS: Alt[] = ["A", "B", "C", "D", "E"];

type GabaritoItem = {
  numero: number;
  alternativas: Alt[];
};

type Props = {
  totalQuestoes: number;
  respostas?: Record<number, Alt> | Record<string, any>;
  porColuna?: number; // default 10
  colunas?: number; // default 4
  titulo?: string; // default "QUESTÕES / RESPOSTAS"
};

function normalizeAlt(v: any): Alt | null {
  const s = (v ?? "").toString().trim().toUpperCase();
  return (ALTS as readonly string[]).includes(s) ? (s as Alt) : null;
}

export default function Gabarito({
  totalQuestoes,
  respostas,
  porColuna = 10,
  colunas = 4,
  titulo = "QUESTÕES / RESPOSTAS",
}: Props) {
  const getResposta = (n: number): Alt | null => {
    if (!respostas) return null;

    const v1 = (respostas as any)[n];
    const a1 = normalizeAlt(v1);
    if (a1) return a1;

    const v2 = (respostas as any)[String(n)];
    const a2 = normalizeAlt(v2);
    if (a2) return a2;

    return null;
  };

  const blocos: GabaritoItem[][] = [];
  const totalBlocos = Math.ceil(totalQuestoes / porColuna);

  for (let b = 0; b < totalBlocos; b++) {
    const start = b * porColuna + 1;
    const end = Math.min(totalQuestoes, start + porColuna - 1);

    const itens: GabaritoItem[] = [];
    for (let n = start; n <= end; n++) itens.push({ numero: n, alternativas: ALTS });
    blocos.push(itens);
  }

  const linhas: GabaritoItem[][][] = [];
  for (let i = 0; i < blocos.length; i += colunas) {
    linhas.push(blocos.slice(i, i + colunas));
  }

  return (
    <div className="gabarito-wrap">
      <div className="gabarito-title">Gabarito</div>

      {linhas.map((linha, idx) => (
        <div key={idx} className="gabarito-row">
          {linha.map((bloco, j) => (
            <div key={j} className="gabarito-block">
              <div className="gabarito-block-header">{titulo}</div>

              <div className="gabarito-block-body">
                {bloco.map((it) => {
                  const ans = getResposta(it.numero);

                  return (
                    <div key={it.numero} className="gabarito-line">
                      <div className="gabarito-num">{it.numero}</div>

                      <div className="gabarito-bubbles">
                        {it.alternativas.map((a) => (
                          <div key={a} className={"gabarito-bubble" + (ans === a ? " filled" : "")}>
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
