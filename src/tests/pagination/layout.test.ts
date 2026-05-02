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
  flattenItems,
  setComputedMargins,
  setOffsetHeight,
  setRect,
} from './helpers'

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

  test('[otimizado] quebra lista romana longa por itens quando ela ficaria isolada', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'questao-item-wrapper'
    setOffsetHeight(wrapper, 989)
    setComputedMargins(wrapper, 0, 0)

    const content = document.createElement('div')
    content.className = 'questao-conteudo'
    const text = document.createElement('div')
    text.className = 'question-text'

    const intro = document.createElement('p')
    intro.textContent = 'Observe as afirmações abaixo.'
    setRect(intro, { height: 55 })
    text.appendChild(intro)

    const listBlock = document.createElement('div')
    listBlock.className = 'leading-snug'
    setRect(listBlock, { height: 746 })
    const list = document.createElement('ol')
    list.className = 'roman-list'
    ;[250, 250, 246].forEach((h) => {
      const li = document.createElement('li')
      setRect(li, { height: h })
      list.appendChild(li)
    })
    listBlock.appendChild(list)
    text.appendChild(listBlock)

    const conclusion = document.createElement('p')
    conclusion.textContent = 'Assinale a alternativa CORRETA.'
    setRect(conclusion, { height: 19 })
    text.appendChild(conclusion)
    content.appendChild(text)

    const options = document.createElement('div')
    options.className = 'question-options'
    ;[27, 27, 27, 27, 27].forEach((h) => {
      const option = document.createElement('div')
      setRect(option, { height: h })
      options.appendChild(option)
    })
    content.appendChild(options)
    wrapper.appendChild(content)

    const m = document.createElement('div')
    document.body.appendChild(m)
    m.appendChild(wrapper)

    const pages = distributeQuestionsOptimized(1, [989], 823, 991, 2, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)

    expect(items.length).toBe(2)
    expect(items.some((x: any) => x.assertiveListFrag?.blockIdx === 2)).toBe(true)
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

  test('[otimizado] fragmenta wrapper com múltiplos .question-text no mesmo conteúdo (regressão set discursivo)', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'questao-item-wrapper'
    setOffsetHeight(wrapper, 1000)
    setComputedMargins(wrapper, 0, 0)

    const content = document.createElement('div')
    content.className = 'questao-conteudo'

    const root = document.createElement('div')
    root.className = 'question-readonly-root'

    const baseReadonly = document.createElement('div')
    baseReadonly.className = 'question-readonly'
    const baseText = document.createElement('div')
    baseText.className = 'question-text'
    ;[200, 200].forEach((h) => {
      const p = document.createElement('p')
      setRect(p, { height: h })
      baseText.appendChild(p)
    })
    baseReadonly.appendChild(baseText)

    const itemWrapper = document.createElement('div')
    itemWrapper.className = 'flex-1'
    const itemReadonly = document.createElement('div')
    itemReadonly.className = 'question-readonly'
    const itemText = document.createElement('div')
    itemText.className = 'question-text'
    ;[180, 180, 180].forEach((h) => {
      const p = document.createElement('p')
      setRect(p, { height: h })
      itemText.appendChild(p)
    })
    itemReadonly.appendChild(itemText)
    itemWrapper.appendChild(itemReadonly)

    root.appendChild(baseReadonly)
    root.appendChild(itemWrapper)
    content.appendChild(root)
    wrapper.appendChild(content)

    const m = document.createElement('div')
    m.appendChild(wrapper)
    document.body.appendChild(m)

    const pages = distributeQuestionsOptimized(1, [1000], 742, 931, 1, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(1)
    expect(items.every((x: any) => x.kind === 'frag')).toBe(true)
  })

  test('[otimizado] fragmento seguinte vai para coluna2 da primeira página quando cabe', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 900, blockHeights: [400, 300, 180], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(1, [900], 742, 931, 2, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(1)
    expect(pages).toHaveLength(1)
    expect(pages[0].coluna1[0]).toMatchObject({ kind: 'frag', q: 0, first: true })
    expect(pages[0].coluna2[0]).toMatchObject({ kind: 'frag', q: 0, first: false })
  })

  test('[otimizado] não pula a coluna2 da primeira página quando o próximo fragmento precisa ser menor que otherPageCapacity', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1200, blockHeights: [400, 400, 400], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(1, [1200], 742, 931, 2, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(2)
    expect(pages[0].coluna1[0]).toMatchObject({ kind: 'frag', q: 0, first: true })
    expect(pages[0].coluna2[0]).toMatchObject({ kind: 'frag', q: 0, first: false })
    expect(pages[1].coluna1[0]).toMatchObject({ kind: 'frag', q: 0, first: false })
  })

  test('[otimizado] recomeça a fragmentação em página limpa quando o residual atual é pequeno demais', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 300, blockHeights: [180, 100], noOptions: true },
      { wrapperHeight: 1000, blockHeights: [250, 250, 250], noOptions: true },
      { wrapperHeight: 120, blockHeights: [70, 40], noOptions: true },
      { wrapperHeight: 120, blockHeights: [70, 40], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4, [300, 1000, 120, 120], 742, 931, 1, m,
      [{ baseIndex: 2, itemIndexes: [3] }]
    )
    const q1Items = flattenItems(pages).filter((x) => x.q === 1)
    expect(q1Items.length).toBeGreaterThan(1)
    expect(pages[0].coluna1[0]).toMatchObject({ kind: 'full', q: 0 })
    expect(pages[1].coluna1[0]).toMatchObject({ kind: 'frag', q: 1, first: true })
  })

  test('[otimizado] continua fragmentando mesmo quando o primeiro fragmento é pequeno', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 950, blockHeights: [150, 400, 380], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(1, [950], 300, 600, 1, m, [])
    const items = flattenItems(pages).filter((x) => x.q === 0)
    expect(items.length).toBeGreaterThan(1)
    expect(items.every((x: any) => x.kind === 'frag')).toBe(true)
  })

  test('[otimizado] não começa questão com fragmento minúsculo em coluna já ocupada', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1179, blockHeights: [13, 384, 35, 13, 421, 12, 74, 129], noOptions: true },
      { wrapperHeight: 2060, blockHeights: [13, 347, 23, 13, 220, 74, 184, 37, 293, 330, 23, 92, 92, 74], noOptions: true },
      { wrapperHeight: 120, blockHeights: [70, 40], noOptions: true },
      { wrapperHeight: 120, blockHeights: [70, 40], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(
      4,
      [1179, 2060, 120, 120],
      742,
      931,
      2,
      m,
      [{ baseIndex: 2, itemIndexes: [3] }]
    )

    expect(pages[0].coluna2.some((x: any) => x.q === 1)).toBe(false)
    expect(pages[1].coluna1[0]).toMatchObject({ kind: 'frag', q: 1, first: true })
  })

  test('[otimizado] não coloca outra questão abaixo de fragmento que ainda continua', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1000, blockHeights: [400, 400, 180], noOptions: true },
      { wrapperHeight: 200, blockHeights: [120, 60], noOptions: true },
    ])
    const pages = distributeQuestionsOptimized(2, [1000, 200], 742, 931, 2, m, [])

    expect(pages[0].coluna1[0]).toMatchObject({ kind: 'frag', q: 0, first: true })
    expect(pages[0].coluna1.some((x: any) => x.q === 1)).toBe(false)
    expect(flattenItems(pages).filter((x) => x.q === 0).length).toBeGreaterThan(1)
  })

  test('[otimizado] com setGroups preserva a ordem de primeira aparição das questões livres (regressão do montar)', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 1179, blockHeights: [401, 35, 438, 12, 74, 129], noOptions: true },
      { wrapperHeight: 2064, blockHeights: [364, 23, 237, 74, 184, 37, 293, 330, 23, 92, 37, 92, 92, 74], noOptions: true },
      { wrapperHeight: 1461, blockHeights: [532, 495, 35, 55, 55, 19, 74, 55, 55], noOptions: true },
      { wrapperHeight: 717, blockHeights: [275, 110, 23, 37, 37, 37, 55, 55], noOptions: true },
      { wrapperHeight: 2282, blockHeights: [37, 19, 19, 330, 275, 19, 184, 19, 312, 257, 147, 129, 184, 19, 239, 23], noOptions: true },
      { wrapperHeight: 246, blockHeights: [92, 92], noOptions: true },
      { wrapperHeight: 356, blockHeights: [110, 19, 92], noOptions: true },
    ])

    const pages = distributeQuestionsOptimized(
      7,
      [1179, 2064, 1461, 717, 2282, 246, 356],
      820,
      991,
      2,
      m,
      [{ baseIndex: 4, itemIndexes: [5, 6] }]
    )

    const firstAppearance = Array.from(
      new Set(flattenItems(pages).map((item) => item.q))
    )

    expect(firstAppearance).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  test('[otimizado] conta gaps reais entre blocos de um único question-text ao fragmentar', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'questao-item-wrapper'
    setOffsetHeight(wrapper, 900)
    setComputedMargins(wrapper, 0, 0)

    const content = document.createElement('div')
    content.className = 'questao-conteudo'
    setRect(content, { top: 0, height: 860, bottom: 860 })

    const text = document.createElement('div')
    text.className = 'question-text'

    const blocks = [
      { top: 0, height: 200, bottom: 200 },
      { top: 220, height: 200, bottom: 420 },
      { top: 440, height: 200, bottom: 640 },
      { top: 660, height: 200, bottom: 860 },
    ]

    blocks.forEach((rect, idx) => {
      const p = document.createElement('p')
      p.textContent = `Bloco ${idx + 1}`
      setRect(p, rect)
      text.appendChild(p)
    })

    content.appendChild(text)
    wrapper.appendChild(content)

    const short = document.createElement('div')
    short.className = 'questao-item-wrapper'
    setOffsetHeight(short, 40)
    setComputedMargins(short, 0, 0)
    const shortContent = document.createElement('div')
    shortContent.className = 'questao-conteudo'
    const shortText = document.createElement('div')
    shortText.className = 'question-text'
    const shortP = document.createElement('p')
    setRect(shortP, { top: 0, height: 40, bottom: 40 })
    shortText.appendChild(shortP)
    shortContent.appendChild(shortText)
    short.appendChild(shortContent)

    const m = document.createElement('div')
    m.appendChild(wrapper)
    m.appendChild(short)
    document.body.appendChild(m)

    const pages = distributeQuestionsOptimized(2, [900, 40], 450, 450, 1, m, [])
    const q0Items = flattenItems(pages).filter((x) => x.q === 0)
    expect(q0Items.length).toBeGreaterThan(1)
    expect(pages[1].coluna1[0]).toMatchObject({ kind: 'frag', q: 0, first: false })
    expect(pages[1].coluna1.some((x: any) => x.q === 1)).toBe(false)
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

  test('[residual] fragmenta item seguinte do mesmo grupo antes de fechar a coluna atual', () => {
    const m = createMeasurementContainer([
      { wrapperHeight: 200, blockHeights: [120, 60], noOptions: true }, // base
      { wrapperHeight: 200, blockHeights: [120, 60], noOptions: true }, // item 1
      { wrapperHeight: 700, blockHeights: [300, 300, 80], noOptions: true }, // item 2
    ])
    const pages = distributeQuestionsOptimized(
      3, [200, 200, 700], 931, 931, 2, m,
      [{ baseIndex: 0, itemIndexes: [1, 2] }]
    )
    const item2 = flattenItems(pages).filter((x) => x.q === 2)
    expect(item2.length).toBeGreaterThan(1)
    expect(pages[0].coluna1[2]).toMatchObject({ kind: 'frag', q: 2, first: true })
    expect(pages[0].coluna2[0]).toMatchObject({ kind: 'frag', q: 2, first: false })
  })
})
