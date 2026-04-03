# PMEditor — memoria operacional para sessoes futuras

## Objetivo do produto

Aplicacao para:

- criar e editar questoes com schema ProseMirror customizado;
- importar questoes a partir de texto/LaTeX/Word/PDF;
- consultar banco de questoes com filtros;
- selecionar questoes e montar provas/listas;
- gerar variacoes de prova com permutacao de alternativas;
- salvar provas e filtros por turma;
- manter perfis de professores e instituicoes com logos.

Stack principal:

- frontend em Next.js 16 + React 19 + TypeScript;
- UI com Tailwind 4 + Radix/shadcn;
- editor rich text com ProseMirror customizado;
- renderizacao matematica com KaTeX;
- backend PHP em `php/guardafiguras/api`;
- persistencia principal no backend PHP/MySQL; parte do estado de montagem fica em `localStorage`.

## Mapa de rotas do app

### Publico / entrada

- `src/app/page.tsx`: landing scroll-driven. Se o usuario ja estiver logado, redireciona para `/dashboard`.
- `src/app/dashboard/page.tsx`: menu principal com atalhos para editor, banco de questoes, template e minha area.
- `src/app/template/page.tsx`: modelo copiavel de YAML/metadados para pre-preencher questoes.
- `src/app/headers/page.tsx`: pagina de demonstracao/preview de cabecalhos.

### Edicao de questoes

- `src/app/editor/page.tsx`: fluxo de criacao. Primeiro passo opcional recebe YAML/template; segundo passo abre `QuestionEditor`.
- `src/app/editor/questoes/filtro/page.tsx`: tela de filtros antes da listagem de questoes.
- `src/app/editor/questoes/page.tsx`: listagem paginada do banco; modo carrossel ou grade; selecao para prova; abertura de modal de edicao.
- `src/app/editor/assuntos/page.tsx`: colaboracao/proposta de ajustes em assuntos.
- `src/app/editor/assuntos/consulta/page.tsx`: consulta de assuntos/areas.

### Provas

- `src/app/editor/prova/selecionar-layout/page.tsx`: configuracao de layout, cabecalho, colunas e defaults da prova.
- `src/app/editor/prova/montar/page.tsx`: montagem/renderizacao final, reordenacao, bin-packing, gabarito, tipos de prova, impressao.
- `src/app/editor/prova/page.tsx`: entrada secundaria do fluxo de prova.

### Area autenticada

- `src/app/minha-area/page.tsx`: hub autenticado com tabs de perfil, turmas, questoes e provas.
- `src/app/minha-area/turmas/nova/page.tsx`: criacao de turma/filtro salvo.
- `src/app/minha-area/turmas/[id]/page.tsx`: edicao de turma existente.
- `src/app/perfil/page.tsx`: pagina simples de perfil.

### Admin

- `src/app/admin/usuarios/page.tsx`: administracao de usuarios.
- `src/app/admin/gerenciar/page.tsx`: area admin para gestao de questoes/importacao.
- `src/app/admin/importar/page.tsx`: workflow de importacao em lote usando `public/data/import-queue.json`.

## Providers e contexto global

- `src/components/Providers.tsx`: empilha `AuthProvider`, `ProvaProvider` e `Toaster`.
- `src/contexts/AuthContext.tsx`:
  - guarda sessao em `localStorage` na chave `pmeditor:session`;
  - restaura perfil por `users/profile.php`;
  - faz login via Google -> `users/login.php`;
  - calcula permissoes (`isAdmin`, `canEditQuestion`, etc.);
  - expoe defaults de professor/disciplina/instituicao/logo.
- `src/contexts/ProvaContext.tsx`:
  - guarda questoes selecionadas para prova;
  - persiste config e selecoes em `localStorage`;
  - trata `set_questions` com selecao parcial de itens;
  - aplica limite de 100 questoes efetivas;
  - configura layout/cabecalho/gabarito/logo da prova.

Chaves importantes de `localStorage`:

- `pmeditor:session`
- `provaConfig_v1`
- `provaQuestions_v1`
- `provaSetSelections_v1`
- `pmeditor:last`
- `questaoViewMode`
- overrides de imagem/alinhamento no renderer da prova

## Editor de questoes

Arquivo central: `src/components/editor/QuestionEditor.tsx`

Responsabilidades:

- cria e controla `EditorView` do ProseMirror;
- monta plugins (`history`, placeholder, input rules, smart paste, verse numbering);
- aplica schema customizado de questao individual e `set_questions`;
- sincroniza metadata da questao;
- permite alternar tipo da questao e numero de alternativas;
- suporta formulas inline com modal `MathInsert`;
- salva rascunho local em `pmeditor:last`;
- faz preview da renderizacao atual no renderer de prova;
- integra texto base por `BaseTextPickerModal`;
- salva:
  - nova questao via `createQuestion`;
  - edicao admin da base via `updateQuestion`;
  - edicao de nao-admin como variante via `proposeQuestion`;
- lida com duplicata via `DuplicateWarningDialog`.

Detalhes importantes:

- `smartPastePlugin` interpreta YAML/meta ao colar e consegue parsear conteudo vindo de LaTeX/Word/PDF.
- imagens recebem IDs via `ensureImageIds` antes de salvar.
- questoes discursivas removem alternativas; objetivas garantem container `options`.
- `set_questions` pode operar em modo grupo/objetivo ou modo discursivo multipartes.

Componentes auxiliares relevantes:

- `QuestionMetadataModal.tsx`: edicao completa dos metadados; em `set_questions` edita answer key/item metadata por item.
- `QuestionMetaBar.tsx`: normalizacao de gabarito e semantica do tipo.
- `BaseTextPickerModal.tsx`: busca/cria/vincula texto base.
- `EditorToolbar.tsx`: acoes do editor, save, preview, transformacoes de set, largura do editor.
- `RichTextMiniEditor.tsx`: editor reduzido para rubricas/gabaritos discursivos.
- `ImageUpload.tsx`, `LogoPicker.tsx`, `MathToolbar.tsx`, `MathInsert.tsx`.

## Schema e semantica do documento

Arquivos:

- `src/components/editor/schema.ts`
- `src/components/editor/miniSchema.ts`
- `src/lib/questionRules.ts`

Estruturas principais:

- questao individual: `doc -> question -> statement + options?`
- conjunto: `doc -> set_questions -> base_text + question_item...`
- `question_item` guarda `answerKey`, `assunto`, `tags`;
- `set_questions` com `mode !== "set"` e sem `options` funciona como discursiva multipartes;
- conjuntos com 1 item podem colapsar semanticamente para questao unica em alguns renderers.

Nodes especiais relevantes:

- `math_inline`, `math_block`
- `image` com `id`, `src`, `width`, `align`
- `poem`, `credits`, `data_box`
- listas `bullet`, `ordered`, `roman`, `alpha`, `assertive`

## Renderizacao de questoes

Arquivos:

- `src/components/Questions/QuestionRendererBase.tsx`
- `src/components/Questions/QuestionRenderer.tsx`
- `src/components/Questions/QuestionRendererProva.tsx`
- `src/components/Questions/QuestionCard.tsx`

Semantica:

- `QuestionRendererBase` e o renderer comum;
- modo `default` serve cards/listas;
- modo `prova` habilita resize/alinhamento de imagem, ajuste de caixas `data_box` e alternancia de opcoes em linha;
- renderer entende `set_questions` direto ou aninhado;
- conjuntos discursivos viram partes `a)`, `b)`, `c)` via `essayPartLabel`;
- conjuntos objetivos com 2+ itens mostram banner "Use o texto...";
- `fragmentRender` controla renderizacao parcial de blocos/opcoes para pagina fragmentada;
- `permutation` aplica reordenacao visual das alternativas para tipos de prova.

`QuestionCard.tsx`:

- mostra metadata, renderizacao, checkbox de selecao;
- quando a questao tem `baseTextId`, busca texto base em separado e o renderiza acima;
- para `set_questions`, mostra preview do texto base + navegacao entre itens;
- abre `VersionHistoryModal` quando ha variantes.

## Fluxo de banco de questoes

### Filtros e listagem

- `QuestionsFilter.tsx` e `QuestionsFilterMobile.tsx`: montam filtros de disciplina, assunto, tipo, dificuldade, nivel, tags, origem, concurso, ano, root type e "minhas questoes".
- `src/app/editor/questoes/page.tsx`:
  - chama `listQuestions` com `includeContent` e `includeBase`;
  - pagina em lotes de 30;
  - pode exibir apenas selecionadas;
  - atualiza selecao no `ProvaContext`;
  - abre modal de edicao;
  - carrega/atualiza versao ativa da questao.

### Modal de edicao

- `QuestionEditorModal.tsx` envolve `QuestionEditor` para criar ou editar a partir da listagem.
- `VersionHistoryModal.tsx` busca variantes e permite trocar a versao ativa no frontend.

## Montagem de prova

Arquivo central: `src/app/editor/prova/montar/page.tsx`

Responsabilidades:

- recebe questoes selecionadas do `ProvaContext`;
- expande `set_questions` em itens sinteticos quando necessario;
- agrupa questoes individuais que compartilham `baseTextId`;
- monta grupos explicitos para o algoritmo de paginacao;
- usa `usePagination` + `src/lib/pagination.ts`;
- permite reordenacao manual (`ReorderModal`) ou layout otimizado automatico;
- gera tipos de prova por `GeraTiposDeProva.ts`;
- aplica permutacao de alternativas e de gabarito;
- monta gabarito objetivo e gabarito discursivo;
- habilita tabela periodica para provas de Quimica;
- salva prova via `SalvarProvaDialog`;
- imprime via `window.print()`.

Componentes ligados a prova:

- `PaginatedA4.tsx`: wrapper A4.
- `layouts/ProvaLayout.tsx`, `ExerciseLayout.tsx`, `AccessibleLayout.tsx`: layout final.
- `headers/*`: cabecalhos.
- `QuestaoHeaderSvg.tsx`: decorador numerico da questao.
- `Gabarito.tsx`, `GabaritoDiscursivoPages.tsx`.
- `SpacerHandle.tsx`: espacadores arrastaveis.
- `TabelaPeriodica.tsx`.

## Paginacao

Arquivos:

- `src/hooks/usePagination.ts`
- `src/lib/pagination.ts`
- testes em `src/tests/pagination/*`

Pontos criticos:

- `pagination.ts` e arquivo de alto risco. Ler o cabecalho interno antes de alterar.
- ha dois modos:
  - linear/manual;
  - otimizado com bin-packing.
- suporta fragmentacao de questoes por blocos DOM;
- suporta grupos de set que devem ficar coesos;
- evita o bug da primeira pagina vazia;
- usa `setGroups` e `spacers`;
- `remainingHeight` e `colXRemaining` sao relevantes para footer e limites dos spacers.

## Minha area

### `ProfileTab.tsx`

- edita nome;
- gerencia lista de disciplinas do professor;
- gerencia instituicoes com nome e logo;
- persiste via `saveProfile`.

### `TurmasTab.tsx`

- lista turmas salvas;
- cria/edita/deleta turmas;
- cada turma e basicamente um filtro salvo de busca de questoes;
- usa `FilterPreview` para mostrar o filtro resumido.

### `QuestoesTab.tsx`

- funciona como atalho para navegar/editar questoes do proprio usuario.

### `ProvasTab.tsx`

- lista provas salvas;
- carrega prova restaurando questoes e `setSelections`;
- grava de volta em `localStorage` antes de redirecionar;
- deleta provas salvas.

## Login e perfil

- `LoginButton.tsx` usa Google Identity Services no frontend;
- recebe credencial Google e chama `AuthContext.login`;
- quando logado, mostra avatar/nome e link para `minha-area`;
- backend trata sessao propria (`session_token` + `session_expires`).

## Importacao em lote

Arquivo central: `src/app/admin/importar/page.tsx`

Fluxo:

1. carrega `public/data/import-queue.json`;
2. admin configura defaults do lote;
3. cada item e aberto no `QuestionEditor` com `initial` preconstruido;
4. parser tenta converter LaTeX em doc ProseMirror;
5. pode haver itens simples ou conjuntos (`ImportSetItem`);
6. ao salvar uma questao, avanca para a proxima.

Scripts ligados a importacao/manutencao:

- `scripts/parse-tex.ts`
- `scripts/bulk-import.ts`
- `scripts/update-questions.ts`
- `scripts/fix-questoes.ts`
- `scripts/migrate-mcq-sets.ts`
- `scripts/merge-variants.js`
- outros scripts de reparo/importacao em `scripts/`

`public/data/import-queue.json` pode conter trabalho local do usuario. Nao assumir que pode ser alterado.

## Libs de API do frontend

### `src/lib/questions.ts`

Mapeia para `/questoes`:

- `createQuestion`
- `proposeQuestion`
- `getQuestion`
- `listQuestions`
- `getQuestionVariants`
- `deleteQuestion`
- `deleteVariant`
- `deleteVariants`
- `updateQuestion`
- `promoteVariant`

Observacoes:

- usa `X-Questions-Token` para acesso publico de leitura/criacao;
- usa `X-Session-Token` para acoes autenticadas do usuario;
- `myQuestions` troca o header para sessao;
- `variants.php` devolve historico base + variantes;
- `list.php` pode retornar `base` quando `includeBase=1`.

### `src/lib/baseTexts.ts`

Mapeia para `/base_texts`:

- buscar texto base por id;
- listar por filtros;
- listar questoes vinculadas;
- criar texto base.

### `src/lib/user.ts`

- login Google -> `users/login.php`;
- buscar perfil por sessao;
- salvar perfil.

### `src/lib/provas.ts`

- criar/listar/buscar/deletar provas salvas.

### `src/lib/turmas.ts`

- criar/listar/editar/deletar turmas;
- `filtros` seguem estrutura semelhante aos filtros do banco de questoes.

### `src/lib/GeraTiposDeProva.ts`

- gera permutacoes balanceadas de alternativas por tipo;
- usa seed derivada do usuario (`hashQuestionId`);
- aplica permutacao visual e permutacao do gabarito.

### `src/lib/yamlMeta.ts`

- parseia o modelo textual com blocos `---`;
- entende questao simples e conjuntos;
- gera template padrao e template para sets.

## Backend PHP — panorama

Raiz: `php/guardafiguras/api`

### `users`

- `users/login.php`
  - recebe `idToken`;
  - cria/atualiza `user_profiles`;
  - gera `session_token` e prazo de expiracao;
  - devolve perfil normalizado.
- `users/profile.php`
  - GET por `X-Session-Token`;
  - POST para atualizar nome, disciplinas e instituicoes.

### `questoes`

- `create.php`
  - POST autenticado por `X-Questions-Token`;
  - valida payload e `metadata.id`;
  - detecta `root_type`;
  - indexa campos derivados (`disciplina`, `assunto`, `tipo`, `dificuldade`, `nivel`, origem, etc.);
  - tem rate limit;
  - roda heuristica de duplicata por texto normalizado e overlap de palavras;
  - aceita `force` para ignorar duplicata;
  - persiste questao base em `questions`.
- `list.php`
  - GET;
  - aceita token publico ou sessao;
  - filtra por disciplina, assunto, tipo, dificuldade, nivel, tags, `base_text_id`, origem, `root_type`, concurso, ano e "minhas questoes";
  - retorna base ou variante mais recente como conteudo ativo;
  - pode incluir conteudo e base original.
- `get.php`
  - busca uma questao especifica.
- `update.php`
  - atualiza base da questao;
  - exige sessao/permissao;
  - admin tende a editar base diretamente;
  - limpa variantes em certos fluxos.
- `propose.php`
  - cria variante em `question_variants`;
  - usado quando nao-admin edita questao existente.
- `variants.php`
  - lista base + variantes com opcao de incluir conteudo.
- `promote-variant.php`
  - promove variante para base;
  - preserva base anterior como variante.
- `delete.php`
  - apaga questao base.
- `delete-variant.php`
  - apaga uma ou varias variantes.
- `batch-merge.php`
  - manutencao em lote para consolidacao/mescla.
- `filters.php`
  - endpoint auxiliar de agregacao de filtros.
- `link-base-text.php`
  - vincula questao a texto base.
- `bulk-delete-temp.php`, `list-debug.php`, `teste.php`
  - utilitarios administrativos/debug.

### `base_texts`

- `create.php`
  - cria texto base;
  - gera `tag`;
  - faz deteccao de duplicata semelhante a questoes;
  - aceita `force`.
- `get.php`
  - busca texto base por ID.
- `list.php`
  - busca paginada com filtros simples.
- `update.php`
  - atualiza texto base.

### `provas`

- `create.php`
- `list.php`
- `get.php`
- `delete.php`

Todos exigem `X-Session-Token` e usam `provas_salvas`.

### `turmas`

- `create.php`
- `list.php`
- `update.php`
- `delete.php`

Todos exigem `X-Session-Token` e operam sobre filtros salvos por usuario.

### `admin`

- `admin/stats.php`: estatisticas administrativas.

### Uploads e logos

- `upload.php`: upload de imagens do editor.
- `logos.php`: listagem/gestao de logos.
- `uploads/`: imagens persistidas.

## Dados e tipos

- `src/types/user.ts`: formato do perfil, instituicoes e papel do usuario.
- `src/types/layout.ts`: `QuestionData`, estruturas de layout/pagina.
- `src/data/disciplinas_areas.json`: taxonomia principal.
- `src/data/matematica_areas.json`: apoio de assuntos.
- `src/data/assuntos.ts`: fonte de opcoes/normalizacao no frontend.

## Testes

Cobertura principal atual:

- `src/tests/pagination/*`
- `src/tests/questionRules/questionRules.test.ts`
- `src/tests/tipos/GeraTiposDeProva.test.ts`
- `src/tests/yamlMeta/yamlMeta.test.ts`

Nao assumir cobertura ampla de UI. Mudancas em editor/renderers/backend podem exigir verificacao manual adicional.

## Acoplamentos e pontos de atencao

- `QuestionEditor`, `QuestionRendererBase`, `schema.ts`, `questionRules.ts` e endpoints `questoes/*.php` precisam permanecer semanticamente alinhados.
- `set_questions` e `baseTextId` possuem dois mecanismos de agrupamento diferentes:
  - conjunto embutido no documento;
  - questoes independentes compartilhando texto base remoto.
- `ProvaContext`, `ProvasTab` e `montar/page.tsx` dependem fortemente das chaves de `localStorage`.
- `pagination.ts` depende da estrutura DOM real produzida pelos renderers/layouts.
- edicao de nao-admin cria variante, nao sobrescreve base.
- importacao admin depende de `public/data/import-queue.json`; respeitar alteracoes locais do usuario.

## Como usar esta memoria em sessoes futuras

Ao receber uma tarefa nova:

1. identificar em qual fluxo ela cai: editor, banco, prova, minha area, importacao ou backend;
2. abrir o modulo central correspondente;
3. se tocar prova/impressao, abrir tambem `pagination.ts` e os testes;
4. se tocar persistencia, conferir a lib do frontend e o endpoint PHP correspondente;
5. se tocar semantica de questao, conferir `schema.ts`, `QuestionEditor.tsx`, `QuestionRendererBase.tsx` e `questionRules.ts`.
