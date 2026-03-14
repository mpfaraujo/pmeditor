import {
  distributeQuestionsAcrossPages,
  distributeQuestionsOptimized,
  measureQuestionHeights,
  calculateFirstPageCapacity,
  calculateOtherPageCapacity,
} from '@/lib/pagination'
import {
  createMeasurementContainer,
  createPageFixture,
  flattenQuestionIndexes,
} from './pagination.helpers'

describe('pagination layout - regressões editoriais', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('calcula capacidades diferentes para primeira página e demais', () => {
    const first = createPageFixture({ pageHeight: 1000, occupiedTop: 180 })
    const other = createPageFixture({ pageHeight: 1000, occupiedTop: 90 })

    const firstCap = calculateFirstPageCapacity(first.page, first.questions, 1000, 43)
    const otherCap = calculateOtherPageCapacity(other.page, other.questions, 1000, 43)

    expect(firstCap).toBeLessThan(otherCap)
    expect(firstCap).toBe(742)
    expect(otherCap).toBe(832)
  })

  test('mede alturas das questões a partir dos wrappers', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [100, 80] },
      { wrapperHeight: 350, blockHeights: [120, 100, 90] },
    ])

    const heights = measureQuestionHeights(measurement)
    expect(heights).toEqual([200, 350])
  })

  test('modo linear preserva ordem das questões', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [120, 60] },
      { wrapperHeight: 200, blockHeights: [120, 60] },
      { wrapperHeight: 200, blockHeights: [120, 60] },
      { wrapperHeight: 200, blockHeights: [120, 60] },
    ])

    const pages = distributeQuestionsAcrossPages(
      4,
      [200, 200, 200, 200],
      400,
      400,
      1,
      measurement,
    )

    expect(flattenQuestionIndexes(pages)).toEqual([0, 1, 2, 3])
  })

  test('questão maior que a primeira página, mas menor que página limpa, não deve fragmentar obrigatoriamente', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 829, blockHeights: [300, 300, 200] },
      { wrapperHeight: 294, blockHeights: [120, 120, 40] },
    ])

    const pages = distributeQuestionsAcrossPages(
      2,
      [829, 294],
      742,
      931,
      1,
      measurement,
    )

    const firstQuestionItems = pages.flatMap((p) => p.coluna1).filter((x) => x.q === 0)
    expect(firstQuestionItems).toHaveLength(1)
    expect(firstQuestionItems[0].kind).toBe('full')
  })

  test('questão maior que página limpa deve fragmentar', () => {
    const measurement = createMeasurementContainer([
      {
        wrapperHeight: 1200,
        blockHeights: [250, 250, 250, 250, 180],
        optionsAsSingleBlock: false,
      },
    ])

    const pages = distributeQuestionsAcrossPages(
      1,
      [1200],
      742,
      931,
      1,
      measurement,
    )

    const items = pages.flatMap((p) => [...p.coluna1, ...p.coluna2]).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(1)
    expect(items.every((x) => x.kind === 'frag')).toBe(true)
  })

  test('modo otimizado não deve usar mais páginas que o modo linear em caso simples', () => {
    const measurement = createMeasurementContainer([
      { wrapperHeight: 400, blockHeights: [250, 130] },
      { wrapperHeight: 400, blockHeights: [250, 130] },
      { wrapperHeight: 400, blockHeights: [250, 130] },
    ])

    const linear = distributeQuestionsAcrossPages(
      3,
      [400, 400, 400],
      800,
      800,
      1,
      measurement,
    )

    const optimized = distributeQuestionsOptimized(
      3,
      [400, 400, 400],
      800,
      800,
      1,
      measurement,
      [],
    )

    expect(optimized.length).toBeLessThanOrEqual(linear.length)
  })
})
