# Plano — flags externas de revisão no `/admin/fixes`

## Objetivo

Levar os sinais produzidos pelo relatório da transcrição até o lote exibido em
`/admin/fixes`, permitindo localizar e filtrar questões que exigem atenção
especial após a importação.

Os sinais são operacionais e permanecem no relatório do `import_run_id`. Eles
não entram no `.tex`, na fila de importação, nos metadados das questões, nas
tags pedagógicas nem no banco de questões.

## Compatibilidade obrigatória

Sem a nova flag, estes comandos devem continuar tendo exatamente o comportamento
atual:

```powershell
pnpm tsx scripts/parse-tex.ts prova.tex --batch "Meu lote"
pnpm tsx scripts/bulk-import.ts --batch "Meu lote"
```

Em particular, a implementação não pode:

- alterar o schema atual dos payloads enviados a `questoes/create.php`;
- adicionar tags ou campos de auditoria a `metadata_json`;
- alterar a detecção atual de duplicatas;
- mudar os filtros, warnings ou ordenação padrão do `/admin/fixes`;
- alterar o comportamento de `--dry-run`, `--so-imagens`, `--sem-imagens`,
  `--queue`, `--batch`, `--run-id` ou `--propose-duplicates`;
- exigir relatório de transcrição para importações antigas ou manuais;
- alterar `parse-tex.ts` na primeira versão;
- executar parse ou importação automaticamente.

Toda funcionalidade nova é opt-in e deve poder ser removida sem afetar a
importação normal.

## Infraestrutura existente a preservar

- `parse-tex.ts --batch` gera fila persistente e manifest com `run_id`.
- `bulk-import.ts --run-id` grava `import_run_id` nas questões importadas.
- `/admin/fixes` seleciona lotes por `import_batch + import_run_id`.
- `import-reports.php` armazena arquivos JSON externos ao banco de questões.
- `/admin/fixes` já consulta `import-reports.php?run_id=<id>` para duplicatas.
- Os filtros atuais — busca, disciplina, tipo, severidade e revisada — continuam
  funcionando sem modificação semântica.

O tipo `ImportReport` e estruturas para duplicatas/erros já aparecem em
`bulk-import.ts`, mas o fluxo atual deve ser auditado antes de reutilizá-los:
não se deve assumir que todos são preenchidos e enviados hoje.

## Interface proposta

### Relatório estruturado da transcrição

Adicionar uma saída JSON opcional ao relatório existente, sem mudar sua saída
Markdown padrão:

```powershell
pnpm tsx transcricao/cli/report.ts <hash> `
  --review-json transcricao/runs/<hash>/relatorio-revisao.json
```

O arquivo terá schema versionado:

```json
{
  "schemaVersion": 1,
  "transcriptionRun": "4d5e564bcc09d42a",
  "generatedAt": "2026-08-10T12:00:00.000Z",
  "questions": [
    {
      "numero": "136",
      "pagina": 16,
      "severity": "attention",
      "flags": [
        "visual_reconstruction",
        "visual_formula"
      ],
      "details": [
        "Reconstrução visual completa",
        "Conferir sinais e subscritos"
      ]
    }
  ]
}
```

O JSON é derivado de `run.json` e dos artefatos do run. Ele não analisa nem
modifica questões já importadas.

### Nova flag do bulk-import

Adicionar somente esta flag funcional:

```powershell
pnpm tsx scripts/bulk-import.ts --batch "Meu lote" `
  --run-id "<uuid>" `
  --review-report "transcricao/runs/<hash>/relatorio-revisao.json"
```

Regras:

- `--review-report` é opcional;
- caminho inexistente, JSON inválido ou schema desconhecido interrompe a
  importação antes de qualquer POST;
- o arquivo é lido e validado integralmente no preflight;
- a flag não altera o payload da questão;
- o `run_id` efetivamente usado é impresso no início e no fim do comando;
- `--dry-run --review-report` valida o casamento das flags, mas não envia
  relatório ao servidor;
- não criar uma segunda flag para cada categoria; categorias vivem no JSON.

`--run-id` e `--batch` continuam sendo flags existentes, mas passam a ser
explicitamente recomendadas no comando exibido pelo pipeline para manter o
pareamento entre lote, questões e relatório. Não mudar sua semântica.

## Categorias iniciais

Usar uma enumeração fechada na v1:

- `visual_reconstruction` — questão reconstruída por visão;
- `visual_formula` — contém matemática reconstruída visualmente;
- `visual_image` — contém figura ou alternativa gráfica que merece conferência;
- `ocr_missing_content` — rejeição normal indicou conteúdo ausente;
- `ocr_boundary` — rejeição normal indicou contaminação ou fronteira;
- `visual_failed` — não houve versão visual importável.

`visual_failed` normalmente não chegará ao banco porque bloqueia `finalize`; a
categoria existe para o relatório completo e para detectar inconsistência. O
bulk deve recusar um relatório que tente associá-la a uma entrada importável,
em vez de ocultar o problema.

Não transportar o texto bruto completo dos gates. `details` deve conter apenas
orientações curtas e legíveis para auditoria.

## Associação segura entre relatório e fila

Na v1, associar pelo número canônico já presente no YAML/metadata da entrada.

Antes de importar, construir um índice das entradas da fila e verificar cada
hint:

1. exatamente uma entrada compatível: associação válida;
2. nenhuma entrada: erro de preflight;
3. duas ou mais entradas com o mesmo número: erro de preflight;
4. set ou estrutura sem número individual inequívoco: erro de preflight.

Não escolher “a primeira” e não associar por posição silenciosamente. Se o
corpus futuro exigir sets, criar uma chave estável específica em uma segunda
versão do schema; não ampliar a heurística durante a implementação da v1.

O preflight deve mostrar:

```text
Review report: 9 hints, 9 associados, 0 ambíguos, 0 ausentes
```

## Relatório externo do import_run

Quando `--review-report` estiver presente, completar o relatório externo do
bulk com uma seção aditiva:

```json
{
  "runId": "...",
  "batch": "Meu lote",
  "reviewHints": [
    {
      "questionId": "uuid-criado-no-banco",
      "numero": "136",
      "severity": "attention",
      "flags": ["visual_reconstruction", "visual_formula"],
      "details": ["Conferir sinais e subscritos"]
    }
  ],
  "unresolvedReviewHints": []
}
```

- `questionId` só é preenchido depois de uma criação bem-sucedida;
- duplicata não importada mantém o hint junto do item correspondente em
  `duplicates`, sem apontar para a questão antiga como se ela tivesse sido
  reconstruída visualmente;
- erro de importação mantém o hint junto do erro;
- hints não podem ser perdidos silenciosamente;
- o POST para `import-reports.php` ocorre somente no fluxo opt-in;
- falha ao salvar o relatório deve produzir erro explícito ao final, sem
  afirmar que a auditoria foi registrada;
- não desfazer questões já criadas se apenas o armazenamento do relatório
  falhar; imprimir o `run_id` e oferecer comando seguro para reenviar apenas o
  relatório.

Antes de implementar, testar se o POST atual substitui ou mescla relatórios. A
primeira versão deve enviar um documento completo e preservar `duplicates`,
`errors` e `summary`; nunca sobrescrever um relatório existente com apenas
`reviewHints`.

## Alterações no `/admin/fixes`

Ao carregar um run, ler `reviewHints` do mesmo relatório já consultado para
duplicatas e criar um mapa local por `questionId`.

Adicionar, sem mudar os warnings atuais:

- badges de revisão externa nos cards;
- filtro “Sinal da transcrição” com:
  - Todos;
  - Reconstrução visual;
  - Fórmula visual;
  - Figura/alternativa gráfica;
  - Conteúdo ausente no OCR;
  - Fronteira/segmentação;
- opção “Com qualquer sinal de transcrição”;
- detalhes curtos dentro do card expandido.

Comportamento padrão:

- filtro começa em “Todos”;
- nenhum card é ocultado por causa das flags;
- a severidade existente continua derivada dos warnings existentes;
- a severidade externa aparece separadamente e só participa do filtro de
  severidade se isso for ativado explicitamente numa evolução posterior;
- marcar uma questão como revisada continua usando o mecanismo atual;
- nenhuma ação da UI grava as flags nos metadados da questão.

Também exibir os hints nas abas de duplicatas e erros quando eles pertencerem a
uma entrada que não foi criada no banco.

## Sequência de implementação

1. Escrever testes que congelem o comportamento atual do bulk sem a nova flag.
2. Escrever testes do schema e da geração opcional de
   `relatorio-revisao.json`.
3. Implementar `report.ts --review-json`, mantendo stdout Markdown idêntico.
4. Escrever testes de preflight de `--review-report`.
5. Implementar leitura, validação e associação única por número no bulk.
6. Auditar e completar a criação do `ImportReport` somente no caminho opt-in.
7. Testar POST e leitura pelo `import-reports.php` com fixture temporária.
8. Adicionar `reviewHints` à leitura da `/admin/fixes`.
9. Adicionar badges e o filtro independente de sinais da transcrição.
10. Rodar dry-run com e sem a nova flag sobre a mesma fila e comparar payloads.
11. Rodar uma importação de teste pequena em ambiente autorizado.
12. Parar antes de qualquer importação real sem autorização explícita.

## Testes obrigatórios

### Regressão do caminho atual

- sem `--review-report`, argumentos, fila, payloads e chamadas externas são os
  mesmos do baseline;
- nenhum POST novo para `import-reports.php` sem a flag;
- `--batch` e `--run-id` mantêm a semântica atual;
- imports com e sem imagens continuam funcionando;
- duplicatas continuam no fluxo atual;
- parse não muda.

### Relatório da transcrição

- Markdown padrão permanece byte a byte igual;
- JSON é gerado somente com `--review-json`;
- visual pronta gera `visual_reconstruction`;
- fórmulas e imagens geram flags específicas;
- questão normal aceita não recebe flag;
- nenhum comentário ou metadado é inserido no `.tex`.

### Bulk-import opt-in

- rejeita arquivo ausente, JSON inválido e schema desconhecido antes de POST;
- rejeita número ausente ou ambíguo;
- associa número único ao ID realmente criado;
- mantém hint de duplicata junto da tentativa, não da questão antiga;
- mantém hint de erro junto do erro;
- `--dry-run` valida sem enviar;
- payload de `create.php` é idêntico com e sem review report;
- falha ao salvar relatório é informada sem apagar questões importadas.

### `/admin/fixes`

- run sem `reviewHints` renderiza exatamente como hoje;
- filtro padrão não esconde questões;
- filtro por cada categoria retorna somente cards associados;
- badges não alteram `reviewed`;
- flags não aparecem nas tags nem nos metadados;
- duplicatas e erros exibem seus próprios hints.

### Verificações finais

- testes focados do bulk, relatório e `/admin/fixes`;
- `pnpm tsc --noEmit` sem erros de produção;
- comparação serializada dos payloads do caminho antigo;
- nenhum teste negativo existente alterado para passar;
- não executar `pnpm test` amplo como substituto dos testes focados e do
  dry-run real.

## Critérios de rollback

Fazer rollback da etapa afetada se ocorrer qualquer um destes casos:

- payload de questão mudar sem `--review-report`;
- flag aparecer em `.tex`, tags ou metadata do banco;
- questão receber hint de outro número;
- relatório de duplicatas ou erros existente for perdido;
- `/admin/fixes` mudar sua lista padrão para runs antigos;
- importação passar a depender da disponibilidade de `import-reports.php` sem
  a nova flag;
- dry-run fizer qualquer escrita remota.

Uma questão do corpus continuar sem flag ou exigir auditoria manual não autoriza
afrouxar a associação por número. Corrigir o schema ou deixar o preflight
falhar é preferível a ligar o aviso à questão errada.

## Resultado esperado

O fluxo antigo permanece intacto. Quando o usuário optar por fornecer
`--review-report`, o mesmo `import_run_id` passa a carregar uma lista externa e
filtrável de pontos de atenção. Ao abrir o lote no `/admin/fixes`, é possível
localizar rapidamente reconstruções visuais, fórmulas, figuras e problemas de
OCR sem poluir o `.tex` ou o banco de questões.

## Resultado da implementação — 2026-08-10

Implementado de forma opt-in:

- `report.ts --review-json <path>` gera o schema estruturado sem alterar o
  Markdown padrão;
- `bulk-import.ts --review-report <path>` valida schema, número único e filtros
  antes da importação;
- hints importados são associados ao ID realmente retornado por `create.php`;
- hints de duplicatas e erros permanecem no relatório externo;
- o relatório é enviado apenas no caminho com `--review-report` e nunca em
  `--dry-run`;
- um `run_id` com relatório existente é recusado antes dos POSTs de criação,
  evitando sobrescrita;
- `/admin/fixes` ganhou badges e filtro independente, mantendo “Todos sinais”
  como padrão;
- a GUI do pipeline gera o JSON após o finalize e passa seu caminho ao bulk;
- payloads das questões, parser, `.tex`, tags e metadados do banco não foram
  alterados.

Durante a validação foi encontrado um comportamento anterior perigoso:
`bulk-import --dry-run` ainda fazia upload de imagens. O dry-run agora usa URLs
simuladas locais ao processo e não faz upload, preservando a mesma contagem e a
mesma validação estrutural.

Verificações concluídas sem importação de questões:

- 19 testes TypeScript focados;
- 30 testes Python da GUI;
- `pnpm tsc --noEmit`;
- `git diff --check`;
- dry-run real da fila de 89 questões, com e sem `--review-report`, ambos com
  89 entradas processadas, 87 imagens simuladas e zero pendências.
