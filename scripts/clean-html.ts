#!/usr/bin/env tsx
/**
 * scripts/clean-html.ts
 *
 * Remove o ruído de páginas HTML de bancos de questões e entrega
 * texto limpo e legível para alimentar uma IA.
 *
 * Uso:
 *   pnpm tsx scripts/clean-html.ts pagina.html
 *   pnpm tsx scripts/clean-html.ts https://site.com/questao/123
 *   pnpm tsx scripts/clean-html.ts pagina.html > questoes-limpas.txt
 *   cat pagina.html | pnpm tsx scripts/clean-html.ts
 *
 * O que é removido:
 *   - <script>, <style>, <nav>, <header>, <footer>
 *   - Formulários, botões, checkboxes, dropdowns
 *   - Elementos de UI (botões de compartilhar, visualizar, etc.)
 *
 * O que é preservado:
 *   - Texto dos enunciados e alternativas
 *   - Sub/superscripts → _{x} ^{x}
 *   - Fórmulas MathJax/MathML → \( LaTeX \)
 *   - [IMAGEM: url] para cada figura
 *   - [RESOLUÇÃO] + conteúdo da resolução quando presente
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';

// ─── MathML → LaTeX ───────────────────────────────────────────────────────────

function mathmlNodeToLatex($m: cheerio.CheerioAPI, node: any): string {
  if (node.type === 'text') return (node.data ?? '').replace(/\s+/g, ' ');

  const tag = node.tagName?.toLowerCase();
  if (!tag) return '';

  const allChildren = $m(node).contents().toArray();
  const tagChildren = allChildren.filter((c: any) => c.type === 'tag');
  const inner = () => allChildren.map((c: any) => mathmlNodeToLatex($m, c)).join('').trim();
  const child = (i: number) => tagChildren[i] ? mathmlNodeToLatex($m, tagChildren[i]) : '';

  const MO_MAP: Record<string, string> = {
    '⋅': '\\cdot', '·': '\\cdot',
    '×': '\\times', '÷': '\\div',
    '±': '\\pm', '∓': '\\mp',
    '≤': '\\leq', '≦': '\\leq',
    '≥': '\\geq', '≧': '\\geq',
    '≠': '\\neq', '≈': '\\approx',
    '→': '\\rightarrow', '←': '\\leftarrow',
    '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow',
    '∞': '\\infty', '∑': '\\sum', '∏': '\\prod',
    '∫': '\\int', '∂': '\\partial',
    '∈': '\\in', '∉': '\\notin',
    '⊂': '\\subset', '⊃': '\\supset',
    '∩': '\\cap', '∪': '\\cup',
    '−': '-', '−': '-',
  };

  switch (tag) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'merror':
    case 'menclose': // box/circle: só o conteúdo
      return inner();

    case 'mphantom': return '';
    case 'mspace':   return ' ';

    case 'mi': return inner();
    case 'mn': return inner();

    case 'mo': {
      const t = inner();
      return MO_MAP[t] ?? t;
    }

    case 'mtext': {
      const t = inner();
      if (!t || /^[\s ]+$/.test(t)) return ' ';
      return `\\text{${t}}`;
    }

    case 'mfrac':
      return `\\frac{${child(0)}}{${child(1)}}`;

    case 'msqrt':
      return `\\sqrt{${inner()}}`;

    case 'mroot':
      return `\\sqrt[${child(1)}]{${child(0)}}`;

    case 'msub':
      return `${child(0)}_{${child(1)}}`;

    case 'msup':
      return `${child(0)}^{${child(1)}}`;

    case 'msubsup':
      return `${child(0)}_{${child(1)}}^{${child(2)}}`;

    case 'mover': {
      const base = child(0);
      const over = child(1);
      const accentMap: Record<string, string> = {
        '→': `\\vec{${base}}`, '⃗': `\\vec{${base}}`,
        '¯': `\\bar{${base}}`, '˙': `\\dot{${base}}`,
        '¨': `\\ddot{${base}}`, '˜': `\\tilde{${base}}`,
        '^': `\\hat{${base}}`,
      };
      return accentMap[over] ?? `\\overset{${over}}{${base}}`;
    }

    case 'munder':
      return `\\underset{${child(1)}}{${child(0)}}`;

    case 'mtable': {
      const rows = $m(node).find('mtr').toArray().map(row => {
        const cells = $m(row).find('mtd').toArray().map(cell =>
          $m(cell).contents().toArray().map((c: any) => mathmlNodeToLatex($m, c)).join('')
        );
        return cells.join(' & ');
      });
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }

    default:
      return inner();
  }
}

function mathmlToLatex(mathmlStr: string): string {
  const $m = cheerio.load(mathmlStr, { xmlMode: true });
  const mathNode = $m('math').get(0);
  if (!mathNode) return '';
  return mathmlNodeToLatex($m, mathNode).trim();
}

// ─── HTML → texto ─────────────────────────────────────────────────────────────

function nodeToText($: cheerio.CheerioAPI, node: any): string {
  if (node.type === 'text') return node.data ?? '';

  const tag = node.tagName?.toLowerCase();
  if (!tag) return '';

  // Ignorados completamente (scripts já foram removidos antes, mas por garantia)
  if (['script','style','nav','header','footer','form','button',
       'select','option','optgroup','input','noscript'].includes(tag)) {
    return '';
  }

  // Imagem
  if (tag === 'figure') {
    const src = $(node).find('img').attr('src') ?? $(node).find('img').attr('data-src') ?? '';
    return src ? `\n[IMAGEM: ${src}]\n` : '';
  }
  if (tag === 'img') {
    const src = $(node).attr('src') ?? $(node).attr('data-src') ?? '';
    return src ? `[IMAGEM: ${src}]` : '';
  }

  // Sub/superscript → notação LaTeX para a IA converter em \ce{} ou $...$
  if (tag === 'sub') {
    const text = childrenToText($, $(node).contents().toArray());
    return `_{${text}}`;
  }
  if (tag === 'sup') {
    const text = childrenToText($, $(node).contents().toArray());
    return `^{${text}}`;
  }

  // Quebras de linha estruturais
  const inner = childrenToText($, $(node).contents().toArray());

  if (['p','div','li','tr','h1','h2','h3','h4'].includes(tag)) {
    return inner.trim() ? inner.trim() + '\n' : '';
  }
  if (tag === 'br') return '\n';

  return inner;
}

function childrenToText($: cheerio.CheerioAPI, nodes: any[]): string {
  return nodes.map(n => nodeToText($, n)).join('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let file = '';
let materia = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--materia') materia = args[++i];
  else if (!args[i].startsWith('--')) file = args[i];
}

// Modo Química: usa \ce{} para fórmulas químicas
const modoQuimica = /qu[ií]mica/i.test(materia);

// Heurística: fórmula é química se contém símbolos de elementos + íons/reações
// e NÃO contém estruturas puramente matemáticas (\frac, \sqrt, \int, \sum)
function isChemicalFormula(latex: string): boolean {
  // Nunca química: math puro, vetores, matrizes
  if (/\\frac|\\sqrt|\\int|\\sum|\\prod|\\lim|\\infty/.test(latex)) return false;
  if (/\\overset\{\\(?:right|left)arrow\}|\\vec\{/.test(latex)) return false; // vetores físicos
  if (/\\begin\{matrix\}/.test(latex)) return false; // sistemas (KaTeX não suporta em \ce)

  // Elemento químico com subscrito numérico: O_{2}, NH_{3}, Mn, Fe...
  const hasElement = /\b(?:H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Mn|Fe|Co|Ni|Cu|Zn|Br|I|Ag|Au|Hg|Pb|Pt)\b/.test(latex);
  const hasIon = /\^\{\s*\d*\s*[+-]/.test(latex);          // carga iônica ^{2+} ^{-}
  const hasReaction = /\\rightarrow|\\leftarrow/.test(latex); // seta de reação

  return hasElement || hasIon || hasReaction;
}

let html: string;
if (file.startsWith('http://') || file.startsWith('https://')) {
  const res = await fetch(file, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Falha ao baixar página: HTTP ${res.status} — ${file}`);
  html = await res.text();
} else if (file) {
  html = fs.readFileSync(file, 'utf-8');
} else {
  html = fs.readFileSync(0, 'utf-8');
}

const $ = cheerio.load(html);

// ── Passo 1: MathJax — substituir ANTES de remover scripts ───────────────────
// Suporte a: span.math-equation (vestibulares.com), span[id^="MathJax-Element"]
function wrapFormula(latex: string): string {
  if (!latex) return '';
  if (modoQuimica && isChemicalFormula(latex)) return `\\ce{${latex}}`;
  return `\\(${latex}\\)`;
}

$('span.math-equation').each((_, el) => {
  const scriptEl = $(el).find('script[type="math/mml"]');
  if (scriptEl.length) {
    const mathml = scriptEl.html() ?? '';
    const latex = mathmlToLatex(mathml);
    $(el).replaceWith(wrapFormula(latex));
    return;
  }
  // Fallback: data-mathml no span.MathJax interno (URL-encoded)
  const dataMathml = $(el).find('[data-mathml]').attr('data-mathml');
  if (dataMathml) {
    const decoded = dataMathml.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
    const latex = mathmlToLatex(decoded);
    $(el).replaceWith(wrapFormula(latex));
  }
});

// KaTeX: span.katex — source em annotation[encoding="application/x-tex"]
$('span.katex').each((_, el) => {
  const annotation = $(el).find('annotation[encoding="application/x-tex"]');
  if (annotation.length) {
    const latex = annotation.text().trim();
    $(el).replaceWith(wrapFormula(latex));
  }
});

// ── Passo 2: remover ruído ────────────────────────────────────────────────────
$('script, style, nav, header, footer, noscript').remove();
$('[id*="menu"], [class*="menu"], [class*="navbar"], [class*="breadcrumb"]').remove();
$('[id*="sidebar"], [class*="sidebar"]').remove();
$('[class*="publicidade"], [class*="banner"], [class*="ads"]').remove();
// Vestibulares.com e similares: remove botões de UI
$('[class*="botao-visualizar"], [class*="botao-compartilhar"], [class*="btn-compartilhar"]').remove();
// Substitui cabeçalho "Resolução" por marcador legível para a IA
$('span.label-inverse').each((_, el) => { $(el).replaceWith('\n[RESOLUÇÃO]\n'); });
// Remove atributos anti-cópia mas mantém o conteúdo da resolução
$('div[onmousedown]').each((_, el) => { $(el).removeAttr('onmousedown').removeAttr('onselectstart'); });
// Substitui checkboxes de alternativas pela letra antes de remover
$('input[type="checkbox"][value]').each((_, el) => {
  const val = $(el).attr('value') ?? '';
  if (/^[A-E]$/i.test(val)) {
    $(el).replaceWith(`${val.toUpperCase()}) `);
  } else {
    $(el).remove();
  }
});
$('select, form, button, input').remove();

// ── Passo 3: extrair texto ────────────────────────────────────────────────────
const main = $('div.questao-vestibular-questoes, main, article, [role="main"], body').first();

const raw = childrenToText($, main.contents().toArray());

const clean = raw
  .replace(/\t/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/^\d{1,2}\.\s*\([^)]+\)\s*/gm, '')
  .trim();

// ── Passo 4: gravar ou imprimir ───────────────────────────────────────────────
const titulo = materia || $('h1').first().text().trim() || 'questoes';
const data = new Date().toISOString().split('T')[0];
const scriptDir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const saidaDir = `${scriptDir}/trabalho/saida`;

if (materia) {
  const outPath = `${saidaDir}/${titulo} ${data}.txt`;
  fs.mkdirSync(saidaDir, { recursive: true });
  fs.writeFileSync(outPath, clean + '\n', 'utf-8');
  process.stderr.write(`→ ${outPath}\n`);
} else {
  process.stdout.write(clean + '\n');
}
