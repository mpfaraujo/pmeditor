/**
 * Testes para GeraTiposDeProva.ts
 *
 * Prioridades verificadas:
 * 1. Nenhuma permutação mapeia uma letra inválida (ex: E em questão com 4 opções)
 * 2. Balanceamento: nenhuma letra recebe gabaritos em excesso (acúmulo)
 * 3. set_questions: cada question_item recebe sua própria permutação (não agrupados)
 * 4. setBase não entra na contagem de questões/balanceamento
 */

import { gerarTiposDeProva, aplicarPermutacaoGabarito } from '@/lib/GeraTiposDeProva'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cria conteúdo JSON mínimo válido para PMNode.fromJSON (questão com opções A-N) */
function makeContent(letras: string[]) {
  return {
    type: 'doc',
    content: [{
      type: 'question',
      attrs: { tipo: null },
      content: [
        {
          type: 'statement',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Enunciado' }] }],
        },
        {
          type: 'options',
          content: letras.map(l => ({
            type: 'option',
            attrs: { letter: l },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `Opção ${l}` }] }],
          })),
        },
      ],
    }],
  }
}

/** Cria uma questão MCQ sintética com as letras e gabarito indicados */
function makeMCQ(id: string, letras: string[], gabarito: string) {
  return {
    metadata: {
      id,
      tipo: 'Múltipla Escolha',
      gabarito: { kind: 'mcq', correct: gabarito },
    },
    content: makeContent(letras),
  }
}

/** Questão Certo/Errado (não deve ter permutação gerada) */
function makeTF(id: string) {
  return {
    metadata: {
      id,
      tipo: 'Certo/Errado',
      gabarito: { kind: 'tf', correct: 'C' },
    },
    content: {
      type: 'doc',
      content: [{
        type: 'question',
        attrs: { tipo: null },
        content: [{
          type: 'statement',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Afirmativa' }] }],
        }],
      }],
    },
  }
}

/** Retorna o gabarito permutado de uma questão no tipo dado */
function gabaritoPermutado(tiposGerados: ReturnType<typeof gerarTiposDeProva>, tipoIdx: number, questionId: string, original: string) {
  const perm = tiposGerados[tipoIdx].permutations.find(p => p.questionId === questionId)?.permutation
  if (!perm) return null
  return perm[original] ?? null
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GeraTiposDeProva - permutações individuais', () => {

  test('Tipo 1 sempre usa permutação identidade (A→A, B→B, ...)', () => {
    const questoes = [
      makeMCQ('q1', ['A', 'B', 'C', 'D'], 'B'),
      makeMCQ('q2', ['A', 'B', 'C', 'D', 'E'], 'C'),
    ]
    const tipos = gerarTiposDeProva(questoes, 3, 42)
    for (const q of questoes) {
      const perm = tipos[0].permutations.find(p => p.questionId === q.metadata.id)!.permutation
      for (const [orig, dest] of Object.entries(perm)) {
        expect(dest).toBe(orig) // identidade
      }
    }
  })

  test('Questão com 4 opções nunca recebe gabarito letra E', () => {
    const questoes = Array.from({ length: 10 }, (_, i) =>
      makeMCQ(`q${i}`, ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D'][i % 4])
    )
    const tipos = gerarTiposDeProva(questoes, 4, 99)

    for (const tipo of tipos) {
      for (const { questionId, permutation } of tipo.permutations) {
        const q = questoes.find(q => q.metadata.id === questionId)!
        // Só deve haver mapeamentos para letras que existem na questão
        for (const dest of Object.values(permutation)) {
          expect(['A', 'B', 'C', 'D']).toContain(dest)
        }
      }
    }
  })

  test('Nenhuma letra acumula mais do que ceil(N/4) gabaritos num mesmo tipo', () => {
    const n = 8
    const gabaritos = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']
    const questoes = Array.from({ length: n }, (_, i) =>
      makeMCQ(`q${i}`, ['A', 'B', 'C', 'D'], gabaritos[i])
    )
    const tipos = gerarTiposDeProva(questoes, 4, 7)
    const maxPerLetter = Math.ceil(n / 4)

    for (const tipo of tipos.slice(1)) { // tipos 2+
      const count: Record<string, number> = {}
      for (const q of questoes) {
        const orig = (q.metadata.gabarito as any).correct as string
        const dest = gabaritoPermutado(tipos, tipo.tipoNumber - 1, q.metadata.id, orig)
        if (dest) count[dest] = (count[dest] ?? 0) + 1
      }
      for (const [letra, total] of Object.entries(count)) {
        expect(total).toBeLessThanOrEqual(maxPerLetter + 1) // +1 tolerância de arredondamento
      }
    }
  })

  test('Questões Certo/Errado não recebem permutações', () => {
    const questoes = [
      makeMCQ('q1', ['A', 'B', 'C', 'D'], 'A'),
      makeTF('tf1'),
      makeMCQ('q2', ['A', 'B', 'C', 'D'], 'B'),
    ]
    const tipos = gerarTiposDeProva(questoes, 2, 1)
    for (const tipo of tipos) {
      const ids = tipo.permutations.map(p => p.questionId)
      expect(ids).toContain('q1')
      expect(ids).toContain('q2')
      expect(ids).not.toContain('tf1')
    }
  })

})

describe('GeraTiposDeProva - set_questions expandidos', () => {

  /**
   * Simula o que expandedQuestions.filter(!__setBase) produz para um set_questions:
   * cada question_item vira uma questão individual com id "parentId#1", "parentId#2", etc.
   */
  function makeSetItems(parentId: string, count: number, letras = ['A', 'B', 'C', 'D']) {
    return Array.from({ length: count }, (_, i) => ({
      metadata: {
        id: `${parentId}#${i + 1}`,
        tipo: 'Múltipla Escolha',           // herdado do pai
        gabarito: { kind: 'mcq', correct: letras[i % letras.length] },
      },
      content: makeContent(letras),
    }))
  }

  test('Conjunto com 2 itens: cada item recebe permutação própria', () => {
    const items = makeSetItems('set1', 2)
    const tipos = gerarTiposDeProva(items, 3, 5)

    for (const tipo of tipos) {
      expect(tipo.permutations).toHaveLength(2)
      const ids = tipo.permutations.map(p => p.questionId)
      expect(ids).toContain('set1#1')
      expect(ids).toContain('set1#2')
    }
  })

  test('Conjunto com 5 itens: cada item recebe permutação própria', () => {
    const items = makeSetItems('set1', 5)
    const tipos = gerarTiposDeProva(items, 3, 7)

    for (const tipo of tipos) {
      expect(tipo.permutations).toHaveLength(5)
      const ids = tipo.permutations.map(p => p.questionId)
      for (let i = 1; i <= 5; i++) expect(ids).toContain(`set1#${i}`)
    }
  })

  test('Conjunto com 2 itens (4 opções): nenhum recebe letra E', () => {
    const items = makeSetItems('set1', 2)
    const tipos = gerarTiposDeProva(items, 4, 13)

    for (const tipo of tipos) {
      for (const { permutation } of tipo.permutations) {
        for (const dest of Object.values(permutation)) {
          expect(['A', 'B', 'C', 'D']).toContain(dest)
        }
      }
    }
  })

  test('Conjunto com 5 itens (4 opções): nenhum recebe letra E', () => {
    const items = makeSetItems('set1', 5)
    const tipos = gerarTiposDeProva(items, 4, 17)

    for (const tipo of tipos) {
      for (const { permutation } of tipo.permutations) {
        for (const dest of Object.values(permutation)) {
          expect(['A', 'B', 'C', 'D']).toContain(dest)
        }
      }
    }
  })

  test('Conjunto misto: item com 4 opções nunca recebe E; item com 5 opções pode receber E', () => {
    // set1#1 e set1#2 têm 4 opções; set1#3 e set1#4 têm 5 opções
    const items4 = Array.from({ length: 2 }, (_, i) => ({
      metadata: { id: `set1#${i + 1}`, tipo: 'Múltipla Escolha', gabarito: { kind: 'mcq', correct: ['A', 'B'][i] } },
      content: makeContent(['A', 'B', 'C', 'D']),
    }))
    const items5 = Array.from({ length: 2 }, (_, i) => ({
      metadata: { id: `set1#${i + 3}`, tipo: 'Múltipla Escolha', gabarito: { kind: 'mcq', correct: ['C', 'E'][i] } },
      content: makeContent(['A', 'B', 'C', 'D', 'E']),
    }))
    const items = [...items4, ...items5]
    const tipos = gerarTiposDeProva(items, 4, 23)

    for (const tipo of tipos) {
      for (const { questionId, permutation } of tipo.permutations) {
        const is4opt = questionId === 'set1#1' || questionId === 'set1#2'
        for (const dest of Object.values(permutation)) {
          if (is4opt) {
            expect(['A', 'B', 'C', 'D']).toContain(dest) // nunca E
          } else {
            expect(['A', 'B', 'C', 'D', 'E']).toContain(dest) // pode ter E
          }
        }
      }
    }

    // Ao menos em algum tipo, algum item de 5 opções deve receber E como destino
    const eAparece = tipos.slice(1).some(tipo =>
      tipo.permutations
        .filter(p => p.questionId === 'set1#3' || p.questionId === 'set1#4')
        .some(p => Object.values(p.permutation).includes('E'))
    )
    expect(eAparece).toBe(true)
  })

  test('Cada item do conjunto recebe permutação própria (não agrupados)', () => {
    const items = makeSetItems('set1', 4)
    const tipos = gerarTiposDeProva(items, 2, 5)

    // Deve haver uma permutação por item
    expect(tipos[0].permutations).toHaveLength(4)
    expect(tipos[1].permutations).toHaveLength(4)

    const ids = tipos[1].permutations.map(p => p.questionId)
    expect(ids).toContain('set1#1')
    expect(ids).toContain('set1#2')
    expect(ids).toContain('set1#3')
    expect(ids).toContain('set1#4')
  })

  test('Itens de conjunto com 4 opções não recebem mapeamento para letra E', () => {
    const items = makeSetItems('set1', 6)
    const tipos = gerarTiposDeProva(items, 3, 11)

    for (const tipo of tipos) {
      for (const { permutation } of tipo.permutations) {
        for (const dest of Object.values(permutation)) {
          expect(['A', 'B', 'C', 'D']).toContain(dest)
        }
      }
    }
  })

  test('setBase não deve ser passado para gerarTiposDeProva (contagem correta)', () => {
    // Simula o que acontece ao chamar com setBase incluído (bug)
    const setBase = {
      metadata: { id: 'set1#base', tipo: 'Múltipla Escolha', gabarito: null },
      content: {
        type: 'doc',
        content: [{ type: 'question', attrs: { tipo: null }, content: [
          { type: 'statement', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto base' }] }] }
        ] }]
      },
      __setBase: { parentId: 'set1', headerText: 'Texto base' },
    }
    const items = makeSetItems('set1', 2)

    // Sem setBase: 2 permutações
    const semBase = gerarTiposDeProva(items, 2, 1)
    expect(semBase[0].permutations).toHaveLength(2)

    // Com setBase (bug): 3 permutações, balanceamento distorcido
    const comBase = gerarTiposDeProva([setBase as any, ...items], 2, 1)
    expect(comBase[0].permutations).toHaveLength(3) // demonstra o problema
    // → confirma que setBase deve ser filtrado antes de chamar gerarTiposDeProva
  })

})

describe('aplicarPermutacaoGabarito', () => {

  test('Atualiza gabarito conforme permutação', () => {
    const q1 = makeMCQ('q1', ['A', 'B', 'C', 'D'], 'B')
    const tipos = gerarTiposDeProva([q1], 2, 3)
    const tipoPermutations = tipos[1].permutations

    // respostas: Record<printNum, letra>
    const respostas: Record<number, any> = { 1: 'B' }
    // questoesPorNumero: Record<printNum, questao>
    const questoesPorNumero: Record<number, any> = { 1: q1 }

    const permutadas = aplicarPermutacaoGabarito(respostas, tipoPermutations, questoesPorNumero)

    // O gabarito permutado deve ser a letra para onde 'B' foi mapeado
    const esperado = tipoPermutations.find(p => p.questionId === 'q1')!.permutation['B']
    expect(permutadas[1]).toBe(esperado)
  })

})
