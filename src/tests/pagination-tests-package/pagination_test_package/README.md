# Pacote de Testes para Paginação (Next.js + Vitest)

Este pacote foi montado para testar a lógica de paginação do arquivo `pagination.ts` em um projeto Next.js.

## O que está incluído

- `vitest.config.ts`: configuração do Vitest com ambiente `jsdom`.
- `vitest.setup.ts`: setup mínimo.
- `tests/pagination.helpers.ts`: helpers para montar fixtures DOM previsíveis.
- `tests/pagination.layout.test.ts`: testes focados em regras editoriais e regressões reais.
- `tests/pagination.invariants.test.ts`: testes de invariantes do layout.
- `tests/usePagination.smoke.test.tsx`: smoke test opcional do hook `usePagination`.
- `package-snippets.md`: trechos de `package.json` para instalar e executar.

## Limitação importante

Eu não tenho o repositório inteiro. Então este pacote foi feito para ser **integrado e ajustado no projeto real**.

Os pontos mais prováveis de ajuste são:

1. Caminho dos imports:
   - `@/lib/pagination`
   - `@/hooks/usePagination`

2. Estrutura DOM esperada pelo paginador.

3. Se o projeto usa Vitest ou Jest.

## Objetivo dos testes

Cobrir especificamente os problemas mais críticos já observados:

1. Questão que **não cabe na primeira página**, mas **cabe na segunda**.
2. Questão que **não cabe nem em página limpa**, logo deve **fragmentar**.
3. Layout nunca deve ultrapassar a capacidade da página.
4. Ordem das questões deve ser preservada no modo linear.
5. Layout em 2 colunas.
6. Fallback silencioso da fragmentação.
7. Regressões quando `firstPageCapacity !== otherPageCapacity`.

## Como integrar

1. Copie os arquivos para o projeto.
2. Ajuste os imports nos testes, se necessário.
3. Instale Vitest + jsdom + testing-library.
4. Rode os testes.

## Observação

Alguns testes usam fixtures DOM artificiais. Isso é intencional: paginação baseada em DOM precisa de medições controladas para que o teste seja determinístico.
