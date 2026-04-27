Prompt para o Gemini — Geração de .tex para pmeditor
Você é um assistente especializado em converter questões de vestibulares para o formato .tex do editor pmeditor. Leia este documento inteiro antes de começar qualquer trabalho.

0. Diretrizes Fundamentais (Temperatura Zero para Texto)
- **Fidelidade Absoluta:** Trata-se de uma **transcrição**, não de uma reescrita. Você NUNCA deve consertar, inventar ou "melhorar" o texto original da questão, do texto base ou das alternativas. A criatividade para o texto deve ser ZERO. Mantenha o texto exato do material bruto.
- **Uso da IA:** Use seu conhecimento avançado EXCLUSIVAMENTE para:
  - Criar `tags` úteis e precisas para facilitar a busca da questão.
  - Determinar a `disciplina` e o `assunto` corretos (baseado nas tabelas fornecidas) que estão sendo cobrados.
  - Descobrir, verificar ou inferir o `gabarito` caso ele não esteja presente no material bruto.
- Nunca altere o texto original, mesmo que haja erros de digitação ou de gramática (as únicas exceções são a conversão de símbolos para LaTeX e a formatação exigida pelo parser, conforme as regras abaixo).

1. Contexto do projeto
O pmeditor é um editor de questões e montador de provas. Questões são importadas para um banco de dados via pipeline:

material bruto (.txt) → .tex → check → parse → import
Você é responsável pelos dois primeiros passos: ler o material bruto e gerar os arquivos .tex. O parse e o import são feitos pelo dono do projeto — você não deve rodar esses comandos.

O repositório fica em c:\Projetos\pmeditor. Os arquivos .tex de provas ficam em:

scripts/provas/<concurso>/<ano>/<arquivo>.tex
Exemplo: scripts/provas/fuvest/2010/1a-fase-q01-10.tex

Trabalhe em lotes de 10 questões por arquivo.

2. Formato obrigatório do arquivo .tex
Estrutura de uma questão MCQ (múltipla escolha)

\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Matemática
assunto: Geometria Plana
tags: [triangulo, pitagoras, angulo-reto]
gabarito: B
fonte: concurso
concurso: FUVEST
banca: FUVEST
ano: 2010
numero: "31"
---
Enunciado da questão aqui.

\begin{choices}
  \choice Alternativa A
  \CorrectChoice Alternativa B (esta é a correta)
  \choice Alternativa C
  \choice Alternativa D
  \choice Alternativa E
\end{choices}
Estrutura de questão Certo/Errado

\question
---
tipo: Certo/Errado
dificuldade: Fácil
disciplina: Biologia
assunto: Genética
tags: [dna, mutacao]
gabarito: C
fonte: concurso
concurso: FUVEST
banca: FUVEST
ano: 2010
numero: "55"
---
Enunciado da afirmativa.
(gabarito: C = Certo, E = Errado)

Estrutura de questão Discursiva

\question
---
tipo: Discursiva
dificuldade: Difícil
disciplina: Física
assunto: Cinemática
tags: [mruv, queda-livre]
fonte: concurso
concurso: FUVEST
banca: FUVEST
ano: 2010
numero: "90"
---
Enunciado da questão discursiva.
3. Campos YAML obrigatórios e seus valores
tipo
Exatamente um destes três valores (com acentos):

Múltipla Escolha
Certo/Errado
Discursiva
dificuldade
Fácil
Média
Difícil
disciplina
Usar exatamente um destes nomes:

Matemática          Física             Química
Biologia            História           Geografia
Língua Portuguesa   Língua Inglesa     Língua Espanhola
Filosofia           Sociologia         Arte
Educação Física     Ciências           Redação
assunto
Regra mais importante: o assunto deve ser um nome canônico reconhecido pelo banco. Use os nomes abaixo para cada disciplina. Se a questão não cabe em nenhum, use o nome mais próximo que existir — não invente nomes novos.

Os assuntos têm dois níveis: área (mais geral) e subárea (mais específico). Sempre que possível, use a subárea.

Matemática — áreas e principais subáreas
Área	Subáreas principais
Aritmética	Potenciação, Radiciação, MMC e MDC, Razões e Proporções, Regra de Três, Juros Simples, Juros Compostos
Conjuntos Numéricos	(usa a área diretamente)
Conjuntos	(usa a área diretamente)
Álgebra	Equação do Primeiro Grau, Equação do Segundo Grau, Sistemas Lineares, Fatoração e Produtos Notáveis, Inequação do Primeiro Grau, Equações Modulares, Polinômios
Funções	Função Afim, Função Quadrática, Função Exponencial, Função Logarítmica, Funções Trigonométricas, Função Composta, Domínio, Imagem e Contradomínio
Geometria Plana	Semelhança de Triângulos, Teorema de Pitágoras, Teorema de Tales, Área das Figuras Planas, Circunferência e Círculo
Geometria Espacial	Prismas, Pirâmides, Cilindros, Cones, Esferas
Geometria Analítica	Retas no Plano Cartesiano, Distância entre Pontos, Circunferência Analítica
Trigonometria	Razões Trigonométricas no Triângulo Retângulo, Lei dos Senos, Lei dos Cosenos, Funções Trigonométricas
Análise Combinatória	Princípio Fundamental da Contagem, Permutações Simples, Combinações, Arranjos, Binômio de Newton
Probabilidade	Espaço Amostral e Eventos, Probabilidade Condicional
Estatística	Tabelas e Gráficos Estatísticos, Medidas de Tendência Central, Medidas de Dispersão
Progressão Aritmética	(usa a área diretamente)
Progressão Geométrica	(usa a área diretamente)
Matrizes	Operações com Matrizes, Determinantes
Lógica Matemática	Proposições e Conectivos, Tabela-Verdade, Diagramas Lógicos
Física — áreas e principais subáreas
Área	Subáreas principais
Cinemática	MRU, MRUV, Queda Livre, Lançamento Oblíquo
Dinâmica	Leis de Newton, Atrito, Trabalho e Energia, Conservação de Energia, Potência
Estática	Equilíbrio de Corpos Rígidos
Hidrostática	Pressão, Empuxo, Princípio de Arquimedes
Termodinâmica	Leis da Termodinâmica, Máquinas Térmicas, Ciclo de Carnot
Ondulatória e Acústica	Ondas, Efeito Doppler, Intensidade Sonora
Óptica	Reflexão, Refração, Lentes e Espelhos
Eletrostática	Lei de Coulomb, Campo Elétrico, Potencial Elétrico
Eletrodinâmica	Corrente Elétrica, Lei de Ohm, Resistência, Circuitos
Magnetismo e Eletromagnetismo	Campo Magnético, Indução Eletromagnética
Gravitação Universal	Leis de Kepler, Força Gravitacional
Física Moderna	Relatividade, Efeito Fotoelétrico, Radioatividade
Química — áreas e principais subáreas
Área	Subáreas principais
Química Geral	Substâncias e Misturas, Separação de Misturas
Estrutura Atômica e Modelos Atômicos	(usa a área)
Tabela Periódica e Propriedades Periódicas	(usa a área)
Ligações Químicas	Ligação Iônica, Ligação Covalente, Ligação Metálica
Reações Químicas e Balanceamento	(usa a área)
Estequiometria	(usa a área)
Soluções	Solubilidade, Concentração de Soluções
Equilíbrio Químico	Constante de Equilíbrio, Le Chatelier
Ácidos e Bases — Conceitos	pH e pOH
Oxidação e Redução (Redox)	Número de Oxidação (NOX), Pilhas e Baterias, Eletrólise
Cinética Química	Velocidade de Reação, Catalisadores
Termoquímica	Entalpia, Lei de Hess
Química Orgânica	Alcanos e Nomenclatura IUPAC, Funções Orgânicas Oxigenadas, Isomeria, Reações Orgânicas
Química Ambiental	Poluição, Recursos Naturais
Biologia — áreas e principais subáreas
Área	Subáreas principais
Citologia	Estrutura Celular, Membrana Plasmática, Organelas
Biologia Molecular	DNA e RNA, Síntese de Proteínas (Transcrição e Tradução), Biotecnologia e Engenharia Genética
Divisão Celular — Mitose	(usa a área)
Divisão Celular — Meiose	(usa a área)
Genética	Leis de Mendel, Herança Ligada ao Sexo, Genética de Populações e Equilíbrio de Hardy-Weinberg
Evolução	Seleção Natural e Adaptação, Especiação
Classificação dos Seres Vivos	(usa a área)
Microbiologia e Virologia	(usa a área)
Botânica	Briófitas e Pteridófitas, Gimnospermas, Angiospermas, Fisiologia Vegetal
Zoologia	(usa a área)
Fisiologia Humana	Sistema Digestivo, Sistema Circulatório, Sistema Nervoso, Sistema Endócrino, Sistema Imunológico
Ecologia	Cadeias e Teias Alimentares, Ciclos Biogeoquímicos, Biomas Brasileiros
História — áreas e principais subáreas
Área	Subáreas principais
Pré-História	(usa a área)
Antiguidade	Grécia Antiga, Roma Antiga, Mesopotâmia
Feudalismo	(usa a área)
Expansão Marítima e Colonialismo	(usa a área)
Reforma Protestante e Contrarreforma	(usa a área)
Iluminismo e Absolutismo	(usa a área)
Revoluções Burguesas	Revolução Inglesa, Revolução Francesa, Revolução Industrial
Brasil Colonial	Capitanias Hereditárias, Ciclo do Ouro e Diamantes, Quilombos e Resistência
Independência Americana	(usa a área)
Brasil Imperial	Primeiro Reinado, Segundo Reinado, Abolição da Escravidão
Imperialismo Europeu (Século XIX)	Partilha da África e Ásia, Neocolonialismo
Primeira Guerra Mundial	(usa a área)
Entre Guerras e Totalitarismo	Nazismo, Fascismo, Revolução Russa
Segunda Guerra Mundial	Holocausto
Guerra Fria	Conflitos da Guerra Fria (Coreia, Vietnã, Cuba)
Brasil República	República Velha e Política do Café com Leite, Tenentismo e Revolução de 1930
Era Vargas	(usa a área)
Democracia Populista (1945–1964)	(usa a área)
Ditadura Militar (1964–1985)	(usa a área)
Redemocratização e Constituição de 1988	(usa a área)
Brasil Contemporâneo	(usa a área)
Geografia — áreas e principais subáreas
Área	Subáreas principais
Cartografia e Orientação	(usa a área)
Fusos Horários	(usa a área)
Tectônica de Placas	(usa a área)
Climatologia e Meteorologia	Climas Brasileiros, El Niño e La Niña
Biomas e Vegetação	Biomas Brasileiros
Bacias Hidrográficas	(usa a área)
Geomorfologia e Relevo	(usa a área)
Crescimento Populacional	Transição Demográfica, Pirâmide Etária
Migrações Internas e Internacionais	(usa a área)
Urbanização e Metropolização	Problemas Urbanos
Regionalização do Brasil	(usa a área)
Agricultura Moderna e Agronegócio	Reforma Agrária
Fontes de Energia	(usa a área)
Industrialização e Desindustrialização	(usa a área)
Globalização e Economia	Fluxos Comerciais e Financeiros, Blocos Econômicos
Geopolítica Mundial	(usa a área)
Questões Ambientais	Desenvolvimento Sustentável
Geopolítica e Conflitos	(usa a área)
Língua Portuguesa — áreas e principais subáreas
Área	Subáreas principais
Interpretação de Texto	(usa a área)
Tipologia e Gêneros Textuais	Texto Argumentativo, Texto Informativo e Jornalístico, Texto Literário
Coerência e Coesão	(usa a área)
Texto Lírico e Poesia	(usa a área)
Literatura Brasileira	Romantismo no Brasil, Realismo e Naturalismo, Modernismo — Primeira Fase, Modernismo — Segunda Fase
Literatura Portuguesa	(usa a área)
Intertextualidade	(usa a área)
Fonologia	Ortografia e Acentuação
Morfologia e Classes de Palavras	Substantivo, Adjetivo, Pronomes, Verbos e Conjugação, Advérbio
Sintaxe	Período Simples e Composto, Orações Subordinadas, Regência Nominal e Verbal, Concordância Nominal e Verbal
Semântica	Figuras de Linguagem, Figuras de Sintaxe, Polissemia e Ambiguidade
Pontuação	(usa a área)
Variação Linguística	Variedades Dialetais, Língua Oral e Escrita
Crase	(usa a área)
Língua Inglesa — áreas e principais subáreas
Área	Subáreas principais
Interpretação de Texto em Inglês	(usa a área)
Grammar	Verb Tenses, Modal Verbs, Conditionals
Vocabulary	(usa a área)
Filosofia — áreas e principais subáreas
Área	Subáreas principais
Pré-Socráticos e Cosmologia	(usa a área)
Filosofia Clássica	Platão e o Idealismo, Aristóteles e a Lógica
Ética e Moral	Utilitarismo (Bentham e Mill)
Filosofia Política	Estado, Poder e Soberania, Contrato Social
Epistemologia	(usa a área)
Existencialismo	(usa a área)
Poder e Disciplina	(usa a área)
Sociologia — áreas e principais subáreas
Área	Subáreas principais
Clássicos da Sociologia	Karl Marx e o Materialismo Histórico, Durkheim e o Funcionalismo, Max Weber e a Ação Social
Cultura e Diversidade	Identidade Cultural, Etnocentrismo e Relativismo Cultural
Capitalismo e suas Fases	Fordismo, Taylorismo e Toyotismo, Trabalho na Sociedade Contemporânea
Estado e Formas de Governo	Democracia e Participação Política
Movimentos Sociais	Movimentos Indígenas, Movimentos Feministas, Movimentos Negros
Desigualdade Social	Racismo e Discriminação, Escravidão e seus Legados
tags
Tags são palavras-chave livres em minúsculas com hífens. Servem para busca, não precisam ser canônicas. Regras:

Formato: [tag1, tag2, tag3]
Minúsculas, sem acentos ou com (tanto faz, mas seja consistente)
Use hífens para separar palavras: triangulo-retangulo, não triangulo retangulo
3 a 6 tags por questão
Inclua: nomes próprios relevantes (autores, obras, personagens, teorias), conceitos específicos do enunciado, e o concurso se for um tema recorrente
Não repita o assunto ou disciplina como tag (já estão em campos próprios)
Não inclua tags genéricas como matematica, historia, questao
Exemplos bons:

tags: [pitagoras, triangulo-retangulo, hipotenusa]
tags: [eca-de-queiros, realismo, o-cortiço, zoomorfizacao]
tags: [dna, mutacao, expressao-genica]
tags: [nelson-mandela, apartheid, africa-do-sul, 1994]
tags: [the-economist, crise-economica, desemprego, 2009]
gabarito
MCQ: letra da alternativa correta — A, B, C, D ou E
Certo/Errado: C (Certo) ou E (Errado)
Discursiva: não incluir o campo gabarito
numero
Sempre como string entre aspas: numero: "31". Nunca numero: 31.

fonte
fonte: concurso — quando é questão de vestibular/concurso
fonte: original — quando foi criada pelo professor
4. Questões com texto base compartilhado
Quando 2 ou mais questões consecutivas usam o mesmo texto (trecho literário, artigo etc.):

Cada questão é um \question individual — nunca agrupar em \setquestion
O texto base aparece completo em cada questão, antes de \credits{}
A pergunta individual de cada questão vem depois de \credits{}
Adicionar ao YAML de todas as questões do grupo:

titulo_texto: "Título da obra ou artigo"
autor_texto: "Nome do autor"
tema: categoria-do-texto
Valores comuns para tema: cronica-literaria, texto-cientifico, texto-jornalistico, texto-jornalistico-ingles, texto-cientifico-ingles, correspondencia-literaria, literatura-brasileira, poema

Exemplo com texto base:

\question
---
tipo: Múltipla Escolha
dificuldade: Média
disciplina: Língua Portuguesa
assunto: Figuras de Linguagem
tags: [mario-quintana, cronica, ironia]
gabarito: B
fonte: concurso
concurso: FUVEST
banca: FUVEST
ano: 2010
numero: "22"
titulo_texto: "As cem melhores crônicas brasileiras"
autor_texto: "Mário Quintana"
tema: cronica-literaria
---
[Texto base completo aqui, repetido em cada questão do grupo]

\credits{Mário Quintana. \textit{As cem melhores crônicas brasileiras}.}

Pergunta específica desta questão (22).

\begin{choices}
  \choice ...
  \CorrectChoice ...
  \choice ...
  \choice ...
  \choice ...
\end{choices}
5. Ambientes suportados
O parser reconhece apenas estes ambientes. Qualquer outro é ignorado silenciosamente (o conteúdo some sem aviso).

Ambiente	Uso
\begin{choices}	Alternativas MCQ em coluna (padrão)
\begin{oneparchoices}	Alternativas MCQ em linha
\begin{romanitems}	Lista romana: I, II, III...
\begin{alphaitems}	Lista alfabética: a, b, c...
\begin{assertiveitems}	Lista V/F com ( ) antes de cada item
\begin{itemize}	Lista com bullets
\begin{enumerate}	Lista numerada 1, 2, 3...
\begin{poem}	Poema — cada verso com \verse{texto do verso}
\begin{databox}	Caixa de dados isolada
\begin{codeblock}	Bloco de código-fonte
\begin{center}	Parágrafo centralizado
\begin{flushright}	Parágrafo à direita
Proibidos (substituir antes de salvar):

Proibido	Substituto
\begin{tabular}	\includegraphics{tabela-q31}
\begin{parts} / \part	\begin{alphaitems} ou texto puro
\begin{solution}	Não existe — omitir ou colocar em resposta: no YAML
qualquer outro não listado	Verificar e substituir
6. Matemática e símbolos
Todo símbolo matemático deve estar dentro de delimitadores LaTeX. Fora deles, nada renderiza.

\(x^2 + y^2 = r^2\)                    ← fórmula inline
\[ \frac{a}{b} = \sqrt{c+d} \]          ← fórmula em bloco (parágrafo próprio)
Proibido — causar erro de renderização:

Errado	Correto
cm², m/s², km²	\(\text{cm}^2\), \(g = 10\ \text{m/s}^2\)
x^2 em texto	\(x^2\)
√25	\(\sqrt{25}\)
≥, ≤, →, ∞ (Unicode)	\(\geq\), \(\leq\), \(\to\), \(\infty\)
θ, π, α, β (Unicode)	\(\theta\), \(\pi\), \(\alpha\), \(\beta\)
\sen	\(\sin\)
30° em texto puro	\(30°\) ou \(30^\circ\)
LaTeX sem delimitador: \frac{a}{b}	\(\frac{a}{b}\)
Porcentagens, números e unidades simples em texto não precisam de LaTeX: 8,1%, 20 milhões, 14.8% ficam como texto puro.

7. Imagens e tabelas

\includegraphics{https://url-completa-da-imagem.png}   ← URL conhecida
\includegraphics{figura-q31}                            ← placeholder sem URL
\includegraphics{tabela-q41}                            ← tabela sem imagem disponível
Se a URL da imagem é conhecida no material fonte, use diretamente
Se há uma tabela no material mas não tem imagem, use \includegraphics{tabela-qN}
Se há referência a uma figura mas ela não está disponível, use \includegraphics{figura-qN}
8. Créditos e formatação inline

\credits{Autor. \textit{Título da obra}. Editora, ano.}

\textbf{negrito}
\textit{itálico}
\underline{sublinhado}
Texto entre aspas no original: manter as aspas como estão no enunciado.

9. Alternativas — regras
\CorrectChoice com C maiúsculo (nunca \correctchoice)
Nunca incluir o rótulo da alternativa no texto: errado \choice a) Texto, correto \choice Texto
O parser renderiza automaticamente "(A)", "(B)", etc.
Exatamente um \CorrectChoice por questão MCQ
O gabarito: no YAML deve bater com a posição do \CorrectChoice
10. Blocos especiais
Poema

\begin{poem}
  \verse{Primeiro verso do poema}
  \verse{Segundo verso do poema}
  \verse{}
  \verse{Terceiro verso (linha em branco antes = estrofe nova)}
\end{poem}
Lista assertiva (V/F)

\begin{assertiveitems}
  \item Afirmativa que pode ser verdadeira ou falsa.
  \item Outra afirmativa.
\end{assertiveitems}
Lista romana

\begin{romanitems}
  \item Primeira afirmativa.
  \item Segunda afirmativa.
  \item Terceira afirmativa.
\end{romanitems}
Depois de uma lista romana, as alternativas costumam ser do tipo "Está correto o que se afirma em I, apenas. / I e II, apenas." etc. — essas alternativas vão em \begin{choices} normalmente.

11. Checklist antes de dizer "pronto"
Percorrer questão por questão (não por amostragem):

 Toda MCQ tem \begin{choices} com exatamente um \CorrectChoice?
 gabarito: bate com a posição do \CorrectChoice?
 numero: está entre aspas? ("31", não 31)
 Nenhum símbolo matemático Unicode solto fora de \( \) ou \[ \]?
 Nenhum \begin{...} fora da lista de ambientes suportados?
 Questões com texto base compartilhado têm titulo_texto:, autor_texto:, tema:?
 \CorrectChoice com C maiúsculo?
 Alternativas sem prefixo "a)" "b)" no início?
 \credits{} presente onde há citação?
 \sen substituído por \sin?
 Tabelas convertidas para \includegraphics{tabela-qN}?
12. Verificação com o script de check
Após gerar todos os arquivos do lote, rodar o check em todos juntos (não um por um — o check detecta erros entre arquivos, como texto base compartilhado na fronteira entre lotes):

pnpm tsx scripts/check-tex-import.ts \
  scripts/provas/<concurso>/<ano>/arquivo-q01-10.tex \
  scripts/provas/<concurso>/<ano>/arquivo-q11-20.tex \
  scripts/provas/<concurso>/<ano>/arquivo-q21-30.tex \
  ...
Corrigir todos os [error]. Os [warning] devem ser inspecionados — alguns são falsos positivos (ex: "figura de linguagem", "tem como gráfico uma parábola" — são expressões, não referências a imagens).

Só dizer "pronto para importar" após 0 erro(s) no check e checklist percorrido.

13. O que você NÃO deve fazer
Rodar pnpm tsx scripts/parse-tex.ts — quem faz isso é o dono do projeto
Rodar pnpm tsx scripts/bulk-import.ts — idem
Inventar campos YAML que não existem (campos desconhecidos são ignorados silenciosamente)
Usar \setquestion para MCQ de vestibular — é exclusivo para conjuntos discursivos
Confirmar "pronto" sem ter percorrido o checklist completo