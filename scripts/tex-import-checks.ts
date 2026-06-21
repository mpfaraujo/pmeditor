import { getAreasMapPorDisciplina, normalizeAssunto } from "../src/data/assuntos";

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

export type QuestionBlock = {
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

export function questionBlocks(text: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];

  // Formato A: \question\n---\nyaml\n---\nbody  (YAML depois do \question)
  const reAfter = /\\question\s*\n---\n([\s\S]*?)\n---\n([\s\S]*?)(?=(?:\n\\question\s*\n---)|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = reAfter.exec(text))) {
    const yaml = m[1];
    const numMatch = yaml.match(/^numero:\s*"?(.*?)"?$/m);
    blocks.push({
      number: numMatch?.[1],
      yaml,
      body: m[2],
      full: m[0],
      startLine: lineNumberAt(text, m.index),
    });
  }

  // Formato B: ---\nyaml\n---\n\question\nbody  (YAML antes do \question)
  if (blocks.length === 0) {
    const markerRe = /\\question\b/g;
    const markers: number[] = [];
    let qm: RegExpExecArray | null;
    while ((qm = markerRe.exec(text))) markers.push(qm.index);

    for (let i = 0; i < markers.length; i++) {
      const qStart = markers[i];
      const qEnd = i + 1 < markers.length ? markers[i + 1] : text.length;
      const prevStart = i > 0 ? markers[i - 1] : 0;
      const textBefore = text.slice(prevStart, qStart);
      // matchAll com lazy captura cada ---...--- separadamente; pegamos o último (o mais próximo do \question)
      const allYaml = [...textBefore.matchAll(/---[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*---/g)];
      const yaml = allYaml.length > 0 ? allYaml[allYaml.length - 1][1].replace(/\r/g, "") : "";
      const body = text.slice(qStart, qEnd).replace(/^\\question\b[^\n]*\n?/, "").trimEnd();
      const numMatch = yaml.match(/^numero:\s*"?(.*?)"?$/m);
      blocks.push({
        number: numMatch?.[1],
        yaml,
        body,
        full: text.slice(prevStart, qEnd),
        startLine: lineNumberAt(text, qStart),
      });
    }
  }

  return blocks;
}

export type SetquestionBlock = {
  number?: string;
  yaml: string;   // YAML compartilhado (antes do \setquestion)
  body: string;   // texto do bloco completo (do \setquestion até o próximo marcador)
  itemCount: number;
  startLine: number;
};

export function setquestionBlocks(text: string): SetquestionBlock[] {
  const blocks: SetquestionBlock[] = [];
  // Localiza todos os marcadores de nível superior: \setquestion e \question (exceto \questionitem)
  const markerRe = /\\(setquestion|question)\b(?!item)/g;
  const markers: Array<{ index: number; isSet: boolean }> = [];
  let qm: RegExpExecArray | null;
  while ((qm = markerRe.exec(text))) {
    markers.push({ index: qm.index, isSet: qm[1] === "setquestion" });
  }

  for (let i = 0; i < markers.length; i++) {
    if (!markers[i].isSet) continue;
    const qStart = markers[i].index;
    const qEnd = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const prevStart = i > 0 ? markers[i - 1].index : 0;
    const textBefore = text.slice(prevStart, qStart);
    const yamlM = textBefore.match(/---\s*\n([\s\S]*?)\n\s*---\s*\n?\s*$/);
    const yaml = yamlM ? yamlM[1] : "";
    const body = text.slice(qStart, qEnd).trimEnd();
    const numMatch = yaml.match(/^numero:\s*"?(.*?)"?$/m);
    const itemCount = (body.match(/\\questionitem\b/g) ?? []).length;
    blocks.push({
      number: numMatch?.[1],
      yaml,
      body,
      itemCount,
      startLine: lineNumberAt(text, qStart),
    });
  }
  return blocks;
}

// Extrai a parte compartilhada do corpo: até o fim de \credits{...} (inclusive),
// ou tudo antes de \begin{choices} se não houver \credits.
export function extractLeadingText(body: string): string {
  const creditsIdx = body.indexOf("\\credits{");
  if (creditsIdx >= 0) {
    let depth = 0;
    let i = creditsIdx + "\\credits{".length - 1;
    for (; i < body.length; i++) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") { depth--; if (depth === 0) break; }
    }
    return body.slice(0, i + 1)
      .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const idx = body.indexOf("\\begin{choices}");
  const raw = idx >= 0 ? body.slice(0, idx) : body;
  return raw
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasBaseTextMeta(yaml: string): boolean {
  return /^(?:titulo_texto|autor_texto|tema):\s*.+$/mi.test(yaml);
}

// Normaliza títulos para comparação tolerante: NFC, sem aspas tipográficas/retas,
// espaços colapsados, case-insensitive. Usado nas regras que casam titulo_texto
// entre \basetext e \question.
export function normalizeTitulo(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[“”‘’"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
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
    id: "includegraphics-placeholder",
    description: "\\includegraphics com placeholder inventado (sem extensão de arquivo e sem URL) — a IA deveria usar o caminho/URL exato do [IMAGEM: ...] no .txt.",
    run: ({ text }): CheckIssue[] => {
      const out: CheckIssue[] = [];
      const seen = new Set<string>();
      const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const arg = (m[1] ?? "").trim();
        if (/^https?:\/\//i.test(arg)) continue;
        if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(arg)) continue;
        const line = lineNumberAt(text, m.index);
        const key = `includegraphics-placeholder|${line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ruleId: "includegraphics-placeholder", severity: "error", line, matched: m[0], excerpt: m[0], message: `\\includegraphics{${arg}} — nome sem extensão e sem URL, provavelmente placeholder inventado. Usar o valor exato do [IMAGEM: ...] do .txt: URL completa ou nome do arquivo local (img-001.png).` });
      }
      return out;
    },
  },

  {
    id: "eaten-escape-control-char",
    description: "Comandos LaTeX danificados por interpretação de escape C (\\t, \\b, \\v, \\f) na transcrição — aparecem como caractere de controle + sufixo do comando (ex.: <tab>itle{, <BS>egin{).",
    run: ({ text }): CheckIssue[] => {
      const out: CheckIssue[] = [];
      const seen = new Set<string>();
      // 1) Caracteres de controle que nunca aparecem em .tex legítimo: 0x08 (BS), 0x0B (VT), 0x0C (FF).
      //    Sinalizam \b, \v, \f interpretados como C-escape.
      const reCtrl = /[\x08\x0B\x0C]/g;
      let m: RegExpExecArray | null;
      while ((m = reCtrl.exec(text))) {
        const line = lineNumberAt(text, m.index);
        const key = `eaten-escape|ctrl|${line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rawLine = text.split("\n")[line - 1] ?? "";
        const code = m[0].charCodeAt(0);
        const escName = code === 0x08 ? "\\b" : code === 0x0B ? "\\v" : "\\f";
        out.push({
          ruleId: "eaten-escape-control-char",
          severity: "error",
          line,
          excerpt: excerpt(rawLine.replace(/[\x08\x0B\x0C]/g, "·")),
          matched: `<U+00${code.toString(16).toUpperCase().padStart(2, "0")}>`,
          message: `Caractere de controle U+00${code.toString(16).toUpperCase().padStart(2, "0")} no .tex — provavelmente comando LaTeX começando com ${escName} foi interpretado como escape C na transcrição (ex.: \\begin → <BS>egin, \\verse → <VT>erse, \\frac → <FF>rac). Restaurar a barra invertida.`,
        });
      }
      // 2) Tab (0x09) no início de comando danificado (\title, \textbf, \textit, \times etc.).
      const reTab = /\t(itle|extbf|extit|extrm|imes|able|ab)\b/g;
      while ((m = reTab.exec(text))) {
        const line = lineNumberAt(text, m.index);
        const key = `eaten-escape|tab|${line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rawLine = text.split("\n")[line - 1] ?? "";
        out.push({
          ruleId: "eaten-escape-control-char",
          severity: "error",
          line,
          excerpt: excerpt(rawLine.replace(/\t/g, "·")),
          matched: m[0],
          message: `Tab seguido de "${m[1]}" — comando LaTeX \\t${m[1]} teve o \\t interpretado como tab na transcrição. Restaurar a barra invertida (\\t${m[1]}).`,
        });
      }
      return out;
    },
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
        /\\begin\{(subparts|exercises|solution|answer|tabular|subenum|quote|quotation|verbatim|figure|minipage)\}/g,
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
      const issues = [];

      // Padrões claramente matemáticos → error
      const mathPatterns: RegExp[] = [
        /\d+\s*raiz\s+\d+\s*\/\s*\d+/gi,   // "3raiz 3/2", "3raiz3/2"
        /\braiz\s+\d+\s*\/\s*\d+/gi,         // "raiz 3/2"
        /\braiz\s+quadrada\b/gi,              // "raiz quadrada"
        /\braiz\s+de\s+[\d√]/gi,             // "raiz de 3", "raiz de √2"
        /\d\s*raiz\s*\d/gi,                  // "3raiz3" (sem espaço na fração)
      ];
      for (const pattern of mathPatterns) {
        issues.push(...issuesForPattern(stripped, pattern, {
          ruleId: "sqrt-word-in-text",
          severity: "error",
          message: "Expressão matemática com 'raiz' em texto puro — não renderiza. CORRIGIR: '3raiz 3/2' → '\\(\\frac{3\\sqrt{3}}{2}\\)', 'raiz de 3' → '\\(\\sqrt{3}\\)', 'raiz quadrada' → '\\(\\sqrt{}\\)'.",
        }));
      }

      // "raiz" isolado (sem número adjacente) → warning: pode ser palavra comum
      // Removemos as regiões já capturadas acima para evitar dupla detecção
      const withoutMath = mathPatterns.reduce((s, p) => s.replace(p, (m) => " ".repeat(m.length)), stripped);
      issues.push(...issuesForPattern(withoutMath, /\braiz\b/gi, {
        ruleId: "sqrt-word-in-text",
        severity: "warning",
        message: "'raiz' pode ser palavra comum (raiz de planta, raiz de equação/zero, sentido poético) OU expressão matemática não convertida. Verificar: se for \\sqrt{}, converter para LaTeX; se for palavra comum, ignorar.",
      }));

      return issues;
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
      // Quando seguido de espaço + letra, exige que a letra NÃO seja início de palavra de 2+ letras
      // (evita "sin precedentes" / "sin modales" / "sin cambiar" do espanhol, "cos da função" em pt etc.)
      const issues1 = issuesForPattern(
        stripped,
        new RegExp(
          `\\b(cos|sin|tan|cot|sec|csc|log|ln)${PTBR_EXCLUDE.source}(?:\\s+[a-zA-Z](?![a-zA-Z]{2,})|\\s+[0-9(°]|[\\d(°])`,
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
    id: "dashes-as-list-bullets",
    description: "Duas ou mais linhas consecutivas iniciadas por `--` — provável lista do PDF transcrita com hífens em vez de ambiente LaTeX.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const stripped = stripComments(text);
      const lines = stripped.split("\n");
      // Linha "marcador de lista com --": começa com -- (exatamente dois) + espaço + texto
      const isDashLine = lines.map((l) => /^\s*--(?!-)\s+\S/.test(l));
      let i = 0;
      while (i < lines.length) {
        if (isDashLine[i]) {
          let j = i;
          while (j < lines.length && isDashLine[j]) j++;
          const count = j - i;
          if (count >= 2) {
            issues.push({
              ruleId: "dashes-as-list-bullets",
              severity: "error",
              line: i + 1,
              message: `${count} linhas consecutivas iniciadas por "--" — provável lista transcrita do PDF com hífens em vez de ambiente. Converter para o ambiente apropriado (\\begin{itemize}, \\begin{alphaitems}, \\begin{romanitems}, \\begin{assertiveitems}, etc.). NÃO substituir por – (en dash) — perderia a semântica de lista.`,
            });
          }
          i = j;
        } else {
          i++;
        }
      }
      return issues;
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
    id: "prefixo-banca-no-enunciado",
    description: "Nome de banca/concurso ou número de questão embutido no enunciado em vez de no YAML.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      // Padrão: "(SIGLA)", "(SIGLA 2019)", "(Nome)", "(Nome PPL 2019)" — qualquer nome de concurso/banca
      // Não captura "(Considere...)", "(Use π=...)" — têm conteúdo longo ou sem fechar logo após
      const PREFIX_BANCA = /^\s*\((?:[A-Z]{2,}[\w\s\-–—]*?|[A-Z][a-z]{1,12}(?:[\s–—\-]+[A-Z][a-zA-Z\-]*)*)(?:\s+\d{4})?\)\s/;
      const PREFIX_NUM   = /^\s*(?:Q\.?\s*)?\d{1,3}[.)]\s/;

      // Varre o texto linha a linha, ignorando blocos YAML e comandos LaTeX
      let inYaml = false;
      const linhas = text.split('\n');
      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i];
        if (l.trim() === '---') { inYaml = !inYaml; continue; }
        if (inYaml) continue;
        if (l.trim().startsWith('%') || l.trim().startsWith('\\') || l.trim() === '') continue;

        if (PREFIX_BANCA.test(l + ' ')) {
          issues.push({
            ruleId: "prefixo-banca-no-enunciado",
            severity: "error",
            line: i + 1,
            message: `Prefixo de concurso no enunciado: "${l.trim().slice(0, 80)}". Remover do texto — concurso/banca/ano vão no YAML.`,
          });
        } else if (PREFIX_NUM.test(l)) {
          issues.push({
            ruleId: "prefixo-banca-no-enunciado",
            severity: "error",
            line: i + 1,
            message: `Número de questão no enunciado: "${l.trim().slice(0, 80)}". Remover do texto — vai em numero: no YAML.`,
          });
        }
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
    id: "discursiva-gabarito-em-resposta",
    description: "Questão discursiva com gabarito: preenchido mas sem resposta: (inclui setquestion/questionitem).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];

      // \question individuais
      for (const block of questionBlocks(text)) {
        const isDiscursiva = /^tipo:\s*Discursiva\s*$/mi.test(block.yaml);
        if (!isDiscursiva) continue;
        const gabaritoMatch = block.yaml.match(/^gabarito:\s*(.+)$/m);
        if (!gabaritoMatch) continue;
        const val = gabaritoMatch[1].trim();
        if (!val || val === "null") continue;
        const respostaMatch = block.yaml.match(/^resposta:\s*(.+)$/m);
        if (respostaMatch && respostaMatch[1].trim()) continue;
        issues.push({
          ruleId: "discursiva-gabarito-em-resposta",
          severity: "error",
          line: block.startLine,
          questionNumber: block.number,
          message: `Discursiva com gabarito: "${val}" mas sem resposta:. Preencher resposta: com o texto da resposta — ou, se gabarito: for texto de resposta, renomear para resposta:.`,
        });
      }

      // \setquestion: verifica YAML compartilhado (gabaritoN: sem respostaN:)
      // e YAML inline de cada \questionitem (gabarito: sem resposta:)
      const setRe = /\\setquestion\b([\s\S]*?)(?=\\setquestion\b|\\question\b|\s*$)/g;
      let sm: RegExpExecArray | null;
      while ((sm = setRe.exec(text))) {
        const setBlock = sm[1];
        const setLine = lineNumberAt(text, sm.index);

        // YAML antes do \setquestion (tipo + campos compartilhados)
        const prevStart = sm.index > 0 ? text.lastIndexOf("\n---\n", sm.index) : 0;
        const textBefore = text.slice(Math.max(0, prevStart), sm.index);
        const sharedYamlM = textBefore.match(/---\s*\n([\s\S]*?)\n\s*---\s*\n?\s*$/);
        const sharedYaml = sharedYamlM ? sharedYamlM[1] : "";
        const isDiscursiva = /^tipo:\s*Discursiva\s*$/mi.test(sharedYaml);
        if (!isDiscursiva) continue;

        // Campos gabaritoN no YAML compartilhado
        const gabNRe = /^gabarito(\d+):\s*(.+)$/gm;
        let gm: RegExpExecArray | null;
        while ((gm = gabNRe.exec(sharedYaml))) {
          const n = gm[1];
          const val = gm[2].trim();
          if (!val || val === "null") continue;
          if (new RegExp(`^resposta${n}:\\s*.+$`, "m").test(sharedYaml)) continue;
          issues.push({
            ruleId: "discursiva-gabarito-em-resposta",
            severity: "error",
            line: setLine,
            message: `\\setquestion discursivo: gabarito${n}: "${val}" sem resposta${n}:. Renomear para resposta${n}:.`,
          });
        }

        // YAML inline de cada \questionitem
        // [^\n]* cobre args opcionais na mesma linha; \n\s*--- exige que --- venha na linha seguinte
        const itemRe = /\\questionitem\b[^\n]*\n\s*---\s*\n([\s\S]*?)\n\s*---/g;
        let im: RegExpExecArray | null;
        while ((im = itemRe.exec(setBlock))) {
          const itemYaml = im[1];
          const gabM = itemYaml.match(/^gabarito:\s*(.+)$/m);
          if (!gabM) continue;
          const val = gabM[1].trim();
          if (!val || val === "null") continue;
          const numM = itemYaml.match(/^numero:\s*"?(.*?)"?$/m);
          if (/^resposta:\s*.+$/m.test(itemYaml)) continue;
          issues.push({
            ruleId: "discursiva-gabarito-em-resposta",
            severity: "error",
            line: lineNumberAt(text, sm!.index + im.index),
            questionNumber: numM?.[1],
            message: `\\questionitem discursivo: gabarito: "${val}" sem resposta:. Renomear para resposta:.`,
          });
        }
      }

      return issues;
    },
  },

  {
    id: "correctchoice-camelcase",
    description: "\\CorrectChoice camelCase — forma não canônica. Usar \\correctchoice.",
    run: ({ text }) =>
      issuesForPattern(text, /\\CorrectChoice\b/g, {
        ruleId: "correctchoice-camelcase",
        severity: "error",
        message: "\\CorrectChoice com C maiúsculo não é a forma canônica. Corrigir para \\correctchoice.",
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
    description: "Verifica número de \\correctchoice em cada bloco de alternativas.",
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
              message: `Bloco de alternativas com ${correctCount} \\correctchoice (deve ser exatamente 1).`,
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
          const choiceCount = (choicesBody.match(/\\(?:choice|correctchoice|CorrectChoice)\b/g) ?? []).length;
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
    description: "Campos obrigatórios ausentes no YAML da questão (\\question e \\setquestion).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const checkYaml = (yaml: string, startLine: number, number?: string) => {
        const missing: string[] = [];
        if (!/^tipo:\s*.+$/m.test(yaml)) missing.push("tipo:");
        if (!/^dificuldade:\s*.+$/m.test(yaml)) missing.push("dificuldade:");
        if (!/^disciplina:\s*.+$/m.test(yaml)) missing.push("disciplina:");
        if (!/^assunto:\s*.+$/m.test(yaml)) missing.push("assunto:");
        if (!/^tags:\s*.+$/m.test(yaml)) missing.push("tags:");
        if (missing.length > 0) {
          issues.push({
            ruleId: "missing-required-yaml",
            severity: "error",
            line: startLine,
            questionNumber: number,
            message: `Campos obrigatórios ausentes: ${missing.join(", ")}`,
          });
        }
      };
      for (const block of questionBlocks(text)) checkYaml(block.yaml, block.startLine, block.number);
      for (const block of setquestionBlocks(text)) checkYaml(block.yaml, block.startLine, block.number);
      return issues;
    },
  },

  {
    id: "setquestion-single-item",
    description: "\\setquestion com menos de 2 \\questionitem — será importado como questão com 1 item.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of setquestionBlocks(text)) {
        if (block.itemCount < 2) {
          issues.push({
            ruleId: "setquestion-single-item",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: `\\setquestion com ${block.itemCount} \\questionitem — mínimo 2 obrigatório. Se for questão simples, usar \\question.`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "questionitem-inline-yaml",
    description: "\\questionitem com YAML inline (---...---) — parse-tex remove esses blocos ao limpar o YAML da questão seguinte, deixando os itens sem metadados.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of setquestionBlocks(text)) {
        // Detecta \questionitem seguido de bloco ---...---
        if (/\\questionitem\b[^\n]*\n\s*---/.test(block.body)) {
          issues.push({
            ruleId: "questionitem-inline-yaml",
            severity: "error",
            line: block.startLine,
            questionNumber: block.number,
            message: `\\setquestion com YAML inline em \\questionitem (\\questionitem seguido de ---). BUG: parse-tex interpreta esses blocos como YAML da questão seguinte e os remove. CORREÇÃO: mover os campos para o YAML compartilhado do \\setquestion como resposta1:, resposta2:, numero1:, numero2:, assunto1:, etc.`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "setquestion-missing-per-item-fields",
    description: "\\setquestion sem campos por item (respostaN:, assuntoN:, tagsN:) no YAML compartilhado.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of setquestionBlocks(text)) {
        if (block.itemCount < 2) continue;
        const yaml = block.yaml;
        const missing: string[] = [];
        // Verifica se algum campo numerado existe; se não, lista o que falta
        const hasResposta = /^resposta\d+:/m.test(yaml);
        const hasAssunto  = /^assunto\d+:/m.test(yaml);
        const hasTags     = /^tags\d+:/m.test(yaml);
        if (!hasResposta) missing.push("resposta1:, resposta2:, ...");
        if (!hasAssunto)  missing.push("assunto1:, assunto2:, ...");
        if (!hasTags)     missing.push("tags1:, tags2:, ...");
        if (missing.length > 0) {
          issues.push({
            ruleId: "setquestion-missing-per-item-fields",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: `\\setquestion sem campos por item no YAML compartilhado: ${missing.join(" ")}`,
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
        "Literatura": "Língua Portuguesa",
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
    id: "invalid-assunto",
    description: "Valor de assunto: não é canônico (não bate com área/subárea de src/data/disciplinas_areas.json).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
      const stripQuotes = (s: string) => s.replace(/^["']+|["']+$/g, "").trim();

      const canonicalFor = (disciplina: string, nivel: string | null): { exact: Set<string>; norm: Map<string, string> } | null => {
        const map = getAreasMapPorDisciplina(disciplina, nivel);
        if (!map) return null;
        const exact = new Set<string>();
        const normMap = new Map<string, string>();
        for (const [area, info] of Object.entries(map)) {
          exact.add(area);
          normMap.set(norm(area), area);
          for (const sub of info.subareas) {
            exact.add(sub);
            normMap.set(norm(sub), sub);
          }
        }
        return { exact, norm: normMap };
      };

      const checkOne = (params: {
        disciplina: string;
        nivel: string | null;
        assunto: string;
        line: number;
        questionNumber?: string;
        fieldLabel: string;
      }) => {
        const { disciplina, nivel, assunto, line, questionNumber, fieldLabel } = params;
        const can = canonicalFor(disciplina, nivel);
        if (!can) return; // disciplina desconhecida — invalid-disciplina cuida
        if (can.exact.has(assunto)) return;
        const hit = can.norm.get(norm(assunto));
        if (hit) {
          issues.push({
            ruleId: "invalid-assunto",
            severity: "error",
            line,
            questionNumber,
            message: `${fieldLabel} "${assunto}" difere do canônico apenas por acento/caixa. Usar exatamente: "${hit}".`,
          });
          return;
        }
        const suggested = normalizeAssunto(assunto);
        const suggestedHit = suggested && can.norm.get(norm(suggested));
        const hint = suggestedHit ? ` Sugestão: "${suggestedHit}".` : "";
        issues.push({
          ruleId: "invalid-assunto",
          severity: "error",
          line,
          questionNumber,
          message: `${fieldLabel} "${assunto}" não é canônico para disciplina "${disciplina}". Usar área ou subárea de src/data/disciplinas_areas.json (preferir subárea mais específica).${hint}`,
        });
      };

      // \question / formato A e B
      for (const block of questionBlocks(text)) {
        const dM = block.yaml.match(/^disciplina:\s*(.+)$/m);
        const aM = block.yaml.match(/^assunto:\s*(.+)$/m);
        if (!dM || !aM) continue;
        const nM = block.yaml.match(/^nivel:\s*(.+)$/m);
        checkOne({
          disciplina: stripQuotes(dM[1].trim()),
          nivel: nM ? stripQuotes(nM[1].trim()) : null,
          assunto: stripQuotes(aM[1].trim()),
          line: block.startLine,
          questionNumber: block.number,
          fieldLabel: "assunto:",
        });
      }

      // \setquestion — assunto: compartilhado e assuntoN: por item
      for (const block of setquestionBlocks(text)) {
        const dM = block.yaml.match(/^disciplina:\s*(.+)$/m);
        if (!dM) continue;
        const disciplina = stripQuotes(dM[1].trim());
        const nM = block.yaml.match(/^nivel:\s*(.+)$/m);
        const nivel = nM ? stripQuotes(nM[1].trim()) : null;
        const aM = block.yaml.match(/^assunto:\s*(.+)$/m);
        if (aM) {
          checkOne({
            disciplina,
            nivel,
            assunto: stripQuotes(aM[1].trim()),
            line: block.startLine,
            questionNumber: block.number,
            fieldLabel: "assunto:",
          });
        }
        const numberedRe = /^assunto(\d+):\s*(.+)$/gm;
        let nm: RegExpExecArray | null;
        while ((nm = numberedRe.exec(block.yaml)) !== null) {
          checkOne({
            disciplina,
            nivel,
            assunto: stripQuotes(nm[2].trim()),
            line: block.startLine,
            questionNumber: block.number,
            fieldLabel: `assunto${nm[1]}:`,
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
    description: "Texto-base com metadados incompletos. Não dispara em Modalidade B-MCQ (\\basetext embutido dentro de \\question).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      for (const block of questionBlocks(text)) {
        const hasAuthor = /^autor_texto:\s*.+$/mi.test(block.yaml);
        const hasTheme = /^tema:\s*.+$/mi.test(block.yaml);
        const hasTitle = /^titulo_texto:\s*.+$/mi.test(block.yaml);
        // Modalidade B-MCQ: \basetext embutido na questão — autor_texto/genero/tema são
        // metadata da questão, texto fica embutido sem ir pro banco. titulo_texto não exigido.
        const hasEmbeddedBaseText = /^\\basetext\b/m.test(block.body);
        if ((hasAuthor || hasTheme) && !hasTitle && !hasEmbeddedBaseText) {
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

  {
    id: "editorial-label-in-body",
    description: "Rótulo editorial no corpo da questão ('TEXTO PARA AS QUESTÕES X', 'TEXTO I', etc.) — entra como parágrafo literal no banco.",
    run: ({ text }) => {
      // Remove blocos YAML antes de checar o corpo
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      return issuesForPattern(
        noYaml,
        /^[ \t]*TEXTO\s+PARA\s+A[S]?\s+QUEST[ÃÕ]\S*\s+[\d,\s]+(?:E\s+\d+)?\s*$/gmi,
        {
          ruleId: "editorial-label-in-body",
          severity: "warning",
          message: "Rótulo editorial no corpo da questão — entra como parágrafo literal no banco. Remover esta linha.",
        },
      );
    },
  },

  {
    id: "untranslated-english-word",
    description: "Palavra em inglês no texto que parece erro de transcrição (ex: 'in 2006' em vez de 'em 2006').",
    run: ({ text }) => {
      // Adicionar mais padrões nesta lista conforme identificados
      const PATTERNS: Array<{ re: RegExp; hint: string }> = [
        {
          re: /\bin\s+\d{4}\b/g,
          hint: '"in" (inglês) antes de ano — provável erro de transcrição. Substituir por "em".',
        },
      ];
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      const issues: CheckIssue[] = [];
      for (const { re, hint } of PATTERNS) {
        issues.push(
          ...issuesForPattern(noYaml, re, {
            ruleId: "untranslated-english-word",
            severity: "warning",
            message: hint,
          }),
        );
      }
      return issues;
    },
  },

  {
    id: "inline-attribution-without-credits",
    description: "Atribuição de fonte inline (linha isolada entre parênteses) sem \\credits{} — entra como parágrafo literal no banco.",
    run: ({ text }) => {
      const noYaml = text.replace(/\n---\n[\s\S]*?\n---\n/g, (m) => "\n" + " ".repeat(m.length - 2) + "\n");
      return issuesForPattern(
        noYaml,
        /^[ \t]*\(.{20,}\)[.\s]*$/gm,
        {
          ruleId: "inline-attribution-without-credits",
          severity: "warning",
          message: "Atribuição de fonte inline sem \\credits{} — entra como parágrafo literal. Substituir por \\credits{...}.",
        },
      );
    },
  },

  {
    id: "base-text-duplicated-in-questions",
    description: "Texto base com titulo_texto: repetido no corpo de múltiplas questões — deve aparecer apenas na primeira.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const blocks = questionBlocks(text);

      // Agrupa blocos pelo titulo_texto do YAML (normalizado)
      const groups = new Map<string, QuestionBlock[]>();
      for (const block of blocks) {
        const m = block.yaml.match(/^titulo_texto:\s*["']?(.+?)["']?\s*$/m);
        if (!m) continue;
        const titulo = normalizeTitulo(m[1]);
        if (!groups.has(titulo)) groups.set(titulo, []);
        groups.get(titulo)!.push(block);
      }

      const MIN_SHARED = 80;

      function sharedPrefixLen(a: string, b: string): number {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return i;
      }

      for (const [titulo, group] of groups) {
        if (group.length < 2) continue;
        const firstLead = extractLeadingText(group[0].body);
        if (firstLead.length < MIN_SHARED) continue;
        // Verifica se alguma outra questão do grupo também tem o texto base no corpo
        for (let i = 1; i < group.length; i++) {
          const lead = extractLeadingText(group[i].body);
          if (lead.length >= MIN_SHARED && sharedPrefixLen(firstLead, lead) >= MIN_SHARED) {
            issues.push({
              ruleId: "base-text-duplicated-in-questions",
              severity: "warning",
              line: group[i].startLine,
              questionNumber: group[i].number,
              message: `Texto base "${titulo}" duplicado no corpo desta questão. Deve aparecer apenas na primeira questão do grupo — as demais têm só o enunciado próprio.`,
            });
          }
        }
      }

      return issues;
    },
  },

  {
    id: "shared-base-text-no-metadata",
    description: "Múltiplas questões consecutivas com texto base compartilhado sem metadados do texto (titulo_texto:, autor_texto:, tema:).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const blocks = questionBlocks(text);
      if (blocks.length < 2) return issues;

      function sharedPrefixLen(a: string, b: string): number {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return i;
      }

      const MIN_SHARED = 100;

      // Agrupa questões consecutivas que compartilham prefixo de texto base
      const groups: QuestionBlock[][] = [];
      let current: QuestionBlock[] = [blocks[0]];

      for (let i = 1; i < blocks.length; i++) {
        const prevLead = extractLeadingText(blocks[i - 1].body);
        const curLead = extractLeadingText(blocks[i].body);
        if (prevLead.length >= MIN_SHARED && sharedPrefixLen(prevLead, curLead) >= MIN_SHARED) {
          current.push(blocks[i]);
        } else {
          if (current.length >= 2) groups.push(current);
          current = [blocks[i]];
        }
      }
      if (current.length >= 2) groups.push(current);

      for (const group of groups) {
        const missingMeta = group.filter((b) => !hasBaseTextMeta(b.yaml));
        if (missingMeta.length > 0) {
          const nums = group.map((b) => b.number ?? "?").join(", ");
          const missing = missingMeta.map((b) => b.number ?? "?").join(", ");
          issues.push({
            ruleId: "shared-base-text-no-metadata",
            severity: "warning",
            line: group[0].startLine,
            questionNumber: group[0].number,
            message: `Questões ${nums} compartilham texto base. Adicionar metadados do texto (titulo_texto:, autor_texto:, tema:) no YAML de TODAS para que o import envie o texto ao banco e as vincule. Faltando nas questões: ${missing}.`,
          });
        }
      }

      return issues;
    },
  },

  {
    id: "basetext-missing-titulo",
    description: "Bloco \\basetext sem titulo_texto: no YAML — o importador ignora o bloco e as questões ficam sem vínculo. Aplica-se apenas a \\basetext no escopo de arquivo (Modalidade A). \\basetext logo após um \\setquestion (Modalidade B, embutido) não exige titulo_texto.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];

      // Posições de \basetext considerados "embutidos" em \setquestion (Modalidade B):
      // aparecem entre um \setquestion e o próximo \question/\setquestion de topo.
      const markerRe = /\\(setquestion|question|basetext)\b/g;
      const embeddedBasetextPositions = new Set<number>();
      let lastSetquestion = -1;
      let mm: RegExpExecArray | null;
      while ((mm = markerRe.exec(text)) !== null) {
        const tag = mm[1];
        if (tag === "setquestion") lastSetquestion = mm.index;
        else if (tag === "question") lastSetquestion = -1;
        else if (tag === "basetext" && lastSetquestion >= 0) {
          embeddedBasetextPositions.add(mm.index);
          lastSetquestion = -1;
        }
      }

      const basetextRe = /\\basetext\b\s*\r?\n---\r?\n([\s\S]*?)\r?\n---\r?\n/g;
      let m: RegExpExecArray | null;
      while ((m = basetextRe.exec(text)) !== null) {
        if (embeddedBasetextPositions.has(m.index)) continue; // Modalidade B — esperado
        const yaml = m[1];
        if (!/^titulo_texto:\s*.+$/m.test(yaml)) {
          const line = text.slice(0, m.index).split("\n").length + 1;
          issues.push({
            ruleId: "basetext-missing-titulo",
            severity: "error",
            line,
            message: "\\basetext sem titulo_texto: no YAML — o importador ignora este bloco. Adicionar titulo_texto: para vincular às questões.",
          });
        }
      }
      return issues;
    },
  },

  {
    id: "titulo-texto-no-basetext-match",
    description: "Questão com titulo_texto: não tem \\basetext correspondente no arquivo (quando o arquivo usa blocos \\basetext).",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      // Só aplica quando o arquivo tem pelo menos um \basetext
      if (!/\\basetext\b/.test(text)) return issues;

      // Extrai titulo_texto de cada \basetext (normalizado)
      const basetextTitles = new Set<string>();
      const basetextRe = /\\basetext\b\s*\r?\n---\r?\n([\s\S]*?)\r?\n---\r?\n/g;
      let m: RegExpExecArray | null;
      while ((m = basetextRe.exec(text)) !== null) {
        const match = m[1].match(/^titulo_texto:\s*["']?(.+?)["']?\s*$/m);
        if (match) basetextTitles.add(normalizeTitulo(match[1]));
      }

      for (const block of questionBlocks(text)) {
        const titleMatch = block.yaml.match(/^titulo_texto:\s*["']?(.+?)["']?\s*$/m);
        if (!titleMatch) continue;
        const titulo = titleMatch[1].trim();
        if (!basetextTitles.has(normalizeTitulo(titulo))) {
          issues.push({
            ruleId: "titulo-texto-no-basetext-match",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: `titulo_texto: "${titulo}" não tem \\basetext correspondente neste arquivo. Adicionar bloco \\basetext antes das questões ou remover o campo se o texto base está no corpo da primeira questão.`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "basetext-repeated-in-question",
    description: "Questão referencia um \\basetext mas tem \\credits{} no corpo — conteúdo que pertence ao bloco \\basetext.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      // Só aplica quando o arquivo tem pelo menos um \basetext
      if (!/\\basetext\b/.test(text)) return issues;

      // Extrai titulo_texto de cada \basetext válido (normalizado)
      const basetextTitles = new Set<string>();
      const basetextRe = /\\basetext\b\s*\r?\n---\r?\n([\s\S]*?)\r?\n---\r?\n/g;
      let m: RegExpExecArray | null;
      while ((m = basetextRe.exec(text)) !== null) {
        const match = m[1].match(/^titulo_texto:\s*["']?(.+?)["']?\s*$/m);
        if (match) basetextTitles.add(normalizeTitulo(match[1]));
      }

      for (const block of questionBlocks(text)) {
        const titleMatch = block.yaml.match(/^titulo_texto:\s*["']?(.+?)["']?\s*$/m);
        if (!titleMatch) continue;
        const titulo = titleMatch[1].trim();
        if (!basetextTitles.has(normalizeTitulo(titulo))) continue;
        // Questão referencia um \basetext — \credits{} de autoria pertence ao \basetext.
        // Imagens NÃO disparam alerta: podem ser figuras específicas da questão (gráficos, esquemas).
        if (/\\credits\{/.test(block.body)) {
          issues.push({
            ruleId: "basetext-repeated-in-question",
            severity: "warning",
            line: block.startLine,
            questionNumber: block.number,
            message: `Questão com titulo_texto: "${titulo}" tem \\credits{} no corpo — autoria pertence ao bloco \\basetext. Mover para o \\basetext se for o crédito do texto.`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "fake-table-in-center",
    description: "\\begin{center} usado como tabela fake (linhas com `|`) — tabela deve ser \\includegraphics{tabela-qX}.",
    run: ({ text }) => {
      const issues: CheckIssue[] = [];
      const centerRe = /\\begin\{center\}([\s\S]*?)\\end\{center\}/g;
      let m: RegExpExecArray | null;
      while ((m = centerRe.exec(text)) !== null) {
        const inner = m[1];
        const pipeLines = inner.split("\n").filter((l) => l.includes("|"));
        if (pipeLines.length >= 2) {
          const line = text.slice(0, m.index).split("\n").length;
          const qBlock = questionBlocks(text).find(
            (b) => b.startLine <= line && (b.endLine ?? Infinity) >= line
          );
          issues.push({
            ruleId: "fake-table-in-center",
            severity: "warning",
            line,
            questionNumber: qBlock?.number,
            message: `\\begin{center} com ${pipeLines.length} linhas contendo '|' parece uma tabela fake. Tabelas devem ser \\includegraphics{tabela-qX}, nunca ASCII com '|'.`,
          });
        }
      }
      return issues;
    },
  },

  {
    id: "reference-to-formatting",
    description: "Enunciado menciona sublinhado/grifado/negritado ou 'trecho marcado' — verificar se a formatação está presente no .tex ou foi perdida na extração.",
    run: ({ text }) => {
      return issuesForPattern(
        text,
        /\b(sublinhad[ao]s?|grifad[ao]s?|negritad[ao]s?)\b|\b(?:trecho|termo|palavra|segmento|parte)s?\s+marcad[ao]s?\b/gi,
        {
          ruleId: "reference-to-formatting",
          severity: "warning",
          message: "Enunciado menciona formatação visual (sublinhado/grifado/marcado) — verificar se está presente no .tex ou foi perdida na extração do PDF.",
        }
      );
    },
  },
];
