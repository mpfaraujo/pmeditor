// toolbar-config.ts
export const SYMBOLS = {
  conjuntos: ['ℕ', 'ℤ', 'ℚ', 'ℝ', 'ℂ'],
  gregas: ['α', 'β', 'γ', 'δ', 'ε', 'π', 'θ', 'λ', 'μ', 'Σ', 'Δ', 'Ω'],
  matematica: ['±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '∫', '∂'],
  especiais: ['°', 'ª', 'º', '§', '¹', '²', '³'],
  setas: ['→', '←', '↑', '↓', '↔', '⇒', '⇔'],
} as const;

export type SymbolCategory = keyof typeof SYMBOLS;

export const SYMBOL_LABELS: Record<SymbolCategory, string> = {
  conjuntos: 'Conjuntos',
  gregas: 'Letras Gregas',
  matematica: 'Matemática',
  especiais: 'Especiais',
  setas: 'Setas',
};

export interface ToolbarGroup {
  id: string;
  label: string;
  items: ToolbarItem[];
}

export interface ToolbarItem {
  id: string;
  label: string;
  icon: string;
  action: string;
  shortcut?: string;
}

export const TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: 'file',
    label: 'Arquivo',
    items: [
      { id: 'new', label: 'Novo', icon: 'FilePlus2', action: 'new' },
      { id: 'open', label: 'Abrir', icon: 'FolderOpen', action: 'load' },
      { id: 'save', label: 'Salvar', icon: 'Save', action: 'save' },
      { id: 'recover', label: 'Recuperar', icon: 'RotateCcw', action: 'recover' },
      { id: 'info', label: 'Informações', icon: 'Info', action: 'metadata' },
    ],
  },
  {
    id: 'edit',
    label: 'Edição',
    items: [
      { id: 'undo', label: 'Desfazer', icon: 'Undo', action: 'undo', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Refazer', icon: 'Redo', action: 'redo', shortcut: 'Ctrl+Y' },
      { id: 'basetext', label: 'Texto-base', icon: 'FileText', action: 'basetext' },
    ],
  },
  {
    id: 'format',
    label: 'Formato',
    items: [
      { id: 'bold', label: 'Negrito', icon: 'Bold', action: 'mark:strong', shortcut: 'Ctrl+B' },
      { id: 'italic', label: 'Itálico', icon: 'Italic', action: 'mark:em', shortcut: 'Ctrl+I' },
      { id: 'underline', label: 'Sublinhado', icon: 'Underline', action: 'mark:underline', shortcut: 'Ctrl+U' },
      { id: 'code', label: 'Código', icon: 'Code', action: 'mark:code' },
      { id: 'superscript', label: 'Sobrescrito', icon: 'Superscript', action: 'mark:superscript' },
      { id: 'subscript', label: 'Subscrito', icon: 'Subscript', action: 'mark:subscript' },
    ],
  },
  {
    id: 'insert',
    label: 'Inserir',
    items: [
      { id: 'image', label: 'Imagem', icon: 'Image', action: 'image' },
      { id: 'math', label: 'Fórmula', icon: 'Sigma', action: 'math' },
      { id: 'codeblock', label: 'Código', icon: 'FileCode', action: 'codeblock' },
      { id: 'symbols', label: 'Símbolos', icon: 'Omega', action: 'symbols' },
    ],
  },
  {
    id: 'options',
    label: 'Opções',
    items: [
      { id: 'four-opts', label: '4 opções', icon: 'CheckSquare', action: 'toggle-options' },
    ],
  },
];