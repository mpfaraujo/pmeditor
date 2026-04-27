# tex-lista — Importar lista de questões para o banco do pmeditor

## O que este comando faz

Executa o pipeline completo de importação de uma lista de questões:
1. Lê o `.txt` fornecido
2. Gera o `.tex` correspondente
3. Roda o checker e corrige erros
4. Roda `parse-tex.ts`
5. Roda `bulk-import.ts`
6. Reporta o resultado

## Como usar

```
/tex-lista <caminho do .txt>
```

Exemplo:
```
/tex-lista scripts/trabalho/saida/Humanas 2026-04-25.txt
```

---

## Contexto obrigatório — ler antes de gerar o .tex

Ler o arquivo de regras completo:
```
c:/Projetos/pmeditor/scripts/listas/PROMPT_IMPORTACAO.md
```

---

## Fluxo obrigatório (não pular etapas, não inventar)

### Etapa 1 — Gerar o .tex

- Ler o `.txt` inteiro
- Determinar disciplina e tema a partir do conteúdo
- Salvar em: `scripts/listas/<disciplina>/<tema>_<N>_questoes_<AAAA-MM-DD>.tex`
  - `<disciplina>`: minúsculas com underscore (ex: `sociologia`, `matematica`, `biologia`)
  - `<tema>`: slug do tema em minúsculas com underscore (ex: `movimentos_sociais`)
  - `<N>`: número de questões
  - `<AAAA-MM-DD>`: data de hoje

### Etapa 2 — Rodar o checker

```
pnpm tsx scripts/check-tex-import.ts scripts/listas/<disciplina>/<arquivo>.tex
```

- Corrigir todos os `[error]`
- `[warning]` de travessão em texto: manter — são travessões de texto corretos em português
- `[warning]` de `includegraphics-url`: manter — bulk-import faz o upload automaticamente
- Rodar de novo após corrigir. Só avançar quando não houver `[error]`

### Etapa 3 — Parse

```
pnpm tsx scripts/parse-tex.ts scripts/listas/<disciplina>/<arquivo>.tex --batch "<Label do lote>"
```

O label do lote deve ser descritivo: `"<Tema> <AAAA-MM-DD>"` (ex: `"Movimentos Sociais 2026-04-25"`)

### Etapa 4 — Import

**Se o `.tex` tem `\includegraphics{https://...}` (URL completa):**
```
pnpm tsx scripts/bulk-import.ts --batch "<Label do lote>" --disciplina "<Disciplina>" --concurso <CONCURSO> --banca <BANCA>
```
Não passar `--html-url-b64` — o script baixa as imagens das URLs do `.tex` e sobe para o guardafiguras automaticamente.

**Se o `.tex` tem `\includegraphics{figura-qN}` (placeholder sem URL):**
```
pnpm tsx scripts/bulk-import.ts --batch "<Label do lote>" --disciplina "<Disciplina>" --concurso <CONCURSO> --banca <BANCA> --html-url-b64 <URL_DA_PAGINA_EM_BASE64>
```

**Se não tem imagem:**
```
pnpm tsx scripts/bulk-import.ts --batch "<Label do lote>" --disciplina "<Disciplina>" --concurso <CONCURSO> --banca <BANCA>
```

---

## Regras de geração do .tex (resumo)

- Cada questão = bloco `\question` com YAML entre `---` antes do corpo
- Alternativas MCQ: `\begin{choices}` ... `\end{choices}` com `\CorrectChoice` na correta
- Alternativas curtas (1–3 palavras): `\begin{oneparchoices}`
- Poema: `\begin{poem}` com `\verse{}` por linha; adicionar `titulo_texto:` e `autor_texto:` no YAML
- Imagens: `\includegraphics{URL_COMPLETA}` — copiar URL exatamente do .txt, sem alterar
- Atribuições de fonte: `\credits{...}` após o trecho citado
- `\CorrectChoice` com C maiúsculo (nunca `\correctchoice`)
- Travessão: `—` (U+2014) direto — nunca `---`
- Acentos: UTF-8 direto — nunca `\'{a}`, `\~{a}`
- `\begin{tabular}` proibido — tabela sempre como `\includegraphics`
- Questões com texto base compartilhado: cada uma é `\question` individual (nunca `\setquestion` para MCQ), repetir o texto em cada questão + `titulo_texto:` / `autor_texto:` no YAML

---

## Campos YAML obrigatórios

```yaml
tipo: Múltipla Escolha        # ou: Certo/Errado | Discursiva
dificuldade: Média            # Fácil | Média | Difícil
disciplina: Sociologia        # nome canônico exato
assunto: Movimentos Sociais   # subárea específica
gabarito: C                   # A–E para MCQ; C ou E para Certo/Errado; omitir em Discursiva
tags: [tag1, tag2, tag3]      # 3–5 palavras-chave; não repetir disciplina/assunto/ano/concurso
fonte: concurso
concurso: ENEM                # maiúsculas: ENEM | ENEM-PPL | ENEM-DIGITAL | FUVEST | etc.
banca: INEP                   # maiúsculas
ano: 2020                     # inteiro sem aspas
numero: "1"                   # string entre aspas
```

---

## O que reportar no final

```
Arquivo: scripts/listas/<disciplina>/<arquivo>.tex
Checker: 0 erro(s), N aviso(s)
Import: X questões importadas, Y duplicatas, Z imagens materializadas
Run ID: <run_id>
IMG_PENDENTE: sim/não
```

---

## O que nunca fazer

- Não pular o checker
- Não confirmar "importado" sem ver o resultado real do bulk-import
- Não usar `\begin{tabular}`
- Não usar `\setquestion` para MCQ de vestibular
- Não inventar flags de comando — verificar no código antes de rodar
- Não gerar a próxima lista antes de confirmar que esta foi importada
