import type { ReactNode } from "react";

export type InsertCtx = {
  value: string;
  setValue: (v: string) => void;
  textarea: HTMLTextAreaElement | null;
};

export type MathItem = {
  id: string;
  icon?: ReactNode;
  iconLatex?: string;
  tooltip?: string;
  insert: (ctx: InsertCtx) => void;
};

export type MathGroup = {
  id: string;
  label: string;
  items: MathItem[];
};

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  value: string,
  latex: string,
  setValue: (v: string) => void
) {
  if (!textarea) {
    setValue(value + latex);
    return;
  }

  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const next = value.slice(0, start) + latex + value.slice(end);

  setValue(next);

  requestAnimationFrame(() => {
    textarea.focus();
    const pos = start + latex.length;
    textarea.setSelectionRange(pos, pos);
  });
}

export const mathPalette: MathGroup[] = [
  {
    id: "basic",
    label: "Bás.",
    items: [
      { id: "+", icon: "+", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "+", ctx.setValue) },
      { id: "-", icon: "−", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "-", ctx.setValue) },
      { id: "*", icon: "×", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\times ", ctx.setValue) },
      { id: "cdot", icon: "·", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\cdot ", ctx.setValue) },
      { id: "div", icon: "÷", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\div ", ctx.setValue) },
      { id: "pm", iconLatex: "\\pm", tooltip: "Mais ou menos", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\pm ", ctx.setValue) },
      { id: "mp", iconLatex: "\\mp", tooltip: "Menos ou mais", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mp ", ctx.setValue) },
      { id: "frac", iconLatex: "\\frac{a}{b}", tooltip: "Fração", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\frac{a}{b}", ctx.setValue) },
      { id: "sqrt", iconLatex: "\\sqrt{x}", tooltip: "Raiz", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sqrt{x}", ctx.setValue) },
      { id: "nroot", iconLatex: "\\sqrt[n]{x}", tooltip: "Raiz n", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sqrt[n]{x}", ctx.setValue) },
      { id: "pow", iconLatex: "x^{n}", tooltip: "Potência", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "x^{n}", ctx.setValue) },
      { id: "sub", iconLatex: "x_{n}", tooltip: "Índice", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "x_{n}", ctx.setValue) },
      { id: "powSub", iconLatex: "x_{k}^{n}", tooltip: "Potência + índice", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "x_{k}^{n}", ctx.setValue) },
      { id: "fact", iconLatex: "n!", tooltip: "Fatorial", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "n!", ctx.setValue) },
      { id: "comb", iconLatex: "\\binom{n}{p}", tooltip: "Combinação", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\binom{n}{p}", ctx.setValue) },
      { id: "arr", iconLatex: "A_{n}^{p}", tooltip: "Arranjo", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "A_{n}^{p}", ctx.setValue) },
    ],
  },
  {
    id: "rel",
    label: "Rel.",
    items: [
      { id: "=", icon: "=", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "=", ctx.setValue) },
      { id: "<", icon: "<", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "<", ctx.setValue) },
      { id: ">", icon: ">", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, ">", ctx.setValue) },
      { id: "leq", iconLatex: "\\leq", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\leq ", ctx.setValue) },
      { id: "geq", iconLatex: "\\geq", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\geq ", ctx.setValue) },
      { id: "neq", iconLatex: "\\neq", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\neq ", ctx.setValue) },
      { id: "approx", iconLatex: "\\approx", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\approx ", ctx.setValue) },
      { id: "sim", iconLatex: "\\sim", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sim ", ctx.setValue) },
      { id: "prop", iconLatex: "\\propto", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\propto ", ctx.setValue) },
      { id: "to", iconLatex: "\\to", tooltip: "Seta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\to ", ctx.setValue) },
      { id: "leftarrow", iconLatex: "\\leftarrow", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\leftarrow ", ctx.setValue) },
      { id: "leftrightarrow", iconLatex: "\\leftrightarrow", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\leftrightarrow ", ctx.setValue) },
      { id: "Rightarrow", iconLatex: "\\Rightarrow", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\Rightarrow ", ctx.setValue) },
      { id: "mapsto", iconLatex: "\\mapsto", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mapsto ", ctx.setValue) },
    ],
  },
  {
    id: "sets",
    label: "Conj.",
    items: [
      { id: "N", iconLatex: "\\mathbb{N}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{N}", ctx.setValue) },
      { id: "Z", iconLatex: "\\mathbb{Z}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{Z}", ctx.setValue) },
      { id: "Q", iconLatex: "\\mathbb{Q}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{Q}", ctx.setValue) },
      { id: "R", iconLatex: "\\mathbb{R}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{R}", ctx.setValue) },
      { id: "C", iconLatex: "\\mathbb{C}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{C}", ctx.setValue) },
      { id: "in", iconLatex: "\\in", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\in ", ctx.setValue) },
      { id: "notin", iconLatex: "\\notin", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\notin ", ctx.setValue) },
      { id: "subset", iconLatex: "\\subset", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\subset ", ctx.setValue) },
      { id: "subseteq", iconLatex: "\\subseteq", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\subseteq ", ctx.setValue) },
      { id: "cup", iconLatex: "\\cup", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\cup ", ctx.setValue) },
      { id: "cap", iconLatex: "\\cap", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\cap ", ctx.setValue) },
      { id: "forall", iconLatex: "\\forall", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\forall ", ctx.setValue) },
      { id: "exists", iconLatex: "\\exists", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\exists ", ctx.setValue) },
      { id: "empty", iconLatex: "\\varnothing", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\varnothing ", ctx.setValue) },
    ],
  },
  {
    id: "func",
    label: "Func.",
    items: [
      { id: "fx", icon: "f(x)", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "f(x)", ctx.setValue) },
      { id: "map", icon: "A→B", tooltip: "Aplicação", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "f: A \\to B", ctx.setValue) },
      {
        id: "cases",
        icon: "{⋮}",
        tooltip: "Função por partes",
        insert: (ctx) =>
          insertAtCursor(
            ctx.textarea,
            ctx.value,
            "f(x)=\\begin{cases}\n a, & \\text{se } x>0 \\\\\n b, & \\text{se } x\\le 0\n\\end{cases}",
            ctx.setValue
          ),
      },
      { id: "inv", icon: "f⁻¹", tooltip: "Inversa", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "f^{-1}", ctx.setValue) },
      { id: "comp", icon: "∘", tooltip: "Composição", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "f\\circ g", ctx.setValue) },
      { id: "ln", icon: "ln", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ln x", ctx.setValue) },
      { id: "log", icon: "log", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\log_{n} x", ctx.setValue) },
      { id: "sin", icon: "sin", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sin x", ctx.setValue) },
      { id: "cos", icon: "cos", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\cos x", ctx.setValue) },
      { id: "tan", icon: "tan", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\tan x", ctx.setValue) },
    ],
  },
  {
    id: "delim",
    label: "Delim.",
    items: [
      { id: "()", iconLatex: "\\left(\\square\\right)", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "( )", ctx.setValue) },
      { id: "[]", iconLatex: "\\left[\\square\\right]", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "[ ]", ctx.setValue) },
      { id: "{}", iconLatex: "\\left\\{\\square\\right\\}", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\{ \\}", ctx.setValue) },
      { id: "left()", iconLatex: "\\left(\\;\\right)", tooltip: "Parênteses ajustáveis", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\left( \\right)", ctx.setValue) },
      { id: "abs", iconLatex: "\\left|x\\right|", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\lvert x \\rvert", ctx.setValue) },
      { id: "norm", iconLatex: "\\left\\lVert x\\right\\rVert", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\lVert x \\rVert", ctx.setValue) },
      { id: "int1", iconLatex: "\\left[a,b\\right]", tooltip: "[a,b]", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "[a,b]", ctx.setValue) },
      { id: "int2", iconLatex: "\\left[a,b\\right)", tooltip: "[a,b)", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "[a,b)", ctx.setValue) },
      { id: "int3", iconLatex: "\\left(a,b\\right]", tooltip: "(a,b]", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "(a,b]", ctx.setValue) },
      { id: "int4", iconLatex: "\\left(a,b\\right)", tooltip: "(a,b)", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "(a,b)", ctx.setValue) },
    ],
  },
  {
    id: "geo",
    label: "Geo.",
    items: [
      { id: "angle", iconLatex: "\\angle", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\angle", ctx.setValue) },
      { id: "measured", iconLatex: "\\measuredangle", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\measuredangle", ctx.setValue) },
      { id: "triangle", iconLatex: "\\triangle", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\triangle", ctx.setValue) },
      { id: "parallel", iconLatex: "\\parallel", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\parallel", ctx.setValue) },
      { id: "perp", iconLatex: "\\perp", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\perp", ctx.setValue) },
      { id: "vec", iconLatex: "\\vec{v}", tooltip: "Vetor", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\vec{v}", ctx.setValue) },
      { id: "overline", iconLatex: "\\overline{AB}", tooltip: "Segmento", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\overline{AB}", ctx.setValue) },
      { id: "widehat", iconLatex: "\\widehat{ABC}", tooltip: "Ângulo/Arco", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\widehat{ABC}", ctx.setValue) },
    ],
  },
  {
    id: "mat",
    label: "Mat.",
    items: [
      {
        id: "matrix",
        iconLatex: "\\left[\\begin{smallmatrix}a&b\\\\ c&d\\end{smallmatrix}\\right]",
        tooltip: "Matrizes e determinantes",
        insert: () => {
          /* handled by dropdown in toolbar */
        },
      },
      {
        id: "sys2",
        icon: "{⋮}",
        tooltip: "Sistema 2×2",
        insert: (ctx) =>
          insertAtCursor(
            ctx.textarea,
            ctx.value,
            "\\begin{cases} ax+by=c \\\\ dx+ey=f \\end{cases}",
            ctx.setValue
          ),
      },
      {
        id: "sys3",
        icon: "{⋮⋮}",
        tooltip: "Sistema 3×3",
        insert: (ctx) =>
          insertAtCursor(
            ctx.textarea,
            ctx.value,
            "\\begin{cases} ax+by+cz=d \\\\ ex+fy+gz=h \\\\ ix+jy+kz=l \\end{cases}",
            ctx.setValue
          ),
      },
    ],
  },
  {
    id: "calc",
    label: "Calc.",
    items: [
      { id: "d1", icon: "d/dx", tooltip: "Derivada", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\frac{dy}{dx}", ctx.setValue) },
      { id: "d2", icon: "f′", tooltip: "Linha", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "f'", ctx.setValue) },
      { id: "int", iconLatex: "\\int", tooltip: "Integral", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\int f(x)\\,dx", ctx.setValue) },
      { id: "intd", iconLatex: "\\int_{a}^{b}", tooltip: "Integral definida", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\int_{a}^{b} f(x)\\,dx", ctx.setValue) },
      { id: "sum", iconLatex: "\\sum", tooltip: "Somatório", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sum_{i=1}^{n}", ctx.setValue) },
      { id: "prod", iconLatex: "\\prod", tooltip: "Produtório", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\prod_{i=1}^{n}", ctx.setValue) },
      { id: "lim", icon: "lim", tooltip: "Limite", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\lim_{x \\to a}", ctx.setValue) },
      { id: "partial", icon: "∂/∂x", tooltip: "Derivada parcial", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\frac{\\partial f}{\\partial x}", ctx.setValue) },
    ],
  },
  {
    id: "greek",
    label: "Greg.",
    items: [
      { id: "alpha", iconLatex: "\\alpha", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\alpha", ctx.setValue) },
      { id: "beta", iconLatex: "\\beta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\beta", ctx.setValue) },
      { id: "gamma", iconLatex: "\\gamma", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\gamma", ctx.setValue) },
      { id: "delta", iconLatex: "\\delta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\delta", ctx.setValue) },
      { id: "epsilon", iconLatex: "\\epsilon", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\epsilon", ctx.setValue) },
      { id: "zeta", iconLatex: "\\zeta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\zeta", ctx.setValue) },
      { id: "eta", iconLatex: "\\eta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\eta", ctx.setValue) },
      { id: "theta", iconLatex: "\\theta", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\theta", ctx.setValue) },
      { id: "lambda", iconLatex: "\\lambda", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\lambda", ctx.setValue) },
      { id: "mu", iconLatex: "\\mu", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\mu", ctx.setValue) },
      { id: "pi", iconLatex: "\\pi", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\pi", ctx.setValue) },
      { id: "rho", iconLatex: "\\rho", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\rho", ctx.setValue) },
      { id: "sigma", iconLatex: "\\sigma", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\sigma", ctx.setValue) },
      { id: "phi", iconLatex: "\\phi", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\phi", ctx.setValue) },
      { id: "omega", iconLatex: "\\omega", insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\omega", ctx.setValue) },
    ],
  },
  {
    id: "chem",
    label: "Quim.",
    items: [
      {
        id: "chem-formula",
        icon: "H₂",
        tooltip: "Fórmula química",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{H2O}", ctx.setValue),
      },
      {
        id: "chem-ion",
        icon: "X⁺",
        tooltip: "Íon",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{Na+}", ctx.setValue),
      },
      {
        id: "chem-reaction",
        icon: "→",
        tooltip: "Reação",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{A + B -> C}", ctx.setValue),
      },
      {
        id: "chem-equilibrium",
        icon: "⇌",
        tooltip: "Equilíbrio",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{A <=> B}", ctx.setValue),
      },
      {
        id: "chem-state",
        icon: "(l)",
        tooltip: "Estado físico",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{H2O(l)}", ctx.setValue),
      },
      {
        id: "chem-charge",
        icon: "2−",
        tooltip: "Carga iônica",
        insert: (ctx) => insertAtCursor(ctx.textarea, ctx.value, "\\ce{SO4^2-}", ctx.setValue),
      },
    ],
  },
];
