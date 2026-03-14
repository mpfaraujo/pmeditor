import { parseYamlMeta, generateYamlTemplate, generateYamlSetTemplate } from '@/lib/yamlMeta'

// ─── Helpers ───────────────────────────────────────────────────────────────

function wrap(body: string) {
  return `---\n${body}\n---`
}

// ─── Casos sem frontmatter ─────────────────────────────────────────────────

describe('parseYamlMeta - sem frontmatter', () => {
  test('texto sem --- retorna null', () => {
    expect(parseYamlMeta('tipo: Múltipla Escolha')).toBeNull()
  })

  test('string vazia retorna null', () => {
    expect(parseYamlMeta('')).toBeNull()
  })

  test('frontmatter vazio (só traços) retorna null', () => {
    expect(parseYamlMeta('---\n---')).toBeNull()
  })

  test('frontmatter só com comentários retorna null', () => {
    expect(parseYamlMeta(wrap('# apenas um comentário'))).toBeNull()
  })

  test('--- sem fechamento retorna null', () => {
    expect(parseYamlMeta('---\ntipo: Múltipla Escolha')).toBeNull()
  })
})

// ─── Campos básicos ────────────────────────────────────────────────────────

describe('parseYamlMeta - campos básicos', () => {
  test('tipo: Múltipla Escolha', () => {
    const r = parseYamlMeta(wrap('tipo: Múltipla Escolha'))
    expect(r?.tipo).toBe('Múltipla Escolha')
  })

  test('tipo: V/F → Certo/Errado', () => {
    const r = parseYamlMeta(wrap('tipo: V/F'))
    expect(r?.tipo).toBe('Certo/Errado')
  })

  test('tipo: vf → Certo/Errado (case-insensitive)', () => {
    const r = parseYamlMeta(wrap('tipo: vf'))
    expect(r?.tipo).toBe('Certo/Errado')
  })

  test('tipo: certo/errado → Certo/Errado', () => {
    const r = parseYamlMeta(wrap('tipo: certo/errado'))
    expect(r?.tipo).toBe('Certo/Errado')
  })

  test('tipo: discursiva → Discursiva', () => {
    const r = parseYamlMeta(wrap('tipo: discursiva'))
    expect(r?.tipo).toBe('Discursiva')
  })

  test('tipo desconhecido ignorado', () => {
    const r = parseYamlMeta(wrap('tipo: Inválido\ndificuldade: Fácil'))
    expect(r?.tipo).toBeUndefined()
    expect(r?.dificuldade).toBe('Fácil')
  })

  test('dificuldade: Fácil', () => {
    const r = parseYamlMeta(wrap('dificuldade: Fácil'))
    expect(r?.dificuldade).toBe('Fácil')
  })

  test('dificuldade: média (lowercase) → Média', () => {
    const r = parseYamlMeta(wrap('dificuldade: média'))
    expect(r?.dificuldade).toBe('Média')
  })

  test('dificuldade inválida ignorada', () => {
    const r = parseYamlMeta(wrap('dificuldade: Absurda\ntipo: Discursiva'))
    expect(r?.dificuldade).toBeUndefined()
    expect(r?.tipo).toBe('Discursiva')
  })

  test('disciplina preserva valor quando não está no mapa canônico', () => {
    const r = parseYamlMeta(wrap('disciplina: "Disciplina Livre"'))
    expect(r?.disciplina).toBe('Disciplina Livre')
  })

  test('disciplina: Física → normaliza para Física', () => {
    const r = parseYamlMeta(wrap('disciplina: Física'))
    expect(r?.disciplina).toBe('Física')
  })

  test('assunto preserva valor desconhecido', () => {
    const r = parseYamlMeta(wrap('assunto: Assunto Qualquer'))
    expect(r?.assunto).toBe('Assunto Qualquer')
  })

  test('nivel: médio', () => {
    const r = parseYamlMeta(wrap('nivel: médio'))
    expect(r?.nivel).toBe('medio')
  })

  test('nivel: fundamental', () => {
    const r = parseYamlMeta(wrap('nivel: fundamental'))
    expect(r?.nivel).toBe('fundamental')
  })

  test('nivel: superior', () => {
    const r = parseYamlMeta(wrap('nivel: superior'))
    expect(r?.nivel).toBe('superior')
  })

  test('nivel inválido ignorado', () => {
    const r = parseYamlMeta(wrap('nivel: primário\ntipo: Discursiva'))
    expect(r?.nivel).toBeUndefined()
    expect(r?.tipo).toBe('Discursiva')
  })
})

// ─── Gabarito ──────────────────────────────────────────────────────────────

describe('parseYamlMeta - gabarito', () => {
  test.each(['A', 'B', 'C', 'D', 'E'])('gabarito: %s → mcq', (letra) => {
    const r = parseYamlMeta(wrap(`gabarito: ${letra}`))
    expect(r?.gabarito).toEqual({ kind: 'mcq', correct: letra })
  })

  test('gabarito: a (lowercase) → mcq A', () => {
    const r = parseYamlMeta(wrap('gabarito: a'))
    expect(r?.gabarito).toEqual({ kind: 'mcq', correct: 'A' })
  })

  test('gabarito: C → tf (Certo)', () => {
    // C é válido tanto como MCQ quanto TF — deve ser MCQ (MCQ_LETTERS verificado primeiro)
    const r = parseYamlMeta(wrap('gabarito: C'))
    expect(r?.gabarito).toEqual({ kind: 'mcq', correct: 'C' })
  })

  test('gabarito: V → tf Certo', () => {
    const r = parseYamlMeta(wrap('gabarito: V'))
    expect(r?.gabarito).toEqual({ kind: 'tf', correct: 'C' })
  })

  test('gabarito: F → tf Errado', () => {
    const r = parseYamlMeta(wrap('gabarito: F'))
    expect(r?.gabarito).toEqual({ kind: 'tf', correct: 'E' })
  })

  test('gabarito: vazio com tipo Discursiva → essay', () => {
    const r = parseYamlMeta(wrap('tipo: Discursiva\ngabarito: vazio'))
    expect(r?.gabarito).toEqual({ kind: 'essay' })
  })

  test('gabarito: "" com tipo Discursiva → essay', () => {
    const r = parseYamlMeta(wrap('tipo: Discursiva\ngabarito: ""'))
    expect(r?.gabarito).toEqual({ kind: 'essay' })
  })

  test('gabarito sem valor (linha vazia) com Discursiva → ignorado (não gera essay)', () => {
    // Parser ignora val="" antes de chegar em parseGabarito — usar "vazio" explicitamente
    const r = parseYamlMeta(wrap('tipo: Discursiva\ngabarito:'))
    expect(r?.gabarito).toBeUndefined()
  })

  test('gabarito vazio sem tipo → ignorado', () => {
    const r = parseYamlMeta(wrap('tipo: Múltipla Escolha\ngabarito:'))
    expect(r?.gabarito).toBeUndefined()
  })

  test('gabarito inválido ignorado', () => {
    const r = parseYamlMeta(wrap('gabarito: X\ntipo: Múltipla Escolha'))
    expect(r?.gabarito).toBeUndefined()
  })
})

// ─── Tags ──────────────────────────────────────────────────────────────────

describe('parseYamlMeta - tags', () => {
  test('tags: [ENEM, 2024] → array', () => {
    const r = parseYamlMeta(wrap('tags: [ENEM, 2024]'))
    expect(r?.tags).toEqual(['ENEM', '2024'])
  })

  test('tags: ENEM, 2024 (sem colchetes) → array', () => {
    const r = parseYamlMeta(wrap('tags: ENEM, 2024'))
    expect(r?.tags).toEqual(['ENEM', '2024'])
  })

  test('tags: [] → campo ausente (array vazio não salvo)', () => {
    const r = parseYamlMeta(wrap('tags: []\ntipo: Discursiva'))
    expect(r?.tags).toBeUndefined()
    expect(r?.tipo).toBe('Discursiva')
  })

  test('tags com aspas → strip de aspas', () => {
    const r = parseYamlMeta(wrap('tags: ["ENEM", "vestibular"]'))
    expect(r?.tags).toEqual(['ENEM', 'vestibular'])
  })
})

// ─── Campos de fonte ───────────────────────────────────────────────────────

describe('parseYamlMeta - fonte/source', () => {
  test('fonte: original', () => {
    const r = parseYamlMeta(wrap('fonte: original'))
    expect(r?.source?.kind).toBe('original')
  })

  test('fonte: concurso', () => {
    const r = parseYamlMeta(wrap('fonte: concurso'))
    expect(r?.source?.kind).toBe('concurso')
  })

  test('concurso + banca + ano + numero', () => {
    const r = parseYamlMeta(wrap(
      'concurso: ENEM\nbanca: INEP\nano: 2024\nnumero: "42"'
    ))
    expect(r?.source).toEqual({
      concurso: 'ENEM',
      banca: 'INEP',
      ano: 2024,
      numero: '42',
    })
  })

  test('ano inválido (não numérico) ignorado', () => {
    const r = parseYamlMeta(wrap('ano: abc\nbanca: INEP'))
    expect(r?.source?.ano).toBeUndefined()
    expect(r?.source?.banca).toBe('INEP')
  })

  test('fonte ausente mas concurso presente → source criado mesmo sem fonte', () => {
    const r = parseYamlMeta(wrap('concurso: FUVEST'))
    expect(r?.source?.concurso).toBe('FUVEST')
  })

  test('sem campos de fonte → source ausente', () => {
    const r = parseYamlMeta(wrap('tipo: Discursiva'))
    expect(r?.source).toBeUndefined()
  })
})

// ─── Comentários e linhas vazias ───────────────────────────────────────────

describe('parseYamlMeta - comentários e linhas vazias', () => {
  test('comentário inline ignorado', () => {
    const r = parseYamlMeta(wrap('tipo: Múltipla Escolha  # MCQ'))
    expect(r?.tipo).toBe('Múltipla Escolha')
  })

  test('linhas vazias ignoradas', () => {
    const r = parseYamlMeta(wrap('\ntipo: Discursiva\n\ndificuldade: Fácil\n'))
    expect(r?.tipo).toBe('Discursiva')
    expect(r?.dificuldade).toBe('Fácil')
  })
})

// ─── Campos por item (assuntoN, tagsN, gabaritoN) ─────────────────────────

describe('parseYamlMeta - campos por item', () => {
  test('assunto1 e assunto2 → items[0] e items[1]', () => {
    // Usar assuntos desconhecidos para evitar normalização pelo mapa canônico
    const r = parseYamlMeta(wrap('assunto1: Topologia Abstrata\nassunto2: Análise Combinatória'))
    expect(r?.items?.[0]?.assunto).toBe('Topologia Abstrata')
    expect(r?.items?.[1]?.assunto).toBe('Análise Combinatória')
  })

  test('gabarito1: A e gabarito2: B', () => {
    const r = parseYamlMeta(wrap('gabarito1: A\ngabarito2: B'))
    expect(r?.items?.[0]?.gabarito).toEqual({ kind: 'mcq', correct: 'A' })
    expect(r?.items?.[1]?.gabarito).toEqual({ kind: 'mcq', correct: 'B' })
  })

  test('tags1: [ENEM] e tags2: [vestibular]', () => {
    const r = parseYamlMeta(wrap('tags1: [ENEM]\ntags2: [vestibular]'))
    expect(r?.items?.[0]?.tags).toEqual(['ENEM'])
    expect(r?.items?.[1]?.tags).toEqual(['vestibular'])
  })

  test('item 2 sem item 1 → items[0] vazio, items[1] preenchido', () => {
    const r = parseYamlMeta(wrap('assunto2: Topologia Abstrata'))
    expect(r?.items).toHaveLength(2)
    expect(r?.items?.[0]).toEqual({}) // item 1 ausente → objeto vazio
    expect(r?.items?.[1]?.assunto).toBe('Topologia Abstrata')
  })

  test('5 itens → items.length = 5', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `gabarito${i + 1}: A`).join('\n')
    const r = parseYamlMeta(wrap(lines))
    expect(r?.items).toHaveLength(5)
  })

  test('campos de item não entram no nível raiz', () => {
    const r = parseYamlMeta(wrap('assunto1: Funções\nassunto: Álgebra'))
    expect(r?.assunto).toBe('Álgebra')         // campo raiz preservado
    expect(r?.items?.[0]?.assunto).toBe('Funções') // campo item separado
  })
})

// ─── Template → parseável ─────────────────────────────────────────────────

describe('generateYamlTemplate / generateYamlSetTemplate', () => {
  test('template individual é parseável e retorna tipo MCQ', () => {
    const template = generateYamlTemplate({ disciplina: 'Matemática' })
    const r = parseYamlMeta(template)
    expect(r).not.toBeNull()
    expect(r?.tipo).toBe('Múltipla Escolha')
  })

  test('template de conjunto é parseável e retorna tipo MCQ', () => {
    const template = generateYamlSetTemplate({ disciplina: 'Física' })
    const r = parseYamlMeta(template)
    expect(r).not.toBeNull()
    expect(r?.tipo).toBe('Múltipla Escolha')
  })

  test('template de conjunto tem items (gabarito1 e gabarito2)', () => {
    const template = generateYamlSetTemplate()
    const r = parseYamlMeta(template)
    expect(r?.items).toHaveLength(2)
    expect(r?.items?.[0]?.gabarito).toEqual({ kind: 'mcq', correct: 'A' })
    expect(r?.items?.[1]?.gabarito).toEqual({ kind: 'mcq', correct: 'B' })
  })

  test('template individual com disciplina preenche campo disciplina', () => {
    const template = generateYamlTemplate({ disciplina: 'Física' })
    const r = parseYamlMeta(template)
    expect(r?.disciplina).toBe('Física')
  })
})
