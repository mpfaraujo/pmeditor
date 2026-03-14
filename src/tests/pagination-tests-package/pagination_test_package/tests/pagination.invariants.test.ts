import {
  distributeQuestionsAcrossPages,
  distributeQuestionsOptimized,
} from '@/lib/pagination'
import {
  createMeasurementContainer,
  flattenQuestionIndexes,
} from './pagination.helpers'

describe('pagination invariants', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('remainingHeight nunca deve ser negativo', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 250, blockHeights: [100, 130] },
      { wrapperHeight: 300, blockHeights: [120, 160] },
      { wrapperHeight: 350, blockHeights: [150, 180] },
      { wrapperHeight: 200, blockHeights: [90, 90] },
    ])

    const pages = distributeQuestionsAcrossPages(
      4,
      [250, 300, 350, 200],
      700,
      900,
      1,
      measurement,
    )

    expect(pages.every((p) => p.remainingHeight >= 0)).toBe(true)
  })

  test('questões não fragmentadas devem aparecer exatamente uma vez', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [80, 100] },
      { wrapperHeight: 220, blockHeights: [90, 110] },
      { wrapperHeight: 240, blockHeights: [100, 120] },
    ])

    const pages = distributeQuestionsAcrossPages(
      3,
      [200, 220, 240],
      500,
      500,
      1,
      measurement,
    )

    const order = flattenQuestionIndexes(pages)
    expect(order.sort()).toEqual([0, 1, 2])
  })

  test('modo otimizado deve manter todos os índices presentes', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 280, blockHeights: [120, 140] },
      { wrapperHeight: 320, blockHeights: [140, 160] },
      { wrapperHeight: 180, blockHeights: [80, 80] },
      { wrapperHeight: 260, blockHeights: [110, 130] },
    ])

    const pages = distributeQuestionsOptimized(
      4,
      [280, 320, 180, 260],
      600,
      600,
      1,
      measurement,
      [],
    )

    const seen = flattenQuestionIndexes(pages).sort()
    expect(seen).toEqual([0, 1, 2, 3])
  })

  test('questão muito alta gera múltiplos fragmentos em ordem crescente', () => {
    const measurement = createMeasurementContainer([
      {
        wrapperHeight: 1400,
        blockHeights: [220, 220, 220, 220, 220, 220],
        optionsAsSingleBlock: false,
      },
    ])

    const pages = distributeQuestionsAcrossPages(
      1,
      [1400],
      700,
      900,
      1,
      measurement,
    )

    const frags = pages.flatMap((p) => [...p.coluna1, ...p.coluna2]).filter((x) => x.q === 0)
    expect(frags.length).toBeGreaterThan(1)
    expect(frags.every((x) => x.kind === 'frag')).toBe(true)

    const bounds = frags.map((x: any) => [x.from, x.to])
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i][0]).toBeGreaterThan(bounds[i - 1][0])
    }
  })
})
