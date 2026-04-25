export type CheckSeverity = "error" | "warning";

export type CheckIssue = {
  ruleId: string;
  severity: CheckSeverity;
  message: string;
  line?: number;
  questionNumber?: string;
  excerpt?: string;
  matched?: string;
};

export type CheckContext = {
  filePath: string;
  text: string;
};

export type TexImportRule = {
  id: string;
  description: string;
  run: (ctx: CheckContext) => CheckIssue[];
};

type QuestionBlock = {
  number?: string;
  yaml: string;
  body: string;
  full: string;
  startLine: number;
};

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function excerpt(line: string): string {
  return line.trim().slice(0, 180);
}

function questionBlocks(text: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];
  const re = /\\question\s*\n---\n([\s\S]*?)\n---\n([\s\S]*?)(?=(?:\n\\question\s*\n---)|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const full = m[0];
    const yaml = m[1];
    const body = m[2];
    const numMatch = yaml.match(/^numero:\s*"?(.*?)"?$/m);
    blocks.push({
      number: numMatch?.[1],
      yaml,
      body,
      full,
      startLine: lineNumberAt(text, m.index),
    });
  }
  return blocks;
}

function issuesForPattern(
  text: string,
  pattern: RegExp,
  base: Omit<CheckIssue, "line" | "excerpt" | "matched">,
): CheckIssue[] {
  const out: CheckIssue[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const line = lineNumberAt(text, m.index);
    const key = `${base.ruleId}|${line}`;
    if (seen.has(key)) {
      if (!pattern.global) break;
      continue;
    }
    seen.add(key);
    const rawLine = text.split("\n")[line - 1] ?? "";
    out.push({ ...base, line, excerpt: excerpt(rawLine), matched: m[0] });
    if (!pattern.global) break;
  }
  return out;
}

// Strips math-mode regions so we don't false-positive on content inside \( \), \[ \], $ $
function stripMathRegions(text: string): string {
  return text
    .replace(/\\\[[\s\S]*?\\\]/g, (m) => " ".repeat(m.length))
    .replace(/\\\([\s\S]*?\\\)/g, (m) => " ".repeat(m.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => " ".repeat(m.length))
    .replace(/\$[^$\n]+\$/g, (m) => " ".repeat(m.length));
}

// Strips comment lines
function stripComments(text: string): string {
  return text.replace(/^%.*$/gm, "");
}

const VISUAL_REFERENCE_RE =
  /\b(figura|gráfico|grafico|esquema|quadro|tabela|infográfico|infografico|tirinha|charge|mapa|diagrama|imagem)\b/i;
const MANUAL_FIGURE_PLACEHOLDER_RE = /\[(Inserir manualmente|Figura pendente:|Inserir)\b/i;

export const TEX_IMPORT_RULES: TexImportRule[] = [
  // ── BLOQUEADORES CRÍTICOS ─────────────────────────────────────────────────

  {
    id: "includegraphics-url",
    description: "\\includegraphics com URL — verificar se é imagem genuína ou fórmula transcritível.",
    run: ({ text }) =>
      issuesForPattern(text, /\\includegraphics(?:\[[^\]]*\])?\{https?:\/\//g, {
        ruleId: "includegraphics-url",
        severity: "warning",
        message: "\\includegraphics com URL (bulk-import faz o upload automaticamente) — verificar se a imagem contém equação química/matemática simples que possa ser transcrita para LaTeX. Se sim, transcrever e remover o \\includegraphics. Tabelas, diagramas e gráficos: manter como URL.",
      }),
  },

  {
    id: "parts-needs-conversion",
    description: "\\begin{parts} sinaliza questão discursiva com subitens — converter para \\setquestion + \\questionitem.",
    run: ({ text }) =>
      issuesForPattern(text, /\\begin\{parts\}/g, {
        ruleId: "parts-needs-conversion",
        severity: "error",
        message: "\\begin{parts} não é suportado pelo parser. Converter para \\setquestion + \\questionitem: cada \\part vira um \\questionitem com YAML inline contendo assunto:, tags:, resposta: — OU usar campos numerados no YAML do \\setquestion (assunto1:, tags1:, resposta1:, assunto2:, tags2:, resposta2:, ...).",
      }),
  },

  {
    id: "unsupported-environment",
    description: "Ambientes LaTeX não suportados pelo parser (além de \\begin{parts}).",
    run: ({ text }) =>
      issuesForPattern(
        text,
        /\\begin\{(subparts|exercises|solution|answer|tabular|subenum)\}/g,
        {
          ruleId: "unsupported-environment",
          severity: "error",
          message: "Ambiente não suportado pelo parser — conteúdo desaparece silenciosamente. Substitua pelo equivalente suportado (ver checklist Z1).",
        },
      ),
  },

  {
    id: "latex-outside-math",
    description: "Notação LaTeX fora de delimitador de equação (^{}, _{}, \\sin, \\cos, \\sqrt, etc.).",
    run: ({ text }) => {
      // Remove YAML blocks antes de checar o corpo
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      // Remove \includegraphics{...} e \ce{...} para não disparar em \in, \int, \ce dentro desses comandos
      const noCommands = noYaml
        .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, (m) => " ".repeat(m.length))
        .replace(/\\ce\{[^}]*\}/g, (m) => " ".repeat(m.length));
      const stripped = stripMathRegions(stripComments(noCommands));
      return issuesForPattern(
        stripped,
        // \b removido dos comandos trig para capturar \sinx, \cosx (sem espaço) fora de math
        /(?<![\\])\^{|(?<![\\])_\{|\\(?:sin|cos|tan|cot|sec|csc|log|ln|exp|lim|sqrt|frac|pi|alpha|beta|gamma|delta|lambda|theta|omega|sigma|mu|phi|psi|epsilon|infty|leq|geq|neq|cdot|times|pm|in\b|mathbb|mathbf|operatorname|sum|prod|int\b|forall|exists)/g,
        {
          ruleId: "latex-outside-math",
          severity: "error",
          message: "LaTeX fora de delimitador de equação (\\( \\) ou \\[ \\]) — não renderiza. CORRIGIR: envolva toda a expressão em \\( ... \\) ou \\[ ... \\]. Ex: '\\\\sqrt{3}' → '\\(\\sqrt{3}\\)', 'A^{-1}' → '\\(A^{-1}\\)'.",
        },
      );
    },
  },

  {
    id: "resposta-latex-without-delimiters",
    description: "LaTeX no campo resposta: do YAML sem delimitador \\( \\) ou $.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const LATEX_CMD = /\\(?:pi|frac|sqrt|mathbb|mathbf|alpha|beta|gamma|delta|lambda|theta|omega|sigma|mu|phi|psi|epsilon|infty|leq|geq|neq|cdot|times|div|pm|mp|in|notin|subset|cup|cap|forall|exists|sum|prod|int|lim|log|ln|exp|sin|cos|tan|cot|operatorname|sen|tg|cotg)\b|\^{|_\{/;

      // Captura blocos de \question E \questionitem
      const blockRe = /\\(?:question|questionitem)\b[^\n]*\n---\n([\s\S]*?)\n---/g;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(text))) {
        const yaml = m[1];
        const inlineMatch = yaml.match(/^resposta:\s+(.+)$/m);
        const multilineMatch = yaml.match(/^resposta:\s*\|\s*\n((?:[ \t]+[^\n]*\n?)*)/m);
        const respostaValue = multilineMatch?.[1] ?? inlineMatch?.[1] ?? "";
        if (!respostaValue.trim()) continue;

        const stripped = stripMathRegions(respostaValue);
        if (LATEX_CMD.test(stripped)) {
          const line = lineNumberAt(text, m.index);
          issues.push({
            ruleId: "resposta-latex-without-delimiters",
            severity: "error",
            line,
            message: "Campo resposta: contém LaTeX sem delimitador \\( \\). Envolver expressões matemáticas em \\( ... \\) ou \\[ ... \\].",
            excerpt: respostaValue.trim().slice(0, 120),
          });
        }
      }
      return issues;
    },
  },

  {
    id: "greek-word-in-text",
    description: "Nome de letra grega em texto puro (theta, pi, alpha, etc.) em vez de LaTeX.",
    run: ({ text }) => {
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      const stripped = stripMathRegions(stripComments(noYaml));
      return issuesForPattern(
        stripped,
        // pi em contexto aritmético (pi/3, = pi, pi +), ou letras gregas por extenso
        /\bpi\s*[/=+\-*)\]^]|\bpi\s*$|\b(theta|alpha|beta|gamma|delta|lambda|sigma|omega|phi|epsilon|rho)\b/gim,
        {
          ruleId: "greek-word-in-text",
          severity: "error",
          message: "Nome de letra grega em texto puro — não renderiza. CORRIGIR: 'theta' → '\\(\\theta\\)', 'pi/3' → '\\(\\pi/3\\)', 'alpha' → '\\(\\alpha\\)', 'beta' → '\\(\\beta\\)', 'delta' → '\\(\\delta\\)'. Toda a expressão matemática deve estar dentro de \\( \\) ou \\[ \\].",
        },
      );
    },
  },

  {
    id: "sqrt-word-in-text",
    description: "Palavra 'raiz' em texto puro em vez de \\sqrt{}.",
    run: ({ text }) => {
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      const stripped = stripMathRegions(stripComments(noYaml));
      return issuesForPattern(
        stripped,
        /\braiz\b/gi,
        {
          ruleId: "sqrt-word-in-text",
          severity: "error",
          message: "Palavra 'raiz' em texto puro — não renderiza. CORRIGIR: '3raiz 3/2' → '\\(\\frac{3\\sqrt{3}}{2}\\)', 'raiz de x' → '\\(\\sqrt{x}\\)', 'raiz quadrada' → '\\(\\sqrt{}\\)'.",
        },
      );
    },
  },

  {
    id: "bare-superscript",
    description: "Expoente escrito com ^ sem chaves e fora de delimitador de equação (y^2, cm^2, 10^3).",
    run: ({ text }) => {
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      // Remove \ce{...} e \includegraphics{...} — dentro desses comandos ^ é sintaxe própria, não LaTeX
      const noCommands = noYaml
        .replace(/\\ce\{[^}]*\}/g, (m) => " ".repeat(m.length))
        .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, (m) => " ".repeat(m.length));
      const stripped = stripMathRegions(stripComments(noCommands));
      return issuesForPattern(
        stripped,
        /[a-zA-Z0-9]\^[a-zA-Z0-9]/g,
        {
          ruleId: "bare-superscript",
          severity: "error",
          message: "Expoente com ^ fora de delimitador de equação — não renderiza. CORRIGIR: 'y^2' → '\\(y^2\\)', 'cm^2' → 'cm\\(^2\\)', '10^3' → '\\(10^3\\)', 'A^{-1}' → '\\(A^{-1}\\)'. Se o expoente já está dentro de \\( \\), ignorar este erro.",
        },
      );
    },
  },

  {
    id: "trig-without-backslash",
    description: "Função trigonométrica escrita como texto puro (cos x, sin x) em vez de LaTeX (\\cos, \\sin) dentro de \\( \\).",
    run: ({ text }) => {
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      const stripped = stripMathRegions(stripComments(noYaml));
      // Exclui palavras portuguesas comuns: tanto(tan), logo(log), tangente(tan),
      // sector(sec), segundo(sec), logística(log), singular(sin), cosseno(cos)
      const PTBR_EXCLUDE = /(?!to\b|gent|gencial|gencia|o\b|ística|ístico|ular|tor\b|und|gular|sseno)/i;

      // Pass 1: word-boundary + requer espaço ou dígito/paren para evitar falsos positivos
      // Captura: 'cos x', 'sin 2x', 'cos(x)', 'log10', 'cos2x'
      const issues1 = issuesForPattern(
        stripped,
        new RegExp(
          `\\b(cos|sin|tan|cot|sec|csc|log|ln)${PTBR_EXCLUDE.source}(?:\\s+[a-zA-Z0-9(°]|[\\d(°])`,
          "gi",
        ),
        {
          ruleId: "trig-without-backslash",
          severity: "error",
          message: "Função matemática em texto puro — não renderiza. CORRIGIR: 'cos x' → '\\(\\cos x\\)', 'sin 2x' → '\\(\\sin 2x\\)', 'log n' → '\\(\\log n\\)', '1/(3-cos x)' → '\\(\\frac{1}{3-\\cos x}\\)'. Toda expressão matemática deve estar dentro de \\( \\) ou \\[ \\].",
        },
      );
      // Pass 2: colado a dígito (2cos2x, 4cos15°)
      const issues2 = issuesForPattern(
        stripped,
        /\d(cos|sin|tan|cot|sec|csc|log|ln)\s*[\d(°]/gi,
        {
          ruleId: "trig-without-backslash",
          severity: "error",
          message: "Função matemática colada a número em texto puro — não renderiza. CORRIGIR: '4cos15°' → '\\(4\\cos 15°\\)', '2sin x' → '\\(2\\sin x\\)'. Toda expressão matemática deve estar dentro de \\( \\) ou \\[ \\].",
        },
      );
      const seen = new Set(issues1.map((i) => i.line));
      return [...issues1, ...issues2.filter((i) => !seen.has(i.line))];
    },
  },

  {
    id: "system-without-cases",
    description: "Sistema de equações escrito com { em texto puro em vez de \\begin{cases}.",
    run: ({ text }) =>
      issuesForPattern(
        text,
        /^\s*\{\\(?:sin|cos|tan|cot|log|ln|frac|sqrt|x|y|z|a|b|c)\b/gm,
        {
          ruleId: "system-without-cases",
          severity: "error",
          message: "Sistema de equações com { em texto puro não renderiza. Usar \\[\\begin{cases} ... \\\\  ... \\end{cases}\\].",
        },
      ),
  },

  {
    id: "em-dash-as-variable",
    description: "Travessão (—) em texto — verificar se é travessão de texto (manter) ou variável matemática (converter para LaTeX).",
    run: ({ text }) => {
      const stripped = stripMathRegions(stripComments(text));
      return issuesForPattern(stripped, /—/g, {
        ruleId: "em-dash-as-variable",
        severity: "warning",
        message: "Travessão (—) fora de math mode. Se for travessão de texto, manter. Se for variável matemática (ex: comprimento λ), substituir por \\(\\lambda\\).",
      });
    },
  },

  {
    id: "unicode-math-symbol",
    description: "Símbolo matemático Unicode usado no lugar de LaTeX (√, ², ³, ∞, ≤, ≥, ≠, ∈, ×, ÷).",
    run: ({ text }) => {
      // Remove blocos math legítimos antes de checar
      const stripped = stripMathRegions(stripComments(text));
      return issuesForPattern(
        stripped,
        /[√²³⁴⁵⁶⁷⁸⁹∞≤≥≠≈∈∉⊂⊆∪∩∀∃∑∏∫×÷]/g,
        {
          ruleId: "unicode-math-symbol",
          severity: "error",
          message: "Símbolo matemático Unicode fora de LaTeX. Converter: √→\\sqrt{}, ²→^2, ³→^3, ∞→\\infty, ≤→\\leq, ≥→\\geq, ≠→\\neq, ∈→\\in, ×→\\times, ÷→\\div — sempre dentro de \\( \\).",
        },
      );
    },
  },

  {
    id: "unicode-latex-duplicate",
    description: "Símbolo Unicode e LaTeX duplicados para o mesmo caractere.",
    run: ({ text }) =>
      issuesForPattern(text, /π\\pi|°\\circ|α\\alpha|β\\beta|θ\\theta|μ\\mu|σ\\sigma|∞\\infty/g, {
        ruleId: "unicode-latex-duplicate",
        severity: "error",
        message: "Símbolo duplicado: Unicode + LaTeX para o mesmo caractere (ex: π\\pi, °\\circ). Use um só.",
      }),
  },

  {
    id: "imagem-abaixo",
    description: "Texto '(imagem abaixo)' importado como parágrafo literal.",
    run: ({ text }) =>
      issuesForPattern(text, /\(imagem\s+abaixo\)/gi, {
        ruleId: "imagem-abaixo",
        severity: "error",
        message: "Texto '(imagem abaixo)' entra como parágrafo literal no banco. Remover.",
      }),
  },

  {
    id: "trig-pt-notation",
    description: "Notação trigonométrica brasileira que KaTeX não reconhece.",
    run: ({ text }) =>
      issuesForPattern(text, /\\(?:sen|tg|cotg|arcsen|arctg)\b|co-\\?s(?:ino|eno|en)\b|co-\\?(?:tang|tg)\b|coss?eno\b/gi, {
        ruleId: "trig-pt-notation",
        severity: "error",
        message: "Notação trig inválida em LaTeX/KaTeX. Converter: \\sen→\\operatorname{sen}, \\tg→\\operatorname{tg}, \\cotg→\\operatorname{cotg}, \\arcsen→\\operatorname{arcsen}, \\arctg→\\operatorname{arctg}, co-sino/cosseno→\\cos, co-tangente→\\operatorname{cotg}. Sempre dentro de \\( \\).",
      }),
  },

  {
    id: "em-dash-literal",
    description: "-- ou --- usados para travessão (viram literal no banco).",
    run: ({ text }) => {
      // Remove linhas que são separadores YAML (exatamente "---") antes de checar
      const stripped = stripComments(text)
        .split("\n")
        .map((l) => (/^---\s*$/.test(l) ? "" : l))
        .join("\n");
      return issuesForPattern(stripped, /--+/g, {
        ruleId: "em-dash-literal",
        severity: "error",
        message: "-- ou --- viram texto literal no banco. Use Unicode: – (en dash) ou — (em dash).",
      });
    },
  },

  {
    id: "dollar-escape",
    description: "\\$ fora de math mode gera \\ literal no banco.",
    run: ({ text }) => {
      const stripped = stripMathRegions(text);
      return issuesForPattern(stripped, /\\\$/g, {
        ruleId: "dollar-escape",
        severity: "error",
        message: "\\$ gera \\ literal no banco. Use $ diretamente no texto.",
      });
    },
  },

  {
    id: "questiongroup",
    description: "\\questiongroup foi removido do pipeline.",
    run: ({ text }) =>
      issuesForPattern(text, /\\questiongroup\b/g, {
        ruleId: "questiongroup",
        severity: "error",
        message: "\\questiongroup foi removido do pipeline — ignorado no import.",
      }),
  },

  {
    id: "banca-lowercase",
    description: "Sigla de banca/concurso em minúsculas.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const WRONG = [
        "Ita", "Fuvest", "Unesp", "Ufpr", "Fei", "Uff", "Fgv", "Uece",
        "Puccamp", "Pucsp", "Pucrio", "Pucrj", "Unirio", "Ufrgs", "Ufrn",
        "Ufscar", "Uel", "Ufpe", "Ufu", "Ufal", "Ufrj", "Ufv", "Ufu",
        "Ufsc", "Ufrj", "Mackenzie", "Fmj", "Ufmg", "Unicamp",
        "Cesgranrio", "Ufrs",
      ];
      for (const banca of WRONG) {
        const re = new RegExp(`(?:^banca:|^concurso:)\\s*${banca}\\s*$`, "gm");
        const found = issuesForPattern(text, re, {
          ruleId: "banca-lowercase",
          severity: "error",
          message: `Sigla "${banca}" em capitalização errada. Deve ser toda maiúscula (ex: ${banca.toUpperCase()}).`,
        });
        issues.push(...found);
      }
      return issues;
    },
  },

  {
    id: "mcq-missing-choices",
    description: "MCQ sem bloco \\begin{choices} ou \\begin{oneparchoices}.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const isMcq = /^tipo:\s*M[úu]ltipla\s+Escolha\s*$/mi.test(block.yaml);
        const hasChoices = /\\begin\{(?:choices|oneparchoices)\}/.test(block.body);
        if (isMcq && !hasChoices) {
          issues.push({
            ruleId: "mcq-missing-choices",
            severity: "error",
            line: block.startLine,
            questionNumber: block.number,
            message: "MCQ sem \\begin{choices}. Questão será importada como discursiva sem alternativas.",
          });
        }
      }
      return issues;
    },
  },

  {
    id: "correctchoice-lowercase",
    description: "\\correctchoice com c minúsculo — gabarito não é registrado.",
    run: ({ text }) =>
      issuesForPattern(text, /\\correctchoice\b/g, {
        ruleId: "correctchoice-lowercase",
        severity: "error",
        message: "\\correctchoice com c minúsculo não registra gabarito. Corrigir para \\CorrectChoice.",
      }),
  },

  {
    id: "roman-items-raw",
    description: "Enumeração romana crua em vez de \\begin{romanitems}.",
    run: ({ text }) =>
      issuesForPattern(text, /^(I{1,3}|IV|V?I{0,3}|IX|X)[.)]\s+\S/gm, {
        ruleId: "roman-items-raw",
        severity: "error",
        message: "Lista romana em texto puro. Use \\begin{romanitems} ... \\item ... \\end{romanitems}.",
      }),
  },

  {
    id: "alpha-items-raw",
    description: "Subitens alfabéticos que deveriam ser \\begin{alphaitems}.",
    run: ({ text }) =>
      issuesForPattern(text, /^[a-e]\)\s+\S/gm, {
        ruleId: "alpha-items-raw",
        severity: "error",
        message: "Subitem alfabético (a), b)...) em texto puro. Correções: (1) lista estrutural → use \\begin{alphaitems} \\item ... \\end{alphaitems}; (2) partes a)/b) de questão discursiva → use \\setquestion + \\questionitem (um por parte, sem o prefixo a)/b) no corpo — o sistema gera os rótulos automaticamente).",
      }),
  },

  {
    id: "assertive-items-raw",
    description: "Lista com ( ) crua em vez de \\begin{assertiveitems}.",
    run: ({ text }) =>
      issuesForPattern(text, /^\(\s*\)\s+\S/gm, {
        ruleId: "assertive-items-raw",
        severity: "error",
        message: "Lista com ( ) crua. Use \\begin{assertiveitems} — o ambiente já renderiza os parênteses.",
      }),
  },

  {
    id: "mcq-setquestion",
    description: "\\setquestion não deve ser usado para MCQ.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const re = /\\setquestion\s*\n---\n([\s\S]*?)\n---\n([\s\S]*?)(?=(?:\n\\setquestion)|(?:\n\\question\s*\n---)|\s*$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const yaml = m[1];
        const body = m[2];
        const tipoMcq = /^tipo:\s*M[úu]ltipla\s+Escolha\s*$/mi.test(yaml);
        const hasChoices = /\\begin\{(?:choices|oneparchoices)\}/.test(body);
        if (tipoMcq || hasChoices) {
          issues.push({
            ruleId: "mcq-setquestion",
            severity: "error",
            line: lineNumberAt(text, m.index),
            message: "MCQ não deve usar \\setquestion. Use \\question individual com texto-base repetido.",
            excerpt: excerpt("\\setquestion"),
          });
        }
      }
      return issues;
    },
  },

  {
    id: "choice-correct-count",
    description: "Verifica número de \\CorrectChoice em cada bloco de alternativas.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const choicesRe = /\\begin\{(choices|oneparchoices)\}([\s\S]*?)\\end\{\1\}/g;
        let m: RegExpExecArray | null;
        while ((m = choicesRe.exec(block.body))) {
          const body = m[2];
          const correctCount =
            (body.match(/\\CorrectChoice\b/g) ?? []).length +
            (body.match(/\\correctchoice\b/g) ?? []).length;
          const isAnnulled = /QUEST[ÃAÕ]O ANULADA/i.test(block.body);
          if (isAnnulled && correctCount === 0) continue;
          if (correctCount !== 1) {
            issues.push({
              ruleId: "choice-correct-count",
              severity: "error",
              line: block.startLine,
              questionNumber: block.number,
              message: `Bloco de alternativas com ${correctCount} \\CorrectChoice (deve ser exatamente 1).`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: "setquestion-missing-required-yaml",
    description: "Campos obrigatórios ausentes no YAML do \\setquestion.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const re = /\\setquestion\s*\n---\n([\s\S]*?)\n---\n([\s\S]*?)(?=(?:\n\\setquestion)|(?:\n\\question\s*\n---)|\s*$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const yaml = m[1];
        const missing: string[] = [];
        if (!/^tipo:\s*.+$/m.test(yaml)) missing.push("tipo:");
        if (!/^dificuldade:\s*.+$/m.test(yaml)) missing.push("dificuldade:");
        if (!/^disciplina:\s*.+$/m.test(yaml)) missing.push("disciplina:");
        if (!/^assunto:\s*.+$/m.test(yaml)) missing.push("assunto:");
        if (!/^tags:\s*.+$/m.test(yaml)) missing.push("tags:");
        const numMatch = yaml.match(/^numero:\s*"?(.*?)"?\s*$/m);
        if (missing.length > 0) {
          issues.push({
            ruleId: "setquestion-missing-required-yaml",
            severity: "error",
            line: lineNumberAt(text, m.index),
            questionNumber: numMatch?.[1],
            message: `\\setquestion com campos obrigatórios ausentes: ${missing.join(", ")}`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "setquestion-missing-item-meta",
    description: "Campos por item ausentes no YAML do \\setquestion (assuntoN:, tagsN:, respostaN: para discursivas).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const re = /\\setquestion\s*\n---\n([\s\S]*?)\n---\n([\s\S]*?)(?=(?:\n\\setquestion)|(?:\n\\question\s*\n---)|\s*$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const yaml = m[1];
        const body = m[2];
        const numMatch = yaml.match(/^numero:\s*"?(.*?)"?\s*$/m);
        const isDiscursiva = /^tipo:\s*Discursiva\s*$/mi.test(yaml);
        const itemCount = (body.match(/\\questionitem\b/g) ?? []).length;
        if (itemCount === 0) continue;
        const missing: string[] = [];
        for (let i = 1; i <= itemCount; i++) {
          if (!new RegExp(`^assunto${i}:\\s*.+$`, "m").test(yaml)) missing.push(`assunto${i}:`);
          if (!new RegExp(`^tags${i}:\\s*.+$`, "m").test(yaml)) missing.push(`tags${i}:`);
          if (isDiscursiva && !new RegExp(`^resposta${i}:\\s*`, "m").test(yaml)) missing.push(`resposta${i}:`);
        }
        if (missing.length > 0) {
          issues.push({
            ruleId: "setquestion-missing-item-meta",
            severity: "error",
            line: lineNumberAt(text, m.index),
            questionNumber: numMatch?.[1],
            message: `\\setquestion com ${itemCount} item(ns): campos ausentes no YAML — ${missing.join(", ")}. Adicionar campo numerado no YAML compartilhado (assunto1:, tags1:, resposta1:, assunto2:, tags2:, resposta2:, ...).`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "choices-single-image",
    description: "\\includegraphics dentro de choices — verificar se é uma imagem única para todas as alternativas.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const choicesRe = /\\begin\{(choices|oneparchoices)\}([\s\S]*?)\\end\{\1\}/g;
        let m: RegExpExecArray | null;
        while ((m = choicesRe.exec(block.body))) {
          const choicesBody = m[2];
          const imgCount = (choicesBody.match(/\\includegraphics/g) ?? []).length;
          const choiceCount = (choicesBody.match(/\\(?:choice|CorrectChoice)\b/g) ?? []).length;
          if (imgCount === 0) continue;
          if (imgCount < choiceCount) {
            // Menos imagens do que alternativas — provavelmente uma imagem única cobrindo várias
            issues.push({
              ruleId: "choices-single-image",
              severity: "error",
              line: block.startLine,
              questionNumber: block.number,
              message: `choices com ${imgCount} imagem(ns) para ${choiceCount} alternativas — imagem única cobrindo múltiplas choices. REQUER INTERVENÇÃO MANUAL: o professor precisa separar e fazer upload de uma imagem por alternativa (figura-qX-a, figura-qX-b, ...). Não importar até resolver.`,
            });
          } else if (imgCount === choiceCount) {
            // Uma imagem por alternativa — ok, mas avisar para verificar se não é transcrevível
            issues.push({
              ruleId: "choices-single-image",
              severity: "warning",
              line: block.startLine,
              questionNumber: block.number,
              message: `choices com imagem por alternativa — verificar se as imagens contêm LaTeX simples (matrizes, fórmulas) que pode ser transcrito diretamente.`,
            });
          }
        }
      }
      return issues;
    },
  },

  {
    id: "missing-required-yaml",
    description: "Campos obrigatórios ausentes no YAML da questão.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const missing: string[] = [];
        if (!/^tipo:\s*.+$/m.test(block.yaml)) missing.push("tipo:");
        if (!/^dificuldade:\s*.+$/m.test(block.yaml)) missing.push("dificuldade:");
        if (!/^disciplina:\s*.+$/m.test(block.yaml)) missing.push("disciplina:");
        if (!/^assunto:\s*.+$/m.test(block.yaml)) missing.push("assunto:");
        if (!/^tags:\s*.+$/m.test(block.yaml)) missing.push("tags:");
        if (missing.length > 0) {
          issues.push({
            ruleId: "missing-required-yaml",
            severity: "error",
            line: block.startLine,
            questionNumber: block.number,
            message: `Campos obrigatórios ausentes: ${missing.join(", ")}`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "invalid-disciplina",
    description: "Valor de disciplina: inválido ou não canônico.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const WRONG: Record<string, string> = {
        "Português": "Língua Portuguesa",
        "portugues": "Língua Portuguesa",
        "LP": "Língua Portuguesa",
        "Interpretação de Texto": "Língua Portuguesa (+ assunto: Interpretação de Texto)",
        "matematica": "Matemática",
        "Math": "Matemática",
        "fisica": "Física",
        "quimica": "Química",
        "bio": "Biologia",
        "historia": "História",
        "geo": "Geografia",
      };
      for (const block of questionBlocks(text)) {
        const m = block.yaml.match(/^disciplina:\s*(.+)$/m);
        if (!m) continue;
        const val = m[1].trim();
        const correct = WRONG[val];
        if (correct) {
          issues.push({
            ruleId: "invalid-disciplina",
            severity: "error",
            line: block.startLine,
            questionNumber: block.number,
            message: `disciplina: "${val}" inválido. Usar: "${correct}"`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "mcq-missing-gabarito",
    description: "MCQ sem campo gabarito: no YAML.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const isMcq = /^tipo:\s*M[úu]ltipla\s+Escolha\s*$/mi.test(block.yaml);
        const isTf = /^tipo:\s*Certo\/Errado\s*$/mi.test(block.yaml);
        const hasGabarito = /^gabarito:\s*.+$/m.test(block.yaml);
        if ((isMcq || isTf) && !hasGabarito) {
          issues.push({
            ruleId: "mcq-missing-gabarito",
            severity: "error",
            line: block.startLine,
            questionNumber: block.number,
            message: "MCQ/TF sem gabarito: no YAML. Adicionar gabarito: A/B/C/D/E (MCQ) ou gabarito: C/E (TF).",
          });
        }
      }
      return issues;
    },
  },

  // ── AVISOS (não bloqueadores, mas corrigir se perceber) ───────────────────

  {
    id: "visual-ref-without-placeholder",
    description: "Menção a figura/gráfico sem \\includegraphics.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        if (
          VISUAL_REFERENCE_RE.test(block.body) &&
          !MANUAL_FIGURE_PLACEHOLDER_RE.test(block.body) &&
          !/\\includegraphics\b/.test(block.body)
        ) {
          issues.push({
            ruleId: "visual-ref-without-placeholder",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: "Questão menciona elemento visual sem \\includegraphics.",
          });
        }
      }
      return issues;
    },
  },

  {
    id: "latex-temperature-text",
    description: "LaTeX desnecessário para temperaturas (E6 — não bloqueador).",
    run: ({ text }) =>
      issuesForPattern(
        text,
        /\\\([^)\n]*(?:\^\{\\circ\}|\\circ)[^)\n]*(?:C|\\text\{C\}|\\mathrm\{C\})[^)\n]*\\\)/g,
        {
          ruleId: "latex-temperature-text",
          severity: "warning",
          message: "Temperatura em LaTeX desnecessário. Prefira texto puro como 25°C (não bloqueador).",
        },
      ),
  },

  {
    id: "latex-unit-text",
    description: "LaTeX desnecessário para unidades simples (E6 — não bloqueador).",
    run: ({ text }) =>
      issuesForPattern(
        text,
        /\\\([^)\n]*\d+(?:[.,]\d+)?\s*\\,?\s*\\mathrm\{[^}]+\}[^)\n]*\\\)/g,
        {
          ruleId: "latex-unit-text",
          severity: "warning",
          message: "Unidade simples em LaTeX desnecessário. Prefira texto puro (não bloqueador).",
        },
      ),
  },

  {
    id: "yaml-base-text-metadata-without-title",
    description: "Texto-base com metadados incompletos.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const hasAuthor = /^autor_texto:\s*.+$/mi.test(block.yaml);
        const hasTheme = /^tema:\s*.+$/mi.test(block.yaml);
        const hasTitle = /^titulo_texto:\s*.+$/mi.test(block.yaml);
        if ((hasAuthor || hasTheme) && !hasTitle) {
          issues.push({
            ruleId: "yaml-base-text-metadata-without-title",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: "Metadados de texto-base sem titulo_texto.",
          });
        }
      }
      return issues;
    },
  },
];
