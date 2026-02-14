# CLAUDE.md — PMEditor: Editor de Questoes & Montador de Provas

## Idioma

**SEMPRE se comunicar em portugues (pt-BR).** Nunca responder em ingles — nem parcialmente. Isso inclui:
- Explicacoes e comentarios
- Perguntas de confirmacao ("posso prosseguir?", "quer que eu faca X?")
- Mensagens de erro ou aviso
- Resumos de mudancas

O usuario nem sempre le tudo com atencao e pode acabar concordando com algo que nao entendeu se estiver em ingles.

## Gerenciador de pacotes

Usar **pnpm** (nao npm nem npx).

## Stack

- **Framework:** Next.js 16.1.4 (App Router, `"use client"` components, React 19)
- **Linguagem:** TypeScript strict
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix UI)
- **Editor:** ProseMirror (schema custom, NAO usa TipTap)
- **Math:** KaTeX 0.16 (renderizacao LaTeX)
- **Icones:** lucide-react
- **Drag & Drop:** @dnd-kit (reordenacao de questoes)
- **API:** PHP backend em `mpfaraujo.com.br/guardafiguras/api/`
- **Upload de imagens:** API propria (`upload.php`)
- **Deploy:** Vercel

## Estrutura de Pastas

```
src/
├── app/
│   ├── editor/
│   │   ├── questoes/                      # Lista/selecao de questoes
│   │   │   └── filtro/                    # Filtragem avancada
│   │   ├── prova/
│   │   │   ├── selecionar-layout/page.tsx # Config da prova (layout, dados, logo)
│   │   │   ├── montar/page.tsx            # Renderizacao/montagem da prova
│   │   │   │   └── prova.css              # CSS especifico da prova
│   │   │   └── print/page.tsx             # Visualizacao de impressao
│   │   └── teste/                         # Pagina de dev/testes
│   ├── template/page.tsx                  # Modelo copiavel de informacoes da questao
│   ├── headers/                           # Preview dos cabecalhos
│   ├── prosemirror.css                    # CSS global do editor ProseMirror
│   └── globals.css                        # CSS global da aplicacao
│
├── components/
│   ├── editor/
│   │   ├── schema.ts                      # Schema ProseMirror COMPLETO
│   │   ├── miniSchema.ts                  # Schema REDUZIDO (para mini-editor)
│   │   ├── QuestionEditor.tsx             # Editor principal (ProseMirror + metadata)
│   │   ├── EditorToolbar.tsx              # Toolbar do editor
│   │   ├── QuestionMetaBar.tsx            # Tipos + barra de metadata
│   │   ├── QuestionMetadataModal.tsx      # Modal completo de metadata
│   │   ├── RichTextMiniEditor.tsx         # Mini-editor rich text (respostas discursivas)
│   │   ├── MathInsert.tsx                 # Dialog de insercao/edicao LaTeX
│   │   ├── MathToolbar.tsx                # Toolbar com simbolos matematicos
│   │   ├── mathPalette.ts                 # Paleta de simbolos math
│   │   ├── ImageUpload.tsx                # Upload de imagens (dialog)
│   │   ├── ensureImageIds.ts              # Garante IDs unicos em imagens
│   │   ├── placeholder-plugin.ts          # Placeholder text no editor vazio
│   │   ├── plugins.ts                     # Agregador de plugins
│   │   ├── plugins/
│   │   │   └── smartPastePlugin.ts        # Paste inteligente (LaTeX, Word, PDF)
│   │   └── toolbar/
│   │       ├── DesktopSidebar.tsx          # Toolbar vertical (desktop)
│   │       ├── HorizontalToolbar.tsx       # Toolbar horizontal (mobile)
│   │       ├── SymbolPicker.tsx            # Seletor de simbolos
│   │       └── toolbar-config.ts           # Config dos botoes da toolbar
│   │
│   ├── prova/
│   │   ├── layouts/
│   │   │   ├── ProvaLayout.tsx            # Layout tipo "prova"
│   │   │   └── ExerciseLayout.tsx         # Layout tipo "lista de exercicio"
│   │   ├── headers/
│   │   │   ├── ProvaHeader.tsx            # Cabecalho padrao (layout 0)
│   │   │   ├── ProvaHeaderLayout1..10.tsx # 10 variantes de cabecalho
│   │   │   └── ExerciseHeader.tsx         # Cabecalho de lista de exercicios
│   │   ├── PaginatedA4.tsx                # Container wrapper A4
│   │   ├── Gabarito.tsx                   # Gabarito de objetivas (MCQ/TF)
│   │   ├── GabaritoDiscursivo.tsx         # Gabarito de discursivas (essay)
│   │   ├── QuestaoHeaderSvg.tsx           # Decorador SVG da questao (5 variantes)
│   │   └── ReorderModal.tsx               # Modal de reordenacao drag-and-drop
│   │
│   ├── Questions/
│   │   ├── QuestionRendererBase.tsx        # Renderizador base (compartilhado)
│   │   ├── QuestionRendererProva.tsx       # Renderizador modo prova
│   │   ├── QuestionRenderer.tsx            # Renderizador generico
│   │   ├── QuestionCard.tsx                # Card de questao na lista
│   │   ├── QuestionEditorModal.tsx         # Modal wrapper do editor
│   │   ├── QuestionsFilter.tsx             # Filtros desktop
│   │   └── QuestionsFilterMobile.tsx       # Filtros mobile
│   │
│   ├── ui/                                # ~20 componentes shadcn/ui
│   └── dashboard/                         # Componentes do dashboard
│
├── contexts/
│   └── ProvaContext.tsx                   # Estado global da prova
│
├── hooks/
│   └── usePagination.ts                  # Hook de paginacao/bin-packing
│
├── lib/
│   ├── pagination.ts                     # Algoritmo de paginacao (core)
│   ├── questions.ts                      # API calls (CRUD questoes)
│   ├── questionRules.ts                  # Regras de validacao
│   ├── yamlMeta.ts                      # Parser de modelo de informacoes + gerador de template
│   └── utils.ts                          # Utilitarios (cn, etc.)
│
└── types/
    ├── layout.ts                         # QuestionData, PageLayout, LayoutProps
    ├── css.d.ts                          # Tipos CSS modules
    └── pagedjs.d.ts                      # Tipos PagedJS
```

## Schema ProseMirror (schema.ts)

Dois modos de documento:

### Questao individual
```
doc > question > statement + options?
                  └── block+       └── option(letter: A-E)+
                                         └── block+
```

### Conjunto (set_questions)
```
doc > set_questions > base_text + question_item(answerKey)+
                       └── block+   └── statement + options?
```

### Todos os nodes
| Node | Attrs | Descricao |
|------|-------|-----------|
| `doc` | — | Raiz |
| `question` | `tipo` | Questao individual |
| `set_questions` | `mode` | Conjunto com texto base |
| `question_item` | `answerKey` | Item do conjunto |
| `base_text` | — | Texto base compartilhado |
| `statement` | — | Enunciado |
| `options` | — | Container de alternativas (2-5) |
| `option` | `letter: A-E` | Uma alternativa |
| `paragraph` | `textAlign` | Paragrafo |
| `text` | — | Texto inline |
| `math_inline` | `latex` | Formula LaTeX inline |
| `math_block` | `latex` | Formula LaTeX bloco |
| `image` | `id, src, width, align` | Imagem |
| `bullet_list` | — | Lista nao-ordenada |
| `ordered_list` | `order` | Lista numerada |
| `roman_list` | — | Lista em romanos |
| `alpha_list` | — | Lista alfabetica |
| `assertive_list` | — | Lista assertiva |
| `list_item` | — | Item de lista |
| `code_block` | — | Bloco de codigo |
| `table` | — | Tabela |
| `table_row` | — | Linha de tabela |
| `table_cell` | — | Celula de tabela |

### Marks
`strong`, `em`, `underline`, `subscript`, `superscript`

## Mini Schema (miniSchema.ts)

Schema reduzido para o `RichTextMiniEditor` (respostas discursivas):

- **Inclui:** `doc(block+)`, `paragraph`, `text`, `math_inline`, `math_block`, `image`, `bullet_list`, `ordered_list`, `list_item`, todos os marks
- **Exclui:** `question`, `statement`, `options`, `option`, `set_questions`, `question_item`, `base_text`, `code_block`, `table*`

## Metadata (QuestionMetadataV1)

```ts
interface QuestionMetadataV1 {
  schemaVersion: 1;
  id: string;                 // UUID
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
  author?: { id?: string; name?: string };

  tipo?: "Multipla Escolha" | "Certo/Errado" | "Discursiva";
  dificuldade?: "Facil" | "Media" | "Dificil";
  disciplina?: string;
  assunto?: string;
  tags?: string[];

  gabarito: AnswerKey;

  source?: {
    kind?: "original" | "concurso";
    concurso?: string;      // Ex: "ENEM"
    banca?: string;         // Ex: "INEP"
    ano?: number;           // Ex: 2024
    cargo?: string;         // Ex: "Tipo 1", "CINZA"
    prova?: string;
    numero?: string;        // Ex: "42"
  };
}

type AnswerKey =
  | { kind: "mcq"; correct: "A"|"B"|"C"|"D"|"E" }
  | { kind: "tf"; correct: "C"|"E" }         // Certo/Errado
  | { kind: "essay"; rubric?: any }           // rubric = ProseMirror JSON doc (miniSchema)
  | null;
```

**IMPORTANTE:** Para `set_questions`, o gabarito de cada item fica em `question_item.attrs.answerKey`, NAO no metadata raiz. O metadata raiz guarda o tipo geral.

## ProvaConfig (ProvaContext)

```ts
type ProvaConfig = {
  layoutType: "prova" | "exercicio";
  columns: 1 | 2;
  logoUrl: string | null;
  logoPlaceholder: string;

  showGabarito: boolean;

  // Campos do cabecalho
  nome: string;
  turma: string;
  professor: string;
  disciplina: string;
  data: string;
  nota: string;
  instituicao: string;

  // Variantes visuais
  headerLayout: 0..10;           // 11 modelos de cabecalho
  questionHeaderVariant: 0..4;   // 5 decoradores SVG da questao

  allowPageBreak: boolean;       // Permite fragmentar questoes longas entre paginas
};
```

## Selection (ProvaContext)

```ts
type Selection =
  | { kind: "question"; id: string }
  | { kind: "set"; id: string; itemIndexes: number[] };  // minimo 2 itens
```

O contexto mantem `selections[]` e `selectedQuestions[]`. Para `set_questions`, o usuario pode escolher quais `question_item` incluir (minimo 2).

## Paginacao (lib/pagination.ts)

```ts
type LayoutItem =
  | { kind: "full"; q: number }
  | { kind: "frag"; q: number; from: number; to: number; first: boolean };

interface PaginationConfig {
  pageHeight: number;
  safetyMargin: number;
  columns: 1 | 2;
  allowPageBreak?: boolean;     // Fragmentar questoes longas
  optimizeLayout?: boolean;     // Bin-packing vs linear
  setBaseIndexes?: number[];    // Indices de textos base (set_questions)
}
```

- **allowPageBreak=false:** Questao atomica (nunca fragmenta)
- **allowPageBreak=true:** Questoes longas podem ser divididas por blocos DOM (`from`/`to` = nth-child 1-based)
- **optimizeLayout=true:** Bin-packing (First Fit Decreasing)
- **optimizeLayout=false:** Distribuicao linear sequencial

**CRITICO:** Tanto `ProvaLayout` quanto `ExerciseLayout` devem usar `renderLayoutItem()` que trata os 3 tipos: `number`, `kind:"full"`, `kind:"frag"`. O ExerciseLayout foi atualizado para isso (commit `d6a427a`).

## Layouts

### ProvaLayout
- Cabecalho completo (11 variantes: ProvaHeader, ProvaHeaderLayout1..10)
- Suporta 1 ou 2 colunas
- Camada invisivel para medicao (3 templates: com header, sem header, medicao de alturas)
- `renderLayoutItem()` trata full/frag/number

### ExerciseLayout
- Cabecalho simplificado (ExerciseHeader)
- Mesma logica de renderizacao que ProvaLayout
- `renderLayoutItem()` identico ao ProvaLayout

### Gabarito
- **Gabarito.tsx:** Grade de respostas objetivas (MCQ/TF) — bolha por questao
- **GabaritoDiscursivo.tsx:** Respostas-modelo de discursivas — usa `QuestionRendererBase` com wrapper `question > statement` para renderizar docs do miniSchema

## RichTextMiniEditor

Mini-editor ProseMirror para respostas de questoes discursivas:

- **Schema:** `miniSchema` (reduzido)
- **Props:** `{ value?: any; onChange: (doc: any) => void }`
- **Toolbar:** Bold, Italic, Underline, Super/Subscript, Math, Imagem, Listas, Undo/Redo
- **NodeViews:** `MathInlineView` (renderiza KaTeX)
- **Dialogs:** Reutiliza `MathInsert` e `ImageUpload` existentes
- **Altura:** min-h 40px, max-h 70px (compacto)
- **CSS:** Overrides com `!important` para nao herdar estilos A4 do `.ProseMirror` global

Usado em:
- `QuestionMetadataModal` — questao discursiva simples (1 editor)
- `QuestionMetadataModal` — set_questions discursivo (N editores, 1 por item)

## SmartPaste Plugin

Aceita colagem de 3 fontes:

### LaTeX
- `\question`, `\choice`, `\correctchoice`
- `\begin{choices}`, `\begin{oneparchoices}`
- Math: `$...$`, `$$...$$`, `\[...\]`, `\(...\)`
- Formatacao: `\textbf{}`, `\textit{}`, `\emph{}`, `\underline{}`
- Listas: `\begin{enumerate}`, `\begin{itemize}`
- Imagens: `\includegraphics{...}` → placeholder
- Tabelas: `\begin{tabular}` → placeholder

### Word/PDF
- Detecta numeracao: "Questao 1:", "Q. 1:", "1)", etc.
- Opcoes classicas: "A)", "A.", "A-", "A:"
- Opcoes ENEM: letra sozinha numa linha
- Opcoes inline: "A) texto B) texto C) texto"
- Limpeza de HTML Word (MSO tags, estilos)
- Normalizacao PDF: dehifenizacao, merge de linhas

### Imagens
- Auto-upload de clipboard para API (`upload.php`)
- Captura `data:image/*` de HTML colado
- Largura: min(naturalWidth, maxWidthCm) — padrao max 8cm

## Modelo de Informacoes (yamlMeta.ts)

Fluxo para pre-preencher metadados da questao:

1. `/template` — pagina com modelo copiavel (botao "Copiar modelo")
2. `/editor` — tela previa com textarea para colar o modelo preenchido
   - "Copiar modelo" — copia o template para a area de transferencia
   - Preview em tempo real dos campos reconhecidos
   - "Continuar" — abre editor com metadados ja preenchidos
   - "Pular" — abre editor vazio (como antes)
   - Botao "Novo" no editor volta para essa tela

### Formato do modelo
```
---
tipo: Multipla Escolha
dificuldade: Media
disciplina: "Matematica"
assunto: "Algebra Linear"
gabarito: A
tags: [ENEM, 2024]
fonte: concurso
concurso: "ENEM"
banca: "INEP"
ano: 2024
numero: "42"
---
```

### Parser (parseYamlMeta)
- Extrai bloco entre `---` delimitadores
- Parseia `key: value` linha a linha (sem lib externa)
- Retorna `Partial<QuestionMetadataV1>` ou `null`
- Merge com `defaultMetadata()` no QuestionEditor (garante id, datas, schemaVersion)
- Sincroniza gabarito com tipo automaticamente

## API (lib/questions.ts)

```
Base: https://mpfaraujo.com.br/guardafiguras/api/questoes/
Auth: Header X-Questions-Token

POST /create.php     — Cria questao (409 → tenta propose)
POST /propose.php    — Propoe alteracao em questao existente
GET  /get.php?id=    — Busca questao por ID
GET  /list.php?...   — Lista questoes com filtros
```

**Upload de imagens:**
```
POST https://mpfaraujo.com.br/guardafiguras/api/upload.php
```

## CSS Importantes

### prova.css
- Estilos da pagina A4 (`.prova-page`, `.questoes-container`, `.coluna`)
- Alinhamento de opcoes: `flex-start` por padrao, `center` quando tem math/imagem (`:has(.math-inline, .katex, img)`)
- Media print: quebras de pagina, reset de margens
- `.measure-layer`: camada invisivel para medicao de alturas

### prosemirror.css
- `.ProseMirror`: estilos do editor (largura A4 210mm, padding 2.54cm)
- `.option::before`: renderiza "(A)", "(B)", etc.
- `.math-inline`: estilo de formulas inline

## Convencoes

- Componentes: PascalCase, um por arquivo
- Hooks custom: prefixo `use`, em `/hooks`
- Contextos: em `/contexts`, com Provider + hook `useXxx()`
- CSS de impressao: classes `print:hidden`, `print:bg-white`
- Unidades na prova: `cm` para grids, `pt` para fontes
- `as any` usado em pontos de tipagem parcial — aceitar temporariamente
- Comunicacao SEMPRE em portugues

## Gotchas / Armadilhas

1. **CSS do ProseMirror global:** O `.ProseMirror` tem width 210mm e min-height 297mm (A4). Qualquer editor ProseMirror novo (como o RichTextMiniEditor) PRECISA de overrides `!important` para nao herdar esses estilos.

2. **LayoutItem vs number:** Os layouts (`ProvaLayout`, `ExerciseLayout`) recebem `LayoutItem[]` do pagination, nao `number[]`. Sempre usar `renderLayoutItem()` que trata `full`, `frag` e `number`.

3. **answerKey de set_questions:** O gabarito de cada item fica em `question_item.attrs.answerKey`, NAO no `metadata.gabarito` raiz. O metadata raiz so indica o tipo.

4. **extractItemRubrics:** Funcao em `montar/page.tsx` que extrai rubrics dos question_items. Precisa de try/catch porque o conteudo pode vir como string ou objeto.

5. **Coluna-2 fantasma na medicao:** No template 3 (medicao de alturas), PRECISA existir `.coluna-2` no DOM mesmo vazia quando `columns=2`, para o CSS `:has(.coluna-2)` funcionar e medir a coluna-1 com largura correta (8.5cm).

6. **suppressRef no RichTextMiniEditor:** O editor usa `suppressRef` para evitar loops infinitos entre `onChange` → `useEffect[value]` → `updateState` → `dispatchTransaction` → `onChange`.

7. **author no create.php:** O campo `author` e um objeto `{id, name}`. O PHP precisa fazer `json_encode()` antes de salvar no VARCHAR, senao vira "Array". Ja corrigido no `create.php`.

## TODO / Em progresso

- [ ] Marcador `(gabarito)` no smartPaste (LaTeX e Word)
- [x] Modelo de informacoes (frontmatter) para pre-preencher metadados da questao
- [ ] Manter texto base + itens do set_questions juntos na paginacao (tentativa anterior revertida — precisa de abordagem nova)
