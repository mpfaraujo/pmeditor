import areasJson from "./matematica_areas.json";
import disciplinasJson from "./disciplinas_areas.json";

export type AreasMap = Record<string, { subareas: string[] }>;

// Mapa de áreas exclusivo da Matemática (retrocompatibilidade)
export const AREAS_MAP: AreasMap = areasJson as AreasMap;

// Mapa completo: disciplina → AreasMap
// Chaves em lowercase para lookup case-insensitive
const DISCIPLINAS_AREAS_MAP: Record<string, AreasMap> = {
  "matemática":       AREAS_MAP,
  "matematica":       AREAS_MAP,
  ...(Object.fromEntries(
    Object.entries(disciplinasJson as Record<string, AreasMap>).flatMap(([disc, areas]) => [
      [disc.toLowerCase(), areas],
      // aliases para nomes alternativos
    ])
  ) as Record<string, AreasMap>),
  // aliases adicionais
  "português":        (disciplinasJson as any)["Língua Portuguesa"],
  "portugues":        (disciplinasJson as any)["Língua Portuguesa"],
  "lingua portuguesa":(disciplinasJson as any)["Língua Portuguesa"],
  "inglês":           (disciplinasJson as any)["Língua Inglesa"],
  "ingles":           (disciplinasJson as any)["Língua Inglesa"],
  "lingua inglesa":   (disciplinasJson as any)["Língua Inglesa"],
  "espanhol":         (disciplinasJson as any)["Língua Espanhola"],
  "lingua espanhola": (disciplinasJson as any)["Língua Espanhola"],
  "francês":          (disciplinasJson as any)["Língua Francesa"],
  "frances":          (disciplinasJson as any)["Língua Francesa"],
  "lingua francesa":  (disciplinasJson as any)["Língua Francesa"],
  "artes":            (disciplinasJson as any)["Arte"],
  "arte":             (disciplinasJson as any)["Arte"],
  "educação física":  (disciplinasJson as any)["Educação Física"],
  "educacao fisica":  (disciplinasJson as any)["Educação Física"],
  "ed. física":       (disciplinasJson as any)["Educação Física"],
  "biologia":         (disciplinasJson as any)["Biologia"],
  "física":           (disciplinasJson as any)["Física"],
  "fisica":           (disciplinasJson as any)["Física"],
  "química":          (disciplinasJson as any)["Química"],
  "quimica":          (disciplinasJson as any)["Química"],
  "história":         (disciplinasJson as any)["História"],
  "historia":         (disciplinasJson as any)["História"],
  "geografia":        (disciplinasJson as any)["Geografia"],
  "filosofia":        (disciplinasJson as any)["Filosofia"],
  "sociologia":       (disciplinasJson as any)["Sociologia"],
};

/**
 * Retorna o AreasMap para uma disciplina específica.
 * Se a disciplina não tiver mapa, retorna null.
 */
export function getAreasMapPorDisciplina(disciplina?: string | null): AreasMap | null {
  if (!disciplina || disciplina.trim() === "") return null;
  const key = disciplina.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // sem acento para fallback
  // Tenta com acento primeiro
  const comAcento = disciplina.trim().toLowerCase();
  return DISCIPLINAS_AREAS_MAP[comAcento]
    ?? DISCIPLINAS_AREAS_MAP[key]
    ?? null;
}

/**
 * Retorna a lista de assuntos canônicos para uma disciplina.
 * Se disciplina não informada ou desconhecida, retorna TODOS os assuntos.
 */
export function getAssuntosPorDisciplina(disciplina?: string | null): string[] {
  const map = getAreasMapPorDisciplina(disciplina);
  if (!map) return ASSUNTOS_CANONICOS; // fallback: todos
  const set = new Set<string>();
  for (const [area, { subareas }] of Object.entries(map)) {
    set.add(area);
    for (const s of subareas) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Mapa: variante suja do banco → nome canônico (subárea ou área)
// Valor "" = lixo, será filtrado
// Chaves DEVEM ser lowercase (a busca é case-insensitive)
const ASSUNTO_ALIASES: Record<string, string> = {
  // ── Lixo ──────────────────────────────────────────────────────────────────
  "teste": "",
  "treste": "",

  // ── Aritmética ────────────────────────────────────────────────────────────
  "divisores": "Múltiplos e Divisores",
  "múltiplos": "Múltiplos e Divisores",
  "divisores e múltiplos": "Múltiplos e Divisores",
  "divisibilidade e múltiplos": "Múltiplos e Divisores",
  "mmc": "MMC e MDC",
  "mdc": "MMC e MDC",
  "mmc e mdc": "MMC e MDC",
  "razão": "Razões e Proporções",
  "proporção": "Razões e Proporções",
  "proporcionalidade": "Razões e Proporções",
  "razão e proporção": "Razões e Proporções",
  "regra de três simples": "Regra de Três",
  "regra de três composta": "Regra de Três",
  "regra de 3": "Regra de Três",
  "potências": "Potenciação",
  "potência": "Potenciação",
  "raízes": "Radiciação",
  "raiz quadrada": "Radiciação",
  "radiciação e potenciação": "Radiciação",
  "pa": "Progressão Aritmética",
  "pg": "Progressão Geométrica",
  "progressões": "Progressão Aritmética",
  "sequências": "Progressão Aritmética",
  "sequências numéricas": "Progressão Aritmética",
  "média aritmética": "Médias",
  "média ponderada": "Médias",
  "médias aritméticas": "Médias",
  "grandezas e medidas": "Grandezas Proporcionais",
  "grandezas inversamente proporcionais": "Grandezas Proporcionais",
  "juros": "Juros Simples",
  "juros e descontos": "Juros Simples",
  "sistema métrico": "Sistema de Numeração e Métrico Decimal",
  "notação científica": "Notação Científica",
  "frações": "Expressões e Frações Algébricas",
  "frações e decimais": "Expressões e Frações Algébricas",
  "operações": "Problemas sobre as 4 Operações",

  // ── Conjuntos Numéricos ───────────────────────────────────────────────────
  "números": "Conjuntos Numéricos",
  "números inteiros": "Conjuntos Numéricos",
  "números naturais": "Conjuntos Numéricos",
  "números racionais": "Conjuntos Numéricos",
  "números reais": "Conjuntos Numéricos",
  "teoria dos números": "Conjuntos Numéricos",
  "conjuntos numéricos": "Conjuntos Numéricos",

  // ── Álgebra ───────────────────────────────────────────────────────────────
  "equações": "Equação do Primeiro Grau",
  "equação linear": "Equação do Primeiro Grau",
  "equação de 1o grau": "Equação do Primeiro Grau",
  "equação de 1º grau": "Equação do Primeiro Grau",
  "equações do 1º grau": "Equação do Primeiro Grau",
  "equações de 1o grau": "Equação do Primeiro Grau",
  "equação de 2o grau": "Equação do Segundo Grau",
  "equação de 2º grau": "Equação do Segundo Grau",
  "equações do 2º grau": "Equação do Segundo Grau",
  "equação quadrática": "Equação do Segundo Grau",
  "equações quadráticas": "Equação do Segundo Grau",
  "equação exponencial": "Equações Exponenciais",
  "inequações": "Inequação do Primeiro Grau",
  "inequação linear": "Inequação do Primeiro Grau",
  "inequação do 2o grau": "Inequação do Segundo Grau",
  "inequações modulares": "Inequações Modulares",
  "sistemas de equações": "Sistemas Lineares",
  "sistema linear": "Sistemas Lineares",
  "sistemas": "Sistemas Lineares",
  "álgebra linear": "Sistemas Lineares",
  "fatoração": "Fatoração e Produtos Notáveis",
  "produtos notáveis": "Fatoração e Produtos Notáveis",
  "fatoração algébrica": "Fatoração e Produtos Notáveis",
  "módulo": "Equações Modulares",
  "valor absoluto": "Equações Modulares",
  "integral definida": "Integrais",

  // ── Funções ───────────────────────────────────────────────────────────────
  "função": "Funções",
  "funções afins": "Função Afim",
  "função linear": "Função Afim",
  "função do 1o grau": "Função Afim",
  "função do 1º grau": "Função Afim",
  "funções quadráticas": "Função Quadrática",
  "função do 2o grau": "Função Quadrática",
  "função do 2º grau": "Função Quadrática",
  "parábola (função)": "Função Quadrática",
  "exponencial": "Função Exponencial",
  "função exponencial e logarítmica": "Função Exponencial",
  "logaritmo": "Função Logarítmica",
  "logaritmos": "Função Logarítmica",
  "funções logarítmicas": "Função Logarítmica",
  "função trigonométrica": "Funções Trigonométricas",
  "função racional": "Funções",
  "composição de funções": "Função Composta",
  "funções e composição": "Função Composta",
  "domínio e imagem": "Domínio, Imagem e Contradomínio",
  "domínio e contradomínio": "Domínio, Imagem e Contradomínio",
  "domínio": "Domínio, Imagem e Contradomínio",
  "imagem de funções": "Domínio, Imagem e Contradomínio",
  "gráficos": "Gráficos e Transformações",
  "gráficos de funções": "Gráficos e Transformações",
  "transformações de gráficos": "Gráficos e Transformações",
  "interpretação de gráficos": "Tabelas e Gráficos Estatísticos",
  "eometria plana": "Geometria Plana",

  // ── Análise Combinatória ──────────────────────────────────────────────────
  "combinatoria": "Análise Combinatória",
  "combinatória": "Análise Combinatória",
  "combinação": "Combinações",
  "permutação": "Permutações Simples",
  "arranjo": "Arranjos",
  "contagem": "Princípio Fundamental da Contagem",
  "princípio da contagem": "Princípio Fundamental da Contagem",
  "princípio multiplicativo": "Princípio Fundamental da Contagem",
  "binômio": "Binômio de Newton",

  // ── Estatística ───────────────────────────────────────────────────────────
  "tabelas e gráficos": "Tabelas e Gráficos Estatísticos",
  "gráficos estatísticos": "Tabelas e Gráficos Estatísticos",
  "moda": "Medidas de Tendência Central",
  "mediana": "Medidas de Tendência Central",
  "média, moda e mediana": "Medidas de Tendência Central",
  "medidas estatísticas": "Medidas de Tendência Central",
  "desvio padrão": "Medidas de Dispersão",
  "variância": "Medidas de Dispersão",
  "frequência": "Distribuição de Frequências",
  "quartil": "Medidas de Posição",
  "percentil": "Medidas de Posição",

  // ── Probabilidade ─────────────────────────────────────────────────────────
  "espaço amostral": "Espaço Amostral e Eventos",
  "binomial": "Distribuição Binomial",

  // ── Geometria Plana ───────────────────────────────────────────────────────
  "geometria": "Geometria Plana",
  "geometria plana e otimização": "Geometria Plana",
  "semelhança": "Semelhança de Triângulos",
  "congruência": "Congruência de Triângulos",
  "pitágoras": "Teorema de Pitágoras",
  "tales": "Teorema de Tales",
  "área": "Área das Figuras Planas",
  "áreas e perímetros": "Área das Figuras Planas",
  "perímetro": "Área das Figuras Planas",
  "círculo": "Circunferência e Círculo",

  // ── Geometria Espacial ────────────────────────────────────────────────────
  "volume": "Geometria Espacial",
  "volumes": "Geometria Espacial",
  "sólidos geométricos": "Geometria Espacial",
  "geometria espacial e volume": "Geometria Espacial",
  "prisma": "Prismas",
  "pirâmide": "Pirâmides",
  "cilindro": "Cilindros",
  "cone": "Cones",

  // ── Trigonometria ─────────────────────────────────────────────────────────
  "trigonometria espacial": "Trigonometria",
  "seno e cosseno": "Razões Trigonométricas no Triângulo Retângulo",
  "seno, cosseno e tangente": "Razões Trigonométricas no Triângulo Retângulo",
  "razões trigonométricas": "Razões Trigonométricas no Triângulo Retângulo",
  "arcos": "Arcos e Medidas de Arcos",
  "radianos": "Arcos e Medidas de Arcos",

  // ── Lógica Matemática ─────────────────────────────────────────────────────
  "lógica": "Lógica Matemática",
  "lógica proposicional": "Proposições e Conectivos",
  "proposições": "Proposições e Conectivos",
  "conectivos lógicos": "Proposições e Conectivos",
  "tabela verdade": "Tabela-Verdade",
  "diagramas de venn": "Diagramas Lógicos",
  "raciocínio lógico": "Lógica Matemática",

  // ── Análise Matemática ────────────────────────────────────────────────────
  "cálculo": "Análise Matemática",
  "derivada": "Derivadas",
  "otimização": "Análise Matemática",
  "máximos e mínimos": "Derivadas",
  "taxa de variação": "Derivadas",
  "integral": "Integrais",
};

// Mapa lowercase → grafia canônica de todos os nomes conhecidos (áreas + subáreas)
// Inclui Matemática (AREAS_MAP) + todas as outras disciplinas (disciplinasJson)
const CANONICAL_NAMES: Record<string, string> = {};

// Matemática
for (const [area, { subareas }] of Object.entries(AREAS_MAP)) {
  CANONICAL_NAMES[area.toLowerCase()] = area;
  for (const s of subareas) {
    CANONICAL_NAMES[s.toLowerCase()] = s;
  }
}

// Todas as outras disciplinas
for (const areasMap of Object.values(disciplinasJson as Record<string, AreasMap>)) {
  for (const [area, { subareas }] of Object.entries(areasMap)) {
    CANONICAL_NAMES[area.toLowerCase()] = area;
    for (const s of subareas) {
      CANONICAL_NAMES[s.toLowerCase()] = s;
    }
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

  // Remove parêntesis e tenta de novo: "Otimização (Mínimos)" → "Otimização"
  const semParen = trimmed.replace(/\s*\([^)]*\)/g, "").trim();
  if (semParen && semParen !== trimmed) {
    const r = normalizeAssunto(semParen);
    if (r) return r;
  }

  // Valor composto com separadores — tenta cada parte individualmente
  // Separadores: vírgula, " / ", " e "
  if (/,| \/ | e /.test(trimmed)) {
    for (const part of trimmed.split(/,| \/ | e /)) {
      const p = stripQuotes(part.trim());
      if (!p) continue;
      const pLower = p.toLowerCase();
      const partAlias = ASSUNTO_ALIASES[pLower];
      if (partAlias !== undefined && partAlias !== "") return partAlias;
      const partCanonical = CANONICAL_NAMES[pLower];
      if (partCanonical) return partCanonical;
    }
  }

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
 *
 * @param assuntos  Lista de assuntos a agrupar
 * @param disciplina  Disciplina opcional para usar o mapa correto
 */
export function groupAssuntosByArea(
  assuntos: string[],
  disciplina?: string | null
): { area: string; assuntos: string[] }[] {
  // Usa o mapa da disciplina se disponível; senão combina todos os mapas conhecidos
  const specificMap = getAreasMapPorDisciplina(disciplina);
  const allMaps: AreasMap[] = specificMap
    ? [specificMap]
    : [
        AREAS_MAP,
        ...Object.values(disciplinasJson as Record<string, AreasMap>),
      ];

  const assuntoSet = new Set(assuntos);
  const used = new Set<string>();
  const groups: { area: string; assuntos: string[] }[] = [];

  for (const map of allMaps) {
    for (const [area, { subareas }] of Object.entries(map)) {
      if (used.has(area)) continue; // já processada por outro mapa

      const matched: string[] = [];

      if (assuntoSet.has(area)) matched.push(area);
      for (const s of subareas) {
        if (assuntoSet.has(s)) matched.push(s);
      }

      if (matched.length > 0) {
        groups.push({ area, assuntos: matched });
        matched.forEach((s) => used.add(s));
        used.add(area);
      }
    }
  }

  // Assuntos que não bateram com nenhuma área conhecida
  const remaining = assuntos.filter((s) => !used.has(s));
  if (remaining.length > 0) {
    groups.push({ area: "Outros", assuntos: remaining.sort() });
  }

  return groups;
}
