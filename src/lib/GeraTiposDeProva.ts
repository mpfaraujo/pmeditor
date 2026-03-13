// src/lib/GeraTiposDeProva.ts

import seedrandom from 'seedrandom';
import { Node as PMNode, Fragment } from 'prosemirror-model';
import { schema } from '@/components/editor/schema';

export type Alt = "A" | "B" | "C" | "D" | "E" | "C/E";

export type OptionPermutation = {
  [originalLetter: string]: string; // A→C, B→A, C→E, D→B, E→D
};

export type QuestionPermutation = {
  questionId: string;
  permutation: OptionPermutation;
};

export type ProvaTypeConfig = {
  tipoNumber: number;         // 1, 2, 3, 4...
  permutations: QuestionPermutation[];  // Uma permutação por questão MCQ
};

/**
 * Fisher-Yates shuffle com seed determinístico (aceita string para evitar colisões aritméticas)
 */
function shuffleArray<T>(array: T[], seed: string): T[] {
  const rng = seedrandom(seed);
  const arr = [...array]; // clone
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Hash simples de string para número (seed único por questão)
 */
export function hashQuestionId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Verifica se a questão é de Múltipla Escolha
 */
function isMCQ(q: any): boolean {
  const tipo = q.metadata?.tipo;
  if (!tipo) return false;

  // Normalizar para comparação (remove acentos e case-insensitive)
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalizar(tipo) === normalizar("Múltipla Escolha");
}

/**
 * Extrai o número de opções de uma questão MCQ
 */
function getNumOpcoes(q: any): number {
  try {
    // Parsear content ProseMirror
    const contentNode = PMNode.fromJSON(schema, q.content);

    // Buscar node 'question' > 'options'
    let numOpcoes: number | null = null;

    contentNode.descendants((node) => {
      if (node.type.name === 'options' && node.content) {
        numOpcoes = node.content.childCount;
        return false; // parar busca
      }
    });

    // Se não encontrou via ProseMirror, tenta contar diretamente no JSON
    if (numOpcoes === null) {
      const findOptions = (node: any): number | null => {
        if (node?.type === 'options' && Array.isArray(node.content)) return node.content.length;
        if (Array.isArray(node?.content)) {
          for (const child of node.content) {
            const r = findOptions(child);
            if (r !== null) return r;
          }
        }
        return null;
      };
      numOpcoes = findOptions(q.content) ?? 4;
    }

    // Se retornou 5 mas alguma opção está vazia (bug de importação anterior).
    // Usa textContent.trim() + presença de math/imagem para detectar opções reais,
    // pois content.size > 2 falha quando a opção tem só whitespace (size=3 mas visualmente vazia).
    if (numOpcoes === 5) {
      contentNode.descendants((node) => {
        if (node.type.name === 'options') {
          let nonEmpty = 0;
          for (let i = 0; i < node.childCount; i++) {
            const opt = node.child(i);
            const hasText = opt.textContent.trim().length > 0;
            let hasMathOrImage = false;
            opt.descendants((n) => {
              if (n.type.name === 'math_inline' || n.type.name === 'math_block' || n.type.name === 'image') {
                hasMathOrImage = true;
              }
            });
            if (hasText || hasMathOrImage) nonEmpty++;
          }
          if (nonEmpty >= 2 && nonEmpty < 5) numOpcoes = nonEmpty;
          return false;
        }
      });
    }

    return Math.min(5, Math.max(2, numOpcoes));
  } catch {
    return 4; // fallback 4 (mais comum que 5)
  }
}

/**
 * Gera permutação identidade (A→A, B→B, ...)
 */
function gerarPermutacaoIdentidade(numOpcoes: number): OptionPermutation {
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, numOpcoes);
  return Object.fromEntries(letras.map(l => [l, l]));
}

/**
 * Gera permutação embaralhada para uma questão, com balanceamento de gabarito.
 * Se a letra resultante para a resposta correta estiver acima do limite,
 * troca-a com a letra de menor contagem, mantendo a permutação válida.
 */
function gerarPermutacaoQuestaoBalanceada(
  numOpcoes: number,
  seed: string,
  originalCorrect: string | null,
  letterCount: Record<string, number>,
  maxPerLetter: number
): OptionPermutation {
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, numOpcoes);
  const embaralhadas = shuffleArray(letras, seed);

  const permutation: OptionPermutation = {};
  letras.forEach((original, idx) => {
    permutation[original] = embaralhadas[idx];
  });

  // Sem gabarito conhecido: retorna permutação como está
  if (!originalCorrect || !letras.includes(originalCorrect)) return permutation;

  const newCorrect = permutation[originalCorrect];

  // Validação crítica: garantir que newCorrect é uma letra válida para esta questão
  if (!letras.includes(newCorrect)) {
    console.warn(
      `[gerarPermutacaoQuestaoBalanceada] Letra inválida detectada: ${newCorrect} não está em [${letras.join(',')}]`
    );
    return gerarPermutacaoIdentidade(numOpcoes);
  }

  // Se a letra resultante está dentro do limite, não precisa ajustar
  if ((letterCount[newCorrect] ?? 0) < maxPerLetter) return permutation;

  // Encontra as letras disponíveis (abaixo do limite) e escolhe aleatoriamente entre elas
  const available = letras.filter(l => l !== newCorrect && (letterCount[l] ?? 0) < maxPerLetter);

  if (available.length > 0) {
    // Escolha aleatória com seed para não criar padrões sequenciais (AA BB CC DD)
    const rng = seedrandom(seed + ':redirect');
    const target = available[Math.floor(rng() * available.length)];
    const otherOriginal = letras.find(k => permutation[k] === target);
    if (otherOriginal) {
      permutation[originalCorrect] = target;
      permutation[otherOriginal] = newCorrect;
    }
  } else {
    // Nenhuma letra disponível via balanceamento: força para a primeira com espaço
    const fallback = letras.find(l => (letterCount[l] ?? 0) < maxPerLetter);
    if (fallback) {
      const otherOriginal = letras.find(k => permutation[k] === fallback);
      if (otherOriginal) {
        permutation[originalCorrect] = fallback;
        permutation[otherOriginal] = newCorrect;
      }
    } else {
      // Todas as letras saturadas: minimiza o excesso trocando para a de menor contagem
      const minCount = Math.min(...letras.map(l => letterCount[l] ?? 0));
      const leastUsed = letras.find(l => l !== newCorrect && (letterCount[l] ?? 0) === minCount);
      if (leastUsed) {
        const otherOriginal = letras.find(k => permutation[k] === leastUsed);
        if (otherOriginal) {
          permutation[originalCorrect] = leastUsed;
          permutation[otherOriginal] = newCorrect;
        }
      }
    }
  }

  // Validação final: garantir que nenhuma letra mapeada está fora do intervalo válido
  for (const mapped of Object.values(permutation)) {
    if (!letras.includes(mapped)) {
      return gerarPermutacaoIdentidade(numOpcoes);
    }
  }

  return permutation;
}

/**
 * Gera todos os tipos de prova
 */
export function gerarTiposDeProva(
  questoes: any[],
  numTipos: number, // 2-6
  provaSeed: number // Seed único da prova (evita cola entre provas diferentes)
): ProvaTypeConfig[] {
  const tipos: ProvaTypeConfig[] = [];

  for (let tipoNumber = 1; tipoNumber <= numTipos; tipoNumber++) {
    if (tipoNumber === 1) {
      // Tipo 1 = original (identidade)
      tipos.push({
        tipoNumber: 1,
        permutations: questoes
          .filter(q => isMCQ(q))
          .map(q => ({
            questionId: q.metadata.id,
            permutation: gerarPermutacaoIdentidade(getNumOpcoes(q))
          }))
      });
    } else {
      // Tipos 2-N = permutado com balanceamento de gabarito
      const mcqs = questoes.filter(q => isMCQ(q));
      const numOpcoesPorQ = mcqs.map(q => getNumOpcoes(q));
      const maxOpcoes = Math.max(...numOpcoesPorQ, 4);
      const maxPerLetter = Math.ceil(mcqs.length / maxOpcoes);

      // Contagem de letras do gabarito gerado até agora
      const letterCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

      const permutations = mcqs.map((q, idx) => {
        // Extrai gabarito em múltiplos formatos possíveis
        const gab = q.metadata?.gabarito;
        const originalCorrect: string | null =
          (gab?.kind === 'mcq' && gab?.correct)
            ? gab.correct
            : (typeof gab === 'string' && /^[A-E]$/.test(gab))
              ? gab
              : (typeof gab?.correct === 'string' && /^[A-E]$/.test(gab.correct))
                ? gab.correct
                : null;

        const numOpcoes = numOpcoesPorQ[idx];
        const perm = gerarPermutacaoQuestaoBalanceada(
          numOpcoes,
          `${provaSeed}:${tipoNumber}:${idx}:${q.metadata.id}`,
          originalCorrect,
          letterCount,
          maxPerLetter
        );

        // Atualiza contagem com a letra resultante desta questão
        if (originalCorrect) {
          const newCorrect = perm[originalCorrect];
          if (newCorrect) letterCount[newCorrect] = (letterCount[newCorrect] ?? 0) + 1;
        }

        return { questionId: q.metadata.id, permutation: perm };
      });

      tipos.push({ tipoNumber, permutations });
    }
  }

  return tipos;
}

/**
 * Aplica permutação ao node 'options' do ProseMirror
 */
export function aplicarPermutacao(
  optionsNode: PMNode,
  permutation: OptionPermutation | null
): PMNode {
  if (!permutation) return optionsNode;

  // 1. Extrair options array
  const options = optionsNode.content.content || [];

  // 2. Criar novo array permutado
  const permutedOptions = options.map((opt: PMNode) => {
    const originalLetter = opt.attrs.letter || "A";
    const newLetter = permutation[originalLetter] || originalLetter;

    // Clonar node com letra nova
    return opt.type.create(
      { ...opt.attrs, letter: newLetter },
      opt.content
    );
  });

  // 3. Ordenar por nova letra (A, B, C, D, E)
  permutedOptions.sort((a: PMNode, b: PMNode) => {
    return (a.attrs.letter || "A").localeCompare(b.attrs.letter || "A");
  });

  // 4. Retornar novo optionsNode
  return optionsNode.type.create(
    optionsNode.attrs,
    Fragment.fromArray(permutedOptions)
  );
}

/**
 * Atualiza gabarito aplicando permutação
 */
export function aplicarPermutacaoGabarito(
  respostas: Record<number, Alt>,
  permutations: QuestionPermutation[],
  questoes: any[]
): Record<number, Alt> {
  const respostasPermutadas: Record<number, Alt> = {};

  Object.entries(respostas).forEach(([numeroImpresso, letraOriginal]) => {
    const idx = parseInt(numeroImpresso) - 1;
    const questao = questoes[idx];

    if (!questao) {
      respostasPermutadas[parseInt(numeroImpresso)] = letraOriginal;
      return;
    }

    const perm = permutations.find(p => p.questionId === questao.metadata.id);

    if (!perm) {
      // Questão não-MCQ ou tipo 1
      respostasPermutadas[parseInt(numeroImpresso)] = letraOriginal;
    } else {
      // Aplicar permutação (original → nova)
      const novaLetra = perm.permutation[letraOriginal];
      respostasPermutadas[parseInt(numeroImpresso)] = (novaLetra || letraOriginal) as Alt;
    }
  });

  return respostasPermutadas;
}
