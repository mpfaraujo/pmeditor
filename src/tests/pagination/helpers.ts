/**
 * Helpers para montar fixtures DOM previsíveis nos testes de paginação.
 * A estrutura DOM imita o que ProvaLayout e QuestionRendererBase produzem.
 */

export function setRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0,
    width: 0, height: 0, right: 0, bottom: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect)
}

export function setOffsetHeight(el: HTMLElement, value: number) {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => value })
}

export function setComputedMargins(el: HTMLElement, mt = 0, mb = 0) {
  el.style.marginTop = `${mt}px`
  el.style.marginBottom = `${mb}px`
}

/**
 * Cria um wrapper de questão simulado com a estrutura que pagination.ts espera:
 *   .questao-item-wrapper
 *     .questao-conteudo
 *       .question-text
 *         <p> (blocos de texto)
 *       .question-options
 *         <div> (opções individuais, se optionsAsSingleBlock=false)
 *
 * @param wrapperHeight  offsetHeight total do wrapper
 * @param blockHeights   alturas de cada bloco medido via getBoundingClientRect
 * @param optionsAsSingleBlock  true = opções como 1 div atômica (fragmentação desabilitada)
 *                              false = cada opção é filho individual (fragmentação possível)
 * @param noOptions      true = sem .question-options (ex: texto base de set_questions)
 */
export function createQuestionWrapper({
  wrapperHeight,
  blockHeights,
  optionsAsSingleBlock = true,
  noOptions = false,
  marginBottom = 0,
}: {
  wrapperHeight: number
  blockHeights: number[]
  optionsAsSingleBlock?: boolean
  noOptions?: boolean
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

  // Quantos blocos vão para .question-text
  const textBlockCount = noOptions
    ? blockHeights.length
    : optionsAsSingleBlock
      ? blockHeights.length - 1
      : Math.max(1, blockHeights.length - 2)

  for (let i = 0; i < textBlockCount; i++) {
    const p = document.createElement('p')
    setRect(p, { height: blockHeights[i] })
    text.appendChild(p)
  }
  content.appendChild(text)

  if (!noOptions) {
    const options = document.createElement('div')
    options.className = 'question-options'

    if (optionsAsSingleBlock) {
      setRect(options, { height: blockHeights[blockHeights.length - 1] ?? 0 })
    } else {
      for (let i = textBlockCount; i < blockHeights.length; i++) {
        const opt = document.createElement('div')
        setRect(opt, { height: blockHeights[i] })
        options.appendChild(opt)
      }
    }
    content.appendChild(options)
  }

  wrapper.appendChild(content)
  return wrapper
}

export function createMeasurementContainer(defs: Array<Parameters<typeof createQuestionWrapper>[0]>) {
  const container = document.createElement('div')
  for (const def of defs) container.appendChild(createQuestionWrapper(def))
  document.body.appendChild(container)
  return container
}

export function createPageFixture({ pageHeight, occupiedTop }: { pageHeight: number; occupiedTop: number }) {
  const page = document.createElement('div')
  const questions = document.createElement('div')
  document.body.appendChild(page)
  document.body.appendChild(questions)
  setOffsetHeight(page, pageHeight)
  setRect(page, { top: 0, height: pageHeight, bottom: pageHeight })
  setRect(questions, { top: occupiedTop, height: 100, bottom: occupiedTop + 100 })
  return { page, questions }
}

export function flattenItems(pages: Array<{ coluna1: any[]; coluna2: any[] }>) {
  return pages.flatMap((p) => [...p.coluna1, ...p.coluna2])
}
