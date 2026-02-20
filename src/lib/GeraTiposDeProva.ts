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
 * Fisher-Yates shuffle com seed determinístico
 */
function shuffleArray<T>(array: T[], seed: number): T[] {
  const rng = seedrandom(seed.toString());
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
    let numOpcoes = 5; // padrão

    contentNode.descendants((node) => {
      if (node.type.name === 'options' && node.content) {
        numOpcoes = node.content.childCount;
        return false; // parar busca
      }
    });

    return numOpcoes;
  } catch {
    return 5; // fallback
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
 * Gera permutação embaralhada para uma questão
 */
function gerarPermutacaoQuestao(
  numOpcoes: number, // 2-5
  seed: number
): OptionPermutation {
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, numOpcoes);
  const embaralhadas = shuffleArray(letras, seed);

  const permutation: OptionPermutation = {};
  letras.forEach((original, idx) => {
    permutation[original] = embaralhadas[idx];
  });

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
      // Tipos 2-N = permutado
      tipos.push({
        tipoNumber,
        permutations: questoes
          .filter(q => isMCQ(q))
          .map(q => ({
            questionId: q.metadata.id,
            permutation: gerarPermutacaoQuestao(
              getNumOpcoes(q),
              provaSeed + tipoNumber * 1000 + hashQuestionId(q.metadata.id)
            )
          }))
      });
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
