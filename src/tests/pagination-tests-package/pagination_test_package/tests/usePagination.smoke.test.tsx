import { renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/pagination', async () => {
  return {
    calculatePageLayout: vi.fn(() => [{ coluna1: [], coluna2: [], remainingHeight: 100 }]),
  }
})

import { usePagination } from '@/hooks/usePagination'

describe('usePagination smoke', () => {
  test('hook publica pages após cálculo bem-sucedido', async () => {
    const { result } = renderHook(() =>
      usePagination({
        config: {
          pageHeight: 1000,
          safetyMargin: 20,
          columns: 1,
        },
        questionCount: 1,
        dependencies: ['smoke'],
      }),
    )

    const refs = result.current.refs
    const makeRefDiv = () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'offsetHeight', {
        configurable: true,
        get: () => 100,
      })
      return el
    }

    refs.measureItemsRef.current = makeRefDiv()
    refs.measureFirstPageRef.current = makeRefDiv()
    refs.measureFirstQuestoesRef.current = makeRefDiv()
    refs.measureOtherPageRef.current = makeRefDiv()
    refs.measureOtherQuestoesRef.current = makeRefDiv()

    await waitFor(() => {
      expect(result.current.pages.length).toBe(1)
    })
  })
})
