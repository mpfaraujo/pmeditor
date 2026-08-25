# Curtidas e Reports em Questões — Design

Data: 2026-08-25

## Objetivo

Adicionar dois sinais sociais em cada questão do banco:

1. **Curtida** (❤️) — sinal positivo. Serve pra ranquear questões boas (mais
   curtidas = melhor colocação em ordenação opcional).
2. **Report** (🚩) — sinal de problema. Serve principalmente pra ação do admin,
   mas também informa outros professores que uma questão tem ressalvas
   (gabarito errado, enunciado ambíguo, etc.) — o professor decide se quer
   usar apesar disso.

## Escopo e não-escopo

**Escopo:**
- Curtida (toggle, só logado, 1 por usuário/questão).
- Report (com motivo, só logado, 1 por usuário/questão, com desfazer).
- 5 tipos de report (1 bloqueante + 4 informativos).
- Bloqueio de questão com report `content` — some pra não-admin.
- Aba "Reportadas" em `/admin/gerenciar` pra revisão.
- Ordenação opcional por curtidas em `list.php`.

**Não-escopo (fica pra depois):**
- Descurtida / thumbs-down separado. O report cobre "questão ruim".
- Notificação ao autor quando alguém reporta.
- Auto-hide baseado em N reports (ex: 3 reports = auto-oculta). Só o admin decide.
- Histórico/audit de quem reportou o quê (nome do reporter é gravado, mas
  não há UI expondo isso além do admin).
- Reação em textos base — só em questões nesta fase.

## Data model

Uma tabela nova cobre tudo:

```sql
CREATE TABLE question_reactions (
  question_id  VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(255) NOT NULL,          -- user_profiles.google_id
  kind         ENUM('like','report') NOT NULL,
  reason       ENUM('content','answer','wording','missing_image','duplicate') NULL,
  duplicate_of VARCHAR(36)  NULL,              -- só quando reason='duplicate'
  created_at   DATETIME     NOT NULL,
  PRIMARY KEY (question_id, user_id, kind),
  KEY idx_question_kind (question_id, kind),
  KEY idx_user (user_id),
  CONSTRAINT fk_qr_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Notas:**
- PK composta `(question_id, user_id, kind)` → cada usuário tem no máximo
  1 like + 1 report por questão. Impossível burlar sem virar 2 usuários.
- `reason` só faz sentido quando `kind='report'`. Se `kind='like'`, `reason` é NULL.
- `duplicate_of` só quando `reason='duplicate'`. Aponta a questão duplicada.
- Sem FK pra `user_profiles` porque `google_id` não é PK lá (`user_profiles`
  usa `google_id` como coluna simples). Aceita nome perdido se o usuário
  for apagado — reações órfãs são inertes (o admin ainda vê o `user_id`).
- FK pra `questions.id` com `ON DELETE CASCADE` — apagar questão limpa reações.

## Endpoints backend

Nova pasta: `php/guardafiguras/api/reactions/`. Segue o padrão dos outros
endpoints — usa `_cors.php` e `_auth.php` compartilhados.

### `POST /reactions/toggle.php`

Body:
```json
{ "question_id": "uuid", "kind": "like" }
```
ou pra report:
```json
{ "question_id": "uuid", "kind": "report", "reason": "duplicate", "duplicate_of": "uuid" }
```

Regras:
- `require_write_auth` (session obrigatória).
- `kind='like'` → cria/apaga linha (toggle). `reason` ignorado.
- `kind='report'` → precisa de `reason`. Se `reason='duplicate'`, também
  precisa de `duplicate_of` (UUID válido).
- Se já existe linha `(question_id, user_id, kind)` → apaga (desfazer),
  independente do `reason` armazenado.
- Devolve o estado atual da questão pro caller: contagens agregadas + flags
  do próprio usuário.

Response:
```json
{
  "success": true,
  "question_id": "uuid",
  "likes_count": 12,
  "my_liked": true,
  "reports": [
    { "reason": "answer",   "count": 2 },
    { "reason": "duplicate","count": 1 }
  ],
  "my_report": { "reason": "answer", "duplicate_of": null } // ou null
}
```

Rate limit: 60/min por IP via `ratelimit.php`.

### Alterações em `list.php` e `get.php`

Passam a incluir os agregados de reações em cada questão retornada.
LEFT JOIN + GROUP BY numa subquery pra evitar N+1.

Campos novos em cada item:
- `likes_count` (int)
- `my_liked` (bool, só se session válida)
- `reports` (array de `{reason, count}`)
- `my_report` (objeto `{reason, duplicate_of}` ou null)
- `blocked` (bool — true se existe ao menos 1 report `content`)

Filtragem por `blocked`:
- Anônimo ou logado não-admin: WHERE clause exclui questões `blocked=true`.
- Admin: recebe tudo, incluindo bloqueadas (com `blocked:true`).

Novo parâmetro opcional em `list.php`:
- `order=likes` → ORDER BY likes_count DESC. Default continua cronológico.

## Frontend

### QuestionCard

Adicionar rodapé no card:

```
[❤ 12]  [🚩 Reportar]  [⚠ gabarito×2 duplicada×1]
```

- **Heart:** ícone cheio se `my_liked`, vazio senão. Clique toggle via
  `toggle.php`. Otimistic update: incrementa localmente antes da resposta.
- **Botão Reportar:** ícone bandeira. Se `my_report` existe → estado
  "Reportado" (destacado). Clique abre modal.
- **Badge de reports agregados:** só aparece se `reports` não vazio.
  Formato compacto por padrão; tooltip no hover mostra breakdown.

### Modal de report

Radio com 5 motivos:
- ⛔ Conteúdo impróprio *(oculta a questão até admin revisar)*
- ❌ Gabarito errado
- 📝 Enunciado com erro
- 🖼️ Falta imagem/figura
- 🔁 Duplicada — abre input pra colar link/ID da outra

Botão "Enviar report" (desabilitado até selecionar motivo válido).

Se já tem report do usuário: modal abre com opção "Desfazer report" no lugar.

### Admin — nova aba em `/admin/gerenciar`

Aba "Reportadas":
- Ordenação: bloqueadas primeiro, depois por total de reports desc.
- Cada linha: preview da questão + lista de reports (motivo, quem reportou, quando).
- Ações: **Apagar questão** (usa `delete.php` existente), **Limpar reports**
  (novo endpoint `POST /reactions/clear.php` — admin apaga todos os reports
  da questão), **Ignorar** (só fecha a linha, reports permanecem).
- Contador no menu lateral do admin: pill vermelho com número de bloqueadas
  pendentes (`SELECT COUNT(DISTINCT question_id) FROM question_reactions
  WHERE kind='report' AND reason='content'`).

## Casos de borda

- **Autor da questão reporta a própria:** permitido. Não faz sentido
  bloquear — talvez ele mesmo perceba um problema depois de publicada.
- **Autor curte a própria:** permitido tecnicamente, mas UI oculta o
  botão de like quando `authUser.google_id === question.author.id`.
  (Menos importante — no pior caso é 1 like a mais, sem valor.)
- **Report de duplicada apontando pra si mesma:** rejeitar no backend
  (`duplicate_of !== question_id`).
- **Report de duplicada apontando pra questão que não existe:** aceitar
  mesmo assim (admin decide caso a caso). Não bloqueia.
- **Questão apagada:** `ON DELETE CASCADE` limpa reações. Sem lixo.
- **Usuário apagado (feature futura):** reações ficam órfãs com `user_id`
  apontando pra nada. Aceitável — admin vê `user_id` sem nome; ainda
  serve pra contagem.
- **Session expira durante ação:** `toggle.php` devolve 401, frontend
  mostra prompt de login e reverte otimistic update.

## Testes essenciais

### Backend

- Toggle idempotente: 2 requests seguidos com mesmo kind → 1 linha, depois 0.
- Report sem `reason` → 400.
- Report com `reason=duplicate` sem `duplicate_of` → 400.
- Report com `duplicate_of === question_id` → 400.
- PK garante: 2 requests concorrentes com mesmo (question, user, kind) →
  1 linha (não 2 e não erro fatal).
- `list.php` como anônimo → não vê questões bloqueadas.
- `list.php` como não-admin → não vê bloqueadas.
- `list.php` como admin → vê tudo, campo `blocked=true` nas bloqueadas.
- `list.php?order=likes` → ordena decrescente por likes_count.

### Frontend

- Curtir → contagem +1, ícone cheio, persiste após reload.
- Descurtir → -1, ícone vazio.
- Reportar "gabarito errado" → badge aparece pra outros usuários.
- Reportar "conteúdo impróprio" → questão some da lista pros outros
  (pra si próprio também, exceto se for admin).
- Desfazer report → badge some, questão volta pra todos.
- Modal desabilita "Enviar" até radio selecionado.
- Duplicada exige input não-vazio.

## Migração e rollout

1. Executar SQL da tabela `question_reactions` (via phpMyAdmin do Hostinger).
2. Subir endpoints PHP novos + alterações em `list.php` e `get.php`.
3. Deploy frontend com QuestionCard + modal + admin aba.
4. Zero migração de dados — feature nova, começa vazia.

Rollback: apagar tabela ou desativar rota `toggle.php`. Frontend degrada:
botões não fazem nada, badges não aparecem, mas nada quebra.

## Alternativas consideradas

- **Descurtida separada:** rejeitado. Não agrega — se a questão é ruim,
  o report já registra isso melhor (com motivo).
- **Múltiplos reports por usuário (um por tipo):** rejeitado.
  Padrão da indústria é 1 report por usuário/item, escolhendo o motivo
  mais forte. Reduz spam de contagem e simplifica UX.
- **Auto-hide após N reports:** rejeitado por ora. Simplicidade > escala.
  Só admin decide. Se ficar difícil de acompanhar, revisita.
- **Reação em textos base:** fora de escopo. Adicionar depois se pedido.
