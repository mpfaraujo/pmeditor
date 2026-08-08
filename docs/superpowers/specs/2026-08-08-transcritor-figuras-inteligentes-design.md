# Transcritor de Figuras Inteligentes — Design

**Data:** 2026-08-08
**Contexto:** o pipeline de transcrição atual falha em provas com figuras que carregam informação por texto adjacente (título, escala de eixo, labels de item, legenda de eixo, crédito). Caso reproduzido: run `ee4b909928ade9a9` — Q170 do ENEM 2021 D2 (gráfico de barras dos reservatórios) foi rejeitada 2 vezes pelo gate `comprimento` (razão .tex/OCR abaixo de 0.6) e só passou na tentativa 3 porque a IA foi forçada a duplicar no enunciado o texto do gráfico ("100 90 80 60 50 40 30 20 10", "I II III IV V", "Reservatório", etc). O `.tex` foi aceito pelos gates mas ficou semanticamente errado — texto de eixo virou texto de enunciado.

A raiz do problema tem dois lados:

- **(A) Extração de figura**: `list-page-figures.py` detecta apenas clusters de vetor. Textos ao redor (título, eixos, labels, legenda) não entram na bbox. A figura extraída sozinha fica inutilizável (ver `p28-f1.png` do run: só grid + cabeçalho, sem escala, sem labels, sem título).
- **(B) OCR de referência**: Tesseract lê a página inteira, inclusive o texto dentro da região da figura. Os gates `cobertura`/`comprimento` comparam esse OCR "com texto de figura" contra o `.tex` da IA. Para passar, a IA precisa duplicar o texto de figura no enunciado — cobrando duas vezes o que deveria estar apenas na imagem.

Corrigir só (A) sem (B) transfere o problema de lugar: a figura fica boa, mas os gates continuam exigindo o texto duplicado no `.tex`.

Este design resolve os dois lados juntos, mantendo a decisão semântica com a IA e a validação mecânica com os gates.

## Objetivo

Transcritor que consegue processar qualquer tipo de figura de prova (gráfico, tabela, esquema, imagem raster + legenda) sem forçar duplicação de texto no `.tex`, sem produzir figuras "cegas" (sem título/eixos/labels), sem introduzir vocabulário `.tex` novo, e sem abrir brecha para alucinação.

## Princípios

1. **Script Python é mecânico.** Detecta geometria, produz variantes, sugere classificações. Não decide semântica.
2. **IA decide caso a caso.** Escolhe qual variante de figura usar, o que vira `\title{}`/`\credits{}`, o que fica no enunciado.
3. **Gates validam retroativamente.** Mascaram o OCR baseado nas escolhas da IA, aceitam texto que virou `\title`/`\credits`, exigem que o resto do OCR apareça em algum lugar do `.tex`.
4. **Nada novo no `.tex`.** `\title{}` e `\credits{}` já existem e são reconhecidos pelo smartpaste e pelos consumidores do banco. Nenhum comando novo, nenhum parser novo, nenhum checker novo.
5. **Anti-alucinação intacta.** `diff-palavras` e `ordem-tokens` continuam rodando contra o OCR ORIGINAL (não mascarado). Toda palavra do `.tex` continua sendo verificada contra a fonte.

## Arquitetura

Três camadas sequenciais, cada uma com responsabilidade única.

```
┌─────────────────────────────────────────────────────────┐
│ 1. SCRIPT PYTHON — list-page-figures.py (ampliado)      │
│    Entrada: PDF + página                                │
│    Saída para cada figura da página:                    │
│      • bbox_min (só desenho vetorial/raster)            │
│      • textos_adjacentes: [{bbox, texto, direcao,       │
│          distancia, sugestao_tag}]                      │
│      • bboxes_variantes: {min, titulo, completa, tudo}  │
│    Consumido por: transcricao/core/figuras.ts           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. IA — subagente de figura + PROMPT-CANONICO           │
│    Recebe do next.ts: OCR completo + manifest ampliado  │
│    Decide, por figura:                                  │
│      • qual variante usar (escolhe path PNG)            │
│      • texto que vira \title{} externo                  │
│      • texto que vira \credits{} externo                │
│      • texto que fica no enunciado normal               │
│    Grava .tex refletindo essas escolhas                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. GATES — submit.ts                                    │
│    Extrai \includegraphics{path} do .tex                │
│    Busca bbox correspondente no manifest                │
│    Compõe OCR mascarado (retângulos brancos sobre       │
│      bboxes escolhidas, roda Tesseract de novo)         │
│    Compara .tex contra:                                 │
│      • OCR mascarado  →  cobertura, comprimento         │
│      • OCR completo   →  diff-palavras, ordem-tokens    │
│    Gate novo: título/credits do .tex devem existir      │
│      no OCR completo (não alucinação)                   │
└─────────────────────────────────────────────────────────┘
```

## Camada 1 — Script Python

### Nova saída de `list-page-figures.py`

Mantém compatibilidade com uso avulso (linhas `raster[N]:` e `vector[N]:` continuam sendo emitidas). Ganha **seções adicionais** parseadas pelo TS.

Formato proposto (linhas novas em negrito):

```
Page 28/32 - 567.0 x 780.0 pt

=== 0 raster image(s) ===

=== 3 vector drawing cluster(s) (of 22 total, min 30pt) ===
  vector[0]: (59.7, 142.3, 273.3, 321.5) - 214x179 pt (127 paths)
  vector[1]: (106.0, 512.2, 216.4, 629.5) - 110x117 pt (8 paths)
  vector[2]: (289.1, 219.7, 535.8, 280.1) - 247x60 pt (22 paths)

=== adjacent text for vector[0] ===
  above: (76.3, 130.5, 256.7, 140.5)  gap=1.8  "Nível dos reservatórios em 2 fev. 2015"  tag=titulo
  left:  (49.9, 162.7, 56.6, 172.7)   gap=3.1  "100"  tag=label
  left:  (46.0, 178.0, 56.6, 188.0)   gap=3.1  "90"   tag=label
  ... (demais labels da escala Y)
  below: (80.1, 324.5, 254.9, 334.5)  gap=3.0  "I II III IV V"  tag=label
  below: (138.2, 332.6, 194.8, 342.6) gap=11.1 "Reservatório"    tag=legenda

=== adjacent text for vector[1] ===
  ...

=== adjacent text for vector[2] ===
  ...

=== variant bboxes for vector[0] ===
  min:      (59.7, 142.3, 273.3, 321.5)
  titulo:   (59.7, 130.5, 273.3, 321.5)
  completa: (59.7, 130.5, 273.3, 342.6)
  tudo:     (46.0, 130.5, 273.3, 342.6)

=== variant bboxes for vector[1] ===
  ...
```

### Regras de expansão por variante

Todas medidas em relação ao `bbox_min` (não iterativas). Parâmetros:

- `EXPAND_DIST` (padrão 15pt) — distância máxima aceita entre bbox_min e um bloco de texto candidato
- `ALIGN_TOL` (padrão 20pt) — tolerância de extravasamento lateral/vertical do bloco em relação ao bbox_min
- `CHAIN_GAP` (padrão 15pt) — gap máximo dentro de uma cadeia (labels + legenda embaixo, por exemplo)

**Direções cardeais** (acima, abaixo, esquerda, direita):

Um bloco de texto T é candidato à direção D se:

- **Acima** (`ty1 <= cy0`): `cy0 - ty1 <= EXPAND_DIST` **E** `tx0 >= cx0 - ALIGN_TOL` **E** `tx1 <= cx1 + ALIGN_TOL`
- **Abaixo** (`ty0 >= cy1`): simétrico
- **Esquerda** (`tx1 <= cx0`): `cx0 - tx1 <= EXPAND_DIST` **E** `ty0 >= cy0 - ALIGN_TOL` **E** `ty1 <= cy1 + ALIGN_TOL`
- **Direita** (`tx0 >= cx1`): simétrico

**Cadeia direcional:** dentro de uma direção, blocos são ordenados por proximidade ao `bbox_min`. Aceita o primeiro se cabe no `EXPAND_DIST`. Aceita o próximo se cabe no `CHAIN_GAP` da CADEIA (não do bbox_min). Para no primeiro gap.

Justificativa: labels de eixo + legenda embaixo formam uma cadeia natural. "Reservatório" está a 11pt do bbox_min mas a 3pt abaixo de "I II III IV V" — a cadeia captura isso. O enunciado da questão está a 16.8pt (fora do EXPAND_DIST) E extravasa lateralmente (fora do ALIGN_TOL) — duplo cinto contra invasão.

**Sobreposição:** blocos que já intersectam o `bbox_min` são incorporados sempre à variante `_min` (não podem ficar de fora — o desenho já toca neles).

**Veto de fusão:** ao computar variante, se o novo bbox englobaria o centro de outra figura da mesma página, a incorporação daquele bloco é abortada. Evita fundir gráficos vizinhos por texto entre eles.

**Composição das 4 variantes:**

| Variante | Composição |
|---|---|
| `min` | `bbox_min` + blocos sobrepostos |
| `titulo` | `min` + cadeia acima |
| `completa` | `min` + cadeia acima + cadeia abaixo |
| `tudo` | `min` + cadeias das 4 direções |

Se uma direção não tem cadeia (nenhum candidato aceito), a variante degrada silenciosamente (ex: `_titulo` sem título acima = igual `_min`).

### Classificação sugerida (`tag`)

Puramente heurística, apenas sugestão pra IA. Regras:

- `credito`: texto começa com `Fonte:`, `Disponível em:`, `Fonte adaptada:`, ou padrão autor + data (`\w+.+,\s*\d{4}`)
- `titulo`: bloco acima do cluster, com 1-2 linhas, largura ≤ 90% do cluster, centralizado (|centro_texto - centro_cluster| ≤ 20pt)
- `label`: bloco curto (≤ 6 palavras) numérico ou de rótulos (I, II, III, A, B, C, X, Y)
- `legenda`: bloco abaixo do cluster, curto, não é label
- `incerto`: nenhuma regra bateu — IA decide sem sugestão

A tag NÃO é vinculante. IA lê o texto real e decide. Serve para reduzir carga cognitiva do prompt.

### Renderização das variantes

`render-pdf-rect.py` já existe e não muda. `list-page-figures.py` não renderiza — é responsabilidade do TS wrapper (`figuras.ts`) chamar `render-pdf-rect.py` uma vez por variante por figura.

Nomenclatura de arquivo:

```
transcricao/runs/<hash>/figuras/
  p28-f1_min.png
  p28-f1_titulo.png
  p28-f1_completa.png
  p28-f1_tudo.png
```

## Camada 2 — IA

### Manifest ampliado (formatVersion 2)

`run.json` ganha `formatVersion: 2` no topo. Cada figura vira:

```jsonc
{
  "id": "p28-f1",
  "pagina": 28,
  "bbox_min": [59.7, 142.3, 273.3, 321.5],
  "tipo": "vetor",
  "textos_adjacentes": [
    {
      "id": "p28-f1-ta1",
      "bbox": [76.3, 130.5, 256.7, 140.5],
      "texto": "Nível dos reservatórios em 2 fev. 2015",
      "direcao": "above",
      "distancia": 1.8,
      "sugestao_tag": "titulo"
    },
    // ... demais blocos
  ],
  "variantes": {
    "min":      { "bbox": [59.7, 142.3, 273.3, 321.5], "png": ".../p28-f1_min.png" },
    "titulo":   { "bbox": [59.7, 130.5, 273.3, 321.5], "png": ".../p28-f1_titulo.png" },
    "completa": { "bbox": [59.7, 130.5, 273.3, 342.6], "png": ".../p28-f1_completa.png" },
    "tudo":     { "bbox": [46.0, 130.5, 273.3, 342.6], "png": ".../p28-f1_tudo.png" }
  }
}
```

### O que `next.ts` entrega à IA

Além do que já entrega hoje, passa a incluir, por figura da página:

- Lista das 4 variantes com **preview visual disponível** (paths dos PNGs)
- Textos adjacentes com metadados
- Regras de decisão (do PROMPT-CANONICO)

### PROMPT-CANONICO — nova seção

Título proposto: **"Figuras: escolher variante e estruturar título/legenda"**

Conteúdo essencial (a redação exata fica na task do plano):

1. Cada figura tem 4 variantes pré-renderizadas: `_min`, `_titulo`, `_completa`, `_tudo`. Escolher a mais enxuta que ainda deixa a figura autoexplicativa.
2. Para labels de eixo, escala numérica, rótulos internos (I, II, III, X, Y): **sempre absorver na figura** via variante expandida. Não escrever no `.tex`.
3. Para créditos ("Fonte:", "Disponível em:", autor + data): **sempre extrair via `\credits{}`** no `.tex`, mesmo que a variante escolhida os inclua visualmente. `\credits{}` fica logo depois do `\includegraphics{}`.
4. Para títulos de gráfico/tabela: **preferir absorver na figura** (variante `_titulo`+); usar `\title{}` externo apenas quando a variante `_titulo` fica visualmente desequilibrada (título muito maior que o desenho).
5. Se nenhuma variante encaixa (raro): usar `_min` e reproduzir o texto adjacente crítico como texto solto no enunciado (aviso: essa via é última alternativa, tende a duplicar).

### Subagente de figura

Já existe (`transcricao/subagent-figura-prompt.md`). Atualizado para receber o novo formato de manifest e produzir escolhas fundamentadas por figura. Sem mudança de contrato de I/O — só de conteúdo interno do prompt.

## Camada 3 — Gates

### OCR mascarado

Novo módulo `transcricao/core/ocr-mascarado.ts`:

```typescript
export function ocrDaPaginaComBboxesMascaradas(
  pdfPath: string,
  pagina: number,
  bboxes: Array<[number, number, number, number]>
): string
```

Fluxo:
1. Renderiza a página em PNG 300dpi via Ghostscript (mesmo padrão que `core/ocr.ts`)
2. Para cada bbox, converte pontos PDF → pixels PNG (fator = 300/72) e pinta retângulo branco (via chamada a script Python `mask-and-ocr.py` novo, usando Pillow OU direto no Python que já roda o Tesseract)
3. Roda Tesseract no PNG mascarado, retorna texto

Alternativa considerada e rejeitada: filtrar tokens do OCR ORIGINAL por posição — depende de `image_to_data` do Tesseract, dá bbox de token mas a granularidade é imprecisa e frágil. Mascarar antes do OCR é mais robusto.

### Contrato dos gates

| Gate | Entrada OCR | Comportamento |
|---|---|---|
| `diff-palavras` | `ocrCompleto` | Inalterado. Toda palavra do `.tex` (fora de comandos LaTeX) deve existir no OCR original. |
| `ordem-tokens` | `ocrCompleto` | Inalterado. |
| `comprimento` | `ocrMascarado` | Razão `.tex/ocrMascarado` entre 0.6 e 2.0 (thresholds atuais preservados). |
| `cobertura` | `ocrMascarado` | Palavras raras exigidas são só as que sobraram fora das figuras escolhidas. |
| `figuras-listadas` | manifest | Aceita paths de **qualquer uma das 4 variantes** (`_min`, `_titulo`, `_completa`, `_tudo`). Rejeita path que não está no manifest. |
| `gabarito`, `checker-tex`, `yaml-completo` | — | Inalterados. |

### Gate novo — `title-credits-validos`

Verifica que conteúdo dentro de `\title{X}` e `\credits{Y}` no `.tex` existe (aproximadamente) no `ocrCompleto`. Reaproveita a infra de `diff-palavras` (tokenização, whitelist de conectivos). Rejeita alucinação em campos estruturados.

### Ordem de execução no `submit`

1. Ler `.tex` submetido, extrair paths de `\includegraphics{}`
2. Para cada path, obter bbox correspondente no manifest (via matching por sufixo `_variante`)
3. Compor `ocrMascarado` (chamada única, todas as bboxes juntas)
4. Rodar gates (paralelizáveis por serem puros; hoje já rodam em sequência — manter)
5. Agregar resultado

### Ajuste do commit `e769bb8`

O commit atual (`todasAlternativasSaoImagens`) fica **redundante** com o novo esquema: quando alternativas são todas imagens, as bboxes das figuras já cobrem a maior parte do OCR, e a máscara resolve automaticamente. Removê-lo mantém os gates simples. A regressão coberta por aquele fix (Q154) precisa entrar como golden novo para garantir que continua passando.

## Fluxo do init — mudanças concretas

Arquivo por arquivo:

**`scripts/list-page-figures.py`**: reescrito conforme Camada 1. Mantém interface CLI atual (linhas `vector[N]:` / `raster[N]:` inalteradas para não quebrar `figuras.ts`), acrescenta seções novas parseadas pelo TS. Flag `--no-text-expand` para desligar (uso avulso legacy).

**`transcricao/core/figuras.ts`**: parser da saída ampliada; renderização das 4 variantes por figura via `render-pdf-rect.py`. Assinatura de `listarFigurasDaPagina` retorna estrutura nova (não mais só bbox+tipo).

**`transcricao/core/types.ts`**: `FiguraNoManifest` ganha `bbox_min`, `textos_adjacentes`, `variantes`. `RunState` ganha `formatVersion: 2`.

**`transcricao/core/run-state.ts`**: `loadRunState` rejeita manifest sem `formatVersion: 2` com mensagem clara ("Delete a pasta e rode init novamente").

**`transcricao/cli/init.ts`**: usa novo `listarFigurasDaPagina`; roda render das 4 variantes; grava manifest v2. **Custo:** hoje ~1 render por figura; passa a 4. Prova média (30 figuras) → +90 renders × 0.5s = +45s no init. Rodável.

## Fluxo do submit — mudanças concretas

**`transcricao/core/ocr-mascarado.ts`** (novo): função `ocrDaPaginaComBboxesMascaradas`.

**Script Python auxiliar `scripts/mask-page-and-ocr.py`** (novo): renderiza página, aplica máscaras brancas (Pillow), roda Tesseract, imprime texto. Segue mesmo padrão dos outros scripts Python (execFileSync via `pythonBin()`).

**`transcricao/gates/comprimento.ts`** e **`transcricao/gates/cobertura.ts`**: passam a receber `ocr` como parâmetro nomeado ambíguo; o `submit` orquestra qual OCR passa pra qual gate. Contrato interno inalterado (função pura tex+ocr → GateResult).

**`transcricao/gates/title-credits-validos.ts`** (novo): implementação com reuso de tokenização de `diff-palavras`.

**`transcricao/gates/index.ts`**: passa a compor `ocrMascarado` uma vez e passar aos gates corretos. Novo gate agregado ao pipeline.

**`transcricao/cli/submit.ts`**: chama `ocrDaPaginaComBboxesMascaradas` antes dos gates.

## Prompt e subagente — mudanças concretas

**`transcricao/PROMPT-CANONICO.md`**: nova seção "Figuras" (conteúdo em Camada 2 acima). Atualização das seções existentes que mencionam `\includegraphics` para referenciar variantes.

**`transcricao/subagent-figura-prompt.md`**: prompt do subagente atualizado para consumir manifest v2 e produzir decisão fundamentada por figura.

## Migração

Runs velhos ficam **inválidos**. Init detecta manifest com `formatVersion !== 2` e recusa com mensagem:

```
Manifesto do run <hash> está no formato v1 (pré-figuras-inteligentes).
Delete o run e rode init novamente:
  rm -rf transcricao/runs/<hash>
  pnpm tsx transcricao/cli/init.ts --pdf ... --gabarito ... --adapter enem
```

Botão "Limpar este teste" da GUI já apaga a pasta do run. Runs em uso ativo o usuário apaga manualmente antes de rodar init.

Nenhum código de migração. Runs são descartáveis por design.

## Testes

**Python** (`scripts/tests/test_list_page_figures.py` — novo, primeiro teste Python em `scripts/`):

- `expand_cadeia_direcional_acima`: só título acima colado no bbox → variante `_titulo` inclui título
- `expand_rejeita_texto_extravasando_lateralmente`: enunciado da Q170 (mais largo, começa antes) → nenhuma variante o inclui
- `expand_cadeia_abaixo_com_gap_intermediario`: labels + legenda em cadeia → variante `_completa` pega ambos; se gap > CHAIN_GAP, para antes
- `expand_veta_fusao_com_figura_vizinha`: bbox expandida englobaria centro de outro cluster → aborta
- `sugestao_credito_fonte`: linhas "Fonte: X" → `sugestao_tag == "credito"`
- `sugestao_titulo_centralizado`: bloco curto acima, alinhado → `sugestao_tag == "titulo"`

**TS — `transcricao/tests/core/figuras.test.ts`** (ampliado):

- Parser aceita nova saída, monta estrutura com variantes e textos_adjacentes
- Chamada real ao Python contra `PDF ENEM 2021 D2 pág 28`: retorna 3 figuras, cada uma com 4 variantes com paths existentes, bboxes coerentes com o esperado (`p28-f1.completa` deve incluir "Nível dos reservatórios..." e "Reservatório")

**TS — `transcricao/tests/core/ocr-mascarado.test.ts`** (novo):

- Dado PDF ENEM 2021 D2 pág 28 + bbox de p28-f1_completa, o OCR mascarado NÃO contém "Nível dos reservatórios", "Reservatório", "Capacidade"
- Ainda contém "Questão 170", enunciado, alternativas

**TS — `transcricao/tests/gates/cobertura.test.ts`** e **`comprimento.test.ts`** (ampliados):

- Regressão positiva: `.tex` com só enunciado curto + `\includegraphics{p28-f1_completa.png}` + alternativas, contra OCR mascarado, **passa** em ambos
- Regressão neutra: `.tex` sem figura contra OCR sem máscara, comportamento atual (razão 0.6 / cobertura 70%) preservado
- Regressão negativa: `.tex` com palavra inventada continua rejeitado por `diff-palavras` (não afetado por máscara)

**TS — `transcricao/tests/gates/title-credits-validos.test.ts`** (novo):

- `\title{Nível dos reservatórios em 2 fev. 2015}` contra OCR que contém essa string → **passa**
- `\title{Nível inventado dos reservatórios}` → **rejeitado** por token "inventado" não presente

**TS — Golden Q170** (`transcricao/tests/golden/enem-2021-q170/*`):

- Fixture: PDF pág 28, gabarito D, `.tex` alvo enxuto (~30 palavras enunciado + `\title{...}` + `\includegraphics{p28-f1_completa.png}` + `\credits{...}` se aplicável + alternativas)
- Executa pipeline completo (init + submit simulado): passa em todos os gates
- Fixture negativo: `.tex` com palavra alucinada, rejeitado por `diff-palavras`
- Fixture regressivo Q154 (do commit `e769bb8`): alternativas todas imagens, `.tex` fiel, passa (garante que remoção do fix específico daquele commit não regride)

## Tratamento de erros

- `init` falha ao renderizar variante → erro específico, deleta variantes parciais desse figura, restante do init prossegue mas manifest marca figura como "variantes: min-only" e IA fica ciente da limitação
- `mask-page-and-ocr.py` falha → submit falha com erro específico, `.tex` fica pendente, próximo submit tenta de novo
- Manifest v1 no init → mensagem clara acima
- Path de `\includegraphics` que não bate com manifest → `figuras-listadas` rejeita (comportamento atual preservado)

## O que NÃO está no design (deliberado)

- **Não muda modelo de dados do banco.** Título/crédito estruturado no `.tex` continua sendo campo de bloco de figura no ProseMirror; nenhuma migração de banco.
- **Não introduz novo modelo semântico "figura + metadados" no editor.** O editor já lida com `title` e `credits` de forma adequada; o design apenas exercita esse modelo mais cedo (na transcrição), não o expande.
- **Não paraleliza renders.** 4 variantes × N figuras roda sequencial no init. Se necessário no futuro, `figuras.ts` pode paralelizar sem mudar contrato.
- **Não adiciona detecção "figura contém alternativas embutidas"** (caso de gráficos-alternativa do ENEM). Fora de escopo — o commit `e769bb8` cobria isso e vai ser removido; o esquema de máscara cobre esse caso naturalmente (bboxes das figuras-alternativa mascaram o OCR).
- **Não mexe em provas não-ENEM.** O design é agnóstico de adapter; o adapter ENEM continua sendo o único implementado.

## Métricas de sucesso

1. **Q170 do run `ee4b909928ade9a9`** — refeita com o novo pipeline: `.tex` enxuto (~30 palavras + `\title` + `\includegraphics{_completa}` + alternativas) passa em todos os gates. Sem duplicação de "100 90 80 60 50 40 30 20 10", "I II III IV V", "Reservatório".
2. **Golden ENEM 2021 D1** — reprocessado, mantém ≥ 93/95 blocos aceitos (não regride do baseline atual).
3. **Testes unitários** — 100% passam, incluindo os regressivos do commit `e769bb8`.
4. **Custo do init** — no PDF ENEM 2021 D2 completo (89 questões), fica dentro de +60s do baseline atual (aceitável).

## Escopo desta implementação

Escopo v1 (este design):

- Camadas 1, 2 e 3 completas
- Adapter ENEM
- Testes acima
- Migração deletando runs antigos

Fora de escopo v1 (planos futuros, se necessário):

- Adapters PUC-Rio / UERJ / CEDERJ (extract adaptado pra layout específico das bancas)
- Paralelização de renders no init
- Cache de OCR mascarado entre submits (hoje é rerodado a cada submit — pode ser lento se prova tem muitos submits)
- UI da tela Teste da GUI mostrando as variantes disponíveis pra facilitar debug
