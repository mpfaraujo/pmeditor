import { distributeQuestionsAcrossPages, distributeQuestionsOptimized } from '@/lib/pagination'
import { createMeasurementContainer, flattenItems } from './helpers'

describe('pagination - invariantes', () => {
  afterEach(() => { document.body.innerHTML = '' })

  test('remainingHeight nunca é negativo', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 250, blockHeights: [100, 130] },
      { wrapperHeight: 300, blockHeights: [120, 160] },
      { wrapperHeight: 350, blockHeights: [150, 180] },
      { wrapperHeight: 200, blockHeights: [90, 90] },
    ])
    const pages = distributeQuestionsAcrossPages(4, [250, 300, 350, 200], 700, 900, 1, m)
    expect(pages.every((p) => p.remainingHeight >= 0)).toBe(true)
  })

  test('[linear] todas as questões aparecem exatamente uma vez', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [80, 100] },
      { wrapperHeight: 220, blockHeights: [90, 110] },
      { wrapperHeight: 240, blockHeights: [100, 120] },
    ])
    const pages = distributeQuestionsAcrossPages(3, [200, 220, 240], 500, 500, 1, m)
    expect(flattenItems(pages).map((x) => x.q).sort()).toEqual([0, 1, 2])
  })

  test('[otimizado] todos os índices estão presentes no resultado', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 280, blockHeights: [120, 140] },
      { wrapperHeight: 320, blockHeights: [140, 160] },
      { wrapperHeight: 180, blockHeights: [80, 80] },
      { wrapperHeight: 260, blockHeights: [110, 130] },
    ])
    const pages = distributeQuestionsOptimized(4, [280, 320, 180, 260], 600, 600, 1, m, [])
    expect(flattenItems(pages).map((x) => x.q).sort()).toEqual([0, 1, 2, 3])
  })

  test('questão muito alta gera fragmentos em ordem crescente de from/to', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1400, blockHeights: [220, 220, 220, 220, 220, 220], optionsAsSingleBlock: false },
    ])
    const pages = distributeQuestionsAcrossPages(1, [1400], 700, 900, 1, m)
    const frags = flattenItems(pages).filter((x) => x.q === 0)
    expect(frags.length).toBeGreaterThan(1)
    expect(frags.every((x: any) => x.kind === 'frag')).toBe(true)
    const bounds = frags.map((x: any) => x.from as number)
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i]).toBeGreaterThan(bounds[i - 1])
    }
  })
})
