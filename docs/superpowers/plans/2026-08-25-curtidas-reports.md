# Curtidas e Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar curtida (❤️) e report (🚩 com 6 motivos) em cada questão do banco.

**Architecture:** Uma única tabela nova (`question_reactions`, PK composta `(question_id, user_id, kind)`) alimenta agregados por questão via LEFT JOIN em `list.php`/`get.php`. Endpoint `toggle.php` faz insert/delete idempotente. Frontend usa otimistic update no clique + badge agregado no card.

**Tech Stack:** PHP 8 + MariaDB (backend). Next.js 16 + TypeScript + shadcn/ui + vitest (frontend). Deploy PHP manual via Hostinger File Manager; frontend via Vercel.

**Spec:** [docs/superpowers/specs/2026-08-25-curtidas-reports-design.md](../specs/2026-08-25-curtidas-reports-design.md)

---

## Estrutura de arquivos

**Backend — novos:**
- `php/guardafiguras/api/reactions/schema.sql` — DDL da tabela
- `php/guardafiguras/api/reactions/_helpers.php` — SQL de agregação reutilizada por list/get
- `php/guardafiguras/api/reactions/toggle.php` — POST toggle
- `php/guardafiguras/api/reactions/clear.php` — POST admin apaga reports de uma questão

**Backend — modificados:**
- `php/guardafiguras/api/questoes/list.php` — join agregados, filtro `blocked`, param `order=likes`
- `php/guardafiguras/api/questoes/get.php` — inclui agregados

**Frontend — novos:**
- `src/lib/reactions.ts` — chamadas HTTP
- `src/components/Questions/ReportModal.tsx` — modal com radio + input de duplicata
- `src/components/Questions/QuestionReactions.tsx` — barra ❤️/🚩/badge do card

**Frontend — modificados:**
- `src/components/Questions/QuestionCard.tsx` — insere `<QuestionReactions>` no rodapé
- `src/lib/questions.ts` — tipos passam a incluir `likes_count`, `my_liked`, `reports`, `my_report`, `blocked`
- `src/app/admin/gerenciar/page.tsx` — nova aba "Reportadas"

---

### Task 1: Schema da tabela

**Files:**
- Create: `php/guardafiguras/api/reactions/schema.sql`

- [ ] **Step 1: Escrever DDL**

```sql
-- Migração: reações (curtidas + reports) por questão
-- Executar via phpMyAdmin no banco u824839049_questoes. Idempotente.

CREATE TABLE IF NOT EXISTS question_reactions (
  question_id  VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  kind         ENUM('like','report') NOT NULL,
  reason       ENUM('content','answer','wording','missing_image','duplicate','metadata') NULL,
  duplicate_of VARCHAR(36)  NULL,
  created_at   DATETIME     NOT NULL,
  PRIMARY KEY (question_id, user_id, kind),
  KEY idx_qr_question_kind (question_id, kind),
  KEY idx_qr_user (user_id),
  CONSTRAINT fk_qr_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Rodar no phpMyAdmin do Hostinger**

Cola o SQL acima no phpMyAdmin do banco `u824839049_questoes` e executa. Confirma que a tabela `question_reactions` aparece na lista.

- [ ] **Step 3: Commit**

```bash
git add php/guardafiguras/api/reactions/schema.sql
git commit -m "feat(reactions): schema da tabela question_reactions"
```

---

### Task 2: Helper de agregação (SQL reutilizado por list/get)

**Files:**
- Create: `php/guardafiguras/api/reactions/_helpers.php`

- [ ] **Step 1: Escrever helper**

```php
<?php
declare(strict_types=1);

/**
 * SQL a ser LEFT JOINado com questions pra expor agregados de reações.
 * Retorna, por questão:
 *  - likes_count       (int)
 *  - reports_json      (JSON string: [{reason, count}])
 *  - blocked           (0/1)  <- se existe report com reason='content'
 *
 * Uso:
 *   $sql = "SELECT q.*, r.likes_count, r.reports_json, r.blocked
 *           FROM questions q
 *           LEFT JOIN (" . reactions_agg_subquery() . ") r ON r.question_id = q.id";
 */
function reactions_agg_subquery(): string {
    return "
        SELECT
            question_id,
            SUM(kind = 'like') AS likes_count,
            JSON_ARRAYAGG(
                CASE WHEN kind = 'report'
                     THEN JSON_OBJECT('reason', reason)
                END
            ) AS reports_raw,
            MAX(kind = 'report' AND reason = 'content') AS blocked
        FROM question_reactions
        GROUP BY question_id
    ";
}

/**
 * Agrega os reports em [{reason, count}] a partir do reports_raw devolvido
 * pelo subquery. Descarta nulls (que vieram de rows de 'like').
 */
function collapse_reports_raw($raw): array {
    if (!$raw) return [];
    $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
    if (!is_array($decoded)) return [];
    $counts = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry) || !isset($entry['reason'])) continue;
        $r = (string)$entry['reason'];
        $counts[$r] = ($counts[$r] ?? 0) + 1;
    }
    $out = [];
    foreach ($counts as $reason => $count) {
        $out[] = ['reason' => $reason, 'count' => $count];
    }
    return $out;
}

/**
 * Descobre, pra um usuário logado, quais foram as reações dele nas questões
 * listadas. Retorna map: question_id => ['my_liked' => bool, 'my_report' => {reason, duplicate_of}|null]
 */
function fetch_my_reactions(PDO $pdo, string $userId, array $questionIds): array {
    if (empty($questionIds)) return [];
    $placeholders = implode(',', array_fill(0, count($questionIds), '?'));
    $stmt = $pdo->prepare(
        "SELECT question_id, kind, reason, duplicate_of
           FROM question_reactions
          WHERE user_id = ? AND question_id IN ($placeholders)"
    );
    $stmt->execute(array_merge([$userId], $questionIds));
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $qid = $row['question_id'];
        if (!isset($out[$qid])) $out[$qid] = ['my_liked' => false, 'my_report' => null];
        if ($row['kind'] === 'like') $out[$qid]['my_liked'] = true;
        if ($row['kind'] === 'report') {
            $out[$qid]['my_report'] = [
                'reason' => $row['reason'],
                'duplicate_of' => $row['duplicate_of'],
            ];
        }
    }
    return $out;
}
```

- [ ] **Step 2: Commit**

```bash
git add php/guardafiguras/api/reactions/_helpers.php
git commit -m "feat(reactions): helpers de agregacao SQL"
```

---

### Task 3: Endpoint `toggle.php`

**Files:**
- Create: `php/guardafiguras/api/reactions/toggle.php`

- [ ] **Step 1: Implementar**

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../_cors.php';
apply_cors('POST, OPTIONS');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('Método não permitido. Use POST.', 405);
}

require_once __DIR__ . '/../questoes/config/database.php';
require_once __DIR__ . '/../questoes/_auth.php';
require_once __DIR__ . '/_helpers.php';

$pdo = db();
$authUser = require_write_auth($pdo); // scripts (token) também passam; ignoramos userId nesse caso.

if ($authUser === null) {
    // Scripts locais não deveriam usar toggle. Rejeita explicitamente.
    fail('Toggle requer usuário logado.', 401);
}

require_once __DIR__ . '/../config/ratelimit.php';
check_rate_limit('rl:reactions', 60, 60);

$raw = file_get_contents('php://input');
$data = json_decode((string)$raw, true);
if (!is_array($data)) fail('JSON inválido.', 400);

$questionId  = (string)($data['question_id'] ?? '');
$kind        = (string)($data['kind'] ?? '');
$reason      = isset($data['reason']) ? (string)$data['reason'] : null;
$duplicateOf = isset($data['duplicate_of']) ? (string)$data['duplicate_of'] : null;

if ($questionId === '') fail('question_id obrigatório.', 400);
if (!in_array($kind, ['like', 'report'], true)) fail('kind inválido.', 400);

$validReasons = ['content','answer','wording','missing_image','duplicate','metadata'];

if ($kind === 'report') {
    if (!in_array($reason, $validReasons, true)) fail('reason inválido.', 400);
    if ($reason === 'duplicate') {
        if (!$duplicateOf) fail('duplicate_of obrigatório quando reason=duplicate.', 400);
        if ($duplicateOf === $questionId) fail('duplicate_of não pode apontar pra própria questão.', 400);
    } else {
        $duplicateOf = null;
    }
} else {
    $reason = null;
    $duplicateOf = null;
}

$userId = (string)$authUser['google_id'];

try {
    // Verifica se a questão existe (evita órfãos silenciosos).
    $chk = $pdo->prepare('SELECT 1 FROM questions WHERE id = ? LIMIT 1');
    $chk->execute([$questionId]);
    if (!$chk->fetchColumn()) fail('Questão não encontrada.', 404);

    // Toggle: se já existe (question_id, user_id, kind), apaga.
    $exists = $pdo->prepare(
        'SELECT 1 FROM question_reactions
          WHERE question_id = ? AND user_id = ? AND kind = ? LIMIT 1'
    );
    $exists->execute([$questionId, $userId, $kind]);
    $hadIt = (bool)$exists->fetchColumn();

    if ($hadIt) {
        $del = $pdo->prepare(
            'DELETE FROM question_reactions
              WHERE question_id = ? AND user_id = ? AND kind = ?'
        );
        $del->execute([$questionId, $userId, $kind]);
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO question_reactions
                 (question_id, user_id, kind, reason, duplicate_of, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $ins->execute([$questionId, $userId, $kind, $reason, $duplicateOf]);
    }

    // Retorna estado atualizado
    $agg = $pdo->prepare(
        "SELECT SUM(kind = 'like') AS likes_count,
                MAX(kind = 'report' AND reason = 'content') AS blocked
           FROM question_reactions WHERE question_id = ?"
    );
    $agg->execute([$questionId]);
    $aggRow = $agg->fetch(PDO::FETCH_ASSOC);

    $repStmt = $pdo->prepare(
        "SELECT reason, COUNT(*) AS c
           FROM question_reactions
          WHERE question_id = ? AND kind = 'report'
          GROUP BY reason"
    );
    $repStmt->execute([$questionId]);
    $reports = array_map(
        fn($r) => ['reason' => $r['reason'], 'count' => (int)$r['c']],
        $repStmt->fetchAll(PDO::FETCH_ASSOC)
    );

    $mine = fetch_my_reactions($pdo, $userId, [$questionId])[$questionId] ?? ['my_liked' => false, 'my_report' => null];

    echo json_encode([
        'success' => true,
        'question_id' => $questionId,
        'likes_count' => (int)($aggRow['likes_count'] ?? 0),
        'blocked' => (bool)($aggRow['blocked'] ?? false),
        'reports' => $reports,
        'my_liked' => $mine['my_liked'],
        'my_report' => $mine['my_report'],
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[reactions/toggle.php] ' . $e->getMessage());
    fail('Erro ao processar reação.', 500);
}
```

- [ ] **Step 2: Upload + testar via curl**

Sobe `_cors.php` já existe. Sobe `reactions/toggle.php` e `_helpers.php` pro Hostinger. Depois testa:

```bash
# Substitua <SESSION> pelo token de X-Session-Token da sua conta
SESSION="<SESSION>"
QID="<uuid de uma questão existente>"

# Like
curl -s -X POST "https://mpfaraujo.com.br/guardafiguras/api/reactions/toggle.php" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SESSION" \
  -d "{\"question_id\":\"$QID\",\"kind\":\"like\"}"
# Esperado: {"success":true, ..., "likes_count":1, "my_liked":true}

# Toggle off
curl -s -X POST "https://mpfaraujo.com.br/guardafiguras/api/reactions/toggle.php" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SESSION" \
  -d "{\"question_id\":\"$QID\",\"kind\":\"like\"}"
# Esperado: likes_count decrementado, my_liked:false

# Report de duplicada sem duplicate_of -> deve dar 400
curl -s -X POST "https://mpfaraujo.com.br/guardafiguras/api/reactions/toggle.php" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SESSION" \
  -d "{\"question_id\":\"$QID\",\"kind\":\"report\",\"reason\":\"duplicate\"}"
# Esperado: {"success":false,"error":"duplicate_of obrigatório..."}
```

- [ ] **Step 3: Commit**

```bash
git add php/guardafiguras/api/reactions/toggle.php
git commit -m "feat(reactions): endpoint toggle.php"
```

---

### Task 4: Modificar `list.php` — agregados + filtro blocked + order

**Files:**
- Modify: `php/guardafiguras/api/questoes/list.php`

- [ ] **Step 1: Adicionar include do helper e leitura do param `order`**

No topo, após `require_once __DIR__ . '/config/database.php'`, adicionar:

```php
require_once __DIR__ . '/../reactions/_helpers.php';
```

Perto de onde outros query params são lidos (por volta da linha 80):

```php
$orderBy = ($_GET['order'] ?? '') === 'likes'
    ? 'r.likes_count DESC, q.created_at DESC'
    : 'q.created_at DESC';
```

- [ ] **Step 2: Trocar `FROM questions q` pela versão com JOIN de agregados**

Localiza o SELECT principal em `list.php` e substitui:

```php
$sql = "SELECT q.*,
               COALESCE(r.likes_count, 0)  AS likes_count,
               COALESCE(r.blocked, 0)      AS blocked,
               r.reports_raw               AS reports_raw
          FROM questions q
          LEFT JOIN (" . reactions_agg_subquery() . ") r ON r.question_id = q.id
         WHERE " . $whereClause . "
      ORDER BY " . $orderBy . "
         LIMIT :limit OFFSET :offset";
```

- [ ] **Step 3: Adicionar filtro de blocked na WHERE**

Antes de montar `$whereClause`, se o usuário atual NÃO for admin (ou anônimo), acrescenta:

```php
// Bloqueia questões com report 'content' pra não-admins
$isAdmin = false;
if ($googleId !== null) {
    $r = $pdo->prepare("SELECT role FROM user_profiles WHERE google_id = ?");
    $r->execute([$googleId]);
    $isAdmin = $r->fetchColumn() === 'admin';
}
if (!$isAdmin) {
    $where[] = "NOT EXISTS (
        SELECT 1 FROM question_reactions bx
         WHERE bx.question_id = q.id
           AND bx.kind = 'report'
           AND bx.reason = 'content'
    )";
}
```

- [ ] **Step 4: Após o fetch, montar campos derivados de reações**

Antes de devolver o JSON:

```php
// Collapse reports_raw -> reports [{reason, count}]
$questionIds = array_map(fn($q) => $q['id'], $items);
$myReactions = ($googleId !== null)
    ? fetch_my_reactions($pdo, $googleId, $questionIds)
    : [];

foreach ($items as &$q) {
    $q['likes_count'] = (int)$q['likes_count'];
    $q['blocked']     = (bool)$q['blocked'];
    $q['reports']     = collapse_reports_raw($q['reports_raw'] ?? null);
    unset($q['reports_raw']);
    $mine = $myReactions[$q['id']] ?? ['my_liked' => false, 'my_report' => null];
    $q['my_liked']  = $mine['my_liked'];
    $q['my_report'] = $mine['my_report'];
}
unset($q);
```

- [ ] **Step 5: Upload + testar**

Sobe `list.php`. Testa:

```bash
# Anônimo — sem reações no output
curl -s "https://mpfaraujo.com.br/guardafiguras/api/questoes/list.php?limit=2" | jq '.items[0] | {id, likes_count, reports, my_liked, blocked}'

# Logado — my_liked/my_report populados
curl -s "https://mpfaraujo.com.br/guardafiguras/api/questoes/list.php?limit=2" \
  -H "X-Session-Token: $SESSION" | jq '.items[0] | {id, likes_count, reports, my_liked, my_report, blocked}'

# order=likes
curl -s "https://mpfaraujo.com.br/guardafiguras/api/questoes/list.php?limit=5&order=likes" | jq '.items[] | {id, likes_count}'
```

- [ ] **Step 6: Commit**

```bash
git add php/guardafiguras/api/questoes/list.php
git commit -m "feat(reactions): list.php inclui agregados, filtra blocked, aceita order=likes"
```

---

### Task 5: Modificar `get.php` — agregados

**Files:**
- Modify: `php/guardafiguras/api/questoes/get.php`

- [ ] **Step 1: Adicionar include do helper**

No topo:

```php
require_once __DIR__ . '/../reactions/_helpers.php';
```

- [ ] **Step 2: Após buscar a questão, anexar reações**

Depois de `$item = $stmt->fetch(...)` (ou equivalente) e antes de devolver JSON:

```php
if ($item) {
    // Agregados
    $agg = $pdo->prepare(
        "SELECT SUM(kind = 'like') AS likes_count,
                MAX(kind = 'report' AND reason = 'content') AS blocked
           FROM question_reactions WHERE question_id = ?"
    );
    $agg->execute([$item['id']]);
    $aggRow = $agg->fetch(PDO::FETCH_ASSOC);

    $repStmt = $pdo->prepare(
        "SELECT reason, COUNT(*) AS c
           FROM question_reactions
          WHERE question_id = ? AND kind = 'report'
          GROUP BY reason"
    );
    $repStmt->execute([$item['id']]);
    $item['reports'] = array_map(
        fn($r) => ['reason' => $r['reason'], 'count' => (int)$r['c']],
        $repStmt->fetchAll(PDO::FETCH_ASSOC)
    );
    $item['likes_count'] = (int)($aggRow['likes_count'] ?? 0);
    $item['blocked']     = (bool)($aggRow['blocked'] ?? false);

    // Bloqueado + não-admin: some
    $sessionToken = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
    $googleId = null;
    if ($sessionToken !== '') {
        $s = $pdo->prepare("SELECT google_id FROM user_profiles WHERE session_token = ? AND session_expires > NOW()");
        $s->execute([$sessionToken]);
        $googleId = $s->fetchColumn() ?: null;
    }
    $isAdmin = false;
    if ($googleId) {
        $r = $pdo->prepare("SELECT role FROM user_profiles WHERE google_id = ?");
        $r->execute([$googleId]);
        $isAdmin = $r->fetchColumn() === 'admin';
    }
    if ($item['blocked'] && !$isAdmin) {
        fail('Questão não encontrada.', 404);
    }

    // my_*
    if ($googleId) {
        $mine = fetch_my_reactions($pdo, $googleId, [$item['id']])[$item['id']]
              ?? ['my_liked' => false, 'my_report' => null];
        $item['my_liked']  = $mine['my_liked'];
        $item['my_report'] = $mine['my_report'];
    } else {
        $item['my_liked']  = false;
        $item['my_report'] = null;
    }
}
```

- [ ] **Step 3: Upload + testar**

```bash
QID="<uuid de questão bloqueada>"
# Anônimo -> 404
curl -s -o /dev/null -w "%{http_code}\n" "https://mpfaraujo.com.br/guardafiguras/api/questoes/get.php?id=$QID"
# Admin -> 200 com blocked:true
curl -s "https://mpfaraujo.com.br/guardafiguras/api/questoes/get.php?id=$QID" \
  -H "X-Session-Token: $ADMIN_SESSION" | jq '.item.blocked'
```

- [ ] **Step 4: Commit**

```bash
git add php/guardafiguras/api/questoes/get.php
git commit -m "feat(reactions): get.php inclui agregados, bloqueia acesso pra nao-admin"
```

---

### Task 6: Endpoint `clear.php` (admin)

**Files:**
- Create: `php/guardafiguras/api/reactions/clear.php`

- [ ] **Step 1: Implementar**

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../_cors.php';
apply_cors('POST, OPTIONS');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Use POST.', 405);

require_once __DIR__ . '/../questoes/config/database.php';
require_once __DIR__ . '/../questoes/_auth.php';

$pdo = db();
require_admin_auth($pdo);

$data = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($data)) fail('JSON inválido.', 400);

$questionId = (string)($data['question_id'] ?? '');
if ($questionId === '') fail('question_id obrigatório.', 400);

try {
    $stmt = $pdo->prepare(
        "DELETE FROM question_reactions WHERE question_id = ? AND kind = 'report'"
    );
    $stmt->execute([$questionId]);

    echo json_encode([
        'success' => true,
        'question_id' => $questionId,
        'deleted' => $stmt->rowCount(),
    ]);
} catch (Throwable $e) {
    error_log('[reactions/clear.php] ' . $e->getMessage());
    fail('Erro ao limpar reports.', 500);
}
```

- [ ] **Step 2: Upload + testar**

```bash
curl -s -X POST "https://mpfaraujo.com.br/guardafiguras/api/reactions/clear.php" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $ADMIN_SESSION" \
  -d "{\"question_id\":\"$QID\"}"
# Esperado: {"success":true, "deleted": <n>}

# Não-admin -> 403
curl -s -X POST "https://mpfaraujo.com.br/guardafiguras/api/reactions/clear.php" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $NORMAL_SESSION" \
  -d "{\"question_id\":\"$QID\"}"
```

- [ ] **Step 3: Commit**

```bash
git add php/guardafiguras/api/reactions/clear.php
git commit -m "feat(reactions): endpoint clear.php admin-only"
```

---

### Task 7: Tipos e cliente HTTP no frontend

**Files:**
- Modify: `src/lib/questions.ts`
- Create: `src/lib/reactions.ts`

- [ ] **Step 1: Adicionar tipos ao `questions.ts`**

Adiciona antes do `handle()`:

```ts
export type ReportReason =
  | "content" | "answer" | "wording" | "missing_image" | "duplicate" | "metadata";

export type MyReport = {
  reason: ReportReason;
  duplicate_of: string | null;
};

export type QuestionReactions = {
  likes_count: number;
  reports: Array<{ reason: ReportReason; count: number }>;
  my_liked: boolean;
  my_report: MyReport | null;
  blocked: boolean;
};
```

Onde tipa o resultado de `listQuestions` / `getQuestion`, cada item passa a incluir os campos de `QuestionReactions` (opcional se você não tipava strictamente antes — nesse caso apenas garanta que os acessos usem `?? 0`, `?? []`, etc. no consumidor).

- [ ] **Step 2: Criar `src/lib/reactions.ts`**

```ts
const API_BASE = (
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes"
).replace(/\/questoes\/?$/, "/reactions");

function sessionHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("pmeditor:session") ?? ""
    : "";
  return { "Content-Type": "application/json", "X-Session-Token": token };
}

import type { QuestionReactions, ReportReason } from "./questions";

export type ToggleParams =
  | { question_id: string; kind: "like" }
  | { question_id: string; kind: "report"; reason: ReportReason; duplicate_of?: string };

export type ToggleResponse = QuestionReactions & { question_id: string };

export async function toggleReaction(params: ToggleParams): Promise<ToggleResponse> {
  const res = await fetch(`${API_BASE}/toggle.php`, {
    method: "POST",
    headers: sessionHeaders(),
    body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export async function clearReports(question_id: string): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/clear.php`, {
    method: "POST",
    headers: sessionHeaders(),
    body: JSON.stringify({ question_id }),
  });
  const body = await res.json();
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Esperado: sem erros (ignorando arquivos `.test.`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/reactions.ts src/lib/questions.ts
git commit -m "feat(reactions): tipos e cliente HTTP"
```

---

### Task 8: Componente `ReportModal`

**Files:**
- Create: `src/components/Questions/ReportModal.tsx`
- Create: `src/components/Questions/__tests__/ReportModal.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

```tsx
// src/components/Questions/__tests__/ReportModal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportModal } from "../ReportModal";

describe("ReportModal", () => {
  it("desabilita Enviar até um motivo ser selecionado", () => {
    render(<ReportModal open onOpenChange={() => {}} onSubmit={() => {}} onUndo={() => {}} myReport={null} />);
    const btn = screen.getByRole("button", { name: /enviar report/i });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/gabarito errado/i));
    expect(btn).not.toBeDisabled();
  });

  it("exige duplicate_of quando reason=duplicate", () => {
    const onSubmit = vi.fn();
    render(<ReportModal open onOpenChange={() => {}} onSubmit={onSubmit} onUndo={() => {}} myReport={null} />);
    fireEvent.click(screen.getByLabelText(/duplicada/i));
    // Sem preencher input
    fireEvent.click(screen.getByRole("button", { name: /enviar report/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    // Com input preenchido
    fireEvent.change(screen.getByPlaceholderText(/ID ou link/i), { target: { value: "some-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar report/i }));
    expect(onSubmit).toHaveBeenCalledWith({ reason: "duplicate", duplicate_of: "some-uuid" });
  });

  it("mostra estado 'Reportado' se myReport existe, com botão Desfazer", () => {
    const onUndo = vi.fn();
    render(<ReportModal open onOpenChange={() => {}} onSubmit={() => {}} onUndo={onUndo} myReport={{ reason: "answer", duplicate_of: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /desfazer report/i }));
    expect(onUndo).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

```bash
pnpm vitest run src/components/Questions/__tests__/ReportModal.test.tsx
```

Esperado: FAIL (arquivo `ReportModal` não existe).

- [ ] **Step 3: Implementar `ReportModal.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyReport, ReportReason } from "@/lib/questions";

const REASONS: Array<{ value: ReportReason; label: string; hint?: string }> = [
  { value: "content",       label: "⛔ Conteúdo impróprio", hint: "Oculta a questão até admin revisar." },
  { value: "answer",        label: "❌ Gabarito errado" },
  { value: "wording",       label: "📝 Enunciado com erro" },
  { value: "missing_image", label: "🖼️ Falta imagem/figura" },
  { value: "metadata",      label: "🏷️ Classificação errada", hint: "Assunto, disciplina, tags." },
  { value: "duplicate",     label: "🔁 Duplicada" },
];

export type ReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: ReportReason; duplicate_of?: string }) => void;
  onUndo: () => void;
  myReport: MyReport | null;
};

export function ReportModal({ open, onOpenChange, onSubmit, onUndo, myReport }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [dupRef, setDupRef] = useState("");

  useEffect(() => {
    if (open) { setReason(null); setDupRef(""); }
  }, [open]);

  const alreadyReported = myReport !== null;
  const dupValid = reason !== "duplicate" || dupRef.trim() !== "";
  const canSubmit = reason !== null && dupValid;

  const handleSubmit = () => {
    if (!reason || !dupValid) return;
    onSubmit(reason === "duplicate"
      ? { reason, duplicate_of: dupRef.trim() }
      : { reason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar problema na questão</DialogTitle>
        </DialogHeader>

        {alreadyReported ? (
          <div className="text-sm">
            Você já reportou essa questão como <strong>{REASONS.find(r => r.value === myReport?.reason)?.label}</strong>.
          </div>
        ) : (
          <div className="space-y-2">
            {REASONS.map(r => (
              <label key={r.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-1"
                />
                <div>
                  <div>{r.label}</div>
                  {r.hint && <div className="text-xs text-muted-foreground">{r.hint}</div>}
                </div>
              </label>
            ))}
            {reason === "duplicate" && (
              <Input
                placeholder="ID ou link da questão duplicada"
                value={dupRef}
                onChange={(e) => setDupRef(e.target.value)}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {alreadyReported
            ? <Button variant="destructive" onClick={onUndo}>Desfazer report</Button>
            : <Button onClick={handleSubmit} disabled={!canSubmit}>Enviar report</Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

```bash
pnpm vitest run src/components/Questions/__tests__/ReportModal.test.tsx
```

Esperado: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/Questions/ReportModal.tsx src/components/Questions/__tests__/ReportModal.test.tsx
git commit -m "feat(reactions): ReportModal com radio e input de duplicata"
```

---

### Task 9: Componente `QuestionReactions`

**Files:**
- Create: `src/components/Questions/QuestionReactions.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useState } from "react";
import { Heart, Flag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleReaction } from "@/lib/reactions";
import type { QuestionReactions as ReactionsType, ReportReason } from "@/lib/questions";
import { ReportModal } from "./ReportModal";

const REASON_LABEL: Record<ReportReason, string> = {
  content: "impróprio",
  answer: "gabarito",
  wording: "enunciado",
  missing_image: "figura",
  duplicate: "duplicada",
  metadata: "classificação",
};

export type QuestionReactionsProps = {
  questionId: string;
  initial: ReactionsType;
  /** Chamado quando o estado muda — o card pai pode re-render se quiser. */
  onChange?: (next: ReactionsType) => void;
  /** true se o usuário está logado. Se false, os botões abrem tooltip pedindo login. */
  loggedIn: boolean;
};

export function QuestionReactions({ questionId, initial, onChange, loggedIn }: QuestionReactionsProps) {
  const [state, setState] = useState<ReactionsType>(initial);
  const [modalOpen, setModalOpen] = useState(false);

  const doToggle = async (payload: Parameters<typeof toggleReaction>[0]) => {
    // Otimistic — soma/subtrai localmente antes da resposta.
    const optimistic: ReactionsType = payload.kind === "like"
      ? {
          ...state,
          likes_count: state.likes_count + (state.my_liked ? -1 : 1),
          my_liked: !state.my_liked,
        }
      : state;
    setState(optimistic);
    try {
      const res = await toggleReaction(payload);
      const next = {
        likes_count: res.likes_count,
        reports: res.reports,
        my_liked: res.my_liked,
        my_report: res.my_report,
        blocked: res.blocked,
      };
      setState(next);
      onChange?.(next);
    } catch (e) {
      // reverte
      setState(state);
      console.error(e);
    }
  };

  const handleLike = () => {
    if (!loggedIn) return alert("Faça login pra curtir.");
    doToggle({ question_id: questionId, kind: "like" });
  };

  const handleReport = () => {
    if (!loggedIn) return alert("Faça login pra reportar.");
    setModalOpen(true);
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <Button variant="ghost" size="sm" onClick={handleLike} className="gap-1">
        <Heart className={state.my_liked ? "fill-current text-red-500" : ""} size={16} />
        <span>{state.likes_count}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReport}
        className={state.my_report ? "text-orange-500" : ""}
      >
        <Flag size={16} />
      </Button>

      {state.reports.length > 0 && (
        <div
          className="flex items-center gap-1 text-xs text-orange-600"
          title={state.reports.map(r => `${REASON_LABEL[r.reason]}: ${r.count}`).join(", ")}
        >
          <AlertTriangle size={14} />
          {state.reports.map(r => `${REASON_LABEL[r.reason]}×${r.count}`).join(" ")}
        </div>
      )}

      <ReportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        myReport={state.my_report}
        onSubmit={async (p) => {
          setModalOpen(false);
          await doToggle({ question_id: questionId, kind: "report", ...p });
        }}
        onUndo={async () => {
          setModalOpen(false);
          // Toggle sem reason: manda o reason do report atual, backend detecta que existe e apaga.
          if (state.my_report) {
            await doToggle({ question_id: questionId, kind: "report", reason: state.my_report.reason });
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/Questions/QuestionReactions.tsx
git commit -m "feat(reactions): componente QuestionReactions"
```

---

### Task 10: Integrar `QuestionReactions` no `QuestionCard`

**Files:**
- Modify: `src/components/Questions/QuestionCard.tsx`

- [ ] **Step 1: Descobrir onde renderizar**

Abre `QuestionCard.tsx` e localiza o rodapé do card (perto do fim do JSX principal, antes do `</Card>` ou equivalente).

- [ ] **Step 2: Adicionar import e usar**

Adiciona no topo dos imports:

```tsx
import { QuestionReactions } from "./QuestionReactions";
```

O card recebe uma `question` prop. Assumindo que `question` tem os novos campos (`likes_count`, `reports`, `my_liked`, `my_report`, `blocked`), insere no rodapé:

```tsx
<div className="border-t pt-2 mt-2">
  <QuestionReactions
    questionId={question.id}
    initial={{
      likes_count: question.likes_count ?? 0,
      reports: question.reports ?? [],
      my_liked: question.my_liked ?? false,
      my_report: question.my_report ?? null,
      blocked: question.blocked ?? false,
    }}
    loggedIn={typeof window !== "undefined" && !!localStorage.getItem("pmeditor:session")}
  />
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Rodar dev + smoke test manual**

```bash
pnpm dev
```

Abre localhost:3000, vai no banco de questões:
- Contagens aparecem em cada card (0/vazio se nada foi curtido/reportado ainda).
- Clique no coração → contagem sobe, ícone fica vermelho.
- Clique no bandeira → modal abre.
- Seleciona motivo, envia → badge aparece.
- Clica no bandeira de novo → modal mostra "já reportou" com "Desfazer".

- [ ] **Step 5: Commit**

```bash
git add src/components/Questions/QuestionCard.tsx
git commit -m "feat(reactions): QuestionCard renderiza barra de reacoes"
```

---

### Task 11: Nova aba "Reportadas" em `/admin/gerenciar`

**Files:**
- Modify: `src/app/admin/gerenciar/page.tsx`

- [ ] **Step 1: Descobrir estrutura de abas atual**

Abre `page.tsx` e vê como abas existentes são declaradas. Aparentemente usa `Tabs` da shadcn (verificar).

- [ ] **Step 2: Adicionar nova aba**

Se for `Tabs`:

```tsx
<TabsList>
  {/* ...abas existentes... */}
  <TabsTrigger value="reportadas">Reportadas</TabsTrigger>
</TabsList>

<TabsContent value="reportadas">
  <ReportadasTab />
</TabsContent>
```

- [ ] **Step 3: Implementar `ReportadasTab` como componente no mesmo arquivo (ou extrair)**

```tsx
function ReportadasTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pmeditor:session") ?? "";
    fetch("https://mpfaraujo.com.br/guardafiguras/api/questoes/list.php?limit=100&order=likes", {
      headers: { "X-Session-Token": token },
    })
      .then(r => r.json())
      .then(data => {
        // Filtra só as que têm reports ou estão bloqueadas
        const withReports = (data.items ?? []).filter((q: any) => q.blocked || (q.reports?.length ?? 0) > 0);
        // Ordena: bloqueadas primeiro, depois por total de reports desc
        withReports.sort((a: any, b: any) => {
          if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
          const ta = (a.reports ?? []).reduce((s: number, r: any) => s + r.count, 0);
          const tb = (b.reports ?? []).reduce((s: number, r: any) => s + r.count, 0);
          return tb - ta;
        });
        setItems(withReports);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleClear = async (id: string) => {
    const token = localStorage.getItem("pmeditor:session") ?? "";
    const res = await fetch("https://mpfaraujo.com.br/guardafiguras/api/reactions/clear.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body: JSON.stringify({ question_id: id }),
    });
    if (res.ok) setItems(prev => prev.filter(q => q.id !== id));
  };

  if (loading) return <div>Carregando…</div>;
  if (items.length === 0) return <div className="text-muted-foreground">Nenhuma questão reportada. 🎉</div>;

  return (
    <div className="space-y-3">
      {items.map(q => (
        <div key={q.id} className="border rounded p-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs">{q.id}</div>
            {q.blocked && <span className="text-red-600 text-xs font-semibold">BLOQUEADA</span>}
          </div>
          <div className="text-sm mt-1">{q.disciplina} / {q.assunto}</div>
          <div className="text-xs text-orange-600 mt-1">
            {q.reports?.map((r: any) => `${r.reason}×${r.count}`).join(" · ")}
          </div>
          <div className="flex gap-2 mt-2">
            <a href={`/editor/questoes?id=${q.id}`} className="text-xs underline">Ver questão</a>
            <button onClick={() => handleClear(q.id)} className="text-xs underline">Limpar reports</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check + smoke test**

```bash
pnpm tsc --noEmit
pnpm dev
```

Abre `/admin/gerenciar`, aba "Reportadas". Reporta uma questão qualquer noutra aba, volta pra "Reportadas" e ela deve aparecer.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/gerenciar/page.tsx
git commit -m "feat(reactions): aba Reportadas em /admin/gerenciar"
```

---

### Task 12: Rollout

- [ ] **Step 1: Confirmar backend em produção**

Todos os PHPs subidos:
- `reactions/schema.sql` executado
- `reactions/_helpers.php`
- `reactions/toggle.php`
- `reactions/clear.php`
- `questoes/list.php` (atualizado)
- `questoes/get.php` (atualizado)

Teste de fumaça: curl `list.php`, confirma que `likes_count`, `reports`, `blocked` aparecem nos itens.

- [ ] **Step 2: Deploy frontend**

```bash
git push
```

Aguarda build da Vercel.

- [ ] **Step 3: Teste end-to-end em produção**

- Logado como admin: curtir, descurtir, reportar (cada tipo), desfazer report.
- Logado como não-admin (se conseguir criar 2ª conta): reportar "conteúdo impróprio" → questão some pra ele; ainda aparece pro admin.
- Filtro "order=likes" na lista: questão com like sobe.
- Aba "Reportadas" no admin: mostra o que foi reportado.

- [ ] **Step 4: Merge/tag opcional**

Se quiser marcar release:

```bash
git tag v-reactions-2026-08-25
git push --tags
```
