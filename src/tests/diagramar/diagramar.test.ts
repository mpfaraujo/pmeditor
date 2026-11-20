import { moverPara, numeracaoPrevista, somarPontos, trechoInicial } from '@/lib/diagramar'

describe('moverPara (insert-at)', () => {
  const l = ['a', 'b', 'c', 'd', 'e']

  it('move para frente e os demais deslizam', () => {
    expect(moverPara(l, 4, 1)).toEqual(['a', 'e', 'b', 'c', 'd'])
  })

  it('move para trás', () => {
    expect(moverPara(l, 0, 3)).toEqual(['b', 'c', 'd', 'a', 'e'])
  })

  it('limita destino fora do intervalo', () => {
    expect(moverPara(l, 2, 99)).toEqual(['a', 'b', 'd', 'e', 'c'])
    expect(moverPara(l, 2, -5)).toEqual(['c', 'a', 'b', 'd', 'e'])
  })

  it('não altera a lista original', () => {
    moverPara(l, 0, 4)
    expect(l).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('numeracaoPrevista', () => {
  const q = (id: string, tipo = 'Múltipla Escolha') => ({ metadata: { id, tipo }, content: null })

  it('conjunto objetivo vira um número por item selecionado', () => {
    const r = numeracaoPrevista(
      [q('x'), q('s'), q('y')],
      [
        { kind: 'question', id: 'x' },
        { kind: 'set', id: 's', itemIndexes: [0, 2, 3] },
        { kind: 'question', id: 'y' },
      ],
    )
    expect(r.map((i) => [i.key, i.numero])).toEqual([
      ['x', 1], ['s#1', 2], ['s#3', 3], ['s#4', 4], ['y', 5],
    ])
  })

  it('conjunto discursivo conta como uma questão', () => {
    const r = numeracaoPrevista(
      [q('d', 'Discursiva'), q('y')],
      [{ kind: 'set', id: 'd', itemIndexes: [0, 1] }, { kind: 'question', id: 'y' }],
    )
    expect(r.map((i) => [i.key, i.numero])).toEqual([['d', 1], ['y', 2]])
  })
})

describe('somarPontos', () => {
  it('aceita vírgula e texto junto', () => {
    expect(somarPontos(['1,5', '2 pts', '0.25'])).toBe(3.75)
  })
  it('retorna null se algum valor não tem número', () => {
    expect(somarPontos(['1', 'bônus'])).toBeNull()
  })
})

describe('trechoInicial', () => {
  it('extrai texto do doc e marca fórmula', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Calcule ' }, { type: 'math_inline', attrs: { latex: 'x' } },
    ] }] }
    expect(trechoInicial(doc)).toBe('Calcule [fórmula]')
  })
})

import { ordenarPorBloco, alternarBloco, blocoDaQuestao, chaveTextoBase } from '@/lib/diagramar'

describe('diagramação híbrida — blocos', () => {
  const q = (id: string, bt?: string[]) => ({ metadata: { id, baseTextIds: bt }, content: null })
  const lista = [q('a'), q('b', ['T1']), q('c'), q('d', ['T1']), q('e')]

  it('chaveTextoBase usa baseTextIds e cai no legado baseTextId', () => {
    expect(chaveTextoBase(q('x', ['T1', 'T2']))).toBe('T1,T2')
    expect(chaveTextoBase({ metadata: { id: 'y', baseTextId: 'T9' }, content: null })).toBe('T9')
    expect(chaveTextoBase(q('z'))).toBeNull()
  })

  it('primeiro=1 põe o bloco de 1 coluna antes, ordem estável', () => {
    const r = ordenarPorBloco(lista, { primeiro: 1, umaColuna: ['c', 'e'] })
    expect(r.map((x) => x.metadata.id)).toEqual(['c', 'e', 'a', 'b', 'd'])
  })

  it('primeiro=2 põe o bloco de 2 colunas antes', () => {
    const r = ordenarPorBloco(lista, { primeiro: 2, umaColuna: ['c', 'e'] })
    expect(r.map((x) => x.metadata.id)).toEqual(['a', 'b', 'd', 'c', 'e'])
  })

  it('grupo de texto base segue o bloco do primeiro membro', () => {
    expect(blocoDaQuestao(lista, { primeiro: 1, umaColuna: ['d'] }, 'd')).toBe(2)
  })

  it('alternarBloco move o grupo inteiro de texto base', () => {
    const r = alternarBloco(lista, { primeiro: 1, umaColuna: [] }, 'd')
    expect([...r].sort()).toEqual(['b', 'd'])
    expect(alternarBloco(lista, { primeiro: 1, umaColuna: r }, 'b')).toEqual([])
  })

  it('ordenarPorBloco é idempotente', () => {
    const cfg = { primeiro: 1 as const, umaColuna: ['c', 'd'] }
    const uma = ordenarPorBloco(lista, cfg)
    expect(ordenarPorBloco(uma, cfg)).toEqual(uma)
  })
})
