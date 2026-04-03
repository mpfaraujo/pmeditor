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
})
