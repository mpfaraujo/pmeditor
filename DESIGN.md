# ProvaMarela — proposta1

Direção híbrida aprovada: navegação persistente em verde escuro, área de trabalho clara e amarelo para ações principais. A mudança inclui hierarquia, organização dos fluxos, filtros, seleção e controles contextuais, além das cores.

## Sistema

- Tokens `--ws-*` em `src/components/workspace/workspace.css`.
- `WorkspaceShell` concentra navegação e contexto da página.
- Painéis de filtros e seleção acompanham o banco; o editor tem inspeção de metadados; a montagem separa controles e documento.
- Navegação e painéis se reorganizam em telas menores; documentos de dimensão física mantêm a medida e permitem rolagem.
- Foco visível, estados de seleção, carregamento, vazio e erro fazem parte das superfícies.
- Branco nos documentos e superfícies de leitura é uma escolha deliberada de continuidade com a impressão, inclusive nas ocorrências sinalizadas como REFLEX pelo detector Hallmark.

## Limites

Não alterar geometria A4, estilos internos do ProseMirror, medição, algoritmo de paginação ou renderizadores de questões para acomodar a interface. O shell e os controles desaparecem na impressão.

Autenticação, autorização e operações remotas permanecem nos fluxos existentes. Não usar perfis simulados para validar telas protegidas.
