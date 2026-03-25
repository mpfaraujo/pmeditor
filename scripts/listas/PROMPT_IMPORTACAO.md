# Prompt: Pipeline de Importação de Questões — pmeditor

## Contexto

Você está alimentando o banco de questões do **pmeditor**, um editor de provas. O banco aceita questões no formato `.tex` descrito abaixo. As questões vêm de listas do site **projetoagathaedu.com.br** — cada lista é um artigo HTML com questões do ENEM sobre um tema específico.

O usuário vai te fornecer o conteúdo HTML (colado diretamente ou como arquivo .txt). Você processa e gera um arquivo `.tex` pronto para importar.

Os arquivos gerados ficam em: `scripts/listas/diversas/`
Já existem: lista1.tex até lista17.tex
A próxima é: **lista18.tex** (e incrementar a partir daí)

---

## Formato do arquivo .tex

Cada questão tem um bloco YAML de metadados entre `---` seguido do corpo LaTeX:

```
---
tipo: Múltipla Escolha
dificuldade: Fácil
nivel: médio
disciplina: Matemática
assunto: Função Exponencial
gabarito: D
tags: [bactérias, epidemia, reprodução, duplicação]
fonte: concurso
concurso: ENEM
banca: INEP
ano: 2016
numero: 1
---
\question
Enunciado da questão...

\begin{choices}
\choice Alternativa A
\choice Alternativa B
\choice Alternativa C
\correctchoice Alternativa D  ← alternativa correta
\choice Alternativa E
\end{choices}
```

### Campos obrigatórios

| Campo | Valores possíveis |
|-------|------------------|
| `tipo` | `Múltipla Escolha` |
| `dificuldade` | `Fácil` / `Média` / `Difícil` |
| `nivel` | sempre `médio` (ensino médio) |
| `disciplina` | `Matemática` (nestas listas) |
| `assunto` | ver seção "Assuntos canônicos" abaixo |
| `gabarito` | letra da alternativa correta: `A`, `B`, `C`, `D` ou `E` |
| `tags` | lista de palavras-chave (ver regras abaixo) |
| `fonte` | `concurso` |
| `concurso` | `ENEM` ou `ENEM-PPL` |
| `banca` | `INEP` |
| `ano` | ano da prova |
| `numero` | número da questão na lista do site (01, 02, etc.) |

### Choices

- `\begin{oneparchoices}` — alternativas curtas (números, expressões simples) → ficam em linha
- `\begin{choices}` — alternativas longas (frases, expressões complexas) → ficam em coluna
- Usar `\correctchoice` na alternativa correta
- O gabarito no YAML deve bater com o `\correctchoice` — **sempre verificar**

---

## Regras de inclusão/exclusão

### OMITIR a questão se:
- O enunciado depende de uma imagem/gráfico/tabela que não está no texto
- As **alternativas são figuras** (cada opção é um gráfico ou imagem)
- A fórmula principal da questão está em imagem (sem texto legível)
- É duplicata de uma questão já presente em lista anterior

### INCLUIR mesmo que:
- Haja imagens decorativas ou de contexto geral (ex: foto de um objeto mencionado)
- A questão referencie uma figura, mas o texto e as alternativas sejam autocontidos

### Comentário de cabeçalho (sempre colocar no início do arquivo)
```
% ENEM XXXX-XXXX — N questões MCQ — Tema
% Fonte: lista "Nome da Lista" do site projetoagathaedu.com.br
% Omitidas: Q2,Q5 (imagens), Q3 (duplicata listaN/QX), Q7 (alternativas com figuras)
```

---

## Regras de LaTeX

### NÃO usar LaTeX para:
- Números decimais simples em texto: `4,5` não `\(4{,}5\)`
- Percentuais simples: `50%` não `\(50\%\)`
- Medidas simples: `3,5 km`, `200 °C` (sem LaTeX)
- Texto puro nas alternativas

### USAR LaTeX para:
- Fórmulas: `\( x^2 + y^2 = r^2 \)`
- Frações: `\( \frac{a}{b} \)`
- Raízes: `\( \sqrt{2} \)`
- Variáveis isoladas: `\( x \)`, `\( n \)`
- Símbolos: `\( \pi \)`, `\( \leq \)`, `\( \infty \)`
- Expressões em bloco: `\[ p(t) = 40 \cdot 2^{3t} \]`
- Logaritmos com base: `\( \log_{10} 2 \)`
- Subscritos/superscritos em fórmulas: `\( N_0 \)`, `\( e^{kt} \)`

### ATENÇÃO — `{,}` e `{.}` SOMENTE dentro de LaTeX:
- CORRETO: `\( 1{,}03 \)` (vírgula decimal em math), `\( 1{.}800 \cdot x \)` (separador de milhar em math)
- **ERRADO**: `1{.}800,00` em texto puro → vai literalmente pro banco como `1{.}800,00`
- Em texto puro: escrever normalmente → `1.800,00`, `100.000 transistores`, `3.000 °C`

### Porcentagem em texto:
- Usar `\%` quando o `%` estiver em texto LaTeX (o `%` puro é comentário e corta a linha)
- Em texto puro fora de LaTeX: `50%` é seguro

### Listas com bullet no enunciado:
```
-- I: \( 1 \leq t \leq 2 \);

-- II: \( 3 \leq t \leq 4 \);
```

---

## Regras de tags

Tags são **palavras de busca** para localizar a questão pela memória — como "a questão do boliche", "a do dengue", "a dos navios".

- ✅ Contexto temático: `boliche`, `dengue`, `andaime`, `navios`, `liga metálica`
- ✅ Sub-tópicos matemáticos: `vértice`, `bissetriz`, `Lei de Moore`, `meia-vida`
- ❌ **NÃO repetir**: concurso (`ENEM`), banca (`INEP`), disciplina (`Matemática`), assunto — já estão nos metadados
- 3 a 5 tags por questão

---

## Assuntos canônicos (Matemática)

Usar exatamente esses nomes:

- `Aritmética` / `Divisibilidade` / `Progressão Aritmética` / `Progressão Geométrica`
- `Função Afim` / `Função Quadrática` / `Função Exponencial` / `Função Logarítmica` / `Funções`
- `Probabilidade Simples` / `Probabilidade Condicional` / `Análise Combinatória`
- `Combinações` / `Permutações Simples` / `Arranjos`
- `Geometria Plana` / `Área das Figuras Planas` / `Circunferência e Círculo`
- `Semelhança de Triângulos` / `Teorema de Tales` / `Teorema de Pitágoras`
- `Trigonometria` / `Razões Trigonométricas no Triângulo Retângulo`
- `Números Complexos` / `Matrizes` / `Determinantes` / `Sistemas Lineares`
- `Estatística` / `Grandezas e Medidas` / `Números Decimais`
- `Razões e Proporções` / `Porcentagem` / `Juros Simples` / `Juros Compostos`

---

## Critério de dificuldade

- **Fácil**: aplicação direta de fórmula, 1 passo, conceptual simples
- **Média**: 2–3 passos, combinação de conceitos
- **Difícil**: múltiplos passos, abstração elevada, contexto não óbvio

---

## Concurso

- `ENEM` — aplicação regular
- `ENEM-PPL` — pessoas privadas de liberdade (aparece como "Enem PPL" no HTML)
- `ENEM-Digital`, `ENEM-Libras` — variações especiais (usar se aparecer)

---

## Verificação do gabarito

**Sempre verificar o gabarito** antes de atribuir `\correctchoice`:
1. O gabarito está na tabela `<div id="gabarito">` no final do HTML
2. Conferir se bate com a resposta matematicamente correta (calcular se necessário)
3. Se houver divergência, usar o resultado do cálculo e anotar no comentário

---

## Exemplo real (lista17.tex — duas questões)

```
---
tipo: Múltipla Escolha
dificuldade: Fácil
nivel: médio
disciplina: Matemática
assunto: Função Exponencial
gabarito: D
tags: [bactérias, epidemia, reprodução, duplicação]
fonte: concurso
concurso: ENEM
banca: INEP
ano: 2016
numero: 1
---
\question
O governo de uma cidade está preocupado com a possível epidemia de uma doença
infectocontagiosa causada por bactéria. Para decidir que medidas tomar, deve calcular
a velocidade de reprodução da bactéria. Em experiências laboratoriais de uma cultura
bacteriana, inicialmente com 40 mil unidades, obteve-se a fórmula para a população:
\[ p(t) = 40 \cdot 2^{3t} \]
em que \( t \) é o tempo, em hora, e \( p(t) \) é a população, em milhares de bactérias.

Em relação à quantidade inicial de bactérias, após 20 min, a população será
\begin{choices}
\choice reduzida a um terço.
\choice reduzida à metade.
\choice reduzida a dois terços.
\correctchoice duplicada.
\choice triplicada.
\end{choices}

---
tipo: Múltipla Escolha
dificuldade: Difícil
nivel: médio
disciplina: Matemática
assunto: Função Logarítmica
gabarito: D
tags: [liga metálica, resfriamento, temperatura, logaritmo]
fonte: concurso
concurso: ENEM
banca: INEP
ano: 2016
numero: 7
---
\question
Uma liga metálica sai do forno a uma temperatura de 3.000 °C e diminui 1\% de sua
temperatura a cada 30 min. Use 0,477 como aproximação para \( \log_{10}(3) \) e
1,041 como aproximação para \( \log_{10}(11) \).

O tempo decorrido, em hora, até que a liga atinja 30 °C é mais próximo de
\begin{oneparchoices}
\choice 22
\choice 50
\choice 100
\correctchoice 200
\choice 400
\end{oneparchoices}
```

---

## Workflow

1. Usuário fornece HTML (colado ou como arquivo .txt)
   - Se for .txt com vários artigos: processar todos de uma vez, gerar um único .tex
   - Se for HTML colado: processar um artigo por mensagem para não cortar no limite de caracteres
2. Gerar o arquivo `.tex` em `scripts/listas/diversas/listaN.tex`
3. **Aguardar confirmação** de que o usuário importou com sucesso antes de gerar o próximo arquivo
4. O usuário roda: `pnpm tsx scripts/parse-tex.ts scripts/listas/diversas/listaN.tex`
5. Depois acessa `/admin/importar` para importar no banco

**Nunca gerar a próxima lista antes de o usuário confirmar que a anterior foi importada.**

---

## Sobre o arquivo .txt

Se o usuário salvar múltiplos HTMLs num arquivo .txt e fornecer o caminho, você pode ler tudo de uma vez sem limite de caracteres. Isso permite processar 5–10 listas juntas e gerar um .tex grande com mais questões — mais eficiente para importação em massa.

Listas com **alto rendimento** (poucas imagens): Aritmética, Álgebra, Progressões, Probabilidade, Combinatória, Trigonometria numérica.

Listas com **baixo rendimento** (muitas imagens): Funções com gráficos, Geometria Plana/Espacial, Estatística com gráficos.
