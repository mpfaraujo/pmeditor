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

  // ─── Aproveitamento de espaço residual (tryFragmentResidual) ────────────────

  test('[residual] fragmenta texto-base quando espaço residual >= 30%', () => {
    // Set A (idxs 0,1): 200+200=400px → coluna1 remaining=531px (57% de 931) >= 30% ✓
    // Set B (idxs 2,3): base=700px (não cabe em 531), item=200px
    // Esperado: base B fragmentado — frag0 em coluna1, frag1+item em coluna2
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true }, // set A base
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true }, // set A item
      { wrapperHeight: 700, blockHeights: [300, 300, 80], noOptions: true }, // set B base
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true }, // set B item
    ])
    const pages = distributeQuestionsOptimized(
      4, [200, 200, 700, 200], 931, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }, { baseIndex: 2, itemIndexes: [3] }]
    )
    const baseB = flattenItems(pages).filter((x) => x.q === 2)
    // Base B deve ter sido fragmentada
    expect(baseB.length).toBeGreaterThan(1)
    expect(baseB.every((x: any) => x.kind === 'frag')).toBe(true)
    // Fragmento 0 deve estar em coluna1 (depois dos itens do set A)
    const col1 = pages[0].coluna1
    expect(col1[col1.length - 1]).toMatchObject({ kind: 'frag', q: 2, first: true })
    // Fragmento 1 e item B devem estar em coluna2
    expect(pages[0].coluna2.some((x: any) => x.q === 3)).toBe(true)
  })

  test('[residual] NÃO fragmenta quando espaço restante é insuficiente para qualquer fragmento', () => {
    // Set A (idxs 0,1): 700+200=900px → coluna1 remaining=31px
    // Set B base=500px: 31px não comporta nem o prefixHeight → buildFragmentsForQuestion retorna null
    // Esperado: base B colocado inteiro em coluna2 (sem fragmentação)
    const m = createMeasurementContainer([
      { wrapperHeight: 700, blockHeights: [400, 300], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
      { wrapperHeight: 500, blockHeights: [250, 200, 50], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4, [700, 200, 500, 200], 931, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }, { baseIndex: 2, itemIndexes: [3] }]
    )
    const baseB = flattenItems(pages).filter((x) => x.q === 2)
    // Base B não deve ter sido fragmentada
    expect(baseB).toHaveLength(1)
    expect(baseB[0]).toMatchObject({ kind: 'full' })
    // Coluna1 tem set A
    expect(pages[0].coluna1).toHaveLength(2)
    // Base B começa em coluna2
    expect(pages[0].coluna2[0]).toMatchObject({ kind: 'full', q: 2 })
  })

  test('[residual] NÃO fragmenta quando fragmento inicial < 30% do total', () => {
    // Set A (idxs 0,1): 200+200=400px → remaining=600px
    // Set B (idxs 2,3): base=700px com blocks=[150,500,50]
    //   → frag0 caberia apenas o block[0]=150px (150/700=21% < 30%) ✗
    // Esperado: sem fragmentação — base B colocado inteiro em coluna2
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
      { wrapperHeight: 700, blockHeights: [150, 500, 50], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4, [200, 200, 700, 200], 1000, 1000, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }, { baseIndex: 2, itemIndexes: [3] }]
    )
    const baseB = flattenItems(pages).filter((x) => x.q === 2)
    expect(baseB).toHaveLength(1)
    expect(baseB[0]).toMatchObject({ kind: 'full' })
  })

  test('[residual] NÃO fragmenta quando coluna está vazia', () => {
    // Set A (idxs 0,1): base=700px, item=200px — coluna1 está vazia antes de começar
    // slot.items.length === 0 → tryFragmentResidual retorna null imediatamente
    // Esperado: base colocado inteiro em coluna1 (cabe: 700 <= 931)
    const m = createMeasurementContainer([
      { wrapperHeight: 700, blockHeights: [300, 300, 80], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      2, [700, 200], 931, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }]
    )
    const baseItems = flattenItems(pages).filter((x) => x.q === 0)
    expect(baseItems).toHaveLength(1)
    expect(baseItems[0]).toMatchObject({ kind: 'full' })
  })

  test('[residual] fragmenta texto-base em coluna2 vazia quando coluna1 da mesma página já tem conteúdo', () => {
    // Questões livres ocupam 500px da coluna1 -> remaining=431 (< 50% da coluna),
    // então a fragmentação residual inicial em coluna1 não dispara.
    // O texto-base do set não cabe inteiro em coluna2 vazia (1000 > 931),
    // mas deve aproveitar essa coluna vazia em vez de pular direto para a próxima página.
    const m = createMeasurementContainer([
      { wrapperHeight: 300, blockHeights: [180, 100], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 60], noOptions: true },
      { wrapperHeight: 1000, blockHeights: [300, 300, 300, 80], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 60], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4, [300, 200, 1000, 200], 931, 931, 2, m,
      [{ baseIndex: 2, itemIndexes: [3] }]
    )
    const baseItems = flattenItems(pages).filter((x) => x.q === 2)
    expect(baseItems.length).toBeGreaterThan(1)
    expect(baseItems.every((x: any) => x.kind === 'frag')).toBe(true)
    expect(pages[0].coluna1.map((x: any) => x.q)).toEqual([0, 1])
    expect(pages[0].coluna2[0]).toMatchObject({ kind: 'frag', q: 2, first: true })
  })

  test('[residual] coesão do conjunto preservada — itens aparecem após todos os fragmentos do base', () => {
    // Mesmo cenário do teste de fragmentação ativada:
    // coluna2: [frag1_de_base_B, item_B] — item vem DEPOIS do fragmento
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
      { wrapperHeight: 700, blockHeights: [300, 300, 80], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 80], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4, [200, 200, 700, 200], 931, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1] }, { baseIndex: 2, itemIndexes: [3] }]
    )
    // Ordem dos fragmentos: first=true antes de first=false
    const baseBFrags = flattenItems(pages).filter((x: any) => x.q === 2)
    expect(baseBFrags[0]).toMatchObject({ kind: 'frag', first: true })
    expect(baseBFrags[1]).toMatchObject({ kind: 'frag', first: false })
    // Item B (q=3) deve aparecer depois do último fragmento de base B em coluna2
    const col2 = pages[0].coluna2
    const idxLastFrag = col2.findIndex((x: any) => x.q === 2 && x.first === false)
    const idxItem = col2.findIndex((x: any) => x.q === 3)
    expect(idxLastFrag).toBeGreaterThanOrEqual(0)
    expect(idxItem).toBeGreaterThan(idxLastFrag)
  })
})
