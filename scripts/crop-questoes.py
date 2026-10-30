"""Recorta cada questão de uma prova em PDF para a tela /dev/revisar.

Âncora = linha cujo texto casa com --header (padrão: começa com QUESTÃO).
Número = grupo 1 do regex, se houver; senão, a linha só-dígitos ao lado/abaixo
da âncora (layout UERJ: "QUESTÃO" e "01" empilhados na margem — o bbox do número
começa um pouco ACIMA do da palavra, por isso a janela vai de -10 a +40 pt).

A região de uma questão vai da âncora até a próxima âncora, na ordem de leitura
(página → coluna → y). Se atravessar coluna/página, sai em vários segmentos.

Saída em scripts/tmp/revisao/<slug>/:
  q-<NN>-<ocorr>-<seg>.png   recortes (300 dpi por padrão)
  paginas/p-NNN.png          páginas inteiras (fallback)
  mapa.json                  {questoes: [{numero, ocorrencia, paginas, arquivos}], paginas, textoPaginas}

Uso:
  python scripts/crop-questoes.py <pdf> --slug uerj-2027-1eq
  python scripts/crop-questoes.py <pdf> --slug enem-2023-d1 --colunas 2 --header "^QUEST[ÃA]O\\s*(\\d{1,3})"
"""
import argparse
import json
import os
import re
from datetime import datetime, timezone

import fitz

PAD_TOPO = 4.0
MIN_SEGMENTO = 20.0


def linhas_da_pagina(page):
    out = []
    for bloco in page.get_text("dict")["blocks"]:
        for linha in bloco.get("lines", []):
            texto = "".join(s["text"] for s in linha["spans"]).strip()
            if texto:
                out.append({"texto": texto, "bbox": linha["bbox"]})
    return out


def colunas_da_pagina(page, n):
    w = page.rect.width
    return [(0.0, w)] if n == 1 else [(0.0, w / 2), (w / 2, w)]


def coluna_de(x, cols):
    for i, (x0, x1) in enumerate(cols):
        if x0 <= x < x1:
            return i
    return len(cols) - 1


def achar_numero(m, ancora, linhas):
    if m.groups() and m.group(1):
        return int(m.group(1))
    ax0, ay0, ax1, ay1 = ancora["bbox"]
    candidatas = [
        l for l in linhas
        if re.fullmatch(r"\d{1,3}", l["texto"])
        and ay0 - 10 <= l["bbox"][1] <= ay1 + 40
        and ax0 - 10 <= l["bbox"][0] <= ax1 + 10
    ]
    candidatas.sort(key=lambda l: abs(l["bbox"][1] - ay0))
    return int(candidatas[0]["texto"]) if candidatas else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--header", default=r"^QUEST[ÃA]O\b\s*(\d{1,3})?")
    ap.add_argument("--colunas", type=int, choices=[1, 2], default=1)
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--dpi-pagina", type=int, default=110)
    args = ap.parse_args()

    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    saida = os.path.join(raiz, "scripts", "tmp", "revisao", args.slug)
    os.makedirs(os.path.join(saida, "paginas"), exist_ok=True)
    header = re.compile(args.header, re.IGNORECASE)

    doc = fitz.open(args.pdf)
    ancoras = []  # (pagina_idx, col_idx, y, numero)
    paginas_png = []
    for pi, page in enumerate(doc):
        nome = f"paginas/p-{pi + 1:03d}.png"
        page.get_pixmap(dpi=args.dpi_pagina).save(os.path.join(saida, nome))
        paginas_png.append(os.path.join(saida, nome))
        cols = colunas_da_pagina(page, args.colunas)
        linhas = linhas_da_pagina(page)
        for l in linhas:
            m = header.match(l["texto"])
            if not m:
                continue
            numero = achar_numero(m, l, linhas)
            if numero is None:
                print(f"  ⚠ página {pi + 1}: âncora sem número em y={l['bbox'][1]:.0f}")
                continue
            ancoras.append((pi, coluna_de(l["bbox"][0], cols), l["bbox"][1], numero))

    ancoras.sort(key=lambda a: (a[0], a[1], a[2]))
    slots = [(pi, ci) for pi, page in enumerate(doc) for ci in range(len(colunas_da_pagina(page, args.colunas)))]

    ocorrencias = {}
    questoes = []
    for k, (pi, ci, y, numero) in enumerate(ancoras):
        ocorr = ocorrencias.get(numero, 0) + 1
        ocorrencias[numero] = ocorr
        prox = ancoras[k + 1] if k + 1 < len(ancoras) else None
        s0 = slots.index((pi, ci))
        s1 = slots.index((prox[0], prox[1])) if prox else s0
        segmentos = []
        for s in range(s0, s1 + 1):
            p, c = slots[s]
            page = doc[p]
            x0, x1 = colunas_da_pagina(page, args.colunas)[c]
            topo = max(0.0, y - PAD_TOPO) if s == s0 else 0.0
            base = (prox[2] - PAD_TOPO) if (prox and s == s1) else page.rect.height
            if base - topo >= MIN_SEGMENTO:
                segmentos.append((p, fitz.Rect(x0, topo, x1, base)))
        arquivos = []
        for j, (p, rect) in enumerate(segmentos):
            nome = f"q-{numero:02d}-{ocorr}-{j + 1}.png"
            doc[p].get_pixmap(clip=rect, dpi=args.dpi).save(os.path.join(saida, nome))
            arquivos.append(os.path.join(saida, nome))
        questoes.append({
            "numero": numero,
            "ocorrencia": ocorr,
            "paginas": sorted({p + 1 for p, _ in segmentos}),
            "arquivos": arquivos,
        })

    mapa = {
        "pdf": os.path.abspath(args.pdf),
        "geradoEm": datetime.now(timezone.utc).isoformat(),
        "paginas": paginas_png,
        # Texto de cada página — a tela usa para achar a página de um texto base.
        "textoPaginas": [page.get_text() for page in doc],
        "questoes": questoes,
    }
    with open(os.path.join(saida, "mapa.json"), "w", encoding="utf-8") as f:
        json.dump(mapa, f, ensure_ascii=False, indent=2)

    nums = sorted(ocorrencias)
    faltando = [n for n in range(1, (nums[-1] if nums else 0) + 1) if n not in ocorrencias]
    repetidos = {n: c for n, c in ocorrencias.items() if c > 1}
    print(f"✓ {len(questoes)} recortes em {saida}")
    print(f"  números ausentes: {faltando or 'nenhum'}")
    print(f"  repetidos (ocorrências): {repetidos or 'nenhum'}")


if __name__ == "__main__":
    main()
