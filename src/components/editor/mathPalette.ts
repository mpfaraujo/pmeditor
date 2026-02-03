// mathPalette.ts

export type InsertCtx = {
  value: string;
  setValue: (v: string) => void;
  textarea: HTMLTextAreaElement | null;
};

export type MathItem = {
  id: string;
  icon: string;
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

  const next =
    value.slice(0, start) + latex + value.slice(end);

  setValue(next);

  requestAnimationFrame(() => {
    textarea.focus();
    const pos = start + latex.length;
    textarea.setSelectionRange(pos, pos);
  });
}

export const mathPalette: MathGroup[] = [
  {
    id: "G1",
    label: "G1",
    items: [
      { id: "+", icon: "+", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "+", ctx.setValue) },
      { id: "-", icon: "−", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "-", ctx.setValue) },
      { id: "*", icon: "×", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\times ", ctx.setValue) },
      { id: "cdot", icon: "·", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\cdot ", ctx.setValue) },
      { id: "div", icon: "÷", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\div ", ctx.setValue) },
      { id: "=", icon: "=", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "=", ctx.setValue) },

      { id: "frac", icon: "a/b", tooltip: "Fração", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\frac{a}{b}", ctx.setValue) },
      { id: "sqrt", icon: "√", tooltip: "Raiz", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\sqrt{x}", ctx.setValue) },
      { id: "nroot", icon: "ⁿ√", tooltip: "Raiz n", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\sqrt[n]{x}", ctx.setValue) },

      { id: "pow", icon: "xⁿ", tooltip: "Potência", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "x^{n}", ctx.setValue) },
      { id: "sub", icon: "xₙ", tooltip: "Índice", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "x_{n}", ctx.setValue) },
      { id: "powSub", icon: "xⁿₖ", tooltip: "Potência + índice", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "x_{k}^{n}", ctx.setValue) },

      { id: "ln", icon: "ln", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\ln x", ctx.setValue) },
      { id: "log", icon: "logₙ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\log_{n} x", ctx.setValue) },

      { id: "fact", icon: "n!", tooltip: "Permutação", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "n!", ctx.setValue) },
      { id: "arr", icon: "A", tooltip: "Arranjo", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "A_{n}^{p}", ctx.setValue) },
      { id: "comb", icon: "C", tooltip: "Combinação", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\binom{n}{p}", ctx.setValue) },
    ],
  },

  {
    id: "G2",
    label: "G2",
    items: [
      { id: "fx", icon: "f(x)", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "f(x)", ctx.setValue) },
      { id: "map", icon: "A→B", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "f: A \\to B", ctx.setValue) },

      { id: "N", icon: "ℕ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{N}", ctx.setValue) },
      { id: "Z", icon: "ℤ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{Z}", ctx.setValue) },
      { id: "Q", icon: "ℚ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{Q}", ctx.setValue) },
      { id: "R", icon: "ℝ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{R}", ctx.setValue) },
      { id: "C", icon: "ℂ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\mathbb{C}", ctx.setValue) },

      {
        id: "cases",
        icon: "f(x)={",
        tooltip: "Função por partes",
        insert: ctx =>
          insertAtCursor(
            ctx.textarea,
            ctx.value,
            "f(x)=\\begin{cases}\n a, & \\text{se } x>0 \\\\\n b, & \\text{se } x\\le 0\n\\end{cases}",
            ctx.setValue
          ),
      },

      { id: "inv", icon: "f⁻¹", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "f^{-1}", ctx.setValue) },
      { id: "comp", icon: "∘", tooltip: "Composição", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "f\\circ g", ctx.setValue) },
    ],
  },

  {
    id: "G3",
    label: "G3",
    items: [
      { id: "()", icon: "( )", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "( )", ctx.setValue) },
      { id: "[]", icon: "[ ]", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "[ ]", ctx.setValue) },
      { id: "{}", icon: "{ }", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\{ \\}", ctx.setValue) },

      { id: "left()", icon: "⟮ ⟯", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\left( \\right)", ctx.setValue) },
      { id: "abs", icon: "| |", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\lvert x \\rvert", ctx.setValue) },
      { id: "norm", icon: "‖ ‖", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\lVert x \\rVert", ctx.setValue) },

      { id: "int1", icon: "[□]", tooltip: "[a,b]", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "[a,b]", ctx.setValue) },
      { id: "int2", icon: "[□[", tooltip: "[a,b)", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "[a,b)", ctx.setValue) },
      { id: "int3", icon: "]□]", tooltip: "(a,b]", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "(a,b]", ctx.setValue) },
      { id: "int4", icon: "]□[", tooltip: "(a,b)", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "(a,b)", ctx.setValue) },
    ],
  },

  {
    id: "G4",
    label: "G4",
    items: [
      { id: "angle", icon: "∠", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\angle", ctx.setValue) },
      { id: "measured", icon: "∡", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\measuredangle", ctx.setValue) },
      { id: "triangle", icon: "△", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\triangle", ctx.setValue) },
      { id: "parallel", icon: "∥", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\parallel", ctx.setValue) },
      { id: "perp", icon: "⟂", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\perp", ctx.setValue) },

      { id: "sin", icon: "sin", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\sin x", ctx.setValue) },
      { id: "cos", icon: "cos", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\cos x", ctx.setValue) },
      { id: "tan", icon: "tan", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\tan x", ctx.setValue) },
    ],
  },

{
  id: "G5",
  label: "G5",
  items: [
    {
      id: "matrix",
      icon: "▦",
      tooltip: "Matrizes e determinantes",
      insert: () => {
        /* handled by dropdown in toolbar */
      },
    },
  ],
},

  {
    id: "G6",
    label: "G6",
    items: [
      {
        id: "sys2",
        icon: "{⋮}",
        tooltip: "Sistema 2×2",
        insert: ctx =>
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
        insert: ctx =>
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
    id: "G7",
    label: "G7",
    items: [
      { id: "d1", icon: "dy/dx", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\frac{dy}{dx}", ctx.setValue) },
      { id: "d2", icon: "f′", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "f'", ctx.setValue) },
      { id: "int", icon: "∫", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\int f(x)\\,dx", ctx.setValue) },
      { id: "intd", icon: "∫ᵃᵇ", insert: ctx => insertAtCursor(ctx.textarea, ctx.value, "\\int_{a}^{b} f(x)\\,dx", ctx.setValue) },
    ],
  },
];
