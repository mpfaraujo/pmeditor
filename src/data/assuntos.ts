import areasJson from "./matematica_areas.json";

export type AreasMap = Record<string, { subareas: string[] }>;
export const AREAS_MAP: AreasMap = areasJson as AreasMap;

// Mapa: variante suja do banco → nome canônico (subárea ou área)
// Valor "" = lixo, será filtrado
// Chaves DEVEM ser lowercase (a busca é case-insensitive)
const ASSUNTO_ALIASES: Record<string, string> = {
  // Lixo — filtrado
  "teste": "",
  "treste": "",

  // Variantes de escrita → subárea canônica
  "funções afins": "Função Afim",
  "funções quadráticas": "Função Quadrática",
  "eometria plana": "Geometria Plana",
  "combinatoria": "Análise Combinatória",
  "proporcionalidade": "Razões e Proporções",
  "proporção": "Razões e Proporções",

  // Nomes informais → subárea do JSON de áreas
  "pa": "Progressão Aritmética",
  "pg": "Progressão Geométrica",
  "pitágoras": "Teorema de Pitágoras",
  "logaritmo": "Função Logarítmica",
  "equação exponencial": "Equações Exponenciais",
  "integral definida": "Integrais",
  "inequação do 2o grau": "Inequação do Segundo Grau",
  "frações": "Expressões e Frações Algébricas",
  "números inteiros": "Conjuntos Numéricos",
  "números": "Conjuntos Numéricos",
  "operações": "Problemas sobre as 4 Operações",
  "grandezas e medidas": "Grandezas Proporcionais",
  "sequências": "Progressão Aritmética",
  "álgebra linear": "Sistemas Lineares",
};

// Mapa lowercase → grafia canônica de todos os nomes conhecidos (áreas + subáreas)
// Ex: "geometria plana" → "Geometria Plana", "análise combinatória" → "Análise Combinatória"
const CANONICAL_NAMES: Record<string, string> = {};
for (const [area, { subareas }] of Object.entries(AREAS_MAP)) {
  CANONICAL_NAMES[area.toLowerCase()] = area;
  for (const s of subareas) {
    CANONICAL_NAMES[s.toLowerCase()] = s;
  }
}

/**
 * Normaliza um assunto:
 * 1. Tenta alias explícito (case-insensitive)
 * 2. Tenta casar com nome conhecido (área/subárea) case-insensitive
 * 3. Se nada bater, retorna como veio (trimmed)
 */
export function normalizeAssunto(raw: string): string {
  const trimmed = stripQuotes(raw.trim());
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  // Alias explícito
  const alias = ASSUNTO_ALIASES[lower];
  if (alias !== undefined) return alias; // "" = lixo, string = canônico

  // Nome conhecido com grafia diferente (ex: "geometria plana" → "Geometria Plana")
  const canonical = CANONICAL_NAMES[lower];
  if (canonical) return canonical;

  // Desconhecido — retorna como está
  return trimmed;
}

// ======================== Disciplinas ========================

// Disciplinas conhecidas (chave lowercase → canônico)
const DISCIPLINAS_CANONICAS: Record<string, string> = {
  "matemática": "Matemática",
  "física": "Física",
  "química": "Química",
  "biologia": "Biologia",
  "português": "Português",
  "história": "História",
  "geografia": "Geografia",
  "filosofia": "Filosofia",
  "sociologia": "Sociologia",
  "inglês": "Inglês",
  "espanhol": "Espanhol",
  "educação física": "Educação Física",
  "artes": "Artes",
  "ciências": "Ciências",
  "redação": "Redação",
  "literatura": "Literatura",
  "informática": "Informática",
};

// Aliases explícitos de disciplinas sujas (chave lowercase → canônico ou "" pra lixo)
const DISCIPLINA_ALIASES: Record<string, string> = {
  "matemáticas": "Matemática",
  "matemáticafunções afins": "Matemática",
  "testetes": "",
};

/**
 * Limpa aspas e apóstrofos das pontas.
 */
function stripQuotes(s: string): string {
  return s.replace(/^["']+|["']+$/g, "").trim();
}

/**
 * Normaliza uma disciplina:
 * 1. Alias explícito (case-insensitive)
 * 2. Nome canônico conhecido (case-insensitive)
 * 3. Se nada bater, retorna como veio
 */
export function normalizeDisciplina(raw: string): string {
  const trimmed = stripQuotes(raw.trim());
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  const alias = DISCIPLINA_ALIASES[lower];
  if (alias !== undefined) return alias;

  const canonical = DISCIPLINAS_CANONICAS[lower];
  if (canonical) return canonical;

  return trimmed;
}

// ======================== Assuntos (autocomplete) ========================

// Todas as subáreas do JSON + nomes de áreas, para autocomplete
export const ASSUNTOS_CANONICOS: string[] = (() => {
  const set = new Set<string>();
  for (const [area, { subareas }] of Object.entries(AREAS_MAP)) {
    set.add(area);
    for (const s of subareas) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
})();

/**
 * Dado uma lista de assuntos (já normalizados), agrupa por área.
 * Reconhece tanto nomes de subáreas quanto nomes de áreas.
 * Assuntos que não pertencem a nenhuma área vão para "Outros".
 */
export function groupAssuntosByArea(assuntos: string[]): { area: string; assuntos: string[] }[] {
  const assuntoSet = new Set(assuntos);
  const used = new Set<string>();
  const groups: { area: string; assuntos: string[] }[] = [];

  for (const [area, { subareas }] of Object.entries(AREAS_MAP)) {
    const matched: string[] = [];

    // Se o próprio nome da área aparece como assunto
    if (assuntoSet.has(area)) {
      matched.push(area);
    }

    // Subáreas que existem na lista
    for (const s of subareas) {
      if (assuntoSet.has(s)) {
        matched.push(s);
      }
    }

    if (matched.length > 0) {
      groups.push({ area, assuntos: matched });
      matched.forEach((s) => used.add(s));
    }
  }

  // Assuntos que não bateram com nenhuma subárea/área conhecida
  const remaining = assuntos.filter((s) => !used.has(s));
  if (remaining.length > 0) {
    groups.push({ area: "Outros", assuntos: remaining.sort() });
  }

  return groups;
}
