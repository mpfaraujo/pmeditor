# Transcritor de Figuras Inteligentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o design em `docs/superpowers/specs/2026-08-08-transcritor-figuras-inteligentes-design.md` — figuras extraídas do PDF passam a ter 4 variantes pré-renderizadas (min/titulo/completa/tudo) com metadados de texto adjacente; a IA escolhe qual usar e o que vira `\title{}`/`\credits{}` externo; os gates `comprimento`/`cobertura` passam a comparar contra um OCR com as bboxes escolhidas mascaradas, eliminando a duplicação forçada de texto de figura no enunciado (caso real: Q170 do run `ee4b909928ade9a9`).

**Architecture:** 3 camadas — (1) `scripts/list-page-figures.py` ganha detecção de texto adjacente + composição de 4 variantes por figura, puramente mecânico; (2) `transcricao/PROMPT-CANONICO.md` ensina a IA a escolher variante e extrair título/crédito; (3) `transcricao/gates/` mascaram o OCR com as bboxes escolhidas antes de rodar `comprimento`/`cobertura`, mantendo `diff-palavras`/`ordem-tokens` contra o OCR original (anti-alucinação intacta).

**Tech Stack:** TypeScript + tsx (Node), vitest, Python 3.12 + PyMuPDF (`fitz`, geometria/render) + Pillow (máscara) + pytest, Ghostscript (render de página), Tesseract OCR.

---

## Divergências do design apuradas no levantamento

1. **`vitest.config.ts` no `main` não inclui `transcricao/tests/**` — bug pré-existente, não introduzido por este plano.** O commit `606ba70` (branch `worktree-pipeline-transcricao`) adicionou essa linha, mas o merge para `main` trouxe todo o código de `transcricao/` sem essa linha de config. Resultado: `pnpm test` hoje **não roda nenhum teste de `transcricao/`**, silenciosamente. Task 0 corrige isso antes de qualquer outra mudança — sem essa correção, os testes que este plano escreve não rodariam em `pnpm test`, só via `npx vitest run transcricao/tests` explícito.

2. **Baseline medido (com o include corrigido, suíte completa de `transcricao/tests` isolada):** 98 testes passando, 5 falhando por timeout de contenção de recursos (múltiplos workers rodando Tesseract/Ghostscript em paralelo — mesmo fenômeno documentado em `transcricao/HANDOFF_CLAUDE.md`: "Houve timeout inicial sob contenção... Repetida isoladamente, a suíte passou"). Este plano não tenta consertar isso — é pré-existente e não relacionado às mudanças daqui. Task 14 (verificação final) roda a suíte de forma a evitar essa contenção (`--pool=forks --poolOptions.forks.maxForks=2` ou rodando arquivos de teste pesados isoladamente).

3. **`QuestaoRunState` precisa ganhar o campo `paginaPdf: number`.** O design não desceu a esse nível de detalhe, mas é necessário: para mascarar o OCR de uma questão, o `submit` precisa saber em qual página do PDF procurar — hoje `QuestaoRunState` só tem `ocrText` (um trecho já recortado), sem página de origem. `QuestaoParsed` (tipo do adapter) já carrega `paginaPdf`; só falta propagá-lo pro `RunState`.

4. **O "subagente de figura" citado no design (`transcricao/subagent-figura-prompt.md`) não existe nesse caminho — o arquivo real é `transcricao/adapters/enem/subagent-figura-prompt.md`, e resolve um problema mais estreito** (classificar se uma alternativa visual é figura de verdade ou fórmula com OCR ruim — `TIPO: figura`/`TIPO: escalar-formula`/`TIPO: irrecuperavel`/`TIPO: sem-visao`). A decisão "qual variante usar / o que vira `\title`/`\credits`" descrita no design como responsabilidade da "Camada 2" é feita pela **IA principal** (que já escreve o `.tex` direto, sem despachar subagente, conforme `PROMPT-CANONICO.md` passo 2) — não por esse subagente específico. Este plano NÃO modifica `subagent-figura-prompt.md` (contrato de I/O dele não muda — ele recebe uma lista de paths candidatos e devolve um `ID:`, que continua funcionando igual com paths de variantes). A mudança real fica em `PROMPT-CANONICO.md` (nova seção) e em `cli/next.ts` (que passa a entregar as 4 variantes por figura, não 1 path).

5. **`gates/comprimento.ts` e `gates/cobertura.ts` não mudam de assinatura.** Design dizia "passam a receber `ocr` como parâmetro nomeado ambíguo" — na prática, a função pura `(tex, ocr) => GateResult` não precisa mudar; quem muda é `gates/index.ts`, que passa a computar DOIS textos de OCR (completo e mascarado) e rotear cada gate pro que corresponde. Menos código, mesmo resultado.

6. **Remoção de `todasAlternativasSaoImagens` (commit `e769bb8`) é feita na Task 9**, junto com a troca de `gates/index.ts` — trocar os dois de uma vez evita um estado intermediário onde ambos os mecanismos coexistem e mascaram um bug do outro.

---

## Task 0: Corrigir `vitest.config.ts` para incluir os testes de `transcricao/`

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Editar o include**

Em `vitest.config.ts`, trocar:

```typescript
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
```

por:

```typescript
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx', 'transcricao/tests/**/*.test.ts'],
```

- [ ] **Step 2: Confirmar que os testes de `transcricao/` agora são descobertos**

Run: `npx vitest list transcricao/tests 2>&1 | tail -5`

Expected: lista de arquivos de teste sob `transcricao/tests/`, sem "No test files found".

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "fix(test): inclui transcricao/tests no vitest — estava faltando desde o merge do pipeline"
```

---

## Task 1: Tipos novos em `transcricao/core/types.ts`

**Files:**
- Modify: `transcricao/core/types.ts`

**Contexto:** hoje `FiguraManifest` tem `bbox` (uma bbox só) e `pngPath` (um PNG só). Precisa virar `bboxMin` + `variantes` (4 bboxes/PNGs) + `textosAdjacentes`. `QuestaoRunState` ganha `paginaPdf` (divergência #3 acima). `RunState` ganha `formatVersion`.

- [ ] **Step 1: Ler o arquivo atual pra confirmar contexto de edição**

Arquivo já lido nesta sessão de planejamento — conteúdo atual:

```typescript
export type QuestaoStatus =
  | "pending"
  | "in-progress"
  | "submitted"
  | "accepted"
  | "rejected"
  | "needs-human"
  | "excluida";

export type FiguraManifest = {
  id: string;              // ex: "p12-f1"
  pagina: number;
  bbox: [number, number, number, number]; // x0 y0 x1 y1 em pontos PDF
  tipo: "raster" | "vetor";
  pngPath: string;          // caminho absoluto do PNG já renderizado
  questaoSugerida?: string; // heurística por proximidade Y
};

export type TentativaSubmissao = {
  tentativa: number;        // 1, 2, 3...
  texPath: string;          // tex/qN.tex ou tex/qN.tex.rejected
  aceita: boolean;
  motivos: string[];        // motivos de rejeição (vazio se aceita)
  timestamp: string;        // ISO
};

export type QuestaoRunState = {
  id: string;               // "91", "92"... (numero da prova)
  status: QuestaoStatus;
  ocrText: string;          // trecho de texto da página relevante
  figurasDisponiveis: string[]; // ids de FiguraManifest associadas
  gabaritoOficial: string | null; // letra ou "C"/"E", null se anulada
  tentativas: TentativaSubmissao[];
  texAceitoPath?: string;   // preenchido quando status === "accepted"
};

export type RunState = {
  hash: string;             // hash da prova (pdf+gabarito), nome da pasta
  adapter: string;          // "enem"
  pdfPath: string;
  gabaritoPath: string;
  criadoEm: string;         // ISO
  figuras: FiguraManifest[];
  questoes: QuestaoRunState[];
};

export type GateResult = {
  gateId: string;
  ok: boolean;
  motivos: string[];
};

export type VerifyResult = {
  ok: boolean;
  motivos: string[];
};
```

- [ ] **Step 2: Escrever o arquivo completo com os tipos novos**

Substituir o conteúdo integral de `transcricao/core/types.ts` por:

```typescript
export type QuestaoStatus =
  | "pending"
  | "in-progress"
  | "submitted"
  | "accepted"
  | "rejected"
  | "needs-human"
  | "excluida";

export type DirecaoTexto = "acima" | "abaixo" | "esquerda" | "direita";

export type SugestaoTag = "titulo" | "credito" | "label" | "legenda" | "incerto";

export type TextoAdjacente = {
  bbox: [number, number, number, number];
  texto: string;
  direcao: DirecaoTexto;
  distancia: number;      // pt, sempre >= 0 em relação ao bbox_min da figura
  sugestaoTag: SugestaoTag;
};

export type NomeVariante = "min" | "titulo" | "completa" | "tudo";

export type VarianteFigura = {
  bbox: [number, number, number, number];
  pngPath: string;         // caminho absoluto do PNG já renderizado
};

export type FiguraManifest = {
  id: string;               // ex: "p12-f1"
  pagina: number;
  bboxMin: [number, number, number, number]; // x0 y0 x1 y1 em pontos PDF — só o desenho
  tipo: "raster" | "vetor";
  variantes: Record<NomeVariante, VarianteFigura>;
  textosAdjacentes: TextoAdjacente[];
  questaoSugerida?: string; // heurística por proximidade Y
};

export type TentativaSubmissao = {
  tentativa: number;        // 1, 2, 3...
  texPath: string;          // tex/qN.tex ou tex/qN.tex.rejected
  aceita: boolean;
  motivos: string[];        // motivos de rejeição (vazio se aceita)
  timestamp: string;        // ISO
};

export type QuestaoRunState = {
  id: string;               // "91", "92"... (numero da prova)
  status: QuestaoStatus;
  ocrText: string;          // trecho de texto da página relevante
  paginaPdf: number;        // página (1-based) de onde ocrText foi extraído — necessária pra mascarar o OCR no submit
  figurasDisponiveis: string[]; // ids de FiguraManifest associadas
  gabaritoOficial: string | null; // letra ou "C"/"E", null se anulada
  tentativas: TentativaSubmissao[];
  texAceitoPath?: string;   // preenchido quando status === "accepted"
};

export type RunState = {
  formatVersion: 2;         // v1 (sem este campo) é rejeitado por loadRunState — ver core/run-state.ts
  hash: string;             // hash da prova (pdf+gabarito), nome da pasta
  adapter: string;          // "enem"
  pdfPath: string;
  gabaritoPath: string;
  criadoEm: string;         // ISO
  figuras: FiguraManifest[];
  questoes: QuestaoRunState[];
};

export type GateResult = {
  gateId: string;
  ok: boolean;
  motivos: string[];
};

export type VerifyResult = {
  ok: boolean;
  motivos: string[];
};
```

- [ ] **Step 3: Rodar typecheck (vai mostrar todos os pontos que precisam de ajuste nas próximas tasks — isso é esperado aqui)**

Run: `pnpm tsc --noEmit 2>&1 | grep transcricao`

Expected: uma lista de erros em `transcricao/core/figuras.ts`, `transcricao/adapters/enem/extract.ts`, `transcricao/cli/init.ts`, `transcricao/cli/next.ts`, `transcricao/cli/submit.ts`, `transcricao/tests/**` — todos referenciando `bbox`/`pngPath` que não existem mais em `FiguraManifest`, ou `formatVersion`/`paginaPdf` faltando. Essa lista de erros é o roteiro das próximas tasks; não precisa zerar agora.

- [ ] **Step 4: Commit**

```bash
git add transcricao/core/types.ts
git commit -m "feat(transcricao): tipos do manifest v2 (variantes de figura, texto adjacente, paginaPdf)

Ainda quebra o build — proximas tasks atualizam cada consumidor.
formatVersion:2 sinaliza runs antigos como invalidos (ver Task 5)."
```

---

## Task 2: `scripts/list-page-figures.py` — geometria pura (chain de texto adjacente + variantes + tag)

**Files:**
- Modify: `scripts/list-page-figures.py`
- Create: `scripts/tests/__init__.py`
- Create: `scripts/tests/test_list_page_figures.py`

**Contexto:** o arquivo atual já tem uma primeira versão de `expand_with_text` (escrita numa exploração anterior desta sessão) que funciona para o caso simples, mas tem um bug real: a condição `if gap < 0 or gap > EXPAND_DIST: break` trata gap NEGATIVO (bloco de texto que se sobrepõe levemente ao elo anterior da cadeia — comum em linhas de texto consecutivas por causa de ascendentes/descendentes de fonte) como fim de cadeia. Isso faz a variante "completa" da Q170 perder o bloco "Reservatório" (que começa a 332.6pt, 1.9pt ANTES do fim do bloco anterior "I II III IV V" a 334.5pt). Esta task reescreve a geometria com essa correção, e restrutura pra computar as 4 variantes explicitamente (não uma bbox única "tudo-ou-nada").

- [ ] **Step 1: Criar `scripts/tests/__init__.py` vazio**

```python
```

- [ ] **Step 2: Escrever os testes de geometria pura (SEM depender de PDF real)**

Criar `scripts/tests/test_list_page_figures.py`:

```python
"""Testes da geometria pura de scripts/list-page-figures.py — sem PDF real,
só tuplas de bbox sintéticas. O módulo tem hífen no nome (convenção de todo
scripts/*.py), então é carregado via importlib por caminho de arquivo, não
por `import`.
"""
import importlib.util
from pathlib import Path

_MODULE_PATH = Path(__file__).resolve().parents[1] / "list-page-figures.py"
_spec = importlib.util.spec_from_file_location("list_page_figures", _MODULE_PATH)
lpf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lpf)


def test_cluster_bboxes_agrupa_por_proximidade():
    bboxes = [(0, 0, 10, 10), (12, 0, 20, 10), (100, 100, 110, 110)]
    grupos = lpf.cluster_bboxes(bboxes, threshold=5)
    assert len(grupos) == 2
    tamanhos = sorted(len(g) for g in grupos)
    assert tamanhos == [1, 2]


def test_union_bbox():
    assert lpf.union_bbox([(0, 0, 10, 10), (5, 5, 20, 20)]) == (0, 0, 20, 20)


def test_chain_acima_inclui_titulo_colado():
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    titulo = (76.0, 130.0, 257.0, 140.0)  # 2pt de gap acima, alinhado
    geo = lpf.compute_figure_geometry(bbox_min, [titulo])
    assert geo["variantes"]["min"] == bbox_min
    assert geo["variantes"]["titulo"] == (60.0, 130.0, 273.0, 321.0)
    assert len(geo["adjacentes"]) == 1
    assert geo["adjacentes"][0]["direcao"] == "acima"
    assert geo["adjacentes"][0]["distancia"] == 2.0


def test_chain_rejeita_texto_que_extravasa_lateralmente_e_esta_longe():
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    # gap real da Q170: enunciado termina em y1=125.5 (17pt acima de y0=142,
    # que é > EXPAND_DIST=15) E começa em x0=31 (extravasa mais que
    # ALIGN_TOL=20pt à esquerda de 60-20=40) — falha nos dois critérios.
    enunciado = (31.0, 76.0, 280.0, 125.0)
    geo = lpf.compute_figure_geometry(bbox_min, [enunciado])
    assert geo["variantes"]["tudo"] == bbox_min
    assert geo["adjacentes"] == []


def test_chain_abaixo_aceita_elo_que_sobrepoe_o_anterior():
    """Regressão do bug original: gap negativo entre elos da MESMA cadeia
    (não em relação ao bbox_min) não deve encerrar a cadeia — só um gap
    POSITIVO maior que o limite encerra."""
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    labels = (80.0, 324.5, 255.0, 334.5)      # gap 3.5pt abaixo de bbox_min
    legenda = (138.0, 332.6, 195.0, 342.6)    # sobrepõe ~1.9pt o fim de "labels"
    geo = lpf.compute_figure_geometry(bbox_min, [labels, legenda])
    assert geo["variantes"]["completa"] == (60.0, 142.0, 273.0, 342.6)
    assert len(geo["adjacentes"]) == 2
    textos_direcao = {tuple(a["bbox"]): a["direcao"] for a in geo["adjacentes"]}
    assert textos_direcao[legenda] == "abaixo"


def test_chain_para_no_primeiro_gap_maior_que_limite():
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    perto = (80.0, 324.5, 255.0, 334.5)
    longe = (80.0, 400.0, 255.0, 410.0)  # gap a partir de "perto": 65.5pt >> CHAIN_GAP
    geo = lpf.compute_figure_geometry(bbox_min, [perto, longe])
    assert geo["variantes"]["completa"] == (60.0, 142.0, 273.0, 334.5)
    assert len(geo["adjacentes"]) == 1


def test_veta_fusao_com_figura_vizinha():
    bbox_min_a = (60.0, 142.0, 273.0, 321.0)
    bbox_min_b = (60.0, 500.0, 273.0, 600.0)  # outra figura mais abaixo na página
    # bloco de texto gigante que, se incorporado, tocaria as duas figuras
    texto_entre = (80.0, 330.0, 255.0, 490.0)
    geo = lpf.compute_figure_geometry(
        bbox_min_a,
        [texto_entre],
        all_other_bboxes=[bbox_min_a, bbox_min_b],
        self_index=0,
    )
    assert geo["variantes"]["tudo"] == bbox_min_a
    assert geo["adjacentes"] == []


def test_variante_degrada_quando_direcao_nao_tem_cadeia():
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    geo = lpf.compute_figure_geometry(bbox_min, [])
    assert geo["variantes"]["min"] == bbox_min
    assert geo["variantes"]["titulo"] == bbox_min
    assert geo["variantes"]["completa"] == bbox_min
    assert geo["variantes"]["tudo"] == bbox_min


def test_bloco_sobreposto_e_incorporado_no_min():
    bbox_min = (60.0, 142.0, 273.0, 321.0)
    sobreposto = (250.0, 300.0, 290.0, 330.0)  # cruza a borda direita/inferior
    geo = lpf.compute_figure_geometry(bbox_min, [sobreposto])
    assert geo["variantes"]["min"] == (60.0, 142.0, 290.0, 330.0)


def test_suggest_tag_credito_por_prefixo():
    assert lpf.suggest_tag("Fonte: IBGE, 2021.", "abaixo", (0, 0, 10, 10), (0, 0, 100, 100)) == "credito"
    assert lpf.suggest_tag("Disponível em: www.exemplo.com.", "abaixo", (0, 0, 10, 10), (0, 0, 100, 100)) == "credito"


def test_suggest_tag_credito_por_autor_data():
    texto = "ANDERSON, R. A. et. al., 1993 (adaptado)."
    assert lpf.suggest_tag(texto, "abaixo", (0, 0, 10, 10), (0, 0, 100, 100)) == "credito"


def test_suggest_tag_titulo_centralizado_acima():
    cluster = (60.0, 0.0, 273.0, 100.0)  # largura 213
    bloco = (76.0, -10.0, 257.0, 0.0)    # largura 181 (<=90% de 213), centralizado
    tag = lpf.suggest_tag("Nível dos reservatórios em 2 fev. 2015", "acima", bloco, cluster)
    assert tag == "titulo"


def test_suggest_tag_label_numerico_romano():
    assert lpf.suggest_tag("I II III IV V", "abaixo", (0, 0, 10, 10), (0, 0, 100, 100)) == "label"


def test_suggest_tag_legenda_abaixo_curta():
    assert lpf.suggest_tag("Reservatório", "abaixo", (0, 0, 10, 10), (0, 0, 100, 100)) == "legenda"


def test_suggest_tag_incerto_quando_nada_bate():
    texto = "um texto qualquer sem padrao reconhecido nenhum aqui perto"
    assert lpf.suggest_tag(texto, "direita", (0, 0, 10, 10), (0, 0, 100, 100)) == "incerto"
```

- [ ] **Step 3: Rodar os testes — devem FALHAR (funções novas ainda não existem)**

Run: `python -m pytest scripts/tests/test_list_page_figures.py -v`

Expected: `AttributeError: module 'list_page_figures' has no attribute 'compute_figure_geometry'` (ou `suggest_tag`) — confirma que os testes exercitam código que ainda não existe.

- [ ] **Step 4: Reescrever `scripts/list-page-figures.py` com a geometria corrigida**

Substituir o conteúdo integral do arquivo por:

```python
"""List figures (raster images + vector drawing clusters) on a PDF page.

For each candidate figure, prints:
  - its MINIMAL bounding box (only the drawing/image itself), in PDF points
  - text blocks adjacent to it (title above, axis labels around, legend
    below, credits below), each with direction/gap/suggested-tag
  - 4 pre-composed variant bboxes: min / titulo / completa / tudo

Coordinates go directly into `scripts/render-pdf-rect.py` — no eyeballing.

Usage:
  python scripts/list-page-figures.py <pdf> <page-number>
  python scripts/list-page-figures.py <pdf> <page-number> --min-size 30
  python scripts/list-page-figures.py <pdf> <page-number> --no-text-expand

The --min-size filter (in points) drops tiny clusters like dividers,
ornaments, and page-number decorations. Default 30pt (~1cm).

--no-text-expand disables adjacent-text detection entirely (legacy
behavior: only bbox_min is computed, no adjacent-text/variant sections
printed — vector[N]/raster[N] lines are always bbox_min in that mode).

## Por que "variantes" em vez de uma bbox única expandida

Um cluster vetorial ou raster sozinho raramente carrega o TÍTULO ("Nível
dos reservatórios..."), a ESCALA DE EIXO, os LABELS ("I II III IV V") nem a
LEGENDA ("Reservatório") — esses são blocos de texto do PDF que ficam ao
redor do desenho. Sem eles, a figura extraída fica inutilizável (o leitor
não sabe o que cada barra vale).

Só que ABSORVER esse texto sempre, sem escolha, também é errado: às vezes
o texto deve virar campo estruturado (\\title{}/\\credits{}) no .tex, não
pixel da imagem — essa decisão é semântica e cabe a quem consome esta
saída (a IA que escreve o .tex), não a este script.

Por isso o script produz 4 variantes prontas (min/titulo/completa/tudo) e
metadados sobre cada bloco de texto candidato (com sugestão de tag,
NÃO-vinculante) — ver `transcricao/PROMPT-CANONICO.md` pra como a decisão
é tomada.
"""
import re
import sys
import fitz  # pymupdf


# ---- Geometria pura (não depende de fitz — testável isoladamente em
#      scripts/tests/test_list_page_figures.py) --------------------------

EXPAND_DIST = 15.0   # distância máxima (pt) entre bbox_min e o 1º elo da cadeia
ALIGN_TOL = 20.0      # tolerância de extravasamento lateral/vertical
CHAIN_GAP = 15.0      # gap máximo (pt) entre elos consecutivos da mesma cadeia


def cluster_bboxes(bboxes, threshold=5):
    """Union-Find cluster: bboxes are in the same cluster if they overlap
    or come within `threshold` points of one another. Returns list of index
    groups.
    """
    n = len(bboxes)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    def close(a, b):
        return not (
            a[2] + threshold < b[0]
            or b[2] + threshold < a[0]
            or a[3] + threshold < b[1]
            or b[3] + threshold < a[1]
        )

    for i in range(n):
        for j in range(i + 1, n):
            if close(bboxes[i], bboxes[j]):
                union(i, j)

    groups = {}
    for i in range(n):
        r = find(i)
        groups.setdefault(r, []).append(i)
    return list(groups.values())


def union_bbox(bboxes):
    return (
        min(b[0] for b in bboxes),
        min(b[1] for b in bboxes),
        max(b[2] for b in bboxes),
        max(b[3] for b in bboxes),
    )


def _would_engulf_other(new_bbox, this_index, all_other_bboxes):
    """True se new_bbox englobaria o CENTRO de qualquer outro cluster/raster
    da página — evita fundir duas figuras vizinhas por causa de texto entre
    elas. `all_other_bboxes` é a lista de bbox_min de TODAS as figuras da
    página (incluindo esta, identificada por `this_index`, que é ignorada)."""
    nx0, ny0, nx1, ny1 = new_bbox
    for i, other in enumerate(all_other_bboxes):
        if i == this_index:
            continue
        ox0, oy0, ox1, oy1 = other
        cx = (ox0 + ox1) / 2
        cy = (oy0 + oy1) / 2
        if nx0 <= cx <= nx1 and ny0 <= cy <= ny1:
            return True
    return False


def _aligned_h(tb, ref_bbox):
    """Bloco alinhado horizontalmente com ref_bbox — candidato a acima/abaixo."""
    rx0, _, rx1, _ = ref_bbox
    tx0, _, tx1, _ = tb
    return tx0 >= rx0 - ALIGN_TOL and tx1 <= rx1 + ALIGN_TOL


def _aligned_v(tb, ref_bbox):
    """Bloco alinhado verticalmente com ref_bbox — candidato a esquerda/direita."""
    _, ry0, _, ry1 = ref_bbox
    _, ty0, _, ty1 = tb
    return ty0 >= ry0 - ALIGN_TOL and ty1 <= ry1 + ALIGN_TOL


def _overlapping_blocks(bbox_min, text_blocks, all_other_bboxes, self_index):
    """Blocos que já sobrepõem bbox_min — sempre incorporados (fazem parte
    do desenho, não são "adjacentes"). Retorna o bbox expandido."""
    x0, y0, x1, y1 = bbox_min
    bbox = bbox_min
    for tb in text_blocks:
        tx0, ty0, tx1, ty1 = tb
        h_over = min(x1, tx1) - max(x0, tx0) > 0
        v_over = min(y1, ty1) - max(y0, ty0) > 0
        if h_over and v_over:
            novo = (min(bbox[0], tx0), min(bbox[1], ty0), max(bbox[2], tx1), max(bbox[3], ty1))
            if not _would_engulf_other(novo, self_index, all_other_bboxes):
                bbox = novo
    return bbox


def _chain(direction, ref_bbox, text_blocks, all_other_bboxes, self_index):
    """Calcula a cadeia de blocos na direção dada, a partir de ref_bbox
    (tipicamente bbox_min, já com blocos sobrepostos incorporados).

    O 1º elo aceita gap até EXPAND_DIST em relação a ref_bbox; elos
    seguintes aceitam gap até CHAIN_GAP em relação ao ELO ANTERIOR da
    cadeia (não a ref_bbox) — permite sequências tipo "labels + legenda"
    embaixo de um gráfico. Gap NEGATIVO (bloco sobrepõe levemente o elo
    anterior — comum em linhas de texto consecutivas por causa de
    ascendentes/descendentes de fonte) é aceito; só gap POSITIVO maior
    que o limite encerra a cadeia.

    Alinhamento (`_aligned_h`/`_aligned_v`) é sempre medido contra
    ref_bbox (não contra a cadeia) — evita cascata que engorda o bbox
    pra além do que faz sentido visual.

    Retorna (bbox_expandido, [bloco, ...]) — blocos aceitos, do mais
    próximo pro mais distante.
    """
    rx0, ry0, rx1, ry1 = ref_bbox

    if direction == "acima":
        candidatos = sorted(
            (tb for tb in text_blocks if tb[3] <= ry0 and _aligned_h(tb, ref_bbox)),
            key=lambda tb: -tb[3],
        )
    elif direction == "abaixo":
        candidatos = sorted(
            (tb for tb in text_blocks if tb[1] >= ry1 and _aligned_h(tb, ref_bbox)),
            key=lambda tb: tb[1],
        )
    elif direction == "esquerda":
        candidatos = sorted(
            (tb for tb in text_blocks if tb[2] <= rx0 and _aligned_v(tb, ref_bbox)),
            key=lambda tb: -tb[2],
        )
    elif direction == "direita":
        candidatos = sorted(
            (tb for tb in text_blocks if tb[0] >= rx1 and _aligned_v(tb, ref_bbox)),
            key=lambda tb: tb[0],
        )
    else:
        raise ValueError(f"direção inválida: {direction}")

    bbox = ref_bbox
    aceitos = []
    for i, tb in enumerate(candidatos):
        tx0, ty0, tx1, ty1 = tb
        if direction == "acima":
            gap = bbox[1] - ty1
        elif direction == "abaixo":
            gap = ty0 - bbox[3]
        elif direction == "esquerda":
            gap = bbox[0] - tx1
        else:  # direita
            gap = tx0 - bbox[2]

        limite = EXPAND_DIST if i == 0 else CHAIN_GAP
        if gap > limite:
            break

        if direction == "acima":
            novo = (min(bbox[0], tx0), ty0, max(bbox[2], tx1), bbox[3])
        elif direction == "abaixo":
            novo = (min(bbox[0], tx0), bbox[1], max(bbox[2], tx1), ty1)
        elif direction == "esquerda":
            novo = (tx0, min(bbox[1], ty0), bbox[2], max(bbox[3], ty1))
        else:
            novo = (bbox[0], min(bbox[1], ty0), tx1, max(bbox[3], ty1))

        if _would_engulf_other(novo, self_index, all_other_bboxes):
            break

        bbox = novo
        aceitos.append(tb)

    return bbox, aceitos


def compute_figure_geometry(bbox_bruto, text_blocks, all_other_bboxes=None, self_index=-1):
    """Calcula bbox_min + as 4 variantes + metadados de texto adjacente para
    UMA figura (cluster vetorial ou raster).

    `all_other_bboxes`, se informado, deve conter o bbox_bruto (pré-expansão)
    de TODAS as figuras da página, incluindo esta (identificada por
    `self_index`) — usado só pro veto de fusão com figura vizinha.

    Retorna dict:
      {
        "bbox_min": (x0,y0,x1,y1),
        "variantes": {"min":..., "titulo":..., "completa":..., "tudo":...},
        "adjacentes": [
          {"bbox": (...), "direcao": "acima", "distancia": 1.8}, ...
        ]
      }

    A sugestão de tag NÃO é calculada aqui — ver `suggest_tag`, separada
    porque depende só do texto/geometria de um bloco, sem precisar de todo
    o contexto da figura.
    """
    if all_other_bboxes is None:
        all_other_bboxes = []

    bbox_min = _overlapping_blocks(bbox_bruto, text_blocks, all_other_bboxes, self_index)

    bbox_acima, aceitos_acima = _chain("acima", bbox_min, text_blocks, all_other_bboxes, self_index)
    bbox_abaixo, aceitos_abaixo = _chain("abaixo", bbox_min, text_blocks, all_other_bboxes, self_index)
    bbox_esquerda, aceitos_esquerda = _chain("esquerda", bbox_min, text_blocks, all_other_bboxes, self_index)
    bbox_direita, aceitos_direita = _chain("direita", bbox_min, text_blocks, all_other_bboxes, self_index)

    bbox_titulo = union_bbox([bbox_min, bbox_acima])
    bbox_completa = union_bbox([bbox_min, bbox_acima, bbox_abaixo])
    bbox_tudo = union_bbox([bbox_min, bbox_acima, bbox_abaixo, bbox_esquerda, bbox_direita])

    adjacentes = []
    for direcao, aceitos in (
        ("acima", aceitos_acima),
        ("abaixo", aceitos_abaixo),
        ("esquerda", aceitos_esquerda),
        ("direita", aceitos_direita),
    ):
        for tb in aceitos:
            tx0, ty0, tx1, ty1 = tb
            if direcao == "acima":
                distancia = bbox_min[1] - ty1
            elif direcao == "abaixo":
                distancia = ty0 - bbox_min[3]
            elif direcao == "esquerda":
                distancia = bbox_min[0] - tx1
            else:
                distancia = tx0 - bbox_min[2]
            adjacentes.append({"bbox": tb, "direcao": direcao, "distancia": distancia})

    return {
        "bbox_min": bbox_min,
        "variantes": {
            "min": bbox_min,
            "titulo": bbox_titulo,
            "completa": bbox_completa,
            "tudo": bbox_tudo,
        },
        "adjacentes": adjacentes,
    }


_RE_CREDITO_PREFIXO = re.compile(r"^(fonte|fonte adaptada|dispon[íi]vel em)\s*:", re.IGNORECASE)
_RE_CREDITO_AUTOR_DATA = re.compile(r"[a-zà-ú][a-zà-ú\s.]{2,60},\s*\d{4}", re.IGNORECASE)
_RE_LABEL = re.compile(r"^[IVXLCDM0-9A-Z,.\s]+$")


def suggest_tag(texto, direcao, bloco_bbox, cluster_bbox):
    """Sugestão heurística (NÃO vinculante) de classificação de um bloco de
    texto adjacente — título / crédito / label / legenda / incerto. Quem
    decide de verdade é a IA que escreve o .tex (ver PROMPT-CANONICO.md)."""
    t = texto.strip()

    if _RE_CREDITO_PREFIXO.match(t) or _RE_CREDITO_AUTOR_DATA.search(t):
        return "credito"

    palavras = t.split()
    tx0, ty0, tx1, ty1 = bloco_bbox
    cx0, cy0, cx1, cy1 = cluster_bbox
    largura_bloco = tx1 - tx0
    largura_cluster = cx1 - cx0
    centro_bloco = (tx0 + tx1) / 2
    centro_cluster = (cx0 + cx1) / 2

    if direcao == "acima" and len(palavras) <= 12 and "\n" not in t:
        centralizado = largura_cluster <= 0 or (
            largura_bloco <= 0.9 * largura_cluster and abs(centro_bloco - centro_cluster) <= ALIGN_TOL
        )
        if centralizado:
            return "titulo"

    if len(palavras) <= 6 and _RE_LABEL.match(t):
        return "label"

    if direcao == "abaixo" and len(palavras) <= 6:
        return "legenda"

    return "incerto"


# ---- Integração com fitz (PDF real) -------------------------------------


def _text_blocks(page):
    """Blocos de texto reais (não imagem) da página, como tuplas de bbox."""
    out = []
    for b in page.get_text("blocks"):
        # PyMuPDF: (x0, y0, x1, y1, text, block_no, block_type). type 0 = texto.
        if len(b) < 7 or b[6] != 0:
            continue
        text = (b[4] or "").strip()
        if not text:
            continue
        out.append((b[0], b[1], b[2], b[3], text))
    return out


def _bbox_only(text_blocks_com_texto):
    return [(t[0], t[1], t[2], t[3]) for t in text_blocks_com_texto]


def _texto_do_bloco(text_blocks_com_texto, bbox_alvo):
    for tb in text_blocks_com_texto:
        if (tb[0], tb[1], tb[2], tb[3]) == bbox_alvo:
            return tb[4]
    return ""


_DIRECAO_EN = {"acima": "above", "abaixo": "below", "esquerda": "left", "direita": "right"}


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    pdf_path = args[0]
    page_num = int(args[1])
    min_size = 30.0
    if "--min-size" in args:
        min_size = float(args[args.index("--min-size") + 1])
    text_expand = "--no-text-expand" not in args

    doc = fitz.open(pdf_path)
    if page_num < 1 or page_num > doc.page_count:
        print(f"page {page_num} out of range (pdf has {doc.page_count} pages)")
        sys.exit(1)
    page = doc[page_num - 1]

    print(f"Page {page_num}/{doc.page_count} - {page.rect.width:.1f} x {page.rect.height:.1f} pt")
    print()

    # ---- Coleta bruta de raster + vetor ----
    img_infos = page.get_image_info()
    raster_bboxes_all = [tuple(info["bbox"]) for info in img_infos]

    drawings = page.get_drawings()
    drawing_bboxes = []
    for d in drawings:
        r = d.get("rect")
        if r:
            drawing_bboxes.append((r.x0, r.y0, r.x1, r.y1))

    clusters = cluster_bboxes(drawing_bboxes, threshold=5)
    vector_bboxes_raw = []
    vector_npaths = []
    for cluster in clusters:
        b = union_bbox([drawing_bboxes[i] for i in cluster])
        vector_bboxes_raw.append(b)
        vector_npaths.append(len(cluster))

    kept_vector_idx = [
        i for i, b in enumerate(vector_bboxes_raw)
        if (b[2] - b[0]) >= min_size and (b[3] - b[1]) >= min_size
    ]
    kept_raster_idx = [
        i for i, b in enumerate(raster_bboxes_all)
        if (b[2] - b[0]) >= min_size and (b[3] - b[1]) >= min_size
    ]

    text_blocks_com_texto = _text_blocks(page) if text_expand else []
    text_blocks = _bbox_only(text_blocks_com_texto)

    # Ordem fixa em all_other_bboxes: vetores mantidos primeiro, depois rasters
    # mantidos — usado como referência de índice pro veto de fusão.
    all_other_bboxes = (
        [vector_bboxes_raw[i] for i in kept_vector_idx]
        + [raster_bboxes_all[i] for i in kept_raster_idx]
    )

    geometrias = {}  # (kind, kept_pos) -> resultado de compute_figure_geometry

    for pos, i in enumerate(kept_vector_idx):
        b = vector_bboxes_raw[i]
        if text_expand:
            geometrias[("vector", pos)] = compute_figure_geometry(b, text_blocks, all_other_bboxes, pos)
        else:
            geometrias[("vector", pos)] = {"bbox_min": b, "variantes": {"min": b, "titulo": b, "completa": b, "tudo": b}, "adjacentes": []}

    raster_offset = len(kept_vector_idx)
    for pos, i in enumerate(kept_raster_idx):
        b = raster_bboxes_all[i]
        self_index = raster_offset + pos
        if text_expand:
            geometrias[("raster", pos)] = compute_figure_geometry(b, text_blocks, all_other_bboxes, self_index)
        else:
            geometrias[("raster", pos)] = {"bbox_min": b, "variantes": {"min": b, "titulo": b, "completa": b, "tudo": b}, "adjacentes": []}

    # ---- Saída: raster (linha bbox_min, mantendo formato pré-existente) ----
    print(f"=== {len(img_infos)} raster image(s) ===")
    for i, info in enumerate(img_infos):
        b = tuple(info["bbox"])
        w, h = b[2] - b[0], b[3] - b[1]
        if w < min_size or h < min_size:
            print(f"  raster[{i}]: ({b[0]:.1f}, {b[1]:.1f}, {b[2]:.1f}, {b[3]:.1f}) - {w:.0f}x{h:.0f} pt  [tiny - probably decorative]")
            continue
        pos = kept_raster_idx.index(i)
        geo = geometrias[("raster", pos)]
        mb = geo["bbox_min"]
        mw, mh = mb[2] - mb[0], mb[3] - mb[1]
        print(f"  raster[{pos}]: ({mb[0]:.1f}, {mb[1]:.1f}, {mb[2]:.1f}, {mb[3]:.1f}) - {mw:.0f}x{mh:.0f} pt")
    print()

    # ---- Saída: vetor ----
    print(f"=== {len(kept_vector_idx)} vector drawing cluster(s) (of {len(clusters)} total, min {min_size:g}pt) ===")
    for pos, i in enumerate(kept_vector_idx):
        geo = geometrias[("vector", pos)]
        mb = geo["bbox_min"]
        mw, mh = mb[2] - mb[0], mb[3] - mb[1]
        print(f"  vector[{pos}]: ({mb[0]:.1f}, {mb[1]:.1f}, {mb[2]:.1f}, {mb[3]:.1f}) - {mw:.0f}x{mh:.0f} pt ({vector_npaths[i]} paths)")
    print()

    # ---- Saída: texto adjacente + variantes, por figura ----
    for kind, label in (("vector", "vector"), ("raster", "raster")):
        count = len(kept_vector_idx) if kind == "vector" else len(kept_raster_idx)
        for pos in range(count):
            geo = geometrias[(kind, pos)]
            print(f"=== adjacent text for {label}[{pos}] ===")
            if not geo["adjacentes"]:
                print("  (none)")
            else:
                for adj in geo["adjacentes"]:
                    texto = _texto_do_bloco(text_blocks_com_texto, adj["bbox"]).replace('"', "'").replace("\n", " ")
                    b = adj["bbox"]
                    dir_en = _DIRECAO_EN[adj["direcao"]]
                    tag = suggest_tag(texto, adj["direcao"], b, geo["bbox_min"])
                    print(f'  {dir_en}: ({b[0]:.1f}, {b[1]:.1f}, {b[2]:.1f}, {b[3]:.1f}) gap={adj["distancia"]:.1f} tag={tag} text="{texto}"')
            print()

    for kind, label in (("vector", "vector"), ("raster", "raster")):
        count = len(kept_vector_idx) if kind == "vector" else len(kept_raster_idx)
        for pos in range(count):
            geo = geometrias[(kind, pos)]
            v = geo["variantes"]
            print(f"=== variant bboxes for {label}[{pos}] ===")
            for nome in ("min", "titulo", "completa", "tudo"):
                b = v[nome]
                print(f"  {nome}:{' ' * (9 - len(nome))}({b[0]:.1f}, {b[1]:.1f}, {b[2]:.1f}, {b[3]:.1f})")
            print()

    print("To render a figure to PNG:")
    print(f"  python scripts/render-pdf-rect.py {pdf_path} {page_num} <x0> <y0> <x1> <y1> <out.png>")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Rodar os testes de geometria pura — devem PASSAR agora**

Run: `python -m pytest scripts/tests/test_list_page_figures.py -v`

Expected: todos os 15 testes passando, incluindo `test_chain_abaixo_aceita_elo_que_sobrepoe_o_anterior` (a regressão do bug original).

- [ ] **Step 6: Rodar manualmente contra o PDF real da Q170 pra conferir visualmente**

Run: `python scripts/list-page-figures.py scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf 28`

Expected: seção `=== variant bboxes for vector[0] ===` mostrando `completa` e `tudo` com `y1` em torno de `342.6` (inclui "Reservatório"), e `=== adjacent text for vector[0] ===` listando "Nível dos reservatórios..." (tag=titulo), "I II III IV V" (tag=label), "Reservatório" (tag=legenda).

- [ ] **Step 7: Commit**

```bash
git add scripts/list-page-figures.py scripts/tests/
git commit -m "feat(transcricao): list-page-figures.py detecta texto adjacente e compoe 4 variantes por figura

Corrige bug de gap negativo entre elos da mesma cadeia (labels+legenda
sobrepostos por causa de ascendentes/descendentes de fonte faziam a cadeia
parar cedo demais — Reservatorio ficava de fora mesmo devendo entrar).

Novo: compute_figure_geometry() e suggest_tag(), com 15 testes pytest
cobrindo geometria pura (sem depender de PDF real)."
```

---

## Task 3: Teste de integração do formato de saída CLI contra o PDF real (página 28, Q170)

**Files:**
- Modify: `scripts/tests/test_list_page_figures.py`

**Contexto:** a Task 2 testa a geometria pura (funções isoladas). Falta garantir que o TEXTO IMPRESSO por `main()` (que o `transcricao/core/figuras.ts` vai parsear na Task 4) realmente sai no formato esperado, rodando contra o PDF real da Q170 — se o formato de impressão tiver um bug (ex: espaçamento errado, seção faltando), só um teste que roda o script de ponta a ponta pega isso; os testes de geometria pura não tocam `main()`.

- [ ] **Step 1: Escrever o teste de integração (adicionar ao fim de `scripts/tests/test_list_page_figures.py`)**

Adicionar ao final do arquivo criado na Task 2:

```python
# ---- Integração com PDF real (página 28 do ENEM 2021 D2 — Q170) ----------

import subprocess

_PDF_Q170 = Path(__file__).resolve().parents[2] / "scripts" / "provas" / "enem" / "2021" / "2021_PV_impresso_D2_CD5.pdf"


def _rodar_cli(pagina, extra_args=()):
    if not _PDF_Q170.exists():
        import pytest
        pytest.skip(f"PDF fixture não encontrado: {_PDF_Q170}")
    cmd = [sys.executable, str(_MODULE_PATH), str(_PDF_Q170), str(pagina), *extra_args]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"stderr: {r.stderr}"
    return r.stdout


def test_cli_pagina_28_lista_titulo_labels_e_legenda_como_adjacentes():
    out = _rodar_cli(28)
    assert "=== adjacent text for vector[0] ===" in out
    assert 'tag=titulo text="Nível dos reservatórios em 2 fev. 2015"' in out
    assert 'tag=label text="I II III IV V"' in out
    assert 'tag=legenda text="Reservatório"' in out


def test_cli_pagina_28_variante_completa_inclui_titulo_e_legenda():
    out = _rodar_cli(28)
    bloco = out.split("=== variant bboxes for vector[0] ===")[1].split("===")[0]
    linha_completa = [l for l in bloco.splitlines() if l.strip().startswith("completa:")][0]
    # y0 da variante completa deve bater com o topo do título (~130.5),
    # não com o topo do bbox_min do desenho (~142.3)
    y0 = float(linha_completa.split("(")[1].split(",")[1].strip())
    assert y0 < 135.0
    # y1 deve incluir a legenda "Reservatório" (~342.6), não parar nos labels (~334.5)
    y1 = float(linha_completa.split(")")[0].split(",")[3].strip())
    assert y1 > 340.0


def test_cli_no_text_expand_preserva_comportamento_legado():
    out = _rodar_cli(28, extra_args=["--no-text-expand"])
    assert "=== adjacent text for vector[0] ===" not in out
    # vector[0] continua presente, mas sem seções novas
    assert "vector[0]:" in out
```

- [ ] **Step 2: Rodar os 3 testes novos**

Run: `python -m pytest scripts/tests/test_list_page_figures.py -v -k "cli_pagina_28 or no_text_expand"`

Expected: 3 passed. Se `test_cli_pagina_28_variante_completa_inclui_titulo_e_legenda` falhar, o parsing manual de string (`.split("(")[1]...`) é frágil — ajustar o parsing do teste antes de mexer no script (o teste da Task 2/Step 6 já confirmou visualmente que os valores saem certos).

- [ ] **Step 3: Rodar a suíte pytest completa de `scripts/tests/`**

Run: `python -m pytest scripts/tests/ -v`

Expected: todos os testes (geometria pura + integração) passando.

- [ ] **Step 4: Commit**

```bash
git add scripts/tests/test_list_page_figures.py
git commit -m "test(transcricao): integracao do formato de saida CLI contra PDF real da Q170"
```

---

## Task 4: `transcricao/core/figuras.ts` — parser da nova saída + render de variantes

**Files:**
- Modify: `transcricao/core/figuras.ts`
- Modify: `transcricao/tests/core/figuras.test.ts`

**Contexto:** `listarFigurasDaPagina` hoje retorna `FiguraDetectada[]` com `{bbox, tipo}` — uma bbox só por figura. Precisa passar a retornar a geometria completa (bbox_min + textos adjacentes + as 4 bboxes de variante), e uma função nova (`renderizarVariantesFigura`) que chama `render-pdf-rect.py` 4 vezes (uma por variante) e devolve os paths.

- [ ] **Step 1: Reler o teste atual pra saber o que vai quebrar**

Conteúdo atual de `transcricao/tests/core/figuras.test.ts` (já lido nesta sessão de planejamento) usa `f.bbox` e `f.tipo`, e `renderizarFigura(PDF, 5, [50,50,200,200], outPath)` (uma bbox, um PNG). Isso muda.

- [ ] **Step 2: Reescrever `transcricao/tests/core/figuras.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listarFigurasDaPagina, renderizarFigura, renderizarVariantesFigura } from "../../core/figuras";

const PDF = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf");

describe("figuras", () => {
  it("lista figuras de uma página com bboxMin em pontos PDF, incluindo raster e vetor", () => {
    // página 5 do caderno amarelo D2 tem figuras raster e vetor confirmadas
    const figuras = listarFigurasDaPagina(PDF, 5, { minSize: 20 });
    expect(figuras.length).toBeGreaterThan(0);
    for (const f of figuras) {
      expect(f.bboxMin).toHaveLength(4);
      expect(["raster", "vetor"]).toContain(f.tipo);
      expect(f.textosAdjacentes).toBeInstanceOf(Array);
    }
    expect(figuras.some((f) => f.tipo === "raster")).toBe(true);
    expect(figuras.some((f) => f.tipo === "vetor")).toBe(true);
  });

  it("detecta título, labels e legenda como texto adjacente na Q170 (página 28)", () => {
    const figuras = listarFigurasDaPagina(PDF, 28, { minSize: 20 });
    const grafico = figuras.find((f) => f.tipo === "vetor" && f.bboxMin[0] < 100);
    expect(grafico).toBeDefined();
    const textos = grafico!.textosAdjacentes.map((t) => t.texto);
    expect(textos.some((t) => t.includes("Nível dos reservatórios"))).toBe(true);
    expect(textos.some((t) => t.includes("Reservatório"))).toBe(true);
    const titulo = grafico!.textosAdjacentes.find((t) => t.texto.includes("Nível dos reservatórios"));
    expect(titulo?.sugestaoTag).toBe("titulo");
  });

  it("renderiza uma figura em PNG dado bbox", () => {
    const dir = mkdtempSync(join(tmpdir(), "transcricao-figtest-"));
    try {
      const png = renderizarFigura(PDF, 5, [50, 50, 200, 200], join(dir, "fig.png"));
      expect(png).toBe(join(dir, "fig.png"));
      expect(existsSync(png)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renderiza as 4 variantes de uma figura, uma por PNG", () => {
    const dir = mkdtempSync(join(tmpdir(), "transcricao-variantes-"));
    try {
      const figuras = listarFigurasDaPagina(PDF, 28, { minSize: 20 });
      const grafico = figuras.find((f) => f.tipo === "vetor" && f.bboxMin[0] < 100)!;
      const variantes = renderizarVariantesFigura(PDF, 28, grafico, dir, "p28-f1");
      expect(Object.keys(variantes).sort()).toEqual(["completa", "min", "titulo", "tudo"]);
      for (const nome of ["min", "titulo", "completa", "tudo"] as const) {
        expect(existsSync(variantes[nome].pngPath)).toBe(true);
        expect(variantes[nome].bbox).toHaveLength(4);
      }
      // completa inclui o título (y0 menor que o bbox_min)
      expect(variantes.completa.bbox[1]).toBeLessThan(variantes.min.bbox[1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("filtra figuras raster pequenas/decorativas quando minSize é passado", () => {
    // Página 5 tem raster[1] com bbox ~1.4x0.8pt, marcado "[tiny — probably
    // decorative]" pelo próprio script — o script só filtra isso nos clusters
    // vetoriais, então o filtro do lado TS precisa cobrir raster também.
    const semFiltro = listarFigurasDaPagina(PDF, 5, {});
    const comFiltro = listarFigurasDaPagina(PDF, 5, { minSize: 20 });
    const minoresQue20 = semFiltro.filter(
      (f) => Math.max(f.bboxMin[2] - f.bboxMin[0], f.bboxMin[3] - f.bboxMin[1]) < 20
    );
    expect(minoresQue20.length).toBeGreaterThan(0);
    for (const f of comFiltro) {
      expect(Math.max(f.bboxMin[2] - f.bboxMin[0], f.bboxMin[3] - f.bboxMin[1])).toBeGreaterThanOrEqual(20);
    }
  });

  it("lança erro claro se o PDF não existe", () => {
    expect(() => listarFigurasDaPagina(resolve(__dirname, "../fixtures/nao-existe.pdf"), 1)).toThrow(
      /não encontrado/
    );
    expect(() =>
      renderizarFigura(resolve(__dirname, "../fixtures/nao-existe.pdf"), 1, [0, 0, 10, 10], "out.png")
    ).toThrow(/não encontrado/);
  });

  it("propaga erro do script Python quando a página é inválida", () => {
    expect(() => listarFigurasDaPagina(PDF, 99999)).toThrow(/list-page-figures\.py falhou/);
  });
});
```

- [ ] **Step 3: Rodar os testes — devem FALHAR (parser/render ainda não mudaram)**

Run: `npx vitest run transcricao/tests/core/figuras.test.ts`

Expected: falhas em `f.bboxMin`/`f.textosAdjacentes` sendo `undefined`, e `renderizarVariantesFigura` não existindo.

- [ ] **Step 4: Reescrever `transcricao/core/figuras.ts`**

```typescript
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { DirecaoTexto, NomeVariante, SugestaoTag, TextoAdjacente, VarianteFigura } from "./types";

export type FiguraDetectada = {
  bboxMin: [number, number, number, number];
  tipo: "raster" | "vetor";
  textosAdjacentes: TextoAdjacente[];
  /** bboxes das 4 variantes — ainda não renderizadas em PNG (ver renderizarVariantesFigura). */
  bboxesVariantes: Record<NomeVariante, [number, number, number, number]>;
};

function pythonBin(): string {
  return process.env.TRANSCRICAO_PYTHON || "python";
}

const LIST_FIGURES_SCRIPT = resolve(__dirname, "../../scripts/list-page-figures.py");
const RENDER_RECT_SCRIPT = resolve(__dirname, "../../scripts/render-pdf-rect.py");

const FIGURA_LINE_RE = /^\s*(raster|vector)\[(\d+)\]:\s*\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/;
const CONTAGEM_RASTER_RE = /===\s*(\d+)\s*raster image\(s\)\s*===/;
const CONTAGEM_VETOR_RE = /===\s*(\d+)\s*vector drawing cluster\(s\)/;
const SECAO_ADJACENTE_RE = /^=== adjacent text for (raster|vector)\[(\d+)\] ===$/;
const SECAO_VARIANTE_RE = /^=== variant bboxes for (raster|vector)\[(\d+)\] ===$/;
const LINHA_ADJACENTE_RE = /^\s*(above|below|left|right):\s*\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)\s*gap=([-\d.]+)\s*tag=(\w+)\s*text="(.*)"$/;
const LINHA_VARIANTE_RE = /^\s*(min|titulo|completa|tudo):\s*\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)$/;

const DIRECAO_PT: Record<string, DirecaoTexto> = {
  above: "acima",
  below: "abaixo",
  left: "esquerda",
  right: "direita",
};

type ChaveFigura = string; // `${tipo}[${indice}]` — ex: "vector[0]"

function parseFigurasOutput(out: string): FiguraDetectada[] {
  const linhas = out.split(/\r?\n/);

  // 1) Linhas bbox_min (mesmo formato de antes)
  const bboxMinPorChave = new Map<ChaveFigura, { tipo: "raster" | "vetor"; bbox: [number, number, number, number] }>();
  let nRaster = 0;
  let nVetor = 0;
  for (const linha of linhas) {
    const m = FIGURA_LINE_RE.exec(linha);
    if (!m) continue;
    const [, kind, idx, x0, y0, x1, y1] = m;
    const tipo = kind === "vector" ? "vetor" : "raster";
    if (tipo === "vetor") nVetor++; else nRaster++;
    bboxMinPorChave.set(`${kind}[${idx}]`, {
      tipo,
      bbox: [parseFloat(x0), parseFloat(y0), parseFloat(x1), parseFloat(y1)],
    });
  }

  const contagemRasterEsperada = CONTAGEM_RASTER_RE.exec(out);
  const contagemVetorEsperada = CONTAGEM_VETOR_RE.exec(out);
  if (contagemRasterEsperada && parseInt(contagemRasterEsperada[1], 10) !== nRaster) {
    throw new Error(
      `figuras: list-page-figures.py anunciou ${contagemRasterEsperada[1]} raster image(s) mas o parser encontrou ${nRaster} — formato de saída pode ter mudado`
    );
  }
  if (contagemVetorEsperada && parseInt(contagemVetorEsperada[1], 10) !== nVetor) {
    throw new Error(
      `figuras: list-page-figures.py anunciou ${contagemVetorEsperada[1]} vector drawing cluster(s) mas o parser encontrou ${nVetor} — formato de saída pode ter mudado`
    );
  }

  // 2) Seções "adjacent text for X[N]" — texto adjacente por figura
  const adjacentesPorChave = new Map<ChaveFigura, TextoAdjacente[]>();
  let secaoAtual: ChaveFigura | null = null;
  let emSecaoAdjacente = false;
  for (const linha of linhas) {
    const inicioAdj = SECAO_ADJACENTE_RE.exec(linha);
    if (inicioAdj) {
      secaoAtual = `${inicioAdj[1]}[${inicioAdj[2]}]`;
      emSecaoAdjacente = true;
      adjacentesPorChave.set(secaoAtual, []);
      continue;
    }
    const inicioVar = SECAO_VARIANTE_RE.exec(linha);
    if (inicioVar) {
      emSecaoAdjacente = false;
      continue;
    }
    if (!emSecaoAdjacente || !secaoAtual) continue;
    const m = LINHA_ADJACENTE_RE.exec(linha);
    if (!m) continue;
    const [, dirEn, x0, y0, x1, y1, gap, tag, texto] = m;
    adjacentesPorChave.get(secaoAtual)!.push({
      bbox: [parseFloat(x0), parseFloat(y0), parseFloat(x1), parseFloat(y1)],
      texto,
      direcao: DIRECAO_PT[dirEn],
      distancia: parseFloat(gap),
      sugestaoTag: tag as SugestaoTag,
    });
  }

  // 3) Seções "variant bboxes for X[N]"
  const variantesPorChave = new Map<ChaveFigura, Record<NomeVariante, [number, number, number, number]>>();
  secaoAtual = null;
  let emSecaoVariante = false;
  for (const linha of linhas) {
    const inicioVar = SECAO_VARIANTE_RE.exec(linha);
    if (inicioVar) {
      secaoAtual = `${inicioVar[1]}[${inicioVar[2]}]`;
      emSecaoVariante = true;
      continue;
    }
    const inicioAdj = SECAO_ADJACENTE_RE.exec(linha);
    if (inicioAdj) {
      emSecaoVariante = false;
      continue;
    }
    if (!emSecaoVariante || !secaoAtual) continue;
    const m = LINHA_VARIANTE_RE.exec(linha);
    if (!m) continue;
    const [, nome, x0, y0, x1, y1] = m;
    if (!variantesPorChave.has(secaoAtual)) {
      variantesPorChave.set(secaoAtual, {} as Record<NomeVariante, [number, number, number, number]>);
    }
    variantesPorChave.get(secaoAtual)![nome as NomeVariante] = [
      parseFloat(x0), parseFloat(y0), parseFloat(x1), parseFloat(y1),
    ];
  }

  // 4) Monta resultado final, na ordem em que apareceram as linhas bbox_min
  // (vector primeiro, depois raster — mesma ordem do script Python).
  const figuras: FiguraDetectada[] = [];
  for (const [chave, { tipo, bbox }] of bboxMinPorChave) {
    const variantes = variantesPorChave.get(chave) ?? {
      min: bbox, titulo: bbox, completa: bbox, tudo: bbox,
    };
    figuras.push({
      bboxMin: bbox,
      tipo,
      textosAdjacentes: adjacentesPorChave.get(chave) ?? [],
      bboxesVariantes: variantes,
    });
  }

  return figuras;
}

/**
 * Lista as figuras (raster + clusters vetoriais) de uma página via
 * `scripts/list-page-figures.py`, com bbox_min, texto adjacente e as 4
 * bboxes de variante (ainda não renderizadas — ver `renderizarVariantesFigura`).
 *
 * `opts.minSize` filtra AMBOS os tipos pelo maior lado da bboxMin, em pontos
 * PDF (mesmo comportamento de antes).
 */
export function listarFigurasDaPagina(
  pdfPath: string,
  pagina: number,
  opts: { minSize?: number } = {}
): FiguraDetectada[] {
  if (!existsSync(pdfPath)) {
    throw new Error(`figuras: PDF não encontrado: ${pdfPath}`);
  }
  const args = [LIST_FIGURES_SCRIPT, pdfPath, String(pagina)];
  if (opts.minSize !== undefined) args.push("--min-size", String(opts.minSize));
  let out: string;
  try {
    out = execFileSync(pythonBin(), args, { encoding: "utf-8" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`list-page-figures.py falhou (${pdfPath}, página ${pagina}): ${msg}`);
  }
  const figuras = parseFigurasOutput(out);
  if (opts.minSize === undefined) return figuras;
  return figuras.filter((f) => {
    const largura = f.bboxMin[2] - f.bboxMin[0];
    const altura = f.bboxMin[3] - f.bboxMin[1];
    return Math.max(largura, altura) >= opts.minSize!;
  });
}

/** Renderiza uma bbox em PNG via `scripts/render-pdf-rect.py`. */
export function renderizarFigura(
  pdfPath: string,
  pagina: number,
  bbox: [number, number, number, number],
  outputPath: string,
  dpi = 300
): string {
  if (!existsSync(pdfPath)) {
    throw new Error(`figuras: PDF não encontrado: ${pdfPath}`);
  }
  const args = [
    RENDER_RECT_SCRIPT,
    pdfPath,
    String(pagina),
    ...bbox.map(String),
    outputPath,
    "--dpi",
    String(dpi),
  ];
  try {
    execFileSync(pythonBin(), args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`render-pdf-rect.py falhou (${pdfPath}, página ${pagina}, bbox ${bbox}): ${msg}`);
  }
  return outputPath;
}

/**
 * Renderiza as 4 variantes de UMA figura em PNGs separados, nomeados
 * `<idPrefix>_min.png`, `<idPrefix>_titulo.png`, `<idPrefix>_completa.png`,
 * `<idPrefix>_tudo.png` dentro de `figurasDir`. Retorna um `VarianteFigura`
 * por nome de variante (bbox + pngPath), pronto pra entrar no manifest.
 */
export function renderizarVariantesFigura(
  pdfPath: string,
  pagina: number,
  figura: FiguraDetectada,
  figurasDir: string,
  idPrefix: string,
  dpi = 300
): Record<NomeVariante, VarianteFigura> {
  const nomes: NomeVariante[] = ["min", "titulo", "completa", "tudo"];
  const resultado = {} as Record<NomeVariante, VarianteFigura>;
  for (const nome of nomes) {
    const pngPath = join(figurasDir, `${idPrefix}_${nome}.png`);
    const bbox = figura.bboxesVariantes[nome];
    renderizarFigura(pdfPath, pagina, bbox, pngPath, dpi);
    resultado[nome] = { bbox, pngPath };
  }
  return resultado;
}
```

- [ ] **Step 5: Rodar os testes — devem PASSAR**

Run: `npx vitest run transcricao/tests/core/figuras.test.ts`

Expected: todos os testes passando (7 testes).

- [ ] **Step 6: `tsc` ainda vai reclamar de outros arquivos (esperado — próximas tasks corrigem)**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "extract\.ts|init\.ts|next\.ts|submit\.ts"`

Expected: erros em `adapters/enem/extract.ts` (`FiguraManifest` incompleto — falta `variantes`/`textosAdjacentes`), esperado até a Task 6.

- [ ] **Step 7: Commit**

```bash
git add transcricao/core/figuras.ts transcricao/tests/core/figuras.test.ts
git commit -m "feat(transcricao): figuras.ts parseia texto adjacente e variantes, renderizarVariantesFigura novo

Parser reescrito pra formato multi-secao (bbox_min + adjacent text +
variant bboxes por figura). renderizarVariantesFigura chama
render-pdf-rect.py 4x (uma por variante) e devolve bbox+pngPath prontos
pro manifest."
```

---

## Task 5: `transcricao/core/run-state.ts` — rejeitar manifest v1

**Files:**
- Modify: `transcricao/core/run-state.ts`
- Create: `transcricao/tests/core/run-state.test.ts` (o arquivo já existe — ver Step 1)

**Contexto:** runs criados antes deste plano não têm `formatVersion` (nem `variantes`/`textosAdjacentes`/`paginaPdf`). Sem essa checagem, `loadRunState` carregaria um manifest antigo e o resto do pipeline quebraria de forma confusa (undefined em cascata). Migração é deletar o run e rodar `init` de novo (decisão já tomada no brainstorming — ver design, seção "Migração").

- [ ] **Step 1: Ler o teste existente de run-state**

```bash
cat transcricao/tests/core/run-state.test.ts
```

Ler o conteúdo atual antes de editar (o arquivo já existe com testes de `saveRunState`/`loadRunState` básicos — a Step 3 abaixo ADICIONA um teste novo ao final, sem remover os existentes).

- [ ] **Step 2: Adicionar a checagem em `loadRunState`**

Em `transcricao/core/run-state.ts`, trocar a função `loadRunState`:

```typescript
export function loadRunState(baseOverride: string | undefined, hash: string): RunState {
  const finalPath = join(runDir(baseOverride, hash), "run.json");
  if (!existsSync(finalPath)) {
    throw new Error(`run.json não encontrado em ${finalPath}. Rode "transcricao init" primeiro.`);
  }
  return JSON.parse(readFileSync(finalPath, "utf-8")) as RunState;
}
```

por:

```typescript
export function loadRunState(baseOverride: string | undefined, hash: string): RunState {
  const finalPath = join(runDir(baseOverride, hash), "run.json");
  if (!existsSync(finalPath)) {
    throw new Error(`run.json não encontrado em ${finalPath}. Rode "transcricao init" primeiro.`);
  }
  const state = JSON.parse(readFileSync(finalPath, "utf-8")) as RunState;
  if (state.formatVersion !== 2) {
    throw new Error(
      `run.json em ${finalPath} está no formato v1 (pré-figuras-inteligentes) — incompatível.\n` +
        `Delete o run e rode init novamente:\n` +
        `  rm -rf ${runDir(baseOverride, hash)}\n` +
        `  pnpm tsx transcricao/cli/init.ts --pdf ... --gabarito ... --adapter enem`
    );
  }
  return state;
}
```

- [ ] **Step 3: Adicionar teste ao final de `transcricao/tests/core/run-state.test.ts`**

Adicionar (sem remover os testes já existentes no arquivo):

```typescript
describe("loadRunState — rejeita manifest v1 (pré-figuras-inteligentes)", () => {
  it("lança erro claro quando run.json não tem formatVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "transcricao-runstate-v1-"));
    try {
      const hash = "abc123";
      const runJsonDir = join(dir, hash);
      mkdirSync(runJsonDir, { recursive: true });
      // Manifest v1 real (sem formatVersion, sem variantes/textosAdjacentes/paginaPdf) —
      // formato que existia antes deste plano.
      writeFileSync(
        join(runJsonDir, "run.json"),
        JSON.stringify({
          hash,
          adapter: "enem",
          pdfPath: "prova.pdf",
          gabaritoPath: "gabarito.pdf",
          criadoEm: new Date().toISOString(),
          figuras: [{ id: "p1-f1", pagina: 1, bbox: [0, 0, 10, 10], tipo: "raster", pngPath: "x.png" }],
          questoes: [],
        }),
        "utf-8"
      );
      expect(() => loadRunState(dir, hash)).toThrow(/formato v1/);
      expect(() => loadRunState(dir, hash)).toThrow(/rm -rf/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

Se o arquivo `transcricao/tests/core/run-state.test.ts` ainda não importar `mkdtempSync, mkdirSync, writeFileSync, rmSync` de `node:fs` e `tmpdir` de `node:os` e `join` de `node:path`, adicionar esses imports no topo do arquivo (verificar o que já está importado antes de duplicar).

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run transcricao/tests/core/run-state.test.ts`

Expected: todos passando, incluindo o novo teste de rejeição de v1.

- [ ] **Step 5: Commit**

```bash
git add transcricao/core/run-state.ts transcricao/tests/core/run-state.test.ts
git commit -m "feat(transcricao): loadRunState rejeita manifest v1 com mensagem de migracao

Runs criados antes deste plano nao tem formatVersion nem os campos novos
de figura (variantes/textosAdjacentes) ou paginaPdf na questao. Sem essa
checagem o pipeline quebraria em cascata com undefined confuso em vez de
uma mensagem clara de 'delete e rode init de novo'."
```

---

## Task 6: `adapters/enem/extract.ts` + `cli/init.ts` — montar manifest v2, propagar `paginaPdf`

**Files:**
- Modify: `transcricao/adapters/enem/extract.ts`
- Modify: `transcricao/cli/init.ts`
- Modify: `transcricao/tests/cli/next-submit-status.test.ts`

**Contexto:** `extractEnem` hoje renderiza 1 PNG por figura e monta `FiguraManifest` com `bbox`/`pngPath` únicos. Precisa renderizar as 4 variantes (via `renderizarVariantesFigura`, Task 4) e montar `variantes`/`textosAdjacentes`. `runInit` precisa gravar `formatVersion: 2` e propagar `paginaPdf` pra cada `QuestaoRunState`.

- [ ] **Step 1: Reescrever `transcricao/adapters/enem/extract.ts`**

```typescript
import type { ExtractInput, ExtractOutput } from "../contract";
import { extrairTextoPagina, contarPaginas } from "../../core/ocr";
import { listarFigurasDaPagina, renderizarVariantesFigura } from "../../core/figuras";
import type { FiguraManifest } from "../../core/types";
import { mkdirSync } from "node:fs";

export async function extractEnem(input: ExtractInput, figurasDir: string): Promise<ExtractOutput> {
  mkdirSync(figurasDir, { recursive: true });
  const totalPaginas = contarPaginas(input.pdfPath);
  const paginas: string[] = [];
  const figuras: FiguraManifest[] = [];
  const ignoradas = new Set(input.paginasIgnoradas ?? []);

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    if (ignoradas.has(pagina)) {
      paginas.push("");
      continue;
    }

    paginas.push(extrairTextoPagina(input.pdfPath, pagina));

    const detectadas = listarFigurasDaPagina(input.pdfPath, pagina, { minSize: 20 });
    detectadas.forEach((fig, idx) => {
      const id = `p${pagina}-f${idx + 1}`;
      const variantes = renderizarVariantesFigura(input.pdfPath, pagina, fig, figurasDir, id);
      figuras.push({
        id,
        pagina,
        bboxMin: fig.bboxMin,
        tipo: fig.tipo,
        variantes,
        textosAdjacentes: fig.textosAdjacentes,
      });
    });
  }

  return { paginas, figuras };
}
```

- [ ] **Step 2: Editar `transcricao/cli/init.ts` — `formatVersion` e `paginaPdf`**

No `runInit`, trocar o bloco de montagem de `questoes` e `state`:

```typescript
  const questoes: QuestaoRunState[] = questoesParsed.map((q) => ({
    id: q.id,
    status: foraDoIntervalo(q.id, opts.somenteIntervalo) ? "excluida" : "pending",
    ocrText: q.ocrText,
    figurasDisponiveis: figuras.filter((f) => f.pagina === q.paginaPdf).map((f) => f.id),
    gabaritoOficial: q.gabaritoOficial,
    tentativas: [],
  }));

  const state: RunState = {
    hash,
    adapter: opts.adapter,
    pdfPath: opts.pdfPath,
    gabaritoPath: opts.gabaritoPath,
    criadoEm: new Date().toISOString(),
    figuras,
    questoes,
  };
```

por:

```typescript
  const questoes: QuestaoRunState[] = questoesParsed.map((q) => ({
    id: q.id,
    status: foraDoIntervalo(q.id, opts.somenteIntervalo) ? "excluida" : "pending",
    ocrText: q.ocrText,
    paginaPdf: q.paginaPdf,
    figurasDisponiveis: figuras.filter((f) => f.pagina === q.paginaPdf).map((f) => f.id),
    gabaritoOficial: q.gabaritoOficial,
    tentativas: [],
  }));

  const state: RunState = {
    formatVersion: 2,
    hash,
    adapter: opts.adapter,
    pdfPath: opts.pdfPath,
    gabaritoPath: opts.gabaritoPath,
    criadoEm: new Date().toISOString(),
    figuras,
    questoes,
  };
```

- [ ] **Step 3: Atualizar `estadoInicial` e os 2 testes com figura literal em `transcricao/tests/cli/next-submit-status.test.ts`**

No topo do arquivo, trocar a função `estadoInicial`:

```typescript
function estadoInicial(hash: string): RunState {
  return {
    hash,
    adapter: "enem",
    pdfPath: "prova.pdf",
    gabaritoPath: "gabarito.pdf",
    criadoEm: new Date().toISOString(),
    figuras: [],
    questoes: [
      { id: "91", status: "pending", ocrText: OCR, figurasDisponiveis: [], gabaritoOficial: "A", tentativas: [] },
    ],
  };
}
```

por:

```typescript
function estadoInicial(hash: string): RunState {
  return {
    formatVersion: 2,
    hash,
    adapter: "enem",
    pdfPath: "prova.pdf",
    gabaritoPath: "gabarito.pdf",
    criadoEm: new Date().toISOString(),
    figuras: [],
    questoes: [
      {
        id: "91",
        status: "pending",
        ocrText: OCR,
        paginaPdf: 1,
        figurasDisponiveis: [],
        gabaritoOficial: "A",
        tentativas: [],
      },
    ],
  };
}
```

No topo do arquivo, adicionar o import do PDF real (mesmo fixture já usado em outros testes de `transcricao/tests/`):

```typescript
const PDF_REAL = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf");
```

(Adicionar essa linha junto de `MATRIZ_PATH`, usando o `resolve` já importado no topo do arquivo.)

Trocar o teste `"next devolve o pngPath absoluto das figuras associadas"`:

```typescript
  it("next devolve o pngPath absoluto das figuras associadas", async () => {
    const state = estadoInicial("hash1");
    const pngPath = join(base, "hash1", "figuras", "p1-f1.png");
    state.figuras = [{ id: "p1-f1", pagina: 1, bbox: [1, 2, 3, 4], tipo: "raster", pngPath }];
    state.questoes[0].figurasDisponiveis = ["p1-f1"];
    saveRunState(base, state);
    const item = await runNext(base, "hash1", MATRIZ_PATH);
    expect(item?.figuras_disponiveis).toEqual([pngPath]);
  });
```

por:

```typescript
  it("next devolve as 4 variantes das figuras associadas", async () => {
    const state = estadoInicial("hash1");
    const figDir = join(base, "hash1", "figuras");
    const variantes = {
      min: { bbox: [1, 2, 3, 4] as [number, number, number, number], pngPath: join(figDir, "p1-f1_min.png") },
      titulo: { bbox: [1, 2, 3, 4] as [number, number, number, number], pngPath: join(figDir, "p1-f1_titulo.png") },
      completa: { bbox: [1, 2, 3, 4] as [number, number, number, number], pngPath: join(figDir, "p1-f1_completa.png") },
      tudo: { bbox: [1, 2, 3, 4] as [number, number, number, number], pngPath: join(figDir, "p1-f1_tudo.png") },
    };
    state.figuras = [{ id: "p1-f1", pagina: 1, bboxMin: [1, 2, 3, 4], tipo: "raster", variantes, textosAdjacentes: [] }];
    state.questoes[0].figurasDisponiveis = ["p1-f1"];
    saveRunState(base, state);
    const item = await runNext(base, "hash1", MATRIZ_PATH);
    expect(item?.figuras_disponiveis).toEqual([
      {
        id: "p1-f1",
        variantes: {
          min: variantes.min.pngPath,
          titulo: variantes.titulo.pngPath,
          completa: variantes.completa.pngPath,
          tudo: variantes.tudo.pngPath,
        },
        textosAdjacentes: [],
      },
    ]);
  });
```

Trocar o teste `"aceita includegraphics com o pngPath absoluto exato do manifesto"` — este precisa de um PDF real porque, com figura referenciada, o `submit` vai tentar mascarar o OCR (Task 9):

```typescript
  it("aceita includegraphics com o pngPath absoluto exato do manifesto", async () => {
    const texDir = mkdtempSync(join(tmpdir(), "transcricao-tex-"));
    const texPath = join(texDir, "q91.tex");
    const pngPath = join(base, "hash1", "figuras", "p1-f1.png");
    const state = estadoInicial("hash1");
    state.figuras = [{ id: "p1-f1", pagina: 1, bbox: [1, 2, 3, 4], tipo: "raster", pngPath }];
    state.questoes[0].figurasDisponiveis = ["p1-f1"];
    saveRunState(base, state);
    writeFileSync(
      texPath,
      TEX_ACEITAVEL.replace("\\begin{choices}", `\\includegraphics{${pngPath}}\n\\begin{choices}`),
      "utf-8"
    );
    const resultado = await runSubmit(base, "hash1", "91", texPath, MATRIZ_PATH);
    expect(resultado.aceita).toBe(true);
    rmSync(texDir, { recursive: true, force: true });
  });
```

por:

```typescript
  it("aceita includegraphics com o pngPath absoluto exato do manifesto", async () => {
    const texDir = mkdtempSync(join(tmpdir(), "transcricao-tex-"));
    const texPath = join(texDir, "q91.tex");
    const pngPath = join(base, "hash1", "figuras", "p1-f1_min.png");
    const state = estadoInicial("hash1");
    // pdfPath real e paginaPdf=1: com figura referenciada, o submit mascara
    // o OCR (Task 9) — precisa de um PDF de verdade pro Ghostscript/Tesseract
    // rodarem. bbox [1,1,2,2] é minúscula de propósito (não precisa ser
    // geometricamente correta pra este teste, só existir).
    state.pdfPath = PDF_REAL;
    state.questoes[0].paginaPdf = 1;
    state.figuras = [
      {
        id: "p1-f1",
        pagina: 1,
        bboxMin: [1, 1, 2, 2],
        tipo: "raster",
        variantes: {
          min: { bbox: [1, 1, 2, 2], pngPath },
          titulo: { bbox: [1, 1, 2, 2], pngPath: pngPath.replace("_min", "_titulo") },
          completa: { bbox: [1, 1, 2, 2], pngPath: pngPath.replace("_min", "_completa") },
          tudo: { bbox: [1, 1, 2, 2], pngPath: pngPath.replace("_min", "_tudo") },
        },
        textosAdjacentes: [],
      },
    ];
    state.questoes[0].figurasDisponiveis = ["p1-f1"];
    saveRunState(base, state);
    writeFileSync(
      texPath,
      TEX_ACEITAVEL.replace("\\begin{choices}", `\\includegraphics{${pngPath}}\n\\begin{choices}`),
      "utf-8"
    );
    const resultado = await runSubmit(base, "hash1", "91", texPath, MATRIZ_PATH);
    expect(resultado.aceita).toBe(true);
    rmSync(texDir, { recursive: true, force: true });
  }, 60_000);
```

- [ ] **Step 4: Rodar os testes de init e cli — devem falhar ainda em partes que a Task 9/10 corrigem (esperado)**

Run: `npx vitest run transcricao/tests/cli/next-submit-status.test.ts`

Expected: o teste `"next devolve as 4 variantes..."` falha (porque `cli/next.ts` ainda devolve o formato antigo — Task 10 corrige). O teste `"aceita includegraphics..."` falha porque `submit.ts` ainda não masca o OCR (Task 9 corrige, mas não deveria QUEBRAR o teste — sem masking, o teste deve continuar passando já que a figura é pequena e o texto do `.tex` já bate com o OCR original; se falhar aqui por outro motivo, investigar antes de prosseguir). Anotar quais falhas são esperadas (ligadas a Task 9/10) e quais não são.

- [ ] **Step 5: Rodar `pnpm tsc --noEmit` pra confirmar que extract.ts/init.ts não têm mais erro de tipo**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "extract\.ts|init\.ts"`

Expected: sem saída (nenhum erro nesses 2 arquivos).

- [ ] **Step 6: Commit**

```bash
git add transcricao/adapters/enem/extract.ts transcricao/cli/init.ts transcricao/tests/cli/next-submit-status.test.ts
git commit -m "feat(transcricao): extractEnem monta manifest v2 (variantes+textosAdjacentes), init grava formatVersion e paginaPdf

QuestaoRunState.paginaPdf propagado do adapter — necessario pro submit
mascarar o OCR (Task 9). Testes de next-submit-status atualizados pro
novo formato de FiguraManifest; teste de includegraphics passa a usar
PDF real (precisa pra mascarar de verdade)."
```

---

## Task 7: `scripts/mask-page-and-ocr.py` + `transcricao/core/ocr-mascarado.ts`

**Files:**
- Create: `scripts/mask-page-and-ocr.py`
- Create: `transcricao/core/ocr-mascarado.ts`
- Create: `transcricao/tests/core/ocr-mascarado.test.ts`

**Contexto:** dado um PDF + página + lista de bboxes (as escolhidas pela IA via `\includegraphics`), renderiza a página, pinta essas bboxes de branco, roda Tesseract no resultado. É essa saída que os gates `comprimento`/`cobertura` passam a comparar (Task 9) — o texto que só existe dentro da figura escolhida some do OCR de referência, então a IA não precisa duplicá-lo no `.tex`.

- [ ] **Step 1: Confirmar que Pillow está instalado (PyMuPDF já é usado em outros scripts)**

Run: `python -c "from PIL import Image, ImageDraw; print('ok')"`

Expected: `ok`. (Confirmado disponível nesta sessão de planejamento — `PIL 10.4.0`.)

- [ ] **Step 2: Criar `scripts/mask-page-and-ocr.py`**

```python
"""Mask rectangular regions of a PDF page (paint them white) and OCR what's left.

Used by transcricao/core/ocr-mascarado.ts to build the "OCR mascarado" that
gates/comprimento.ts and gates/cobertura.ts compare against — the AI is not
forced to duplicate in the .tex text that only exists inside a figure
(title, axis scale, labels) once that figure's bbox has been chosen and is
masked here.

Usage:
  python scripts/mask-page-and-ocr.py <pdf> <page> --bbox x0 y0 x1 y1 [--bbox x0 y0 x1 y1 ...] [--dpi 300]

Coordinates are PDF points (1pt = 1/72in), same convention as
list-page-figures.py / render-pdf-rect.py. Prints the OCR'd text to stdout.
With zero --bbox, just OCRs the page unmasked.

Tesseract path resolution: env var TESSERACT_PATH, falling back to the
default Windows install path (same convention as transcricao/core/ocr.ts).
"""
import argparse
import os
import subprocess
import sys
import tempfile

import fitz  # pymupdf
from PIL import Image, ImageDraw

TESSERACT_DEFAULT = "C:/Program Files/Tesseract-OCR/tesseract.exe"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("page", type=int)
    parser.add_argument("--bbox", nargs=4, type=float, action="append", default=[])
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args()

    tesseract_path = os.environ.get("TESSERACT_PATH", TESSERACT_DEFAULT)

    doc = fitz.open(args.pdf)
    if args.page < 1 or args.page > doc.page_count:
        print(f"page {args.page} out of range (pdf has {doc.page_count} pages)", file=sys.stderr)
        sys.exit(1)
    page = doc[args.page - 1]

    zoom = args.dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    draw = ImageDraw.Draw(img)
    for x0, y0, x1, y1 in args.bbox:
        px0, py0, px1, py1 = x0 * zoom, y0 * zoom, x1 * zoom, y1 * zoom
        draw.rectangle([px0, py0, px1, py1], fill="white")

    with tempfile.TemporaryDirectory() as tmpdir:
        png_path = os.path.join(tmpdir, "masked.png")
        img.save(png_path)
        out_base = os.path.join(tmpdir, "masked")
        try:
            subprocess.run(
                [tesseract_path, png_path, out_base, "-l", "por"],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            stderr = e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e)
            print(f"tesseract falhou: {stderr}", file=sys.stderr)
            sys.exit(1)
        except FileNotFoundError:
            print(f"tesseract não encontrado em {tesseract_path} (setar TESSERACT_PATH)", file=sys.stderr)
            sys.exit(1)

        with open(f"{out_base}.txt", "r", encoding="utf-8") as f:
            sys.stdout.write(f.read())


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Testar manualmente contra a Q170 (página 28)**

Run:

```bash
python scripts/mask-page-and-ocr.py scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf 28 --bbox 59.7 130.5 273.3 342.6
```

Expected: saída contém "Questão 170" e o enunciado, mas **não** contém "Nível dos reservatórios", "Reservatório" (maiúsculo, label do eixo) nem "Capacidade".

- [ ] **Step 4: Escrever `transcricao/core/ocr-mascarado.ts`**

```typescript
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function pythonBin(): string {
  return process.env.TRANSCRICAO_PYTHON || "python";
}

const MASK_SCRIPT = resolve(__dirname, "../../scripts/mask-page-and-ocr.py");

/**
 * OCR de uma página com bboxes específicas mascaradas (pintadas de branco)
 * antes do reconhecimento. Usado pelo submit pra montar o texto de
 * referência dos gates comprimento/cobertura — a IA não é obrigada a
 * duplicar no .tex texto que só existe dentro de uma figura já escolhida
 * (título, escala de eixo, labels). Com `bboxes` vazio, ainda roda o
 * Tesseract na página inteira, sem máscara nenhuma.
 */
export function ocrDaPaginaComBboxesMascaradas(
  pdfPath: string,
  pagina: number,
  bboxes: Array<[number, number, number, number]>,
  dpi = 300
): string {
  if (!existsSync(pdfPath)) {
    throw new Error(`ocr-mascarado: PDF não encontrado: ${pdfPath}`);
  }
  const args = [MASK_SCRIPT, pdfPath, String(pagina)];
  for (const bbox of bboxes) {
    args.push("--bbox", ...bbox.map(String));
  }
  args.push("--dpi", String(dpi));
  try {
    return execFileSync(pythonBin(), args, { encoding: "utf-8" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `mask-page-and-ocr.py falhou (${pdfPath}, página ${pagina}, ${bboxes.length} bbox(es)): ${msg}`
    );
  }
}
```

- [ ] **Step 5: Escrever `transcricao/tests/core/ocr-mascarado.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { ocrDaPaginaComBboxesMascaradas } from "../../core/ocr-mascarado";

const PDF = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf");

describe("ocr-mascarado", () => {
  it("mascara a bbox completa da Q170 e remove titulo/eixo/legenda, mantendo o enunciado", () => {
    const bboxCompleta: [number, number, number, number] = [59.7, 130.5, 273.3, 342.6];
    const texto = ocrDaPaginaComBboxesMascaradas(PDF, 28, [bboxCompleta]);
    expect(texto).not.toContain("Nível dos reservatórios");
    expect(texto).not.toContain("Reservatório");
    expect(texto).not.toContain("Capacidade");
    expect(texto).toContain("Questão 170");
    expect(texto).toMatch(/reservat[oó]rios/i); // enunciado ainda menciona "reservatórios" fora da figura
  }, 60_000);

  it("sem bboxes, retorna o OCR da página inteira (sem máscara)", () => {
    const texto = ocrDaPaginaComBboxesMascaradas(PDF, 28, []);
    expect(texto).toContain("Questão 170");
    expect(texto).toContain("Reservatório");
  }, 60_000);

  it("lança erro claro se o PDF não existe", () => {
    expect(() => ocrDaPaginaComBboxesMascaradas("/nao/existe.pdf", 1, [])).toThrow(/não encontrado/);
  });
});
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run transcricao/tests/core/ocr-mascarado.test.ts`

Expected: 3 testes passando (os 2 primeiros são lentos — render + Tesseract real).

- [ ] **Step 7: Commit**

```bash
git add scripts/mask-page-and-ocr.py transcricao/core/ocr-mascarado.ts transcricao/tests/core/ocr-mascarado.test.ts
git commit -m "feat(transcricao): mask-page-and-ocr.py + ocrDaPaginaComBboxesMascaradas

Novo caminho de OCR que pinta de branco as bboxes de figura ja escolhidas
pela IA antes de rodar o Tesseract — a IA nao precisa mais duplicar no
.tex texto que so existe dentro da figura (titulo, escala, labels)."
```

---

## Task 8: Gate novo `title-credits-validos`

**Files:**
- Create: `transcricao/gates/title-credits-validos.ts`
- Create: `transcricao/tests/gates/title-credits-validos.test.ts`

**Contexto:** quando a IA extrai título/crédito de uma figura pra `\title{}`/`\credits{}` no `.tex` (Task 11), esse conteúdo precisa continuar sendo verificado contra o OCR original — senão vira uma brecha de alucinação (a IA poderia escrever qualquer coisa dentro de `\title{}` e nenhum gate pegaria, já que `\title`/`\credits` não fazem parte do "texto comparável" de `diff-palavras`/`ordem-tokens` hoje — ver `extrairTextoComparavel` em `gates/index.ts`, que remove nomes de comando LaTeX preservando conteúdo de argumento, então na verdade `\title{X}` JÁ vira `X` dentro do texto comparável de `diff-palavras`. Mesmo assim, um gate dedicado com mensagem de erro específica pra este caso — "palavra não encontrada dentro de `\title{}`" em vez de um "palavra não encontrada" genérico — ajuda a IA a corrigir mais rápido, e documenta explicitamente essa garantia como parte do contrato do design, não como efeito colateral do gate genérico).

- [ ] **Step 1: Escrever o teste (TDD)**

Criar `transcricao/tests/gates/title-credits-validos.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { gateTitleCreditsValidos } from "../../gates/title-credits-validos";

describe("gate title-credits-validos", () => {
  const ocr = "Nível dos reservatórios em 2 fev. 2015. Fonte: IBGE, 2021.";

  it("aceita \\title cujo conteúdo existe no OCR", () => {
    const tex = "\\title{Nível dos reservatórios em 2 fev. 2015}";
    expect(gateTitleCreditsValidos(tex, ocr).ok).toBe(true);
  });

  it("aceita \\credits cujo conteúdo existe no OCR", () => {
    const tex = "\\credits{Fonte: IBGE, 2021.}";
    expect(gateTitleCreditsValidos(tex, ocr).ok).toBe(true);
  });

  it("rejeita \\title com palavra inventada", () => {
    const tex = "\\title{Nível inventado dos reservatórios}";
    const r = gateTitleCreditsValidos(tex, ocr);
    expect(r.ok).toBe(false);
    expect(r.motivos.join(" ")).toMatch(/inventado/);
  });

  it("rejeita \\credits com palavra inventada", () => {
    const tex = "\\credits{Fonte: DataFake, 2021.}";
    const r = gateTitleCreditsValidos(tex, ocr);
    expect(r.ok).toBe(false);
    expect(r.motivos.join(" ")).toMatch(/datafake/i);
  });

  it("aceita quando não há \\title nem \\credits", () => {
    expect(gateTitleCreditsValidos("\\question sem nada disso", ocr).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR (módulo não existe)**

Run: `npx vitest run transcricao/tests/gates/title-credits-validos.test.ts`

Expected: erro de import (`Cannot find module '../../gates/title-credits-validos'`).

- [ ] **Step 3: Escrever `transcricao/gates/title-credits-validos.ts`**

```typescript
import type { GateResult } from "../core/types";

// Mesma whitelist/normalização de diff-palavras.ts — duplicada de propósito
// (arquivo pequeno, extrair uma dependência cruzada só por isso não compensa).
const WHITELIST = new Set([
  "e", "ou", "mas", "porém", "portanto", "assim", "logo", "então", "pois",
  "que", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "para", "com", "sem",
  "mais", "menos", "muito", "pouco",
]);

function normalizar(palavra: string): string {
  return palavra
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "");
}

function tokenizar(texto: string): string[] {
  return texto.split(/\s+/).map(normalizar).filter(Boolean);
}

function extrairComandos(tex: string, comando: "title" | "credits"): string[] {
  const re = new RegExp(`\\\\${comando}\\{([^}]*)\\}`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex))) out.push(m[1]);
  return out;
}

export function gateTitleCreditsValidos(tex: string, ocrCompleto: string): GateResult {
  const ocrTokens = new Set(tokenizar(ocrCompleto));
  const motivos: string[] = [];

  for (const comando of ["title", "credits"] as const) {
    for (const conteudo of extrairComandos(tex, comando)) {
      const tokensOriginais = conteudo.split(/\s+/).filter(Boolean);
      const tokensNorm = tokensOriginais.map(normalizar);
      for (let i = 0; i < tokensNorm.length; i++) {
        const token = tokensNorm[i];
        if (!token) continue;
        if (WHITELIST.has(token)) continue;
        if (/^\d+$/.test(token)) continue;
        if (ocrTokens.has(token)) continue;
        motivos.push(
          `\\${comando}{}: palavra não encontrada no OCR: "${tokensOriginais[i]}" (dentro de "${conteudo}")`
        );
      }
    }
  }

  return { gateId: "title-credits-validos", ok: motivos.length === 0, motivos };
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run transcricao/tests/gates/title-credits-validos.test.ts`

Expected: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add transcricao/gates/title-credits-validos.ts transcricao/tests/gates/title-credits-validos.test.ts
git commit -m "feat(transcricao): gate title-credits-validos — title/credits externos continuam sob anti-alucinacao"
```

---

## Task 9: `transcricao/gates/index.ts` + `transcricao/cli/submit.ts` — roteamento do OCR mascarado, remoção de `todasAlternativasSaoImagens`

**Files:**
- Modify: `transcricao/gates/index.ts`
- Modify: `transcricao/tests/gates/index.test.ts`
- Modify: `transcricao/adapters/enem/parse.ts`
- Modify: `transcricao/cli/submit.ts`

**Contexto:** esta é a task que efetivamente muda o comportamento fim-a-fim. `gates/index.ts` passa a receber `ocrCompleto` (pra `diff-palavras`/`ordem-tokens`/`title-credits-validos`) e `ocrMascarado` (pra `comprimento`/`cobertura`) em vez de um `ocr` único. O mecanismo antigo (`todasAlternativasSaoImagens`, que isentava comprimento/cobertura quando todas as alternativas eram imagem) é removido — a máscara resolve o mesmo caso (Q154) de forma mais geral, sem precisar de uma regra especial só pra alternativas.

- [ ] **Step 1: Reescrever `transcricao/gates/index.ts`**

```typescript
import type { GateResult } from "../core/types";
import type { MatrizHabilidades } from "../core/taxonomia";
import { gateDiffPalavras } from "./diff-palavras";
import { gateOrdemTokens } from "./ordem-tokens";
import { gateComprimento } from "./comprimento";
import { gateCobertura } from "./cobertura";
import { gateGabarito } from "./gabarito";
import { gateCheckerTex } from "./checker-tex";
import { gateYamlCompleto } from "./yaml-completo";
import { gateFigurasListadas } from "./figuras-listadas";
import { gateTitleCreditsValidos } from "./title-credits-validos";

export type InsumosGates = {
  tex: string;
  /** OCR completo da questão (sem máscara) — usado por diff-palavras, ordem-tokens e title-credits-validos. */
  ocrCompleto: string;
  /** OCR com as bboxes das figuras ESCOLHIDAS já pintadas de branco — usado por comprimento e cobertura. Se nenhuma figura foi referenciada no .tex, é igual a ocrCompleto (ver cli/submit.ts). */
  ocrMascarado: string;
  gabaritoOficial: string | null;
  pathsFigurasValidos: string[];
  matrizHabilidades: MatrizHabilidades;
};

export function extrairYaml(tex: string): string {
  const m = /---\r?\n([\s\S]*?)\r?\n---/.exec(tex);
  return m ? m[1] : "";
}

/**
 * Remove estrutura do formato para comparar somente conteúdo autoral com o OCR.
 *
 * IMPORTANTE: conteúdo dentro de `\(...\)`/`\[...\]` (fórmulas/equações LaTeX)
 * é removido INTEIRO, não só a marcação — ao contrário de texto corrido,
 * fórmula não tem como ser fiel por comparação literal com o OCR (não existe
 * ferramenta confiável de OCR-pra-LaTeX; testamos Texify e Pix2Text, ambos
 * alucinaram estrutura que não existe na imagem real). A IA reconstrói
 * fórmula olhando a imagem da prova diretamente (visão), não o OCR — ver
 * `transcricao/PROMPT-CANONICO.md`. Rastreabilidade fica no comentário LaTeX
 * `% RECONSTRUÍDO POR VISÃO: ...` que a IA é instruída a deixar acima da
 * fórmula (já removido pela regra de comentário abaixo, mas indexado por
 * `cli/report.ts` a partir do `.tex` bruto — ver lá).
 */
export function extrairTextoComparavel(tex: string): string {
  return tex
    .replace(/---\r?\n[\s\S]*?\r?\n---/, " ")
    .replace(/\\\(([\s\S]*?)\\\)/g, " ")
    .replace(/\\\[([\s\S]*?)\\\]/g, " ")
    .replace(/%[^\n]*/g, " ")
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/g, " ")
    .replace(/\\(?:begin|end)\{[^}]+\}/g, " ")
    // Remove genericamente o nome do comando, preservando o conteúdo dos argumentos.
    // Ex.: \ce{H2O} -> {H2O}, \frac{1}{2} -> {1}{2}, \part texto -> texto,
    // \title{X} -> {X}, \credits{Y} -> {Y}.
    .replace(/\\[A-Za-z@]+\*?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rodarTodosOsGates(insumos: InsumosGates): { ok: boolean; resultados: GateResult[] } {
  const yaml = extrairYaml(insumos.tex);
  const textoComparavel = extrairTextoComparavel(insumos.tex);
  const resultados: GateResult[] = [
    gateDiffPalavras(textoComparavel, insumos.ocrCompleto),
    gateOrdemTokens(textoComparavel, insumos.ocrCompleto),
    gateComprimento(textoComparavel, insumos.ocrMascarado),
    gateCobertura(textoComparavel, insumos.ocrMascarado),
    gateGabarito(yaml, insumos.gabaritoOficial),
    gateCheckerTex(insumos.tex),
    gateYamlCompleto(yaml, insumos.matrizHabilidades),
    gateFigurasListadas(insumos.tex, insumos.pathsFigurasValidos),
    gateTitleCreditsValidos(insumos.tex, insumos.ocrCompleto),
  ];
  return { ok: resultados.every((r) => r.ok), resultados };
}
```

Note: `todasAlternativasSaoImagens` foi removida por completo (não é mais exportada, não é mais chamada). O `.replace(/\\[A-Za-z@]+\*?/g, " ")` já cobria `\title`/`\credits` antes desta task (preserva conteúdo do argumento) — isso não muda, só é documentado agora no comentário.

- [ ] **Step 2: Reescrever `transcricao/tests/gates/index.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { rodarTodosOsGates, type InsumosGates } from "../../gates/index";
import { parseMatrizHabilidades } from "../../core/taxonomia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MATRIZ = parseMatrizHabilidades(readFileSync(resolve(__dirname, "../../../scripts/provas/enem/matriz_referencia.txt"), "utf-8"));
const TEX_OK = `\\question
---
tipo: Múltipla Escolha
dificuldade: Fácil
disciplina: Biologia
assunto: Primeira Lei de Mendel
tags: [enem-cn-h13, heranca-recessiva, mendel]
gabarito: A
fonte: concurso
concurso: ENEM
banca: INEP
ano: 2021
numero: "91"
---
A herança é de caráter recessivo neste caso segundo o texto.
\\begin{choices}
  \\correctchoice recessivo.
  \\choice dominante.
  \\choice codominante.
  \\choice poligênico.
  \\choice polialélico.
\\end{choices}
`;
const OCR = "A herança é de caráter recessivo neste caso segundo o texto. recessivo dominante codominante poligênico polialélico";

function insumos(overrides: Partial<InsumosGates> = {}): InsumosGates {
  return {
    tex: TEX_OK,
    ocrCompleto: OCR,
    ocrMascarado: OCR,
    gabaritoOficial: "A",
    pathsFigurasValidos: [],
    matrizHabilidades: MATRIZ,
    ...overrides,
  };
}

describe("gates/index — rodarTodosOsGates", () => {
  it("aceita quando todos os 9 gates passam", () => {
    const r = rodarTodosOsGates(insumos());
    expect(r.ok).toBe(true);
    expect(r.resultados).toHaveLength(9);
  });

  it("agrega motivos de múltiplos gates quando mais de um rejeita", () => {
    const r = rodarTodosOsGates(insumos({
      gabaritoOficial: "B",
      ocrCompleto: "nada a ver aqui totalmente diferente",
      ocrMascarado: "nada a ver aqui totalmente diferente",
    }));
    expect(r.ok).toBe(false);
    expect(r.resultados.filter((g) => !g.ok).map((g) => g.gateId)).toContain("gabarito");
  });

  it("remove nomes de comandos LaTeX e preserva o conteúdo dos argumentos", () => {
    const tex = TEX_OK.replace(
      "A herança é de caráter recessivo neste caso segundo o texto.",
      "A herança usa \\ce{H2O} e \\textbf{caráter recessivo} segundo o texto."
    );
    const ocr = "A herança usa H2O e caráter recessivo segundo o texto. recessivo dominante codominante poligênico polialélico";
    expect(rodarTodosOsGates(insumos({ tex, ocrCompleto: ocr, ocrMascarado: ocr })).ok).toBe(true);
  });

  it("isenta conteúdo dentro de \\(...\\) da comparação com o OCR (fórmula reconstruída por visão, não por OCR)", () => {
    const tex = TEX_OK.replace(
      "A herança é de caráter recessivo neste caso segundo o texto.",
      "Considere as semiequações de redução.\n\n" +
        "% RECONSTRUÍDO POR VISÃO: equações redox garbled no OCR (sopa de símbolo)\n" +
        "\\[\\mathrm{I_2 + 2\\,e^- \\to 2\\,I^- \\qquad E^\\circ = +0{,}54\\,V}\\]\n\n" +
        "recessivo neste caso segundo o texto."
    );
    const ocr =
      "Considere as semiequações de redução. L+2e > 2 Eº=+0,54V recessivo neste caso segundo o texto. recessivo dominante codominante poligênico polialélico";
    const r = rodarTodosOsGates(insumos({ tex, ocrCompleto: ocr, ocrMascarado: ocr }));
    expect(r.ok).toBe(true);
  });

  it("comprimento/cobertura passam com OCR mascarado enxuto — substitui a antiga isenção todasAlternativasSaoImagens (achado real: Q154 do ENEM 2021 D2, 5 gráficos cartesianos)", () => {
    // ocrCompleto: OCR real da página, INCLUINDO o ruído que o Tesseract produz
    // tentando "ler" os 5 gráficos como texto (números soltos, símbolos).
    const ocrCompletoReal =
      "Questão 154 enemzoz\nO quadro representa a relação entre o preço de um produto (R) e seu respectivo imposto devido (1).\n" +
      "Preço do produto (R) Imposto devido (1)\nR<5000 isento\n5 000<R<10000 10% de (R — 5 000)\n10 000<R<15 000 500 + 30% de (R — 10 000)\n\n" +
      "O gráfico que melhor representa essa relação é\n\n(A) 14 D) pj A\n2000 2000--------—— O e)\n\n500 500 | --- O\n> O >\n" +
      "0] 5000 10000 15000 0] 5000 10000 15000\nB) LE)\n14 IA\n1000 1000\n500 500\n0] 5000 10000 15000 - 0 5000 10000 15000 -\nIC)\nIA\n" +
      "1000f------===-= ==...\n\n500 p------- =,\n\nR\n\n>\n\n5000 10000 15000\n\nenemo>027 MT - 2º dia | Caderno 5 - AMARELO - 1º Aplicação 2)";
    // ocrMascarado: simula o que sobra depois de mascarar as bboxes dos 5
    // gráficos-alternativa — só a prosa (quadro + intro), sem o ruído.
    const ocrMascaradoSimulado =
      "Questão 154 enemzoz\nO quadro representa a relação entre o preço de um produto (R) e seu respectivo imposto devido (1).\n" +
      "Preço do produto (R) Imposto devido (1)\nR<5000 isento\n5 000<R<10000 10% de (R — 5 000)\n10 000<R<15 000 500 + 30% de (R — 10 000)\n\n" +
      "O gráfico que melhor representa essa relação é\n\nenemo>027 MT - 2º dia | Caderno 5 - AMARELO - 1º Aplicação 2)";
    const figs = [
      "C:\\figuras\\p21-f1_min.png", "C:\\figuras\\p21-f2_min.png", "C:\\figuras\\p21-f3_min.png",
      "C:\\figuras\\p21-f4_min.png", "C:\\figuras\\p21-f5_min.png", "C:\\figuras\\p21-f6_min.png",
    ];
    const tex = `\\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Matemática
assunto: Funções Definidas por Várias Sentenças
tags: [enem-mt-h20]
gabarito: A
fonte: concurso
concurso: ENEM
banca: INEP
ano: 2021
numero: "154"
---
O quadro representa a relação entre o preço de um produto (R) e seu respectivo imposto devido (1).

\\includegraphics{${figs[0]}}

O gráfico que melhor representa essa relação é
\\begin{choices}
  \\correctchoice \\includegraphics{${figs[1]}}
  \\choice \\includegraphics{${figs[2]}}
  \\choice \\includegraphics{${figs[3]}}
  \\choice \\includegraphics{${figs[4]}}
  \\choice \\includegraphics{${figs[5]}}
\\end{choices}
`;
    const r = rodarTodosOsGates({
      tex,
      ocrCompleto: ocrCompletoReal,
      ocrMascarado: ocrMascaradoSimulado,
      gabaritoOficial: "A",
      pathsFigurasValidos: figs,
      matrizHabilidades: MATRIZ,
    });
    expect(r.resultados.find((g) => g.gateId === "comprimento")?.ok).toBe(true);
    expect(r.resultados.find((g) => g.gateId === "cobertura")?.ok).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("cobertura ainda rejeita quando o conteúdo diverge de verdade (não é só ruído de figura)", () => {
    const tex = TEX_OK.replace(
      "\\choice dominante.",
      "\\choice \\includegraphics{C:\\figuras\\p1-f1_min.png}"
    );
    const ocr = "texto completamente diferente sem nenhuma palavra em comum aqui";
    const r = rodarTodosOsGates(insumos({
      tex,
      ocrCompleto: ocr,
      ocrMascarado: ocr,
      pathsFigurasValidos: ["C:\\figuras\\p1-f1_min.png"],
    }));
    expect(r.resultados.find((g) => g.gateId === "cobertura")?.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar os testes de `gates/index.ts` — devem PASSAR**

Run: `npx vitest run transcricao/tests/gates/index.test.ts`

Expected: 6 testes passando.

- [ ] **Step 4: Adicionar `extrairTrechoDeQuestaoNaPagina` em `transcricao/adapters/enem/parse.ts`**

Adicionar ao final do arquivo (sem remover nada do que já existe):

```typescript
const MARCADOR_QUESTAO_TRECHO = /QUEST[ÃA]O\s+(\d+)/gi;

/**
 * Extrai o trecho de UMA questão específica dentro do texto de UMA página —
 * mesma lógica de marcador de `parseQuestoesEnem`, mas pra uso pontual (ex:
 * re-fatiar o texto da página depois de mascarar figuras no submit — ver
 * `cli/submit.ts`). Retorna null se o marcador da questão não aparecer no
 * texto (ex: header "Questão N" foi engolido pelo Tesseract perto de uma
 * figura — mesmo fenômeno que `recuperarMarcadoresAusentes` trata no parse
 * completo; aqui, sem o contexto de página anterior/seguinte necessário pra
 * aplicar essa heurística, apenas retorna null e quem chama decide o
 * fallback).
 */
export function extrairTrechoDeQuestaoNaPagina(textoPagina: string, questaoId: string): string | null {
  const marcadores: { numero: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  MARCADOR_QUESTAO_TRECHO.lastIndex = 0;
  while ((m = MARCADOR_QUESTAO_TRECHO.exec(textoPagina))) {
    marcadores.push({ numero: m[1], index: m.index });
  }
  const idx = marcadores.findIndex((mk) => mk.numero === questaoId);
  if (idx < 0) return null;
  const inicio = marcadores[idx].index;
  const fim = idx + 1 < marcadores.length ? marcadores[idx + 1].index : textoPagina.length;
  return textoPagina.slice(inicio, fim).trim();
}
```

- [ ] **Step 5: Testar `extrairTrechoDeQuestaoNaPagina` (adicionar ao arquivo de teste do adapter)**

Ver `transcricao/tests/adapters/enem/parse.test.ts` (já existe — ler antes de editar) e adicionar ao final:

```typescript
describe("extrairTrechoDeQuestaoNaPagina", () => {
  it("extrai o trecho entre o marcador da questão e o próximo marcador", () => {
    const pagina = "lixo antes\nQuestão 91\ntexto da 91\nQuestão 92\ntexto da 92";
    expect(extrairTrechoDeQuestaoNaPagina(pagina, "91")).toBe("Questão 91\ntexto da 91");
  });

  it("extrai até o fim do texto quando é a última questão da página", () => {
    const pagina = "Questão 91\ntexto da 91\nQuestão 92\ntexto da 92 até o fim";
    expect(extrairTrechoDeQuestaoNaPagina(pagina, "92")).toBe("Questão 92\ntexto da 92 até o fim");
  });

  it("retorna null quando o marcador não existe no texto", () => {
    const pagina = "Questão 91\ntexto da 91";
    expect(extrairTrechoDeQuestaoNaPagina(pagina, "99")).toBeNull();
  });
});
```

Adicionar `extrairTrechoDeQuestaoNaPagina` ao import de `parseQuestoesEnem` no topo do arquivo de teste.

Run: `npx vitest run transcricao/tests/adapters/enem/parse.test.ts`

Expected: todos os testes passando (os já existentes + os 3 novos).

- [ ] **Step 6: Reescrever `transcricao/cli/submit.ts`**

```typescript
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRunState, runDir, saveRunState } from "../core/run-state";
import { extrairYaml, rodarTodosOsGates } from "../gates/index";
import { parseMatrizHabilidades } from "../core/taxonomia";
import { extrairTrechoDeQuestaoNaPagina } from "../adapters/enem/parse";
import { ocrDaPaginaComBboxesMascaradas } from "../core/ocr-mascarado";
import type { RunState, TentativaSubmissao } from "../core/types";
import { verifyEnem } from "../adapters/enem/verify";

const MAX_TENTATIVAS = 3;

export type SubmitResultado = {
  aceita: boolean;
  motivos: string[];
};

function extrairPathsIncludegraphics(tex: string): string[] {
  const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex))) paths.push(m[1].trim());
  return paths;
}

/** Bboxes das figuras cujo path (de qualquer uma das 4 variantes) foi
 * referenciado no .tex — usadas pra mascarar o OCR. Paths que não batem
 * com nenhuma variante do manifest são ignorados aqui (gateFigurasListadas
 * já rejeita esses paths — não precisa duplicar a checagem). */
function bboxesEscolhidas(state: RunState, paths: string[]): Array<[number, number, number, number]> {
  const bboxes: Array<[number, number, number, number]> = [];
  for (const path of paths) {
    for (const figura of state.figuras) {
      const variante = Object.values(figura.variantes).find((v) => v.pngPath === path);
      if (variante) {
        bboxes.push(variante.bbox);
        break;
      }
    }
  }
  return bboxes;
}

export async function runSubmit(
  baseOverride: string | undefined,
  hash: string,
  questaoId: string,
  texPath: string,
  matrizPath: string
): Promise<SubmitResultado> {
  const state = loadRunState(baseOverride, hash);
  const questao = state.questoes.find((q) => q.id === questaoId);
  if (!questao) throw new Error(`submit: questão "${questaoId}" não encontrada no run ${hash}`);

  questao.status = "submitted";
  saveRunState(baseOverride, state);

  const tex = readFileSync(texPath, "utf-8");
  const matriz = parseMatrizHabilidades(readFileSync(matrizPath, "utf-8"));

  const pathsFigurasValidos = state.figuras
    .filter((f) => questao.figurasDisponiveis.includes(f.id))
    .flatMap((f) => Object.values(f.variantes).map((v) => v.pngPath));

  const pathsReferenciados = extrairPathsIncludegraphics(tex);
  const bboxes = bboxesEscolhidas(state, pathsReferenciados);

  // Só toca o PDF (Ghostscript + Tesseract, caro) quando a questão de fato
  // referencia alguma figura conhecida — a maioria das questões não tem
  // figura nenhuma, e nesse caso ocrMascarado === ocrCompleto (comportamento
  // idêntico ao pipeline antes deste plano).
  let ocrMascarado = questao.ocrText;
  if (bboxes.length > 0) {
    const paginaMascarada = ocrDaPaginaComBboxesMascaradas(state.pdfPath, questao.paginaPdf, bboxes);
    ocrMascarado =
      state.adapter === "enem"
        ? extrairTrechoDeQuestaoNaPagina(paginaMascarada, questao.id) ?? paginaMascarada
        : paginaMascarada;
  }

  const resultado = rodarTodosOsGates({
    tex,
    ocrCompleto: questao.ocrText,
    ocrMascarado,
    gabaritoOficial: questao.gabaritoOficial,
    pathsFigurasValidos,
    matrizHabilidades: matriz,
  });

  const disciplina = /^disciplina:\s*(.+)$/m.exec(extrairYaml(tex))?.[1].trim();
  const verificacaoAdapter = state.adapter === "enem"
    ? verifyEnem(questao, disciplina)
    : { ok: true, motivos: [] };
  const aceita = resultado.ok && verificacaoAdapter.ok;
  const motivos = [...resultado.resultados.flatMap((r) => r.motivos), ...verificacaoAdapter.motivos];
  const tentativa: TentativaSubmissao = {
    tentativa: questao.tentativas.length + 1,
    texPath,
    aceita,
    motivos,
    timestamp: new Date().toISOString(),
  };
  questao.tentativas.push(tentativa);

  if (aceita) {
    const snapshotDir = join(runDir(baseOverride, hash), "accepted");
    mkdirSync(snapshotDir, { recursive: true });
    const snapshotPath = join(snapshotDir, `q${questao.id.replace(/[^\w-]/g, "_")}.tex`);
    writeFileSync(snapshotPath, tex, "utf-8");
    questao.status = "accepted";
    questao.texAceitoPath = snapshotPath;
  } else if (questao.tentativas.length >= MAX_TENTATIVAS) {
    questao.status = "needs-human";
    const rejeitadoPath = `${texPath}.rejected`;
    renameSync(texPath, rejeitadoPath);
  } else {
    questao.status = "rejected";
  }

  saveRunState(baseOverride, state);

  return { aceita, motivos };
}

if (require.main === module) {
  const [hash, questaoId, texPath] = process.argv.slice(2);
  if (!hash || !questaoId || !texPath) {
    console.error("Uso: pnpm tsx transcricao/cli/submit.ts <hash> <numero> <arquivo.tex>");
    process.exit(2);
  }
  runSubmit(undefined, hash, questaoId, texPath, "scripts/provas/enem/matriz_referencia.txt")
    .then((r) => {
      console.log(r.aceita ? "ACEITA" : `REJEITADA:\n${r.motivos.map((m) => `  - ${m}`).join("\n")}`);
      process.exit(r.aceita ? 0 : 1);
    })
    .catch((err) => {
      console.error(`submit falhou: ${err.message}`);
      process.exit(1);
    });
}
```

- [ ] **Step 7: Rodar os testes de CLI (agora as falhas esperadas da Task 6/Step 4 devem estar resolvidas)**

Run: `npx vitest run transcricao/tests/cli/next-submit-status.test.ts`

Expected: todos passando (`"aceita includegraphics..."` agora mascara de verdade via `state.pdfPath` real e passa; `"next devolve as 4 variantes..."` ainda depende da Task 10 — ver próximo passo).

- [ ] **Step 8: `pnpm tsc --noEmit` — confirmar que `submit.ts`/`gates/index.ts`/`parse.ts` não têm mais erro**

Run: `pnpm tsc --noEmit 2>&1 | grep -E "submit\.ts|gates/index\.ts|adapters/enem/parse\.ts"`

Expected: sem saída.

- [ ] **Step 9: Commit**

```bash
git add transcricao/gates/index.ts transcricao/tests/gates/index.test.ts transcricao/adapters/enem/parse.ts transcricao/tests/adapters/enem/parse.test.ts transcricao/cli/submit.ts
git commit -m "feat(transcricao): submit mascara o OCR das figuras escolhidas antes de rodar comprimento/cobertura

Remove todasAlternativasSaoImagens (commit e769bb8) — a mascara resolve o
mesmo caso (Q154, 5 alternativas em grafico) de forma geral, sem regra
especial so pra alternativas. diff-palavras/ordem-tokens continuam
intactos contra o OCR completo (anti-alucinacao preservada).

extrairTrechoDeQuestaoNaPagina novo em adapters/enem/parse.ts: re-fatia
o texto da pagina mascarada pro trecho da questao especifica, mesma
logica de marcador que parseQuestoesEnem ja usava."
```

---

## Task 10: `transcricao/cli/next.ts` — entregar as 4 variantes por figura pra IA

**Files:**
- Modify: `transcricao/cli/next.ts`

**Contexto:** hoje `figuras_disponiveis` é `string[]` (um path por figura). Precisa virar uma lista de objetos com as 4 variantes + texto adjacente + sugestão de tag, pra IA escolher (Task 11 ensina como).

- [ ] **Step 1: Reescrever `transcricao/cli/next.ts`**

```typescript
import { loadRunState, saveRunState } from "../core/run-state";
import type { DirecaoTexto, NomeVariante, SugestaoTag } from "../core/types";

export type FiguraParaIA = {
  id: string;
  variantes: Record<NomeVariante, string>; // nome da variante -> pngPath absoluto
  textosAdjacentes: Array<{
    texto: string;
    direcao: DirecaoTexto;
    distancia: number;
    sugestaoTag: SugestaoTag;
  }>;
};

export type NextItem = {
  questao_id: string;
  ocr_text: string;
  figuras_disponiveis: FiguraParaIA[];
  gabarito: string | null;
  feedback_tentativa_anterior: string[];
};

export async function runNext(baseOverride: string | undefined, hash: string, _matrizPath: string): Promise<NextItem | null> {
  const state = loadRunState(baseOverride, hash);
  const proxima = state.questoes.find((q) => q.status === "in-progress")
    ?? state.questoes.find((q) => q.status === "pending" || q.status === "rejected");
  if (!proxima) return null;

  const ultimaTentativa = proxima.tentativas[proxima.tentativas.length - 1];
  const figurasDisponiveis: FiguraParaIA[] = state.figuras
    .filter((figura) => proxima.figurasDisponiveis.includes(figura.id))
    .map((figura) => ({
      id: figura.id,
      variantes: {
        min: figura.variantes.min.pngPath,
        titulo: figura.variantes.titulo.pngPath,
        completa: figura.variantes.completa.pngPath,
        tudo: figura.variantes.tudo.pngPath,
      },
      textosAdjacentes: figura.textosAdjacentes.map((t) => ({
        texto: t.texto,
        direcao: t.direcao,
        distancia: t.distancia,
        sugestaoTag: t.sugestaoTag,
      })),
    }));

  if (proxima.status !== "in-progress") {
    proxima.status = "in-progress";
    saveRunState(baseOverride, state);
  }

  return {
    questao_id: proxima.id,
    ocr_text: proxima.ocrText,
    figuras_disponiveis: figurasDisponiveis,
    gabarito: proxima.gabaritoOficial,
    feedback_tentativa_anterior: ultimaTentativa?.motivos ?? [],
  };
}

if (require.main === module) {
  const hash = process.argv[2];
  if (!hash) {
    console.error("Uso: pnpm tsx transcricao/cli/next.ts <hash>");
    process.exit(2);
  }
  runNext(undefined, hash, "scripts/provas/enem/matriz_referencia.txt").then((item) => {
    console.log(JSON.stringify(item, null, 2));
  });
}
```

- [ ] **Step 2: Rodar os testes de CLI — agora TUDO deve passar**

Run: `npx vitest run transcricao/tests/cli/`

Expected: todos os arquivos em `transcricao/tests/cli/` passando, incluindo `next-submit-status.test.ts` (o teste `"next devolve as 4 variantes..."` da Task 6/Step 3 agora bate).

- [ ] **Step 3: `pnpm tsc --noEmit` geral**

Run: `pnpm tsc --noEmit 2>&1 | grep transcricao`

Expected: sem saída (nenhum erro em `transcricao/`) — se ainda houver algo, é sinal de um consumidor de `FiguraManifest`/`NextItem` não coberto pelas tasks anteriores; investigar e corrigir antes de prosseguir (não deveria acontecer se as Tasks 1–9 foram seguidas à risca, mas `report.ts`/`finalize.ts` não foram tocados neste plano — Task 14 confirma que eles não têm acoplamento, ver Divergência levantada no levantamento).

- [ ] **Step 4: Commit**

```bash
git add transcricao/cli/next.ts
git commit -m "feat(transcricao): next.ts entrega as 4 variantes + texto adjacente por figura pra IA escolher"
```

---

## Task 11: `transcricao/PROMPT-CANONICO.md` — nova seção "Figuras: escolher variante e estruturar título/legenda"

**Files:**
- Modify: `transcricao/PROMPT-CANONICO.md`

**Contexto:** a IA principal (que já escreve o `.tex`, sem subagente — ver Divergência #4) precisa saber que agora recebe 4 variantes por figura (não 1 path), e como decidir entre absorver texto na figura ou extrair via `\title{}`/`\credits{}`.

- [ ] **Step 1: Inserir a seção nova, logo depois da seção "Alternativa que é imagem, não texto"**

Em `transcricao/PROMPT-CANONICO.md`, localizar o fim da seção `### Alternativa que é imagem, não texto (ex: estrutura química, gráfico)` (termina em "Não tente descrever a imagem como texto — nem tente adivinhar o conteúdo por conhecimento geral.", antes de `### Conteúdo genuinamente irrecuperável`) e inserir a seção nova ali, antes de `### Conteúdo genuinamente irrecuperável`:

```markdown
   ### Figuras: escolher variante e estruturar título/legenda

   Cada figura em `figuras_disponiveis` agora vem com **4 variantes**
   pré-renderizadas (`variantes.min`, `variantes.titulo`, `variantes.completa`,
   `variantes.tudo`) e uma lista `textosAdjacentes` (texto que o PDF tem ao
   redor do desenho — título, escala de eixo, labels, legenda, crédito —
   cada um com `direcao`, `distancia` e `sugestaoTag`, essa última NÃO
   vinculante, só uma dica).

   As 4 variantes diferem em quanto texto adjacente cada uma já **absorveu**
   dentro da própria imagem:
   - `min`: só o desenho (gráfico/tabela/diagrama em si), sem nenhum texto ao redor.
   - `titulo`: `min` + o texto acima (tipicamente o título).
   - `completa`: `min` + acima + abaixo (título + labels/legenda embaixo).
   - `tudo`: `min` + as 4 direções (inclui também escala de eixo lateral).

   **Regra de decisão** (aplicar por figura, olhando `textosAdjacentes`):

   1. **Labels de eixo, escala numérica, rótulos internos** (ex: "I II III
      IV V", "0 10 20 30..."): **sempre deixe absorvidos na figura** —
      escolha uma variante que os inclua (`completa` ou `tudo`, conforme a
      direção). **Nunca** retype esse texto no `.tex` — ele é dado da
      figura, não do enunciado.
   2. **Créditos** (texto com `sugestaoTag: "credito"`, tipicamente começando
      com "Fonte:", "Disponível em:", ou padrão autor+data): **sempre**
      extraia via `\credits{...}` no `.tex`, mesmo que a variante escolhida
      já os inclua visualmente — `\credits{}` fica na linha logo depois do
      `\includegraphics{}`.
   3. **Título de gráfico/tabela** (texto com `sugestaoTag: "titulo"`):
      **prefira deixá-lo absorvido na figura** (escolher `titulo`, `completa`
      ou `tudo` — o que fizer sentido pro resto do texto adjacente que
      também precisa entrar). Só use `\title{...}` externo se a variante que
      inclui o título deixasse a figura desequilibrada (título muito maior
      que o próprio desenho) — nesse caso, use a variante SEM o título
      (ex: `min`) e escreva `\title{...}` acima do `\includegraphics{}`.
      **Não faça as duas coisas ao mesmo tempo** (variante com título
      absorvido E `\title{}` externo) — isso duplica o título visualmente
      na prova renderizada.
   4. Se nenhuma variante deixar a figura autoexplicativa (raro — geometria
      não capturou tudo que precisa): use `min` e reproduza só o texto
      adjacente estritamente necessário como texto solto no enunciado.
      Essa via é último recurso — prefira sempre uma das variantes prontas.

   O `\includegraphics{}` deve apontar pro path de UMA das 4 variantes —
   nunca invente um path diferente (mesma regra de sempre: só paths de
   `figuras_disponiveis`).

   O conteúdo de `\title{}`/`\credits{}` continua sob a mesma regra de
   fidelidade: só o que está no PDF, nunca completado ou parafraseado
   (gate `title-credits-validos` verifica isso).
```

- [ ] **Step 2: Confirmar visualmente que a seção entrou no lugar certo**

Run: `grep -n "^### " transcricao/PROMPT-CANONICO.md`

Expected: a ordem das seções `###` deve ser: "Fórmula/equação com OCR ilegível", "Alternativa que é imagem, não texto", "Figuras: escolher variante e estruturar título/legenda", "Conteúdo genuinamente irrecuperável" — nessa ordem.

- [ ] **Step 3: Commit**

```bash
git add transcricao/PROMPT-CANONICO.md
git commit -m "docs(transcricao): PROMPT-CANONICO ensina a IA a escolher variante de figura e extrair title/credits"
```

---

## Task 12: Golden — Q170 (run `ee4b909928ade9a9`) resolvido pelo pipeline novo, sem duplicação

**Files:**
- Create: `transcricao/tests/golden/enem-2021-q170.test.ts`

**Contexto:** este é o teste que prova a Meta de Sucesso #1 do design — a mesma Q170 que motivou todo o plano (run `ee4b909928ade9a9`, rejeitada 2x e aceita na 3ª tentativa só com texto de gráfico duplicado no enunciado) passa a ser aceita com um `.tex` enxuto, sem duplicação, usando o pipeline novo de ponta a ponta (init real, escopado só na página 28, + submit real).

**Nota sobre a variante escolhida:** a variante `completa` de `p28-f1` já inclui o título "Nível dos reservatórios em 2 fev. 2015" absorvido na imagem (confirmado na Task 2/Step 6 e Task 7/Step 3). Por isso este golden usa `\includegraphics{completa}` **sem** `\title{}` externo — usar os dois ao mesmo tempo duplicaria o título (um nos pixels da figura, outro como texto renderizado pelo `\title{}`), o que a regra 3 da Task 11 explicitamente proíbe.

- [ ] **Step 1: Escrever o teste**

Criar `transcricao/tests/golden/enem-2021-q170.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInit } from "../../cli/init";
import { runSubmit } from "../../cli/submit";
import { loadRunState } from "../../core/run-state";

const PDF = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf");
const GABARITO = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_GB_impresso_D2_CD5.pdf");
const MATRIZ_PATH = resolve(__dirname, "../../../scripts/provas/enem/matriz_referencia.txt");
const TOTAL_PAGINAS = 32;

let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "transcricao-golden-q170-"));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("golden — Q170 (ENEM 2021 D2, run ee4b909928ade9a9 original) sem duplicação de texto de gráfico", () => {
  it("aceita .tex enxuto usando a variante completa da figura, sem retype de eixo/labels/legenda", async () => {
    const paginasIgnoradas = Array.from({ length: TOTAL_PAGINAS }, (_, i) => i + 1).filter((p) => p !== 28);
    const hash = await runInit(
      {
        pdfPath: PDF,
        gabaritoPath: GABARITO,
        adapter: "enem",
        paginasIgnoradas,
        somenteIntervalo: { de: 170, ate: 170 },
      },
      base
    );

    const state = loadRunState(base, hash);
    const questao170 = state.questoes.find((q) => q.id === "170");
    expect(questao170).toBeDefined();
    expect(questao170!.gabaritoOficial).toBe("D");

    const figuraGrafico = state.figuras.find((f) => questao170!.figurasDisponiveis.includes(f.id) && f.tipo === "vetor");
    expect(figuraGrafico).toBeDefined();
    const pngCompleta = figuraGrafico!.variantes.completa.pngPath;

    const tex = `\\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Matemática
assunto: Tabelas e Gráficos Estatísticos
gabarito: D
numero: "170"
tags: [enem-mt-h20]
---
O gráfico apresenta o nível de ocupação dos cinco reservatórios de água que abasteciam uma cidade em 2 de fevereiro de 2015.

\\includegraphics{${pngCompleta}}

Nessa data, o reservatório com o maior volume de água era o

\\begin{choices}
  \\choice I.
  \\choice II.
  \\choice III.
  \\correctchoice IV.
  \\choice V.
\\end{choices}
`;

    const texDir = mkdtempSync(join(tmpdir(), "transcricao-golden-q170-tex-"));
    const texPath = join(texDir, "q170.tex");
    writeFileSync(texPath, tex, "utf-8");

    const resultado = await runSubmit(base, hash, "170", texPath, MATRIZ_PATH);

    if (!resultado.aceita) {
      // Mensagem de diagnóstico rica se algo divergir — não deveria acontecer
      // se a Task 2 (geometria) e Task 7 (máscara) estiverem corretas.
      console.error("Q170 golden rejeitada:", resultado.motivos);
    }
    expect(resultado.aceita).toBe(true);

    // Confirma que o .tex aceito NÃO contém o texto que motivou este plano
    // inteiro (duplicação de eixo/labels/legenda no enunciado).
    expect(tex).not.toContain("100 90 80");
    expect(tex).not.toContain("I II III IV V");
    expect(tex.match(/Reservatório/g) ?? []).toHaveLength(0); // "Reservatório" (label) não aparece — só "reservatórios" (enunciado, minúsculo) aparece

    rmSync(texDir, { recursive: true, force: true });
  }, 300_000);

  it("rejeita se o .tex duplica o texto de eixo (regressão do bug original — motivos citam comprimento/cobertura)", async () => {
    const paginasIgnoradas = Array.from({ length: TOTAL_PAGINAS }, (_, i) => i + 1).filter((p) => p !== 28);
    const hash = await runInit(
      {
        pdfPath: PDF,
        gabaritoPath: GABARITO,
        adapter: "enem",
        paginasIgnoradas,
        somenteIntervalo: { de: 170, ate: 170 },
      },
      base
    );

    // .tex sem NENHUM \includegraphics — mesmo defeito da tentativa 3 real
    // (retype do gráfico como texto). Sem figura referenciada, ocrMascarado
    // === ocrCompleto (nenhuma máscara aplicada) — o texto duplicado do
    // gráfico deveria continuar SENDO alucinação em relação ao enunciado
    // real (que não descreve o gráfico em prosa), então diff-palavras
    // também pega isso, não só comprimento/cobertura.
    const tex = `\\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Matemática
assunto: Tabelas e Gráficos Estatísticos
gabarito: D
numero: "170"
tags: [enem-mt-h20]
---
O gráfico apresenta o nível de ocupação dos cinco reservatórios de água que abasteciam uma cidade em 2 de fevereiro de 2015.

Nível dos reservatórios em 2 fev. 2015

Capacidade (bilhão de litros)
105 100 20 80 40
Nessa data, o reservatório com o maior volume de água era o

\\begin{choices}
  \\choice I.
  \\choice II.
  \\choice III.
  \\correctchoice IV.
  \\choice V.
\\end{choices}
`;
    const texDir = mkdtempSync(join(tmpdir(), "transcricao-golden-q170-neg-tex-"));
    const texPath = join(texDir, "q170.tex");
    writeFileSync(texPath, tex, "utf-8");

    const resultado = await runSubmit(base, hash, "170", texPath, MATRIZ_PATH);
    expect(resultado.aceita).toBe(false);
    rmSync(texDir, { recursive: true, force: true });
  }, 300_000);
});
```

- [ ] **Step 2: Rodar o golden**

Run: `npx vitest run transcricao/tests/golden/enem-2021-q170.test.ts`

Expected: 2 testes passando. Se o primeiro teste falhar, ler `resultado.motivos` no console (`console.error` já está no teste) — provavelmente indica que a bbox da variante `completa` não bate exatamente com o esperado (rodar `python scripts/list-page-figures.py <pdf> 28` manualmente pra conferir, igual na Task 2/Step 6).

- [ ] **Step 3: Commit**

```bash
git add transcricao/tests/golden/enem-2021-q170.test.ts
git commit -m "test(transcricao): golden Q170 — pipeline novo aceita .tex enxuto sem duplicar texto de grafico

Prova a meta de sucesso #1 do design: a questao real que motivou o plano
(run ee4b909928ade9a9, rejeitada 2x, aceita na 3a tentativa so com texto
do grafico duplicado no enunciado) agora passa com um .tex ~30 palavras +
includegraphics{completa}, sem retype de eixo/labels/legenda."
```

---

## Task 13: Golden — Q154 (5 alternativas em gráfico) sem a isenção antiga

**Files:**
- Create: `transcricao/tests/golden/enem-2021-q154.test.ts`

**Contexto:** prova que a remoção de `todasAlternativasSaoImagens` (Task 9) não regride o caso que motivou aquele fix — a máscara resolve de forma mais geral, usando o pipeline real (página 21).

- [ ] **Step 1: Escrever o teste**

Criar `transcricao/tests/golden/enem-2021-q154.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInit } from "../../cli/init";
import { runSubmit } from "../../cli/submit";
import { loadRunState } from "../../core/run-state";

const PDF = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_PV_impresso_D2_CD5.pdf");
const GABARITO = resolve(__dirname, "../../../scripts/provas/enem/2021/2021_GB_impresso_D2_CD5.pdf");
const MATRIZ_PATH = resolve(__dirname, "../../../scripts/provas/enem/matriz_referencia.txt");
const TOTAL_PAGINAS = 32;

let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "transcricao-golden-q154-"));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("golden — Q154 (ENEM 2021 D2, 5 alternativas em gráfico cartesiano) sem a isenção todasAlternativasSaoImagens", () => {
  it("aceita .tex com alternativas só-imagem usando a máscara, sem a regra especial removida na Task 9", async () => {
    const paginasIgnoradas = Array.from({ length: TOTAL_PAGINAS }, (_, i) => i + 1).filter((p) => p !== 21);
    const hash = await runInit(
      {
        pdfPath: PDF,
        gabaritoPath: GABARITO,
        adapter: "enem",
        paginasIgnoradas,
        somenteIntervalo: { de: 154, ate: 154 },
      },
      base
    );

    const state = loadRunState(base, hash);
    const questao154 = state.questoes.find((q) => q.id === "154");
    expect(questao154).toBeDefined();

    const figurasDaQuestao = state.figuras.filter((f) => questao154!.figurasDisponiveis.includes(f.id));
    // A página 21 tem o quadro (tabela) + 5 gráficos-alternativa — pelo menos
    // 5 figuras (uma por gráfico).
    expect(figurasDaQuestao.length).toBeGreaterThanOrEqual(5);

    // Usa a variante "min" de cada figura pras alternativas (gráficos
    // cartesianos pequenos, autoexplicativos sem texto adjacente relevante)
    // — pega as primeiras 5 na ordem em que aparecem no manifest.
    const pngsAlternativas = figurasDaQuestao.slice(0, 5).map((f) => f.variantes.min.pngPath);

    const gabaritoReal = questao154!.gabaritoOficial;
    expect(gabaritoReal).not.toBeNull();
    const letras = ["A", "B", "C", "D", "E"] as const;
    const idxCorreta = letras.indexOf(gabaritoReal as (typeof letras)[number]);
    expect(idxCorreta).toBeGreaterThanOrEqual(0);

    const escolha = (i: number) => (i === idxCorreta ? "\\correctchoice" : "\\choice");

    const tex = `\\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Matemática
assunto: Funções Definidas por Várias Sentenças
gabarito: ${gabaritoReal}
numero: "154"
tags: [enem-mt-h20]
---
O quadro representa a relação entre o preço de um produto (R) e seu respectivo imposto devido (I).

O gráfico que melhor representa essa relação é

\\begin{choices}
  ${escolha(0)} \\includegraphics{${pngsAlternativas[0]}}
  ${escolha(1)} \\includegraphics{${pngsAlternativas[1]}}
  ${escolha(2)} \\includegraphics{${pngsAlternativas[2]}}
  ${escolha(3)} \\includegraphics{${pngsAlternativas[3]}}
  ${escolha(4)} \\includegraphics{${pngsAlternativas[4]}}
\\end{choices}
`;

    const texDir = mkdtempSync(join(tmpdir(), "transcricao-golden-q154-tex-"));
    const texPath = join(texDir, "q154.tex");
    writeFileSync(texPath, tex, "utf-8");

    const resultado = await runSubmit(base, hash, "154", texPath, MATRIZ_PATH);
    if (!resultado.aceita) {
      console.error("Q154 golden rejeitada:", resultado.motivos);
    }
    expect(resultado.aceita).toBe(true);

    rmSync(texDir, { recursive: true, force: true });
  }, 300_000);
});
```

- [ ] **Step 2: Rodar o golden**

Run: `npx vitest run transcricao/tests/golden/enem-2021-q154.test.ts`

Expected: 1 teste passando. Se falhar, ler `resultado.motivos`. Causas prováveis: (a) o quadro/tabela também é detectado como figura e acaba entre as "5 primeiras" no lugar de um gráfico-alternativa — nesse caso, ajustar o teste pra filtrar por posição/tamanho, já que o quadro fica ACIMA das alternativas na página, ou (b) o enunciado "O quadro representa..." não bate com o OCR mascarado porque o quadro (que tem texto de tabela relevante, não só ruído) foi mascarado por engano — nesse caso o teste NÃO deve referenciar a figura do quadro em `\includegraphics`, só as 5 dos gráficos-alternativa (o código já faz isso via `.slice(0,5)`, mas confirmar que a ordem do manifest realmente põe o quadro depois, ou ajustar pra filtrar por bbox/id explicitamente se a ordem não for essa).

- [ ] **Step 3: Commit**

```bash
git add transcricao/tests/golden/enem-2021-q154.test.ts
git commit -m "test(transcricao): golden Q154 — mascara substitui todasAlternativasSaoImagens sem regressao

Prova que remover a isencao especifica (Task 9) nao regride o caso real
que a motivou (5 alternativas em grafico cartesiano, OCR do Tesseract
virava ruido tentando ler os graficos como texto)."
```

---

## Task 14: Verificação final — suíte completa, migração do run real, typecheck

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: `pnpm tsc --noEmit` limpo em todo o projeto (não só `transcricao/`)**

Run: `pnpm tsc --noEmit 2>&1 | tail -30`

Expected: sem erros. Se houver erro fora de `transcricao/`, não deveria ter relação com este plano — investigar antes de prosseguir (pode ser erro pré-existente; se for, anotar e não tentar consertar aqui, fora de escopo).

- [ ] **Step 2: Suíte pytest completa**

Run: `python -m pytest scripts/tests/ transcricao/gui/tests/ -v`

Expected: todos passando — os testes de `scripts/tests/` são novos (Tasks 2/3); os de `transcricao/gui/tests/` são pré-existentes e não deveriam ter sido afetados por este plano (a GUI só chama a CLI via subprocess, sem acoplamento de tipos — ver levantamento inicial).

- [ ] **Step 3: Suíte vitest de `transcricao/`, evitando contenção de recursos**

A suíte tem testes pesados (OCR/Ghostscript reais) que competem por CPU/disco quando rodados em paralelo — isso já causava timeout por contenção ANTES deste plano (ver "Divergências apuradas", item 2). Rodar com paralelismo restrito:

Run: `npx vitest run transcricao/tests --pool=forks --poolOptions.forks.maxForks=2`

Expected: 0 failed. Anotar a duração total (referência: a suíte completa, antes deste plano, levava ~590s com 2 forks nesta mesma máquina — as tasks deste plano adicionam ~6 arquivos de teste novos com chamadas reais a Ghostscript/Tesseract, então um aumento proporcional é esperado, não um sinal de problema).

Se ainda houver timeout por contenção mesmo com `maxForks=2`, rodar os arquivos pesados isoladamente pra confirmar que passam fora de paralelismo:

```bash
npx vitest run transcricao/tests/golden/enem-2021-q170.test.ts
npx vitest run transcricao/tests/golden/enem-2021-q154.test.ts
npx vitest run transcricao/tests/golden/enem-2021-d1.test.ts
npx vitest run transcricao/tests/core/ocr-mascarado.test.ts
```

- [ ] **Step 4: Suíte completa do repo (garantir que nada em `src/tests/` quebrou)**

Run: `pnpm test 2>&1 | tail -20`

Expected: `src/tests/**` continua 100% verde (este plano não toca nada em `src/`). Se `transcricao/tests/**` rodar dentro desse mesmo comando (agora que o include foi corrigido na Task 0) e a suíte demorar muito nessa forma combinada, usar o comando com `--pool`/`maxForks` do Step 3 em vez do `pnpm test` puro pra essa parte.

- [ ] **Step 5: Confirmar a mensagem de migração contra o run real que motivou o plano**

Se o diretório do run original ainda existir (`transcricao/runs/ee4b909928ade9a9/`), confirmar que carregá-lo agora falha com a mensagem de migração (Task 5):

```bash
pnpm tsx transcricao/cli/status.ts ee4b909928ade9a9
```

Expected: erro contendo `formato v1` e `rm -rf transcricao/runs/ee4b909928ade9a9`. Isso é o comportamento correto — o run antigo não é compatível com o formato novo (ver "Migração" no design). Se o usuário quiser reprocessar a Q170 de verdade (não só o golden test), apagar o diretório e rodar `init` de novo é o próximo passo natural, fora do escopo deste plano.

- [ ] **Step 6: Commit final (se sobrou algo pendente das steps acima) e resumo**

Se todas as verificações passaram sem exigir mudança de código, não há commit nesta task — as Tasks 0–13 já cobrem tudo. Se alguma verificação exigiu ajuste, commitar normalmente com mensagem descrevendo o ajuste.

Reportar ao usuário, ao final: contagem de testes novos adicionados (Python + TS), resultado do golden Q170 (a questão real que motivou o plano), e lembrete de que o run `ee4b909928ade9a9` precisa ser recriado (`rm -rf` + `init`) se ele quiser reprocessar a prova de verdade com o pipeline novo.

---

## Self-Review

**1. Cobertura da spec** — cada seção do design (`docs/superpowers/specs/2026-08-08-transcritor-figuras-inteligentes-design.md`) mapeada pra uma task:

| Seção do design | Task |
|---|---|
| Camada 1 — Script Python (nova saída, regras de expansão, tag, renderização de variantes) | Tasks 2, 3, 4 |
| Camada 2 — Manifest ampliado, `next.ts`, PROMPT-CANONICO, subagente | Tasks 1, 6, 10, 11 (subagente: sem mudança — Divergência #4) |
| Camada 3 — OCR mascarado, contrato dos gates, gate novo, ordem de execução, remoção do fix antigo | Tasks 7, 8, 9 |
| Fluxo do init — mudanças concretas | Tasks 1, 4, 5, 6 |
| Fluxo do submit — mudanças concretas | Tasks 7, 8, 9 |
| Prompt e subagente — mudanças concretas | Task 11 |
| Migração | Task 5 |
| Testes (Python geometria pura, TS figuras, TS ocr-mascarado, TS gates cobertura/comprimento, TS title-credits-validos, Golden Q170) | Tasks 2, 3, 4, 7, 9, 12 |
| Testes — Fixture regressivo Q154 | Tasks 9 (unitário) e 13 (golden end-to-end) |
| Tratamento de erros | Cobertos inline: erro de render parcial não é implementado como feature separada (fora do escopo mínimo — anotado abaixo em "gaps conhecidos"); erro de `mask-page-and-ocr.py` já propaga como exceção (Task 7); manifest v1 (Task 5); path inválido (`gateFigurasListadas`, sem mudança). |
| Métricas de sucesso #1 (Q170) | Task 12 |
| Métricas de sucesso #2 (Golden D1 ≥93/95) | Não re-executado neste plano — o teste `enem-2021-d1.test.ts` já existe e não foi modificado; nenhuma mudança deste plano toca `parseQuestoesEnem`/`extractEnem`'s core de segmentação de questões (só a parte de figuras), então o resultado não deveria regredir. Rodar manualmente na Task 14/Step 3 confirma. |
| Métricas de sucesso #3 (todos os 8→9 gates testados no stub) | `gates/index.test.ts` (Task 9) cobre os 9 gates via `rodarTodosOsGates` |
| Métricas de sucesso #4 (custo do init +60s) | Não medido explicitamente numa task — Task 6/Step 4 e Task 14/Step 3 relatam duração observada; se ultrapassar a margem, é um achado a reportar ao usuário, não um bloqueador de implementação (paralelização fica fora de escopo v1, conforme o próprio design). |

**Gap conhecido, aceito conscientemente:** o design menciona "`init` falha ao renderizar variante → erro específico, deleta variantes parciais desse figura, restante do init prossegue mas manifest marca figura como 'variantes: min-only'" como tratamento de erro. Este plano NÃO implementa esse fallback degradado — se `renderizarVariantesFigura` falhar no meio das 4 chamadas, a exceção propaga e o `init` inteiro falha (comportamento consistente com o resto do pipeline, que já falha ruidosamente em vez de degradar silenciosamente — ver `core/ocr.ts`, `core/figuras.ts` atuais). Implementar o fallback parcial é aditivo e de baixo risco pra adicionar depois, se a experiência real mostrar que vale a pena; adicionar agora sem um caso real que o justifique seria especulativo (viola YAGNI). Se o usuário quiser esse comportamento, é uma task pequena e isolada a fazer depois.

**2. Varredura de placeholders** — nenhum "TBD", "adicionar validação apropriada" ou trecho de código incompleto nas tasks acima; todo bloco de código é o conteúdo integral do arquivo (ou a substituição exata de um trecho, com before/after).

**3. Consistência de tipos** — conferido manualmente:
- `FiguraManifest.variantes: Record<NomeVariante, VarianteFigura>` (Task 1) é usado consistentemente em `figuras.ts` (Task 4), `extract.ts`/`init.ts` (Task 6), `submit.ts` (Task 9), `next.ts` (Task 10).
- `QuestaoRunState.paginaPdf` (Task 1) é populado em `init.ts` (Task 6) e consumido em `submit.ts` (Task 9).
- `InsumosGates.ocrCompleto`/`ocrMascarado` (Task 9, `gates/index.ts`) usado consistentemente em `submit.ts` (Task 9) e testado em `gates/index.test.ts` (Task 9).
- `FiguraDetectada.bboxMin`/`textosAdjacentes`/`bboxesVariantes` (Task 4) consistente entre `figuras.ts` e `figuras.test.ts`.
- `NextItem.figuras_disponiveis: FiguraParaIA[]` (Task 10) consistente com o teste adicionado na Task 6/Step 3.

---

## Rollback

Cada task é 1 commit isolado, na ordem: Task 0 (infra) → Task 1 (tipos) → Tasks 2–4 (extração/figuras) → Task 5 (migração) → Task 6 (init) → Tasks 7–9 (máscara/gates/submit) → Task 10 (next) → Task 11 (prompt) → Tasks 12–13 (goldens) → Task 14 (verificação, sem commit próprio na maioria dos casos).

Se algo quebrar depois de uma task específica, `git revert` do commit daquela task isola o problema — as tasks anteriores continuam funcionando porque cada uma deixa o `tsc`/testes num estado consistente (mesmo que incompleto — ver Task 1/Step 3, que documenta explicitamente os erros esperados até a Task 6 fechar o ciclo).

**Rollback total:** reverter da Task 14 até a Task 0, na ordem inversa. Runs já criados com o formato v2 (Task 5+) deixam de carregar se a Task 5 for revertida sozinha sem reverter as demais — reverter tasks fora de ordem não é seguro; reverter o plano inteiro (ou nada) é a via recomendada.

## Não confundir com

- **`docs/superpowers/plans/2026-08-05-pipeline-transcricao.md`** — plano original que construiu o pipeline `transcricao/` do zero (Tasks 0–21, já executado e mergeado). Este plano aqui é incremental sobre esse trabalho, não o substitui.
- **`transcricao/gui-teste-plan.md`** — plano da 5ª tela da GUI Python (Tkinter), também já executado. Este plano não mexe na GUI (ela só chama a CLI via subprocess, sem acoplamento — ver levantamento).
- **`transcricao/subagentes-formula-figura-plan.md`** — plano dos subagentes de fórmula/figura (classificação, não escolha de variante). Não modificado por este plano (Divergência #4).

