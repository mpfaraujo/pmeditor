# Plano: deteccao de questoes possivelmente duplicadas

## Objetivo

Criar uma etapa de revisao antes da insercao de uma nova questao para identificar itens ja cadastrados ou muito parecidos, exibindo a questao nova e a existente lado a lado para decisao do professor.

## Resultado esperado

Ao tentar inserir uma questao, o sistema:

1. compara a nova questao com o banco existente;
2. classifica o resultado como sem conflito, duplicata certa ou duplicata provavel;
3. quando houver suspeita de duplicata, mostra as duas versoes lado a lado;
4. permite ao professor decidir se deseja inserir, cancelar ou tratar como variacao.

## Escopo funcional

### Fluxo principal

1. Usuario inicia a insercao de uma nova questao.
2. Sistema normaliza os dados relevantes da questao.
3. Sistema busca candidatas parecidas no banco.
4. Se nao houver candidatas acima do limiar minimo, a insercao segue normalmente.
5. Se houver candidatas, o sistema abre uma tela ou modal de comparacao.
6. Professor decide entre:
   - inserir mesmo assim;
   - cancelar a insercao;
   - marcar como variacao/versao, se esse conceito existir no produto.

### Comparacoes previstas

- Enunciado
- Alternativas
- Gabarito
- Disciplina
- Assunto/tema
- Serie/ano
- Nivel de dificuldade, se houver
- Conteudo matematico em LaTeX, se houver

## Estrategia tecnica sugerida

### 1. Normalizacao

Criar uma rotina de normalizacao para reduzir diferencas superficiais:

- converter para caixa uniforme;
- remover espacos redundantes e quebras irrelevantes;
- remover ou padronizar acentos, se fizer sentido para a base;
- padronizar pontuacao simples;
- normalizar HTML/Markdown/LaTeX, se esses formatos existirem;
- separar texto do enunciado, alternativas e metadados em campos comparaveis.

### 2. Deteccao em duas camadas

#### Camada A: duplicata exata ou quase exata

- gerar um texto canonico da questao;
- calcular um hash desse texto;
- se o hash bater com um registro existente, marcar como duplicata certa.

#### Camada B: similaridade

Para casos nao identicos:

- usar similaridade textual entre enunciados;
- comparar semelhanca entre alternativas;
- considerar coincidencia de resposta correta;
- aplicar pesos por campo para formar um score final.

Exemplo de interpretacao:

- `>= 0,98`: duplicata certa
- `0,85 a 0,97`: duplicata provavel
- `< 0,85`: sem conflito

Os limiares devem ser ajustados com amostras reais.

### 3. Busca eficiente

Para evitar comparar com todo o banco a cada insercao:

- filtrar primeiro por disciplina/serie/assunto;
- usar hash para casos exatos;
- buscar candidatas por indice textual ou estrategia equivalente;
- comparar em profundidade apenas as candidatas mais proximas.

## Proposta de interface

### Tela de revisao de duplicata

Exibir:

- nova questao em uma coluna;
- questao existente em outra coluna;
- score de similaridade;
- destaque visual das diferencas;
- metadados da questao existente:
  - data de cadastro;
  - origem;
  - autor/professor, se houver;
  - listas, provas ou usos anteriores.

### Acoes do professor

- `Inserir mesmo assim`
- `Cancelar`
- `Marcar como variacao` ou equivalente, se existir esse conceito
- `Abrir questao existente` para consultar mais contexto

## Regras de negocio a definir

- O sistema deve interromper a insercao sempre que houver suspeita, ou apenas alertar?
- O conceito de variacao/versao existe no produto?
- A comparacao deve considerar imagens?
- A comparacao deve considerar apenas enunciado ou enunciado + alternativas?
- Questoes em disciplinas diferentes podem ser consideradas duplicatas?
- O professor pode desativar o alerta em importacoes em lote?

## Plano de implementacao

### Fase 1: descoberta

- mapear onde hoje acontece a insercao de questoes;
- identificar o modelo de dados da questao;
- listar os campos disponiveis para comparacao;
- levantar volume aproximado da base e restricoes de performance.

### Fase 2: prototipo de comparacao

- implementar normalizacao basica;
- implementar hash da versao canonica;
- implementar score simples de similaridade;
- testar com uma amostra real de questoes conhecidas.

### Fase 3: experiencia de uso

- criar a tela/modal de comparacao lado a lado;
- destacar diferencas relevantes;
- registrar a decisao do professor.

### Fase 4: endurecimento

- calibrar limiares com casos reais;
- reduzir falsos positivos;
- tratar casos com LaTeX, alternativas embaralhadas e pequenas edicoes;
- medir impacto de performance.

### Fase 5: auditoria e evolucao

- registrar quando o usuario ignorou um alerta;
- registrar quando confirmou uma duplicata;
- usar esse historico para ajustar regras futuras.

## Riscos principais

- falso positivo em questoes parecidas, mas pedagogicamente distintas;
- falso negativo por mudancas pequenas de formatacao ou LaTeX;
- custo alto de comparacao em bases grandes;
- interface atrapalhar o fluxo se alertar demais.

## Informacoes que ajudariam a detalhar o plano

Nao sao necessarias para guardar este rascunho, mas seriam uteis para evoluir:

- onde a questao e inserida hoje no sistema;
- quais campos existem no cadastro da questao;
- se ha LaTeX, HTML, imagens ou anexos;
- volume aproximado de questoes no banco;
- se ja existe algum conceito de questao derivada, versao ou variacao;
- se a deteccao deve acontecer tambem em importacao em lote.

## Decisao de produto sugerida

Tratar isso como assistente de deduplicacao, e nao como bloqueio automatico. O sistema aponta suspeitas e o professor decide, com contexto suficiente para comparar as duas questoes.
