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

const VALID_LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalizar(tipo) === normalizar("Múltipla Escolha");
}

/**
 * Verifica se um nó option tem conteúdo real (texto, math ou imagem).
 * Opções com só whitespace ou vazias são excluídas da permutação.
 */
function isOptionNonEmpty(opt: PMNode): boolean {
  if (opt.textContent.trim().length > 0) return true;
  let found = false;
  opt.descendants((n) => {
    if (n.type.name === 'math_inline' || n.type.name === 'math_block' || n.type.name === 'image') {
      found = true;
    }
  });
  return found;
}

/**
 * Lê as letras reais das opções: combina attrs.letter com verificação de conteúdo real.
 * Opções com letra válida mas sem conteúdo (importadas vazias) são ignoradas.
 */
function getLetrasOpcoes(q: any): string[] {
  try {
    const contentNode = PMNode.fromJSON(schema, q.content);
    let letras: string[] = [];

    contentNode.descendants((node) => {
      if (node.type.name === 'options') {
        for (let i = 0; i < node.childCount; i++) {
          const opt = node.child(i);
          const letter = opt.attrs?.letter;
          if (letter && VALID_LETTERS.includes(letter) && isOptionNonEmpty(opt)) {
            letras.push(letter);
          }
        }
        return false;
      }
    });

    if (letras.length >= 2) return letras;

    return ['A', 'B', 'C', 'D']; // fallback
  } catch {
    return ['A', 'B', 'C', 'D'];
  }
}

/**
 * Gera permutação identidade (A→A, B→B, ...)
 */
function gerarPermutacaoIdentidade(letras: string[]): OptionPermutation {
  return Object.fromEntries(letras.map(l => [l, l]));
}

/**
 * Gera permutação embaralhada para uma questão, com balanceamento de gabarito.
 * Recebe as letras reais da questão — nunca infere letras por contagem.
 */
function gerarPermutacaoQuestaoBalanceada(
  letras: string[],
  seed: string,
  originalCorrect: string | null,
  letterCount: Record<string, number>,
  maxPerLetter: number
): OptionPermutation {
  const embaralhadas = shuffleArray(letras, seed);

  const permutation: OptionPermutation = {};
  letras.forEach((original, idx) => {
    permutation[original] = embaralhadas[idx];
  });

  // Sem gabarito conhecido ou gabarito fora das letras válidas desta questão
  if (!originalCorrect || !letras.includes(originalCorrect)) return permutation;

  const newCorrect = permutation[originalCorrect];

  // Validação crítica: newCorrect deve estar nas letras válidas
  if (!letras.includes(newCorrect)) {
    return gerarPermutacaoIdentidade(letras);
  }

  // Dentro do limite de balanceamento — ok
  if ((letterCount[newCorrect] ?? 0) < maxPerLetter) return permutation;

  // Letras disponíveis abaixo do limite
  const available = letras.filter(l => l !== newCorrect && (letterCount[l] ?? 0) < maxPerLetter);

  if (available.length > 0) {
    const rng = seedrandom(seed + ':redirect');
    const target = available[Math.floor(rng() * available.length)];
    const otherOriginal = letras.find(k => permutation[k] === target);
    if (otherOriginal) {
      permutation[originalCorrect] = target;
      permutation[otherOriginal] = newCorrect;
    }
  } else {
    // Nenhuma letra abaixo do limite: usa a de menor contagem
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

  // Validação final: nenhum valor fora das letras válidas
  for (const mapped of Object.values(permutation)) {
    if (!letras.includes(mapped)) {
      return gerarPermutacaoIdentidade(letras);
    }
  }

  return permutation;
}

/**
 * Gera todos os tipos de prova
 */
export function gerarTiposDeProva(
  questoes: any[],
  numTipos: number,
  provaSeed: number
): ProvaTypeConfig[] {
  const tipos: ProvaTypeConfig[] = [];

  for (let tipoNumber = 1; tipoNumber <= numTipos; tipoNumber++) {
    if (tipoNumber === 1) {
      tipos.push({
        tipoNumber: 1,
        permutations: questoes
          .filter(q => isMCQ(q))
          .map(q => ({
            questionId: q.metadata.id,
            permutation: gerarPermutacaoIdentidade(getLetrasOpcoes(q))
          }))
      });
    } else {
      const mcqs = questoes.filter(q => isMCQ(q));
      const letrasPorQ = mcqs.map(q => getLetrasOpcoes(q));
      const maxOpcoes = Math.max(...letrasPorQ.map(l => l.length), 4);
      const maxPerLetter = Math.ceil(mcqs.length / maxOpcoes);

      const letterCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

      const permutations = mcqs.map((q, idx) => {
        const gab = q.metadata?.gabarito;
        const originalCorrect: string | null =
          (gab?.kind === 'mcq' && gab?.correct)
            ? gab.correct
            : (typeof gab === 'string' && /^[A-E]$/.test(gab))
              ? gab
              : (typeof gab?.correct === 'string' && /^[A-E]$/.test(gab.correct))
                ? gab.correct
                : null;

        const letras = letrasPorQ[idx];
        const perm = gerarPermutacaoQuestaoBalanceada(
          letras,
          `${provaSeed}:${tipoNumber}:${idx}:${q.metadata.id}`,
          originalCorrect,
          letterCount,
          maxPerLetter
        );

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

  const options = optionsNode.content.content || [];

  const permutedOptions = options.map((opt: PMNode) => {
    const originalLetter = opt.attrs.letter || "A";
    const newLetter = permutation[originalLetter] || originalLetter;
    return opt.type.create(
      { ...opt.attrs, letter: newLetter },
      opt.content
    );
  });

  permutedOptions.sort((a: PMNode, b: PMNode) => {
    return (a.attrs.letter || "A").localeCompare(b.attrs.letter || "A");
  });

  return optionsNode.type.create(
    optionsNode.attrs,
    Fragment.fromArray(permutedOptions)
  );
}

/**
 * Atualiza gabarito aplicando permutação.
 * Recebe um mapa printNum → questão para evitar desalinhamento de índice
 * quando há set_questions expandidos na prova.
 */
export function aplicarPermutacaoGabarito(
  respostas: Record<number, Alt>,
  permutations: QuestionPermutation[],
  questoesPorNumero: Record<number, any>
): Record<number, Alt> {
  const respostasPermutadas: Record<number, Alt> = {};

  Object.entries(respostas).forEach(([numeroImpresso, letraOriginal]) => {
    const printNum = parseInt(numeroImpresso);
    const questao = questoesPorNumero[printNum];

    if (!questao) {
      respostasPermutadas[printNum] = letraOriginal;
      return;
    }

    const perm = permutations.find(p => p.questionId === questao.metadata.id);

    if (!perm) {
      respostasPermutadas[printNum] = letraOriginal;
    } else {
      const novaLetra = perm.permutation[letraOriginal];
      respostasPermutadas[printNum] = (novaLetra || letraOriginal) as Alt;
    }
  });

  return respostasPermutadas;
}
