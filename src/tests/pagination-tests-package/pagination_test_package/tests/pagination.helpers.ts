export function setRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect)
}

export function setOffsetHeight(el: HTMLElement, value: number) {
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => value,
  })
}

export function setComputedMargins(el: HTMLElement, mt = 0, mb = 0) {
  el.style.marginTop = `${mt}px`
  el.style.marginBottom = `${mb}px`
}

export function createPageFixture({
  pageHeight,
  occupiedTop,
}: {
  pageHeight: number
  occupiedTop: number
}) {
  const page = document.createElement('div')
  const questions = document.createElement('div')
  document.body.appendChild(page)
  document.body.appendChild(questions)

  setOffsetHeight(page, pageHeight)
  setRect(page, { top: 0, height: pageHeight, bottom: pageHeight })
  setRect(questions, { top: occupiedTop, height: 100, bottom: occupiedTop + 100 })

  return { page, questions }
}

export function createQuestionWrapper({
  wrapperHeight,
  blockHeights,
  optionsAsSingleBlock = true,
  marginBottom = 0,
}: {
  wrapperHeight: number
  blockHeights: number[]
  optionsAsSingleBlock?: boolean
  marginBottom?: number
}) {
  const wrapper = document.createElement('div')
  wrapper.className = 'questao-item-wrapper'
  setOffsetHeight(wrapper, wrapperHeight)
  setComputedMargins(wrapper, 0, marginBottom)

  const content = document.createElement('div')
  content.className = 'questao-conteudo'

  const text = document.createElement('div')
  text.className = 'question-text'

  const textBlocks = optionsAsSingleBlock ? blockHeights.length - 1 : Math.max(1, blockHeights.length - 2)

  for (let i = 0; i < textBlocks; i++) {
    const p = document.createElement('p')
    p.textContent = `bloco-${i}`
    setRect(p, { height: blockHeights[i] })
    text.appendChild(p)
  }

  content.appendChild(text)

  const options = document.createElement('div')
  options.className = 'question-options'

  if (optionsAsSingleBlock) {
    setRect(options, { height: blockHeights[blockHeights.length - 1] ?? 0 })
  } else {
    for (let i = textBlocks; i < blockHeights.length; i++) {
      const opt = document.createElement('div')
      opt.textContent = `opt-${i}`
      setRect(opt, { height: blockHeights[i] })
      options.appendChild(opt)
    }
  }

  content.appendChild(options)
  wrapper.appendChild(content)
  return wrapper
}

export function createMeasurementContainer(questionDefs: Array<{
  wrapperHeight: number
  blockHeights: number[]
  optionsAsSingleBlock?: boolean
  marginBottom?: number
}>) {
  const container = document.createElement('div')
  for (const def of questionDefs) {
    container.appendChild(createQuestionWrapper(def))
  }
  document.body.appendChild(container)
  return container
}

export function flattenQuestionIndexes(pages: Array<{ coluna1: any[]; coluna2: any[] }>) {
  return pages.flatMap((p) => [...p.coluna1, ...p.coluna2].map((item) => item.q))
}

export function getPageUsedHeights(pages: Array<{ remainingHeight: number }>, capacities: number[]) {
  return pages.map((page, i) => capacities[i] - page.remainingHeight)
}
