import {
  distributeQuestionsAcrossPages,
  distributeQuestionsOptimized,
  measureQuestionHeights,
  calculateFirstPageCapacity,
  calculateOtherPageCapacity,
} from '@/lib/pagination'
import { createMeasurementContainer, createPageFixture, flattenItems } from './helpers'

describe('pagination - layout e regressões', () => {
  afterEach(() => { document.body.innerHTML = '' })

  // ─── Capacidades ───────────────────────────────────────────────────────────

  test('firstPageCapacity < otherPageCapacity quando cabeçalho ocupa espaço', () => {
    const first = createPageFixture({ pageHeight: 1000, occupiedTop: 180 })
    const other = createPageFixture({ pageHeight: 1000, occupiedTop: 90 })
    const firstCap = calculateFirstPageCapacity(first.page, first.questions, 1000, 43)
    const otherCap = calculateOtherPageCapacity(other.page, other.questions, 1000, 43)
    expect(firstCap).toBeLessThan(otherCap)
    expect(firstCap).toBe(742)
    expect(otherCap).toBe(832)
  })

  test('mede alturas das questões a partir dos wrappers', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [100, 80] },
      { wrapperHeight: 350, blockHeights: [120, 100, 90] },
    ])
    expect(measureQuestionHeights(m)).toEqual([200, 350])
  })

  // ─── Layout linear ─────────────────────────────────────────────────────────

  test('[linear] preserva a ordem das questões', () => {
    const m = createMeasurementContainer(Array(4).fill({ wrapperHeight: 200, blockHeights: [120, 60] }))
    const pages = distributeQuestionsAcrossPages(4, [200, 200, 200, 200], 400, 400, 1, m)
    expect(flattenItems(pages).map((x) => x.q)).toEqual([0, 1, 2, 3])
  })

  test('[linear] questão maior que página inteira deve ser fragmentada', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1200, blockHeights: [250, 250, 250, 250, 180], optionsAsSingleBlock: false },
    ])
    const pages = distributeQuestionsAcrossPages(1, [1200], 742, 931, 1, m)
    const items = flattenItems(pages).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(1)
    expect(items.every((x: any) => x.kind === 'frag')).toBe(true)
  })

  // ─── Bug de regressão — overflow na primeira página ────────────────────────
  //
  // Quando q.height > firstPageCapacity mas q.height <= otherPageCapacity,
  // o algoritmo criava nova página (com otherPageCapacity), a página 0 ficava
  // vazia, era removida, e a nova página virava a página 0 renderizada.
  // Com cabeçalho, só há firstPageCapacity disponível → overflow.
  //
  // O comportamento correto é fragmentar a questão, aproveitando o espaço
  // restante da primeira página e continuando na segunda.

  test('[otimizado] questão maior que firstPageCapacity deve ser fragmentada (regressão overflow)', () => {
    // Reproduz o caso real: q0=829, firstPageCapacity=742, otherPageCapacity=931
    const m = createMeasurementContainer([
      // noOptions=true: setBase (texto base) não tem opções — todos os blocos são texto
      { wrapperHeight: 829, blockHeights: [300, 300, 200], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(1, [829], 742, 931, 1, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)
    // Deve ser fragmentada, não colocada como 'full' (o que causaria overflow)
    expect(items.length).toBeGreaterThan(1)
    expect(items.every((x: any) => x.kind === 'frag')).toBe(true)
  })

  test('[otimizado] set group com base maior que firstPageCapacity deve fragmentar a base (regressão)', () => {
    // Mesmo cenário mas com set group: base + 1 item
    const m = createMeasurementContainer([
      { wrapperHeight: 829, blockHeights: [300, 300, 200], noOptions: true }, // setBase (idx 0)
      { wrapperHeight: 294, blockHeights: [150, 120], noOptions: true },       // item  (idx 1)
    ])
    const pages = distributeQuestionsOptimized(
      2, [829, 294], 742, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }]
    )
    const baseItems = flattenItems(pages).filter((x) => x.q === 0)
    // Base deve ser fragmentada
    expect(baseItems.length).toBeGreaterThan(1)
    expect(baseItems.every((x: any) => x.kind === 'frag')).toBe(true)
  })

  // ─── Bin-packing geral ─────────────────────────────────────────────────────

  test('[otimizado] não usa mais páginas que o linear em caso simples', () => {
    const m = createMeasurementContainer(Array(3).fill({ wrapperHeight: 400, blockHeights: [250, 130] }))
    const linear = distributeQuestionsAcrossPages(3, [400, 400, 400], 800, 800, 1, m)
    const optimized = distributeQuestionsOptimized(3, [400, 400, 400], 800, 800, 1, m, [])
    expect(optimized.length).toBeLessThanOrEqual(linear.length)
  })
})
