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

# Ajuste confirmado — continuação pode ser redividida ao entrar em página mais folgada

## Problema

Num caso real com várias discursivas, a quebra entre subitens (`a)`, `b)`, `c)`, `d)`) estava ficando feia:

- a questão começava sob a restrição da primeira página;
- depois seguia para páginas internas com capacidade maior;
- mas a fragmentação antiga era mantida;
- então um bloco como `d)` podia ser empurrado para a outra coluna antes da hora, mesmo ainda havendo espaço útil.

## Causa

Em `src/lib/pagination.ts`, `placeWithFragmentation(...)` calculava os fragmentos iniciais usando o `capNext` disponível no momento do começo da questão.

Quando a continuação chegava a uma página posterior:

- o slot real já era mais generoso;
- mas os fragmentos antigos não eram recompostos;
- então a paginação seguia um plano de quebra já “curto”.

## Correção

Ao tentar colocar um fragmento em uma nova página:

- antes de aceitar a quebra antiga,
- o algoritmo passa a reconstruir os fragmentos restantes a partir do bloco atual,
- usando a capacidade real da nova página (`coluna1` e, se houver, `coluna2`).

Isso foi implementado em:

- `src/lib/pagination.ts`
- dentro de `placeWithFragmentation(...)`

## Efeito prático

- a continuação deixa de carregar uma quebra conservadora demais herdada da página anterior;
- blocos que cabem na nova página/coluna voltam a ser aproveitados;
- a fragmentação fica visualmente mais natural.

## Estado

Correção confirmada manualmente no `localhost`.

# Ajuste corretivo — não pular o primeiro fragmento reconstruído

## Problema introduzido

Na primeira versão da redivisão acima, surgiu uma regressão imediata:

- as letras `a)`, `b)`, `c)` da questão deixavam de aparecer.

## Causa

Depois de reconstruir os fragmentos restantes:

- o código substituía `frag.items`/`frag.heights`,
- mas fazia `continue` no loop;
- com isso, o primeiro fragmento reconstruído não era efetivamente inserido no slot atual.

## Correção

Após a reconstrução:

- o primeiro fragmento recomposto passou a ser inserido imediatamente no slot corrente;
- e só os fragmentos subsequentes seguem o fluxo normal do loop.

## Estado

Correção confirmada manualmente.

Resultado observado:

- a questão voltou a renderizar `a)`, `b)`, `c)` normalmente;
- e a melhoria da quebra foi preservada.

# Infra de debug reutilizável — possibilidade de expandir para outras telas

## O que foi feito

O debug do `montar` deixou de ser um bloco ad hoc dentro da página e passou a usar um componente reutilizável:

- `src/components/dev/DevDebugTools.tsx`

Esse componente concentra:

- `Debug ON/OFF`
- `Copiar Debug`
- `Baixar Debug`
- persistência via `localStorage`
- ocultação automática em produção

No `montar`, a página agora só:

- gera o payload específico;
- publica no `snapshotKey` global;
- e renderiza o componente com:
  - `storageKey`
  - `snapshotKey`
  - `filePrefix`

## Possibilidade já deixada preparada

Essa infraestrutura foi pensada para ser reaproveitada em outras telas sem repetir a UI dos botões.

Próximas candidatas naturais:

- editor de questão
- página de seleção/filtro de questões

## Como expandir

Para cada nova tela:

1. definir um payload específico do estado relevante;
2. publicar esse payload em um `snapshotKey` próprio;
3. importar `DevDebugTools`;
4. configurar:
   - `enabled`
   - `onEnabledChange`
   - `storageKey`
   - `snapshotKey`
   - `filePrefix`

## Observação

A parte difícil não é mais o botão.

O trabalho real em cada tela passa a ser:

- decidir qual snapshot é útil para depuração;
- e garantir que ele capture o estado certo sem poluir a lógica principal da página.

# Ajuste confirmado — alinhamento entre fragmentação e renderer

## Problema

Depois da refatoração dos labels por texto base, surgiu um desencontro entre:

- os blocos que a paginação contava;
- e os filhos reais que o renderer colocava dentro de `.question-text`.

O sintoma observado no `localhost` foi:

- a paginação gerava `frag.from/to` plausíveis;
- mas o DOM final mostrava fragmentos “deslocados”;
- em alguns casos o fragmento inicial ficava grande demais e estourava a página;
- em outros, o fragmento final praticamente não renderizava conteúdo.

## Causa identificada

Em `src/components/Questions/QuestionRendererBase.tsx`, o início de cada seção de `base_text` com label estava sendo produzido como um único nó React que juntava:

- o label/toggle;
- e o primeiro bloco real da seção.

Com isso, a paginação passava a contar um número de blocos diferente do DOM final.

## Correção aplicada

Foi ajustado o renderer para que a sequência de blocos reais volte a bater com a estrutura usada pela paginação.

O efeito prático confirmado foi:

- o overflow principal deixou de acontecer;
- os fragmentos passaram a respeitar melhor os limites reais da página.

## Cobertura

Foi adicionada cobertura em:

- `src/tests/renderer/QuestionRendererBase.test.tsx`

para travar o alinhamento entre:

- `fragmentRender.textBlocks`
- labels de `base_text`
- e os blocos efetivamente renderizados.

## Validação

Executado:

```bash
pnpm test
```

Resultado nessa etapa:

- `131` testes passando
- `0` falhas

# Tentativa ainda não comprovada — evitar início de questão com fragmento minúsculo

## Motivação

Depois do overflow principal ter sido corrigido, apareceu um sintoma diferente:

- algumas questões começavam com um fragmento muito pequeno;
- isso podia fazer parecer que um bloco “solto” estava recebendo início de questão.

## Intervenção

Em `src/lib/pagination.ts`, dentro de `placeWithFragmentation(...)`, foi adicionada uma proteção:

- se o primeiro fragmento ficar menor que `30%` da altura total;
- e a questão estiver começando em um slot já ocupado;
- a questão não começa ali e tenta o próximo slot útil.

## Estado dessa intervenção

Essa mudança foi deixada documentada, mas **ainda não está comprovado que ela resolve o problema visual que o usuário estava relatando naquele momento**.

Motivo:

- o sintoma observado pelo usuário era “um fragmento recebeu numeração de questão”;
- a intervenção acima ataca a decisão de início de fragmento pequeno;
- portanto ela pode ser apenas um caso adjacente, não necessariamente a causa exata do problema visto na tela.

## Cobertura

Foi adicionado um teste em:

- `src/tests/pagination/layout.test.ts`

reproduzindo um caso real aproximado com ordem preservada e início minúsculo de fragmento.

## Validação

Executado:

```bash
pnpm test
```

Resultado nessa etapa:

- `132` testes passando
- `0` falhas

## Observação importante

Essa intervenção deve ser tratada como **pendente de confirmação no `localhost`**.

Se o problema visual reaparecer e o debug mostrar que a causa é outra, essa mudança em `pagination.ts` pode precisar ser revista ou revertida isoladamente.

# Complemento — questão livre não pode backfill em página antiga quando a ordem está preservada

## Problema

Num caso real do `montar`, a ordem visual das questões estava sendo quebrada mesmo sem erro de numeração:

- uma questão longa começava;
- continuava em páginas/colunas seguintes;
- e uma questão livre posterior aparecia antes da continuação, preenchendo um “buraco” antigo.

Visualmente isso aparecia como:

- `Q2` começava;
- `Q3` surgia numa coluna anterior;
- e só depois a continuação de `Q2` aparecia.

## Causa

Em `src/lib/pagination.ts`, no modo otimizado com `setGroups`, a ordem dos grupos já era preservada em `orderedGroups = groups`.

Mas, dentro de `placeGroup(...)`, o ramo de questão individual ainda fazia:

```ts
for (const page of pages) {
  if (tryPlaceInSlot(page.coluna1, qIdx, h)) return;
  if (columns === 2 && tryPlaceInSlot(page.coluna2, qIdx, h)) return;
}
```

Ou seja:

- a ordem dos grupos era preservada;
- mas a questão livre posterior ainda podia procurar qualquer slot antigo com espaço;
- isso permitia `backfill` em páginas anteriores;
- e a leitura visual saía de ordem.

## Correção

Foi adicionada uma distinção explícita:

- sem `setGroups`: continua `First Fit` global;
- com `setGroups`: ativa `preserveFlowOrder`.

Nesse modo, questão individual livre:

- não procura mais em todas as páginas antigas;
- tenta apenas o **slot de cauda** do fluxo atual;
- se necessário, tenta a próxima coluna natural da mesma página;
- e, se ainda não couber, segue para nova página/fragmentação.

Funções adicionadas:

- `getTailCol(...)`
- `tryPlaceSinglePreservingFlow(...)`

## Teste de regressão

Adicionado em:

- `src/tests/pagination/layout.test.ts`

Caso coberto:

- cenário baseado no debug real do `montar`, com `setGroups`;
- valida que a ordem de primeira aparição das questões continua:
  - `[0, 1, 2, 3, 4, 5, 6]`

e não algo como:

- `[0, 1, 3, 2, ...]`

## Estado

Essa mudança ataca **o bug correto relatado nessa etapa**:

- não é ajuste de numeração;
- não é heurística de fragmento minúsculo;
- é bloqueio de `backfill` fora da ordem quando a prova está em modo de ordem preservada.

# Ajuste confirmado — continuação precisa tentar redividir na coluna2 imediata

## Problema

Num caso real confirmado no `localhost`, a questão longa:

- começava em uma coluna;
- tinha continuação esperada na `coluna2` da mesma página;
- mas a paginação deixava essa `coluna2` vazia;
- e só continuava na `coluna1` da página seguinte.

Isso era o bug visível correto naquele momento:

- não era numeração;
- não era “fragmento minúsculo”;
- era abandono indevido da `coluna2` imediata.

## Causa

Em `src/lib/pagination.ts`, `placeWithFragmentation(...)` podia montar uma sequência de fragmentos válida em abstrato, mas ainda assim chegar no momento de inserir o próximo fragmento e descobrir que:

- o fragmento calculado estava grande demais para a `coluna2` real disponível naquele ponto.

Quando isso acontecia, o fluxo simplesmente desistia da `coluna2` e abria nova página.

## Correção

Foi adicionada uma redivisão local do restante da questão:

- quando o próximo fragmento não cabe na `coluna2` imediata;
- e ainda existe espaço útil nessa coluna;
- o algoritmo recompõe os fragmentos restantes a partir do bloco atual,
  usando essa `coluna2` como `capFirst`;
- só depois disso ele considera pular para nova página.

Implementação em:

- `src/lib/pagination.ts`
- dentro de `placeWithFragmentation(...)`
- helper local `buildRemainingFromBlock(...)`

## Estado

Correção **confirmada manualmente no caso real aberto na tela**.

Resultado observado:

- a continuação voltou a ocupar a `coluna2` imediata;
- a próxima questão deixou de aparecer antes da hora;
- o bug específico foi encerrado.

# Ajuste confirmado — toggle do segundo label de texto base

## Problema

Ao carregar uma única questão com `2` textos base:

- o primeiro label `Texto XXX` mostrava toggle;
- o segundo label aparecia sem toggle;
- então não era possível ocultar o segundo label individualmente.

## Causa

Em `src/app/editor/prova/montar/page.tsx`, o callback `onToggleBaseTextSection` só era habilitado quando:

```ts
!frag || frag.first
```

Isso amarrava o toggle ao início do fragmento da questão, e não ao início da seção de texto base efetivamente renderizada.

Consequência:

- se a segunda seção começasse em fragmento posterior;
- o label podia aparecer;
- mas o botão não vinha junto.

## Correção

O gating foi simplificado para:

- existir seção de texto;
- não ser item-filho de set.

Ou seja, o toggle agora acompanha a seção renderizada, sem depender de `frag.first`.

Arquivo:

- `src/app/editor/prova/montar/page.tsx`

## Estado

Correção **confirmada manualmente**.

Resultado observado:

- o segundo label voltou a exibir toggle;
- e passou a poder ser ocultado individualmente.

# Complemento — slot intermediário de fragmentação não pode receber outra questão

Depois de estabilizar a fragmentação dos sets, apareceu um caso claro de regressão:

- um `base_text` fragmentava;
- sobrava espaço visual abaixo do fragmento atual;
- e a próxima questão entrava nesse espaço, enquanto o texto continuava na coluna/página seguinte.

Esse comportamento é inválido: se a questão ainda vai continuar em outro slot, o slot atual precisa ficar logicamente “fechado”.

## Causa

Em `src/lib/pagination.ts`, dentro de `placeWithFragmentation()`, cada fragmento era inserido e o `remaining` do slot continuava disponível.

Na prática:

- o fragmento era colocado;
- a continuação da mesma questão ia para outro slot;
- mas o slot anterior ainda parecia livre para a próxima questão;
- isso permitia uma questão “no meio” do texto fragmentado.

## Correção

Foi adicionada uma vedação explícita para slots de fragmentos não-finais:

- depois de inserir um fragmento que ainda terá continuação, o slot recebe `remaining = 0`;
- assim, nenhuma outra questão pode ocupar o espaço abaixo dele;
- o último fragmento continua usando o `remaining` normal.

Implementação em `src/lib/pagination.ts`:

- helper local `sealFragmentSlot(...)`;
- aplicado ao slot do primeiro fragmento e a qualquer slot de fragmento intermediário.

## Teste novo

Adicionado em `src/tests/pagination/layout.test.ts`:

- `"[otimizado] não coloca outra questão abaixo de fragmento que ainda continua"`

Cenário:

- questão longa fragmentada;
- questão curta seguinte;
- esperado: a questão curta **não** aparece na mesma coluna abaixo do primeiro fragmento.

## Validação final atualizada

Executado:

```bash
pnpm test -- src/tests/pagination/layout.test.ts -t "não coloca outra questão abaixo de fragmento que ainda continua"
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final atualizado:

- `126` testes passando
- `0` falhas

# Complemento — labels por texto base sem contaminar o PMDoc

Na sequência, entrou uma necessidade editorial nova:

- quando uma questão usa múltiplos textos base, cada texto precisa ter seu próprio label (`Texto XXX`);
- mas alguns labels precisam poder ser ocultados individualmente;
- a primeira implementação colocou esses labels dentro do `base_text` montado.

Isso funcionava visualmente, mas ficou ruim tecnicamente:

- o PMDoc mudava por causa do toggle;
- a paginação passava a depender da visibilidade do label;
- ocultar um label mexia no conteúdo paginado, não só na apresentação.

## Estratégia nova

Foi adotado um modelo melhor:

- o `base_text` volta a ficar puro;
- `page.tsx` só calcula metadados de seções (`id`, `tag`, `blockCount`);
- o renderer decide onde mostrar cada label;
- o toggle atua apenas como estado visual por ocorrência do bloco.

## Alterações

### `src/app/editor/prova/montar/page.tsx`

- `buildCombinedBaseTextNode(...)` voltou a apenas concatenar o conteúdo real dos textos base;
- adicionada `buildBaseTextSections(...)`, que gera:
  - `id`
  - `tag`
  - `blockCount`
- o estado `hiddenBaseTextLabels` passou a ser escopado por ocorrência:
  - chave = `${scopeKey}::${textId}`
- os metadados são passados para o renderer como:
  - `__setBase.textSections`
  - `__baseTextSections`

### `src/components/Questions/QuestionRendererBase.tsx`

- adicionado suporte a `baseTextSections`;
- labels são renderizados no início da seção correspondente;
- o botão de toggle agora fica junto do label, no mesmo ponto visual;
- o label aparece apenas no fragmento que contém o início daquele texto;
- ocultar o label não remove o texto base, só a camada visual.

### `src/components/Questions/QuestionRendererProva.tsx`

- apenas repasse dos novos props de `baseTextSections` e callback de toggle.

## Cobertura nova

Em `src/tests/renderer/QuestionRendererBase.test.tsx` foram adicionados:

- `renderiza label apenas no início da seção de texto base presente no fragmento`
- `oculta label de seção marcada como hidden sem alterar o texto base`

Esses testes garantem:

- que o label de uma seção só aparece quando o fragmento começa naquele texto;
- que ocultar o label não some com o conteúdo.

## Resultado prático

O comportamento final passou a ser:

- cada texto base pode ter seu label individual;
- o toggle fica ao lado do label correspondente;
- o toggle não altera o PMDoc nem a contagem de blocos paginados;
- esconder `Texto XXX` em uma ocorrência não esconde automaticamente em outra.

## Validação final atualizada

Executado:

```bash
pnpm test -- src/tests/renderer/QuestionRendererBase.test.tsx
pnpm test -- src/tests/pagination/layout.test.ts
pnpm test
```

Resultado final atualizado:

- `128` testes passando
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
