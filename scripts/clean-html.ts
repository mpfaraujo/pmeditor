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
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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
    '−': '-',
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
    return src ? `\n[IMAGEM: ${resolveUrl(src)}]\n` : '';
  }
  if (tag === 'img') {
    const src = $(node).attr('src') ?? $(node).attr('data-src') ?? '';
    return src ? `[IMAGEM: ${resolveUrl(src)}]` : '';
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

let baseUrl = ''; // preenchido dentro do IIFE quando a entrada é uma URL
let imageOutputDir = ''; // diretório onde salvar imagens base64 extraídas
let imageCounter = 0;   // reiniciado a cada arquivo de saída

function resolveUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith('data:')) {
    // Imagem embutida como base64 → salvar em arquivo para o bulk-import poder subir
    if (imageOutputDir) {
      const match = src.match(/^data:(image\/([a-zA-Z+]+));base64,(.+)$/s);
      if (match) {
        const ext = match[2].replace('+', '').toLowerCase() || 'png';
        imageCounter++;
        const imgFile = `${imageOutputDir}/img-${String(imageCounter).padStart(3, '0')}.${ext}`;
        fs.mkdirSync(imageOutputDir, { recursive: true });
        fs.writeFileSync(imgFile, Buffer.from(match[3], 'base64'));
        return imgFile;
      }
    }
    return ''; // se não há output dir, descarta (não polui o .txt)
  }
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (!baseUrl) return src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function childrenToText($: cheerio.CheerioAPI, nodes: any[]): string {
  return nodes.map(n => nodeToText($, n)).join('');
}

// ─── Processa um HTML já carregado e retorna texto limpo ─────────────────────

function processHtml(html: string, modoQuimica: boolean): { clean: string; titulo: string } {
  function isChemicalFormula(latex: string): boolean {
    if (/\\frac|\\sqrt|\\int|\\sum|\\prod|\\lim|\\infty/.test(latex)) return false;
    if (/\\overset\{\\(?:right|left)arrow\}|\\vec\{/.test(latex)) return false;
    if (/\\begin\{matrix\}/.test(latex)) return false;
    const hasElement = /\b(?:H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Mn|Fe|Co|Ni|Cu|Zn|Br|I|Ag|Au|Hg|Pb|Pt)\b/.test(latex);
    const hasIon = /\^\{\s*\d*\s*[+-]/.test(latex);
    const hasReaction = /\\rightarrow|\\leftarrow/.test(latex);
    return hasElement || hasIon || hasReaction;
  }

  function wrapFormula(latex: string): string {
    if (!latex) return '';
    if (modoQuimica && isChemicalFormula(latex)) return `\\ce{${latex}}`;
    return `\\(${latex}\\)`;
  }

  const $ = cheerio.load(html);

  // Passo 1: fórmulas
  $('span.math-equation').each((_, el) => {
    const scriptEl = $(el).find('script[type="math/mml"]');
    if (scriptEl.length) {
      $(el).replaceWith(wrapFormula(mathmlToLatex(scriptEl.html() ?? '')));
      return;
    }
    const dataMathml = $(el).find('[data-mathml]').attr('data-mathml');
    if (dataMathml) {
      const decoded = dataMathml.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
      $(el).replaceWith(wrapFormula(mathmlToLatex(decoded)));
    }
  });
  $('span.katex').each((_, el) => {
    const annotation = $(el).find('annotation[encoding="application/x-tex"]');
    if (annotation.length) $(el).replaceWith(wrapFormula(annotation.text().trim()));
  });

  // Passo 2: remover ruído
  $('script, style, nav, header, footer, noscript').remove();
  $('[id*="menu"], [class*="menu"], [class*="navbar"], [class*="breadcrumb"]').remove();
  $('[id*="sidebar"], [class*="sidebar"]').remove();
  $('[class*="publicidade"], [class*="banner"], [class*="ads"]').remove();
  $('[class*="botao-visualizar"], [class*="botao-compartilhar"], [class*="btn-compartilhar"]').remove();
  $('div[onmousedown]').each((_, el) => { $(el).removeAttr('onmousedown').removeAttr('onselectstart'); });
  $('input[type="checkbox"][value]').each((_, el) => {
    const val = $(el).attr('value') ?? '';
    $(el).replaceWith(/^[A-E]$/i.test(val) ? `${val.toUpperCase()}) ` : '');
  });
  $('select, form, button, input').remove();

  // Passo 3: extrair texto
  const titulo = $('h1').first().text().trim() || 'questoes';
  const main = $('div.questao-vestibular-questoes, main, article, [role="main"], body').first();
  const raw = childrenToText($, main.contents().toArray());
  const clean = raw
    .replace(/\t/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\d{1,2}\.\s*\([^)]+\)\s*/gm, '')
    .replace(/^\s*resolu[çc][aã]o\s*$/gim, '[RESOLUÇÃO]')
    .replace(/^\s*gabarito\s*$/gim, '[GABARITO]')
    .trim();

  return { clean, titulo };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {

const args = process.argv.slice(2);
let file = '';
let materia = '';
let paginas = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--materia') materia = args[++i];
  else if (args[i] === '--paginas') paginas = parseInt(args[++i], 10);
  else if (args[i] === '--url') file = args[++i];
  else if (args[i] === '--url-file') file = fs.readFileSync(args[++i], 'utf-8').trim();
  else if (!args[i].startsWith('--')) file = args[i];
}

const modoQuimica = /qu[ií]mica/i.test(materia);

async function fetchAndProcess(url: string): Promise<{ clean: string; titulo: string }> {
  baseUrl = url;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Falha ao baixar: HTTP ${res.status} — ${url}`);
  return processHtml(await res.text(), modoQuimica);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const saidaDir = resolve(scriptDir, 'trabalho', 'saida');
const data = new Date().toISOString().split('T')[0];

// Ativa extração de imagens base64 se materia é conhecida antes do fetch
if (materia) {
  imageOutputDir = resolve(saidaDir, `${materia} ${data}_imagens`);
  imageCounter = 0;
}

function finalizarSaida(outPath: string, conteudo: string) {
  fs.mkdirSync(saidaDir, { recursive: true });
  fs.writeFileSync(outPath, conteudo, 'utf-8');
  process.stderr.write(`\n✅ Arquivo gerado:\n   ${outPath}\n`);
  if (imageOutputDir && fs.existsSync(imageOutputDir)) {
    const imgs = fs.readdirSync(imageOutputDir).length;
    process.stderr.write(`🖼  ${imgs} imagem(ns) extraída(s) em:\n   ${imageOutputDir}\n`);
  }
  process.stderr.write('\n');
}

if (file.startsWith('http://') || file.startsWith('https://')) {
  // URL — suporte a múltiplas páginas via --paginas N
  if (paginas > 1 && /[?&]pagina=\d+/.test(file)) {
    const partes: string[] = [];
    let titulo = '';
    for (let p = 1; p <= paginas; p++) {
      const url = file.replace(/([?&]pagina=)\d+/, `$1${p}`);
      process.stderr.write(`  → página ${p}/${paginas}...\n`);
      const result = await fetchAndProcess(url);
      if (!titulo) {
        titulo = result.titulo;
        if (!materia) { imageOutputDir = resolve(saidaDir, `${titulo} ${data}_imagens`); imageCounter = 0; }
      }
      partes.push(result.clean);
    }
    const tituloFinal = materia || titulo;
    const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
    finalizarSaida(outPath, partes.join('\n\n') + '\n');
  } else {
    const tmpImgDir = materia ? imageOutputDir : resolve(saidaDir, `_tmp_imagens_${Date.now()}`);
    if (!materia) { imageOutputDir = tmpImgDir; imageCounter = 0; }
    const result = await fetchAndProcess(file);
    const tituloFinal = materia || result.titulo;
    const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
    if (!materia && fs.existsSync(tmpImgDir)) {
      const finalImgDir = resolve(saidaDir, `${tituloFinal} ${data}_imagens`);
      fs.renameSync(tmpImgDir, finalImgDir);
      imageOutputDir = finalImgDir;
    }
    finalizarSaida(outPath, result.clean + '\n');
  }
} else if (file) {
  const html = fs.readFileSync(file, 'utf-8');
  const result = processHtml(html, modoQuimica);
  const tituloFinal = materia || result.titulo;
  if (!materia) { imageOutputDir = resolve(saidaDir, `${tituloFinal} ${data}_imagens`); imageCounter = 0; }
  const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
  finalizarSaida(outPath, result.clean + '\n');
} else {
  // Modo interativo — pergunta URL/arquivo e número de páginas
  const readline = await import('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  process.stderr.write('\n🔧 clean-html — modo interativo\n');
  const entrada = (await ask('URL ou caminho do arquivo HTML: ')).trim();
  const materiaPergunta = (await ask('Matéria/prefixo do arquivo (Enter para usar o título da página): ')).trim();
  if (materiaPergunta) materia = materiaPergunta;

  let paginasPergunta = 1;
  if ((entrada.startsWith('http://') || entrada.startsWith('https://')) && /[?&]pagina=\d+/.test(entrada)) {
    const pStr = (await ask('Quantas páginas tem a prova? [1]: ')).trim();
    paginasPergunta = pStr ? parseInt(pStr, 10) : 1;
  }
  rl.close();

  file = entrada;
  paginas = paginasPergunta;

  if (materia) {
    imageOutputDir = resolve(saidaDir, `${materia} ${data}_imagens`);
    imageCounter = 0;
  }

  if (file.startsWith('http://') || file.startsWith('https://')) {
    if (paginas > 1 && /[?&]pagina=\d+/.test(file)) {
      const partes: string[] = [];
      let titulo = '';
      for (let p = 1; p <= paginas; p++) {
        const url = file.replace(/([?&]pagina=)\d+/, `$1${p}`);
        process.stderr.write(`  → página ${p}/${paginas}...\n`);
        const result = await fetchAndProcess(url);
        if (!titulo) {
          titulo = result.titulo;
          if (!materia) { imageOutputDir = resolve(saidaDir, `${titulo} ${data}_imagens`); imageCounter = 0; }
        }
        partes.push(result.clean);
      }
      const tituloFinal = materia || titulo;
      const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
      finalizarSaida(outPath, partes.join('\n\n') + '\n');
    } else {
      const tmpImgDir = materia ? imageOutputDir : resolve(saidaDir, `_tmp_imagens_${Date.now()}`);
      if (!materia) { imageOutputDir = tmpImgDir; imageCounter = 0; }
      const result = await fetchAndProcess(file);
      const tituloFinal = materia || result.titulo;
      const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
      if (!materia && fs.existsSync(tmpImgDir as string)) {
        const finalImgDir = resolve(saidaDir, `${tituloFinal} ${data}_imagens`);
        fs.renameSync(tmpImgDir as string, finalImgDir);
        imageOutputDir = finalImgDir;
      }
      finalizarSaida(outPath, result.clean + '\n');
    }
  } else {
    const html = fs.readFileSync(file, 'utf-8');
    const result = processHtml(html, modoQuimica);
    const tituloFinal = materia || result.titulo;
    if (!materia) { imageOutputDir = resolve(saidaDir, `${tituloFinal} ${data}_imagens`); imageCounter = 0; }
    const outPath = `${saidaDir}/${tituloFinal} ${data}.txt`;
    finalizarSaida(outPath, result.clean + '\n');
  }
}

})();
