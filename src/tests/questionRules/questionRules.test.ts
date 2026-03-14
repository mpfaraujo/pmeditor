import {
  getQuestionSetConstraints,
  shouldRenderGroupSetAsSingleQuestion,
  canRemoveQuestionItem,
  shouldShowEssayPartLabels,
  essayPartLabel,
  groupBaseTextTitle,
} from '@/lib/questionRules'

// ─── getQuestionSetConstraints ─────────────────────────────────────────────

describe('getQuestionSetConstraints', () => {
  test('Discursiva → mode essay, minItems 1', () => {
    expect(getQuestionSetConstraints('Discursiva')).toEqual({ mode: 'essay', minItems: 1 })
  })

  test('Múltipla Escolha → mode group, minItems 2', () => {
    expect(getQuestionSetConstraints('Múltipla Escolha')).toEqual({ mode: 'group', minItems: 2 })
  })

  test('Certo/Errado → mode group, minItems 2', () => {
    expect(getQuestionSetConstraints('Certo/Errado')).toEqual({ mode: 'group', minItems: 2 })
  })
})

// ─── shouldRenderGroupSetAsSingleQuestion ──────────────────────────────────

describe('shouldRenderGroupSetAsSingleQuestion', () => {
  test('1 item → true (renderiza como questão normal)', () => {
    expect(shouldRenderGroupSetAsSingleQuestion(1)).toBe(true)
  })

  test('2 itens → false', () => {
    expect(shouldRenderGroupSetAsSingleQuestion(2)).toBe(false)
  })

  test('5 itens → false', () => {
    expect(shouldRenderGroupSetAsSingleQuestion(5)).toBe(false)
  })
})

// ─── canRemoveQuestionItem ─────────────────────────────────────────────────

describe('canRemoveQuestionItem', () => {
  test('MCQ com 3 itens → pode remover (acima do mínimo 2)', () => {
    expect(canRemoveQuestionItem('Múltipla Escolha', 3)).toBe(true)
  })

  test('MCQ com 2 itens → não pode remover (no mínimo)', () => {
    expect(canRemoveQuestionItem('Múltipla Escolha', 2)).toBe(false)
  })

  test('MCQ com 1 item → não pode remover', () => {
    expect(canRemoveQuestionItem('Múltipla Escolha', 1)).toBe(false)
  })

  test('Certo/Errado com 3 itens → pode remover', () => {
    expect(canRemoveQuestionItem('Certo/Errado', 3)).toBe(true)
  })

  test('Certo/Errado com 2 itens → não pode remover', () => {
    expect(canRemoveQuestionItem('Certo/Errado', 2)).toBe(false)
  })

  test('Discursiva com 1 item → não pode remover (mínimo 1)', () => {
    expect(canRemoveQuestionItem('Discursiva', 1)).toBe(false)
  })

  test('Discursiva com 2 itens → pode remover (acima do mínimo 1)', () => {
    expect(canRemoveQuestionItem('Discursiva', 2)).toBe(true)
  })
})

// ─── shouldShowEssayPartLabels ─────────────────────────────────────────────

describe('shouldShowEssayPartLabels', () => {
  test('1 parte → não mostra labels', () => {
    expect(shouldShowEssayPartLabels(1)).toBe(false)
  })

  test('2 partes → mostra labels', () => {
    expect(shouldShowEssayPartLabels(2)).toBe(true)
  })

  test('5 partes → mostra labels', () => {
    expect(shouldShowEssayPartLabels(5)).toBe(true)
  })
})

// ─── essayPartLabel ────────────────────────────────────────────────────────

describe('essayPartLabel', () => {
  test('índices 0-25 geram a) até z)', () => {
    const letras = 'abcdefghijklmnopqrstuvwxyz'.split('')
    for (let i = 0; i < 26; i++) {
      expect(essayPartLabel(i)).toBe(`${letras[i]})`)
    }
  })

  test('índice 26 → aa) (volta ao início, estilo Excel)', () => {
    expect(essayPartLabel(26)).toBe('aa)')
  })

  test('índice 27 → ab)', () => {
    expect(essayPartLabel(27)).toBe('ab)')
  })

  test('índice 51 → az)', () => {
    expect(essayPartLabel(51)).toBe('az)')
  })

  test('índice 52 → ba)', () => {
    expect(essayPartLabel(52)).toBe('ba)')
  })

  test('índice 0 → a) (primeiro)', () => {
    expect(essayPartLabel(0)).toBe('a)')
  })

  test('índice 25 → z) (último single-letter)', () => {
    expect(essayPartLabel(25)).toBe('z)')
  })
})

// ─── groupBaseTextTitle ────────────────────────────────────────────────────

describe('groupBaseTextTitle', () => {
  test('2 questões', () => {
    expect(groupBaseTextTitle(2)).toBe(
      'Use o texto a seguir para responder às próximas 2 questões.'
    )
  })

  test('5 questões', () => {
    expect(groupBaseTextTitle(5)).toBe(
      'Use o texto a seguir para responder às próximas 5 questões.'
    )
  })
})
