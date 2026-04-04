import { render, screen } from '@testing-library/react'
import QuestionRendererBase from '@/components/Questions/QuestionRendererBase'

describe('QuestionRendererBase - fragmentação de set discursivo', () => {
  test('renderiza apenas os blocos do fragmento em set discursivo', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'set_questions',
          content: [
            {
              type: 'base_text',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Base A' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Base B' }] },
              ],
            },
            {
              type: 'question_item',
              attrs: { answerKey: { kind: 'essay' } },
              content: [
                {
                  type: 'statement',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] },
                  ],
                },
              ],
            },
            {
              type: 'question_item',
              attrs: { answerKey: { kind: 'essay' } },
              content: [
                {
                  type: 'statement',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <QuestionRendererBase
        content={content}
        mode="prova"
        fragmentRender={{ textBlocks: [1, 2], options: [] }}
      />
    )

    expect(screen.getByText('Base A')).toBeInTheDocument()
    expect(screen.getByText('Base B')).toBeInTheDocument()
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument()
  })

  test('renderiza label apenas no início da seção de texto base presente no fragmento', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'question',
          content: [
            {
              type: 'base_text',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Trecho A1' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Trecho A2' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Trecho B1' }] },
              ],
            },
          ],
        },
      ],
    }

    render(
      <QuestionRendererBase
        content={content}
        mode="prova"
        fragmentRender={{ textBlocks: [3], options: [] }}
        baseTextSections={[
          { id: 'a', tag: 'AAA', blockCount: 2 },
          { id: 'b', tag: 'BBB', blockCount: 1 },
        ]}
      />
    )

    expect(screen.queryByText('Texto AAA')).not.toBeInTheDocument()
    expect(screen.getByText('Texto BBB')).toBeInTheDocument()
    expect(screen.getByText('Trecho B1')).toBeInTheDocument()
  })

  test('oculta label de seção marcada como hidden sem alterar o texto base', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'question',
          content: [
            {
              type: 'base_text',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Trecho A1' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Trecho B1' }] },
              ],
            },
          ],
        },
      ],
    }

    render(
      <QuestionRendererBase
        content={content}
        mode="prova"
        baseTextSections={[
          { id: 'a', tag: 'AAA', blockCount: 1, hidden: true },
          { id: 'b', tag: 'BBB', blockCount: 1 },
        ]}
      />
    )

    expect(screen.queryByText('Texto AAA')).not.toBeInTheDocument()
    expect(screen.getByText('Texto BBB')).toBeInTheDocument()
    expect(screen.getByText('Trecho A1')).toBeInTheDocument()
    expect(screen.getByText('Trecho B1')).toBeInTheDocument()
  })

  test('mantém os índices de fragmento alinhados quando labels de textos base estão ativos', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'set_questions',
          content: [
            {
              type: 'base_text',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Base A1' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Base A2' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Base B1' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Base B2' }] },
              ],
            },
            {
              type: 'question_item',
              attrs: { answerKey: { kind: 'essay' } },
              content: [
                {
                  type: 'statement',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Parte 1' }] },
                  ],
                },
              ],
            },
            {
              type: 'question_item',
              attrs: { answerKey: { kind: 'essay' } },
              content: [
                {
                  type: 'statement',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Parte 2' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <QuestionRendererBase
        content={content}
        mode="prova"
        fragmentRender={{ textBlocks: [5, 6], options: [] }}
        baseTextSections={[
          { id: 'a', tag: 'AAA', blockCount: 2 },
          { id: 'b', tag: 'BBB', blockCount: 2 },
        ]}
      />
    )

    expect(screen.queryByText('Base A1')).not.toBeInTheDocument()
    expect(screen.queryByText('Base B2')).not.toBeInTheDocument()
    expect(screen.queryByText('Texto AAA')).not.toBeInTheDocument()
    expect(screen.queryByText('Texto BBB')).not.toBeInTheDocument()
    expect(screen.getByText('Parte 1')).toBeInTheDocument()
    expect(screen.getByText('Parte 2')).toBeInTheDocument()
  })
})
