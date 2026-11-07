# Modernização visual — proposta1

Implementação isolada na branch `proposta1`, no worktree `C:\Projetos\pmeditor-proposta1`.

## Cobertura

As 24 rotas de produção e duas de desenvolvimento receberam a estrutura visual. Todas responderam HTTP 200 na verificação de compilação; isso não equivale à validação do conteúdo autenticado.

| Área | Rotas |
| --- | --- |
| Entrada e apoio | `/`, `/dashboard`, `/template`, `/headers`, `/perfil` |
| Questões e edição | `/editor`, `/editor/questoes`, `/editor/questoes/filtro`, `/editor/teste` |
| Textos base e assuntos | `/editor/textos-base`, `/editor/texto-base/[id]`, `/editor/assuntos`, `/editor/assuntos/consulta` |
| Provas | `/editor/prova`, `/editor/prova/selecionar-layout`, `/editor/prova/montar`, `/editor/prova/diagramar` |
| Conta e turmas | `/minha-area`, `/minha-area/turmas/nova`, `/minha-area/turmas/[id]` |
| Administração | `/admin/usuarios`, `/admin/gerenciar`, `/admin/importar`, `/admin/fixes` |
| Desenvolvimento | `/dev`, `/dev/revisar` |

Rotas dinâmicas foram verificadas com `/editor/texto-base/novo` e `/minha-area/turmas/0`; a segunda não comprova uma turma real autenticada.

## Verificações

- TypeScript strict sem erros; 169 testes passaram em 12 arquivos.
- Build de produção `pnpm exec next build --webpack` concluído com sucesso em 2026-11-07, incluindo TypeScript e geração das páginas. Avisos existentes de configuração do Sentry permanecem.
- Revisão de código em todas as áreas, incluindo callbacks e operações existentes na administração.
- Algoritmo e hook de paginação, CSS A4/ProseMirror, renderizadores de questões e layouts de prova sem alterações.
- Comparação original/proposta com duas questões reais: geometria, conteúdo das colunas e modelos de medição idênticos; uma página A4 de 793,6875 × 1122,515625 px. Essa comparação cobre o caso exercitado, não todas as provas possíveis.
- Detector Hallmark: zero FAIL; detector Impeccable sem ocorrências nos componentes compartilhados novos.
- Há regras antigas de lint em páginas existentes; não foi feita uma refatoração geral para removê-las.

## Pendências de conferência

A inspeção visual autenticada de Minha Área e administração depende de login OAuth. A ferramenta de navegador falhou ao abrir novas abas durante a finalização; não se declara revisão visual integral nem validação móvel integral. Capturas anteriores cobrem entrada, painel, modelo, cabeçalhos, editor e banco.

Prévia local na porta 3000, usada pelo OAuth. Comando: `pnpm dev --webpack --port 3000`. Webpack é necessário neste worktree porque `node_modules` é uma junction para o checkout original.

Sem deploy, push ou merge em `main`.
