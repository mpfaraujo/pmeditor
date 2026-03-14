/**
 * Testa o comportamento de disparo do usePagination:
 * - Só recalcula quando repaginateVersion muda (ou questionCount/columns mudam)
 * - NÃO recalcula quando conteúdo de questões muda (expandedQuestions, etc.)
 */

import { render, act, waitFor } from '@testing-library/react'
import { vi, type Mock } from 'vitest'
import React, { useState } from 'react'
import { usePagination } from '@/hooks/usePagination'

// ─── Mock de calculatePageLayout ──────────────────────────────────────────────

vi.mock('@/lib/pagination', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    calculatePageLayout: vi.fn(() => [
      { coluna1: [{ kind: 'full', q: 0 }], coluna2: [], remainingHeight: 100 },
    ]),
  }
})

// Importa DEPOIS do mock para pegar a versão mockada
const { calculatePageLayout } = await import('@/lib/pagination') as any

// ─── Componente de teste ───────────────────────────────────────────────────────

function PaginationConsumer({
  dependencies,
  questionCount = 1,
  columns = 1,
}: {
  dependencies: any[]
  questionCount?: number
  columns?: 1 | 2
}) {
  const { refs } = usePagination({
    config: {
      pageHeight: 1000,
      safetyMargin: 10,
      columns,
      optimizeLayout: false,
    },
    questionCount,
    dependencies,
  })

  return (
    <div>
      <div ref={refs.measureItemsRef} style={{ height: 10 }} />
      <div ref={refs.measureFirstPageRef} style={{ height: 900 }} />
      <div ref={refs.measureFirstQuestoesRef} style={{ height: 900 }} />
      <div ref={refs.measureOtherPageRef} style={{ height: 900 }} />
      <div ref={refs.measureOtherQuestoesRef} style={{ height: 900 }} />
    </div>
  )
}

// ─── Wrapper controlável ───────────────────────────────────────────────────────

function ControlledWrapper({
  initialDeps,
  initialCount = 1,
}: {
  initialDeps: any[]
  initialCount?: number
}) {
  const [deps, setDeps] = useState(initialDeps)
  const [count, setCount] = useState(initialCount)
  ;(ControlledWrapper as any)._setDeps = setDeps
  ;(ControlledWrapper as any)._setCount = setCount
  return <PaginationConsumer dependencies={deps} questionCount={count} />
}

// ─── Testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  (calculatePageLayout as Mock).mockClear()
})

describe('usePagination - controle de disparo', () => {

  test('calcula na montagem inicial', async () => {
    render(<PaginationConsumer dependencies={[0]} />)
    await waitFor(() => {
      expect(calculatePageLayout).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
  })

  test('NÃO recalcula quando dependencies não muda', async () => {
    const deps = [0]
    const { rerender } = render(<PaginationConsumer dependencies={deps} />)
    await waitFor(() => expect(calculatePageLayout).toHaveBeenCalledTimes(1), { timeout: 3000 })

    // Re-renderiza com o mesmo array (mesmo conteúdo serializado)
    ;(calculatePageLayout as Mock).mockClear()
    rerender(<PaginationConsumer dependencies={[0]} />)

    // Espera um ciclo e confirma que NÃO disparou de novo
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    expect(calculatePageLayout).not.toHaveBeenCalled()
  })

  test('recalcula quando repaginateVersion (dependencies[0]) incrementa', async () => {
    let repaginateVersion = 0
    const { rerender } = render(<PaginationConsumer dependencies={[repaginateVersion]} />)
    await waitFor(() => expect(calculatePageLayout).toHaveBeenCalledTimes(1), { timeout: 3000 })

    ;(calculatePageLayout as Mock).mockClear()
    repaginateVersion = 1
    rerender(<PaginationConsumer dependencies={[repaginateVersion]} />)

    await waitFor(() => {
      expect(calculatePageLayout).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
  })

  test('recalcula quando questionCount muda (add/remove questão)', async () => {
    const { rerender } = render(<PaginationConsumer dependencies={[0]} questionCount={2} />)
    await waitFor(() => expect(calculatePageLayout).toHaveBeenCalledTimes(1), { timeout: 3000 })

    ;(calculatePageLayout as Mock).mockClear()
    rerender(<PaginationConsumer dependencies={[0]} questionCount={3} />)

    await waitFor(() => {
      expect(calculatePageLayout).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
  })

  test('recalcula quando columns muda (1 → 2)', async () => {
    const { rerender } = render(<PaginationConsumer dependencies={[0]} columns={1} />)
    await waitFor(() => expect(calculatePageLayout).toHaveBeenCalledTimes(1), { timeout: 3000 })

    ;(calculatePageLayout as Mock).mockClear()
    rerender(<PaginationConsumer dependencies={[0]} columns={2} />)

    await waitFor(() => {
      expect(calculatePageLayout).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
  })

  test('NÃO recalcula quando conteúdo muda mas repaginateVersion é o mesmo', async () => {
    // Simula edição de questão: expandedQuestions muda, mas repaginateVersion não
    const repaginateVersion = 0
    const { rerender } = render(
      <PaginationConsumer dependencies={[repaginateVersion]} questionCount={2} />
    )
    await waitFor(() => expect(calculatePageLayout).toHaveBeenCalledTimes(1), { timeout: 3000 })

    ;(calculatePageLayout as Mock).mockClear()

    // Novo objeto de expandedQuestions (como acontece ao editar questão),
    // mas repaginateVersion continua 0
    const novoExpandedQuestions = [{ id: 'q1', texto: 'editado' }, { id: 'q2' }]
    rerender(
      // dependências ainda têm só [0] — conteúdo editado não entra nas deps
      <PaginationConsumer dependencies={[repaginateVersion]} questionCount={2} />
    )

    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    expect(calculatePageLayout).not.toHaveBeenCalled()
  })

})
