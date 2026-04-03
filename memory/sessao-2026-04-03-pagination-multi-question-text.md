---
name: Fix pagination — set discursivo com múltiplos .question-text (2026-04-03)
description: Corrige regressão em que um wrapper único de set discursivo não fragmentava e extrapolava a página porque a paginação só enxergava o primeiro .question-text
type: problem-solving
---

# Problema

Uma questão nova importada do `.tex` estava extrapolando o rodapé em vez de fragmentar. O caso não era um problema geral do parser ou do `bulk-import`: o conteúdo já estava no banco e o defeito aparecia na paginação/renderização da prova.

# Causa raiz

Em `src/app/editor/prova/montar/page.tsx`, conjuntos discursivos continuam entrando em `expandedQuestions` como unidade única. No renderer, esse wrapper único passa a conter vários `.question-text` em sequência (texto base + partes discursivas).

Em `src/lib/pagination.ts`, a função `pickBlockElementsFromWrapper()` usava:

```ts
const qt = conteudo.querySelector(".question-text")
```

Isso fazia a paginação enxergar apenas o primeiro `.question-text` do wrapper. O restante do conteúdo ficava embutido no `prefixHeight`, inflando artificialmente o primeiro fragmento e fazendo `buildFragmentsForQuestion()` retornar `null`. O fluxo então caía no fallback `full`, causando overflow visual.

# Estratégia adotada

Foi escolhida uma correção mínima e segura em `pagination.ts`, sem reestruturar `montar/page.tsx`:

- ativar um caminho especial apenas quando o wrapper contém **múltiplos `.question-text`**;
- e apenas quando **não há `.question-options`** dentro do wrapper.

Assim, o caso de set discursivo passa a coletar todos os blocos textuais em ordem de DOM, enquanto os fluxos de MCQ e de opções expandidas permanecem inalterados.

# Alterações

## `src/lib/pagination.ts`

Em `pickBlockElementsFromWrapper()`:

- adicionada detecção de múltiplos `.question-text` no mesmo `.questao-conteudo`;
- se houver mais de um e não existir `.question-options`, a função passa a concatenar os filhos de todos os `.question-text` como blocos fragmentáveis;
- mantido o comportamento antigo para wrappers com opções.

## `src/tests/pagination/layout.test.ts`

Adicionado teste de regressão:

- `"[otimizado] fragmenta wrapper com múltiplos .question-text no mesmo conteúdo (regressão set discursivo)"`

O teste monta um wrapper único com:

- `questao-conteudo`
- `question-readonly-root`
- dois `.question-text` distintos no mesmo wrapper
- altura total de `1000px`

Antes da correção, ele falhava com:

- warning de fallback `full`
- apenas `1` item no layout

Depois da correção, a questão é fragmentada em múltiplos `frag`.

# Validação

Executado:

```bash
pnpm test -- src/tests/pagination/layout.test.ts -t "múltiplos .question-text"
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final:

- `119` testes passando
- `0` falhas

# Risco residual

A correção não muda a lógica geral de `placeGroup`, `tryFragmentResidual` ou `placeWithFragmentation`. Ela só amplia a coleta de blocos no caso específico de wrappers sem opções e com múltiplos `.question-text`, que era justamente o formato novo dos sets discursivos longos.

# Complemento — renderer de fragmentos do set discursivo

Após a primeira correção, surgiu um segundo sintoma no `localhost`:

- o texto base aparecia duplicado;
- a questão ainda extrapolava a página.

Isso indicou que a paginação já estava produzindo `frag`, mas o renderer de `set_questions` discursivo ainda desenhava o set inteiro em cada fragmento.

## Causa

Em `src/components/Questions/QuestionRendererBase.tsx`, o branch `isEssaySet` dentro de `renderSetQuestions()` ignorava `fragmentRender` e renderizava:

- `base_text` completo;
- todos os `question_item` completos;

em cada fragmento.

## Correção

Foi adicionada uma lógica local de particionamento dos blocos textuais do set discursivo:

- percorre `base_text` e os `statement` de cada item em ordem;
- aplica os índices globais de `fragmentRender.textBlocks`;
- renderiza apenas os blocos pertencentes ao fragmento atual;
- preserva os rótulos `a)`, `b)`, `c)` quando houver conteúdo do item no fragmento.

Isso foi feito sem alterar o branch de MCQ e sem mexer novamente na paginação.

## Teste novo

Arquivo:

- `src/tests/renderer/QuestionRendererBase.test.tsx`

Caso coberto:

- set discursivo com `base_text` de 2 blocos;
- 2 itens discursivos;
- `fragmentRender={{ textBlocks: [1, 2], options: [] }}`

Esperado:

- renderiza apenas `Base A` e `Base B`;
- não renderiza `Item 1` nem `Item 2`.

Antes da correção:

- o teste falhava porque `Item 1` era renderizado mesmo fora do fragmento.

Depois da correção:

- o teste passou.

## Validação final

Executado novamente:

```bash
pnpm test -- src/tests/renderer/QuestionRendererBase.test.tsx
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final atualizado:

- `120` testes passando
- `0` falhas

# Complemento — re-paginação quando o conteúdo real muda

Após corrigir o renderer, ainda restava um sintoma no `localhost`:

- a questão nova com `baseTextIds[]` continuava extrapolando a página mesmo sem duplicar o texto;
- isso acontecia de forma inconsistente entre questões parecidas.

## Causa

Em `src/app/editor/prova/montar/page.tsx`, o `expandedQuestions` muda quando o `baseTextCache` é preenchido de forma assíncrona. Porém o `usePagination()` estava sendo chamado com:

```ts
dependencies: [repaginateVersion]
```

Então a paginação podia medir uma versão incompleta da questão (antes de o `base_text` externo entrar) e não recalcular depois.

## Correção

Foi adicionada uma chave estável baseada no conteúdo real de `expandedQuestions`:

- `expandedQuestionsContentKey`

Essa chave inclui:

- `metadata.id`
- tipo sintético (`base`, `item`, `single`)
- `content` serializado

E ela passou a entrar nas `dependencies` do `usePagination()`:

```ts
dependencies: [
  repaginateVersion,
  expandedQuestionsContentKey,
]
```

Isso força repaginação quando o conteúdo efetivo muda por causa do carregamento de textos base externos.

## Teste/documentação

Foi adicionado um teste em:

- `src/tests/pagination/usePagination.test.tsx`

Caso coberto:

- quando uma chave de conteúdo entra nas `dependencies` e muda, `calculatePageLayout` deve ser chamado novamente.

Importante:

- nenhuma lógica interna do hook `usePagination` foi alterada;
- a correção ficou no uso correto das `dependencies` em `montar/page.tsx`.

## Validação final atualizada

Executado novamente:

```bash
pnpm test -- src/tests/pagination/usePagination.test.tsx
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final atualizado:

- `122` testes passando
- `0` falhas

# Complemento — não pular a coluna2 da primeira página

Persistiu um sintoma real no `localhost`:

- a questão preenchia a `coluna1` da página 1;
- a `coluna2` ficava vazia;
- e o texto continuava na `coluna1` da página 2.

## Causa

Em `src/lib/pagination.ts`, dentro de `placeWithFragmentation()`, os fragmentos posteriores ao primeiro eram construídos com:

```ts
const capNext = otherPageCapacity
```

Isso era grande demais quando o próximo destino real ainda era a `coluna2` da **primeira página**, cuja capacidade é `firstPageCapacity`.

Efeito:

- `buildFragmentsForQuestion()` montava um segundo fragmento válido para `otherPageCapacity`;
- esse fragmento não cabia na `coluna2` da primeira página;
- a alocação então pulava direto para a próxima página.

## Correção

`capNext` passou a respeitar o próximo slot imediato:

- se o primeiro fragmento começa na `coluna1` e ainda existe `coluna2` disponível na mesma página, usa `targetPage.coluna2.remaining`;
- caso contrário, continua usando `otherPageCapacity`.

Implementação:

```ts
const capNext =
  columns === 2 && targetCol === "coluna1" && targetPage.coluna2.remaining > 0
    ? targetPage.coluna2.remaining
    : otherPageCapacity;
```

## Teste novo

Adicionado em `src/tests/pagination/layout.test.ts`:

- `"[otimizado] não pula a coluna2 da primeira página quando o próximo fragmento precisa ser menor que otherPageCapacity"`

Cenário:

- questão de `1200px`
- blocos `[400, 400, 400]`
- `firstPageCapacity=742`
- `otherPageCapacity=931`
- `columns=2`

Antes da correção:

- os fragmentos saíam como `[400, 800]`;
- o fragmento `800` não cabia na `coluna2` da primeira página;
- o algoritmo pulava para a página seguinte.

Depois da correção:

- os fragmentos passam a respeitar a `coluna2` imediata;
- o fluxo vira `coluna1 página 1 -> coluna2 página 1 -> coluna1 página 2`.

## Validação final atualizada

Executado novamente:

```bash
pnpm test -- src/tests/pagination/layout.test.ts -t "não pula a coluna2 da primeira página"
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final atualizado:

- `123` testes passando
- `0` falhas

# Complemento — item seguinte do grupo também precisa tentar residual

Depois que `montar/page.tsx` passou a expandir o set discursivo em base + itens, reapareceu um problema real:

- a paginação já tratava bem o `base_text` do grupo;
- mas, quando o **item seguinte do mesmo grupo** não cabia inteiro na coluna atual, a coluna era fechada cedo demais;
- isso podia deixar uma coluna inteira vazia, apesar de haver espaço suficiente para um bom fragmento do item seguinte.

## Causa

Em `src/lib/pagination.ts`, no loop de `placeGroup(...)`, o fluxo era:

1. tentar colocar o item atual inteiro na coluna atual;
2. se não coubesse, fechar a coluna;
3. só então tentar a próxima coluna/página.

O `tryFragmentResidual()` para aproveitar o residual da coluna atual estava sendo aplicado:

- ao `base_text` no início do grupo;
- e ao caso especial de `coluna2` vazia;

mas **não** ao item atual do grupo antes de fechar a coluna.

## Correção

Antes do fechamento da coluna, o loop de `placeGroup(...)` agora tenta:

- `tryFragmentResidual(qIdx, h, lastPage[setCol], ...)`

usando:

- a capacidade real da coluna atual;
- a capacidade do próximo slot imediato quando a próxima parada natural é a `coluna2`.

Se a fragmentação residual for válida, o fluxo usa `placeResidualFragments(...)` e continua sem fechar a coluna prematuramente.

## Teste novo

Adicionado em `src/tests/pagination/layout.test.ts`:

- `"[residual] fragmenta item seguinte do mesmo grupo antes de fechar a coluna atual"`

Cenário:

- grupo com base + item 1 curtos;
- item 2 longo;
- sobra na `coluna1` é >= 50% da coluna;
- esperado: item 2 começa como `frag` na `coluna1` e continua na `coluna2`.

## Validação final atualizada

Executado novamente:

```bash
pnpm test -- src/tests/pagination/layout.test.ts -t "fragmenta item seguinte do mesmo grupo antes de fechar a coluna atual"
pnpm test
```

Resultado final atualizado:

- `124` testes passando
- `0` falhas

# Complemento — restauração do label do texto base

Durante as correções de renderer/paginação, o label do texto base deixou de aparecer no item sintético `__setBase` (ex.: `Texto XXX`).

## Causa

No fluxo de `src/app/editor/prova/montar/page.tsx`, o item sintético `__setBase` estava carregando apenas:

- `parentId`
- `headerText`

Mas o `tag` do texto base continuava disponível em `baseTextCache`.

## Correção

Foi adicionada uma função local:

- `buildBaseTextLabelFromTags(tags: string[])`

E o `__setBase` criado para grupos de questões individuais com texto base passou a incluir:

- `labelText: "Texto XXX"` para 1 tag
- `labelText: "Textos XXX, YYY"` para múltiplas tags

No render do `isSetBase`, o label voltou a ser mostrado acima do cabeçalho:

- primeiro `labelText`
- depois `headerText`

## Escopo

Essa correção foi propositalmente limitada ao caso do `__setBase`, sem alterar novamente:

- paginação
- renderer de set discursivo
- parser/importação

## Validação

Executado:

```bash
pnpm test
```

Resultado final mantido:

- `123` testes passando
- `0` falhas

## Observação posterior

A primeira tentativa de restaurar o label do texto base foi aplicada apenas no caminho `__setBase`. Em alguns casos reais isso não teve efeito, porque a questão passava pelo ramo de set discursivo atômico (`isEssaySet` em `montar/page.tsx`), não pelo ramo `__setBase`.

## Ajuste final do label

Foi então restaurado também no ramo correto:

- `page.tsx` agora calcula `baseTextLabel` a partir das `tag`s dos `baseTextIds[]`;
- no fluxo `isEssaySet`, o item expandido recebe `__baseTextLabel`;
- no `renderQuestion`, questões normais (não `__setBase`) exibem esse label acima do conteúdo no primeiro fragmento.

Isso repõe o comportamento visual sem voltar a tocar na paginação.

# Mudança de estratégia — restauração da paginação e correção em `montar/page.tsx`

Após insistir em ajustes locais em `pagination.ts`, ficou claro que o caso real do `localhost` não estava sendo resolvido ali.

## Diagnóstico final

O conjunto discursivo problemático passava por este ramo em `src/app/editor/prova/montar/page.tsx`:

- `isEssaySet === true`
- comentário antigo: `Conjuntos discursivos: unidade atômica`

Ou seja:

- o set discursivo inteiro entrava em `expandedQuestions` como **uma questão só**;
- ele **não** virava `__setBase + __set items`;
- então a paginação nunca enxergava fronteiras reais entre texto-base, questão 1, questão 2 etc.;
- por isso os remendos em `pagination.ts` estavam atacando sintomas, não a causa.

## Restauração

Para evitar acumular heurísticas erradas em `pagination.ts`:

- `src/lib/pagination.ts` foi restaurado a partir de `src/lib/pagination_old.ts`
- `src/app/editor/prova/montar/page.tsx` foi congelado em `src/app/editor/prova/montar/page_old.tsx` antes da nova alteração

Isso deixa dois pontos explícitos de comparação/rollback.

## Correção adotada

Em `src/app/editor/prova/montar/page.tsx`, o ramo `isEssaySet` passou a funcionar assim:

### Quando há 2+ itens selecionados

- o set discursivo deixa de ser atômico;
- se houver `base_text` inline, ele vira `__setBase`;
- se o `base_text` tiver sido migrado para `baseTextIds[]`, ele é reconstruído a partir de `baseTextCache` e também vira `__setBase`;
- cada `question_item` selecionado vira uma questão própria, com `__set.parentId = id`.

Na prática, isso alinha o comportamento de discursivas longas com o fluxo já usado para agrupamentos base + itens:

- a paginação passa a trabalhar sobre **unidades reais**;
- o banner/label do texto base continua no item sintético;
- as questões do conjunto deixam de depender de “adivinhar” fronteiras internas pelo DOM.

### Quando há menos de 2 itens selecionados

- o comportamento atômico anterior é preservado.

### Quando não há `base_text`, mas há 2+ itens

- os itens ainda recebem `__set.parentId`;
- em `setGroups`, se não existir `__setBase`, o grupo é montado usando o primeiro item como `baseIndex` lógico e os demais como `itemIndexes`;
- isso preserva a coesão e a ordem do grupo mesmo sem texto base explícito.

## Observação sobre testes

Havia um teste sintético adicionado anteriormente para forçar residual em `pagination.ts` com ordem preservada. Como a correção deixou de viver nessa camada, esse teste foi removido para manter a suíte coerente com a estratégia nova.

## Validação final atualizada

Executado novamente:

```bash
pnpm test
```

Resultado final atualizado:

- `123` testes passando
- `0` falhas
