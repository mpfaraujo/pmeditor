# Fase 0 — Segurança urgente (plano executável, com estado real medido)

> Substitui a Fase 0 do plano [2026-07-21-refatoracao-estrutural.md](./2026-07-21-refatoracao-estrutural.md), que foi escrita sem auditar o código atual. Muitas etapas propostas lá **já estavam feitas**; outras estavam mal desenhadas. Este documento reflete o estado real medido em 2026-07-29.

**Goal:** Fechar as três vulnerabilidades de segurança da Fase 0 original **sem quebrar o deploy atual em nenhum momento**. Cada task é retrocompatível: PHP deployado primeiro, frontend depois; rotação/rollback só depois que ambos convergem.

**Estado real medido (2026-07-29):**

| Endpoint | Auth aceita hoje | Precisa mudar? |
|----------|------------------|----------------|
| `login.php` | Token do Google (sem validar `aud`/`iss`) | ✅ Task 0.1 |
| `questoes/update.php` | X-Session-Token (admin) **OU** X-Questions-Token (secrets) | ❌ já retro-compat |
| `questoes/delete.php` | Só X-Session-Token (admin) | ❌ já migrado |
| `questoes/delete-bulk.php` | **Só X-Questions-Token** (bundle exposto) | ✅ Task 0.2 |
| `questoes/fix.php` | **Só X-Questions-Token** (bundle exposto) | ✅ Task 0.2 |
| `questoes/batch-merge.php` | **Só X-Questions-Token** (bundle exposto) | ✅ Task 0.2 |
| `upload.php` | Token hardcoded no PHP | ✅ Task 0.3 |

**Frontend usa `NEXT_PUBLIC_QUESTIONS_TOKEN` (bundle) em:**
- `src/lib/questions.ts` linhas 20, 48, 61, 70, 149, 181 — leitura, propose, list, create
- `src/lib/baseTexts.ts`, `src/lib/provas.ts`, `src/lib/turmas.ts`, `src/lib/user.ts`, `src/components/Questions/QuestionsFilter.tsx`, `src/components/editor/plugins/smartPastePlugin.ts`, `src/app/minha-area/turmas/**` — outros usos (todos endpoints que **continuam** aceitando X-Questions-Token)
- `src/app/admin/fixes/page.tsx` — único caller de `delete-bulk`/`fix`/`batch-merge`

**Escopo Fase 0:** só os endpoints destrutivos + login + upload. `create.php`/`propose.php`/`list.php`/etc continuam aceitando X-Questions-Token porque não são destrutivos. Rotação completa do `NEXT_PUBLIC_QUESTIONS_TOKEN` fica pra Fase pós-0 (fora daqui).

**Ordem geral:** 0.1 (independente) → 0.2A/B/C sequencial → 0.3A/B/C sequencial.

**Custo total:** zero janela de quebra se a ordem for respeitada. Ver "Custo & compat" de cada task.

**Rollback global:** cada task tem seu bloco de reversão. Todos os PHPs antes de mudar são copiados pra `php/.backup-fase-0/` no seu servidor (você faz esse backup no primeiro passo).

---

## Task 0.0 — Backup dos PHPs originais (5 minutos, você)

**Antes de qualquer outra coisa**, no servidor da Hostinger:

```bash
cd /home/<usuario>/public_html/guardafiguras/api
mkdir -p .backup-fase-0
cp users/login.php .backup-fase-0/login.php
cp questoes/delete-bulk.php .backup-fase-0/delete-bulk.php
cp questoes/fix.php .backup-fase-0/fix.php
cp questoes/batch-merge.php .backup-fase-0/batch-merge.php
cp upload.php .backup-fase-0/upload.php
cp questoes/config/secrets.php .backup-fase-0/secrets.php
```

**Rollback global** (se qualquer coisa quebrar em qualquer momento):

```bash
cd /home/<usuario>/public_html/guardafiguras/api
cp .backup-fase-0/login.php users/login.php
cp .backup-fase-0/delete-bulk.php questoes/delete-bulk.php
cp .backup-fase-0/fix.php questoes/fix.php
cp .backup-fase-0/batch-merge.php questoes/batch-merge.php
cp .backup-fase-0/upload.php upload.php
cp .backup-fase-0/secrets.php questoes/config/secrets.php
```

- [ ] backup feito na Hostinger

---

## Task 0.1 — `login.php` valida `aud` e `iss` (só PHP)

**Problema:** login.php aceita qualquer Google ID token, mesmo emitido para OUTRO app. Um atacante que consiga um ID token válido de qualquer aplicação Google que use OAuth pode logar como o dono do email correspondente.

**Solução:** validar que `payload.aud === GOOGLE_CLIENT_ID` (nosso app) e `payload.iss` é `accounts.google.com`.

### Custo & compat

- **Janela de quebra:** zero **se** `GOOGLE_CLIENT_ID` estiver correto. Se estiver errado, TODOS os logins param até ajustar (rollback: 30s copiando o backup de volta).
- **Compat retroativa:** total. Todo login que já funcionava continua funcionando.
- **Ação do frontend:** nenhuma.

### Passos (você)

- [ ] **1.** Descobrir seu `GOOGLE_CLIENT_ID` no Google Cloud Console → OAuth 2.0 Client IDs. Formato típico: `1234567890-abcdefghij.apps.googleusercontent.com`.

- [ ] **2.** Setar variável de ambiente na Hostinger. No painel:

  ```
  Advanced → PHP Configuration → PHP-FPM → Environment Variables:
    GOOGLE_CLIENT_ID = <seu_client_id_aqui>
  ```

  Alternativa: adicionar no início do `login.php` (menos seguro, versionado):

  ```php
  putenv('GOOGLE_CLIENT_ID=1234...apps.googleusercontent.com');
  ```

- [ ] **3.** Substituir o bloco de validação do token em `php/guardafiguras/api/users/login.php` (linhas 37-53) por:

  ```php
  // === CONFIG ===
  $GOOGLE_CLIENT_ID = getenv('GOOGLE_CLIENT_ID') ?: '';
  if ($GOOGLE_CLIENT_ID === '') {
      http_response_code(500);
      echo json_encode(['error' => 'server misconfigured: GOOGLE_CLIENT_ID missing']);
      exit;
  }

  // === Verificar token com Google ===
  $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
  $response = @file_get_contents($verifyUrl);

  if ($response === false) {
      http_response_code(401);
      echo json_encode(['error' => 'Falha ao verificar token com Google']);
      exit;
  }

  $payload = json_decode($response, true);

  if (!$payload || !isset($payload['sub'])) {
      http_response_code(401);
      echo json_encode(['error' => 'Token inválido']);
      exit;
  }

  // === NOVA: validar aud e iss ===
  $aud = $payload['aud'] ?? null;
  $iss = $payload['iss'] ?? null;

  if ($aud !== $GOOGLE_CLIENT_ID) {
      http_response_code(401);
      echo json_encode(['error' => 'invalid audience']);
      exit;
  }

  $validIss = ['accounts.google.com', 'https://accounts.google.com'];
  if (!in_array($iss, $validIss, true)) {
      http_response_code(401);
      echo json_encode(['error' => 'invalid issuer']);
      exit;
  }
  ```

- [ ] **4.** Upload no servidor. Testar login no `/` — se abrir e mostrar seu perfil, sucesso.

- [ ] **5.** (opcional) Ver o log do PHP-FPM se aparecer `invalid audience` — significa que o `GOOGLE_CLIENT_ID` está errado. Rollback e conferir.

### Rollback Task 0.1

```bash
cp .backup-fase-0/login.php users/login.php
```

Login volta ao comportamento antigo (aceita qualquer ID token). Fica vulnerável mas funcional.

---

## Task 0.2 — Endpoints destrutivos aceitam `X-Session-Token`

**Problema:** `delete-bulk.php`, `fix.php` e `batch-merge.php` aceitam SÓ `X-Questions-Token` (valor de `secrets.php`), que é o MESMO valor de `NEXT_PUBLIC_QUESTIONS_TOKEN` — está no bundle JS acessível a qualquer visitante. Isso permite: destruir 200 questões por chamada (`delete-bulk`), sobrescrever campos em massa (`fix`), mesclar variantes (`batch-merge`).

**Solução:** replicar o padrão do `update.php` (aceita X-Session-Token de admin OU X-Questions-Token). Manter fallback pro token antigo garante que scripts CLI que usam `--questions-token` (bulk-import, check-*, fix-*) continuem funcionando.

### Custo & compat

- **Task 0.2A (PHP):** janela de quebra ZERO. Só ADICIONA um caminho de auth novo, não remove o antigo.
- **Task 0.2B (frontend):** janela de quebra ZERO. Frontend passa a mandar X-Session-Token quando logado; se não logado, os botões destrutivos já falham na UI hoje (só `/admin/fixes` os usa).
- **Task 0.2C (rotação):** fica pra fase pós-0. Envolve trocar o valor em `secrets.php` E em toda config CLI/frontend que usa o token antigo. Fora do escopo aqui.

### Task 0.2A — PHP: aceitar X-Session-Token como alternativa (você)

Aplicar em `delete-bulk.php`, `fix.php`, `batch-merge.php`. Trecho a substituir (padrão comum nos 3, aparece nas primeiras ~40 linhas):

**Antes** (exemplo `delete-bulk.php` linhas 36-42):
```php
require_once __DIR__ . '/config/secrets.php';
require_once __DIR__ . '/config/database.php';

$token = $_SERVER['HTTP_X_QUESTIONS_TOKEN'] ?? '';
if (!$token || !hash_equals(questions_token(), $token)) {
    fail('Token inválido.', 403);
}
```

**Depois:**
```php
require_once __DIR__ . '/config/secrets.php';
require_once __DIR__ . '/config/database.php';
$pdo = db();

// Auth: aceita X-Session-Token (admin logado no site) OU X-Questions-Token (scripts CLI)
$sessionToken   = $_SERVER['HTTP_X_SESSION_TOKEN']   ?? '';
$questionsToken = $_SERVER['HTTP_X_QUESTIONS_TOKEN'] ?? '';

if ($questionsToken !== '' && hash_equals(questions_token(), $questionsToken)) {
    // Autenticado via questions token (scripts admin) — acesso liberado
} elseif ($sessionToken !== '') {
    $stmt = $pdo->prepare('SELECT role FROM user_profiles WHERE session_token = ? AND session_expires > NOW()');
    $stmt->execute([$sessionToken]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        fail('Sessão inválida ou expirada.', 401);
    }
    if ($user['role'] !== 'admin') {
        fail('Acesso restrito a administradores.', 403);
    }
} else {
    fail('Autenticação obrigatória.', 401);
}
```

Também adicionar `X-Session-Token` no cabeçalho CORS (linha `Access-Control-Allow-Headers`):

```php
header('Access-Control-Allow-Headers: Content-Type, X-Questions-Token, X-Session-Token');
```

- [ ] `delete-bulk.php` atualizado
- [ ] `fix.php` atualizado
- [ ] `batch-merge.php` atualizado
- [ ] upload dos 3 no servidor
- [ ] smoke test: logar como admin no site, ir em `/admin/fixes`, tentar uma correção → funciona. Rodar `pnpm tsx scripts/check-questoes.ts` com token antigo → funciona.

### Task 0.2B — Frontend: usar X-Session-Token nas 3 chamadas destrutivas (eu)

Único caller no frontend é `src/app/admin/fixes/page.tsx`. Vou:

1. Localizar chamadas a `delete-bulk`, `fix`, `batch-merge` no arquivo
2. Trocar `"X-Questions-Token": TOKEN` por `"X-Session-Token": getSessionToken()`
3. Adicionar tratamento de "não logado" (redirecionar pra login)

- [ ] chamadas migradas
- [ ] `pnpm tsc --noEmit` verde
- [ ] `pnpm test --run` verde
- [ ] commit no branch `feat/fase-0-seguranca`
- [ ] smoke test manual em dev (logado admin) e sem login (deve dar 401)

### Task 0.2C — (fora do Fase 0) Rotacionar o token em secrets.php

Deixado para depois porque:
- Requer coordenar troca simultânea em `secrets.php` + `NEXT_PUBLIC_QUESTIONS_TOKEN` do frontend + tokens de CLI (`bulk-import.ts` etc)
- Os 3 endpoints destrutivos já estarão protegidos por X-Session-Token acima
- Rotação sem coordenação quebra bulk-import e chamadas de list/get/create do frontend

### Rollback Task 0.2

**PHP:**
```bash
cp .backup-fase-0/delete-bulk.php questoes/delete-bulk.php
cp .backup-fase-0/fix.php         questoes/fix.php
cp .backup-fase-0/batch-merge.php questoes/batch-merge.php
```

**Frontend:** `git revert <hash-do-commit-0.2B>` no branch.

---

## Task 0.3 — `upload.php` usa `UPLOAD_TOKEN` via env

**Problema:** `upload.php` linha 28 tem o token hardcoded no PHP e o valor está no histórico do git (`DEFAULT_UPLOAD_TOKEN` no `bulk-import.ts`). Qualquer clone do repo tem o token.

**Solução:** ler de variável de ambiente com fallback pro valor hardcoded (retro-compat). Rotacionar depois.

### Custo & compat

- **Task 0.3A (PHP):** janela zero. Se `UPLOAD_TOKEN` env não estiver setada, cai no fallback hardcoded — comportamento atual.
- **Task 0.3B (env + rotação):** janela zero desde que o valor novo seja distribuído antes de invalidar o antigo. Estratégia: setar env com **valor novo** no servidor; deploy do PHP; nesse ponto, PHP aceita **ambos** (nada quebra); depois frontend/scripts migram pro novo; depois remove-se o fallback.
- **Task 0.3C (frontend/scripts):** janela zero — migração incremental.
- **Task 0.3D (remover fallback):** trava se algum caller ainda usar o antigo.

### Task 0.3A — PHP: upload.php lê env com fallback (você)

Substituir em `php/guardafiguras/api/upload.php` (linhas 27-39):

**Antes:**
```php
// ====== TOKEN FIXO ======
$UPLOAD_TOKEN = 'uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes';
// =======================

// Token
$headerToken = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
$formToken   = $_POST['token'] ?? '';
$token = $headerToken !== '' ? $headerToken : $formToken;

if (!is_string($token) || $token === '') {
    fail('Token ausente.', 401);
}
if (!hash_equals($UPLOAD_TOKEN, $token)) {
    fail('Token inválido.', 403);
}
```

**Depois:**
```php
// ====== TOKENS ACEITOS ======
// UPLOAD_TOKEN vem da env (novo). O legado fica como fallback temporário
// até que todos os callers estejam migrados. Remover o legado quando 0.3D rodar.
$UPLOAD_TOKEN_ENV    = getenv('UPLOAD_TOKEN') ?: '';
$UPLOAD_TOKEN_LEGACY = 'uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes';
// ============================

$headerToken = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
$formToken   = $_POST['token'] ?? '';
$token = $headerToken !== '' ? $headerToken : $formToken;

if (!is_string($token) || $token === '') {
    fail('Token ausente.', 401);
}

$ok = false;
if ($UPLOAD_TOKEN_ENV !== '' && hash_equals($UPLOAD_TOKEN_ENV, $token)) $ok = true;
if (!$ok && hash_equals($UPLOAD_TOKEN_LEGACY, $token)) $ok = true;
if (!$ok) {
    fail('Token inválido.', 403);
}
```

- [ ] `upload.php` atualizado
- [ ] upload no servidor

### Task 0.3B — Setar env e distribuir novo valor (você)

- [ ] **1.** Gerar valor novo: `openssl rand -base64 48` (ou o gerador do painel Hostinger)

- [ ] **2.** Setar env no painel Hostinger (mesmo local do `GOOGLE_CLIENT_ID`):

  ```
  UPLOAD_TOKEN = <valor_novo_gerado>
  ```

- [ ] **3.** Anotar o valor. Vai ser usado no passo 0.3C (env do frontend + servidor de builds Vercel).

### Task 0.3C — Frontend/scripts: usar env em vez do hardcoded (eu)

- [ ] **1.** No worktree, ler `.env.local` do projeto. Se não existir, criar com:

  ```
  UPLOAD_TOKEN=<valor_novo_gerado_no_0.3B>
  ```

  Confirmar `.env.local` no `.gitignore` (já está).

- [ ] **2.** Refatorar `scripts/bulk-import.ts` (linha ~137):

  **Antes:**
  ```typescript
  const DEFAULT_UPLOAD_TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";
  ```

  **Depois:**
  ```typescript
  const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN;
  if (!UPLOAD_TOKEN) {
    console.error("ERRO: variável UPLOAD_TOKEN não definida em .env.local");
    process.exit(1);
  }
  ```

  Substituir referências a `DEFAULT_UPLOAD_TOKEN` por `UPLOAD_TOKEN` no arquivo.

- [ ] **3.** Auditar os outros 4 arquivos que grep achou usando `UPLOAD_TOKEN`/`DEFAULT_UPLOAD_TOKEN`:
  - `scripts/fix-agatha-images.mjs`
  - `scripts/check-outros.ts`
  - `scripts/fix-questoes.ts`
  - `scripts/check-questoes.ts`

  Aplicar mesmo padrão (env obrigatório, sem fallback).

- [ ] **4.** Auditar frontend caller de upload: `src/components/editor/ImageUpload.tsx` e `src/components/editor/LogoPicker.tsx`. Se usam `NEXT_PUBLIC_UPLOAD_TOKEN` no bundle, mudar pra receber via env server-side ou pedir sessão. **Provável blocker:** o frontend PRECISA subir imagens direto do browser (não passa por servidor Next). Solução mais realista: manter o token no bundle mas rotacionar frequente. Deixar `NEXT_PUBLIC_UPLOAD_TOKEN` = valor novo (env). Aceitar que o token continua exposto no bundle — o rate limit em `ratelimit.php` (300/h por IP) mitiga o risco.

- [ ] **5.** `pnpm tsc --noEmit` verde, `pnpm test --run` verde.

- [ ] **6.** Commit.

- [ ] **7.** Setar `NEXT_PUBLIC_UPLOAD_TOKEN` na Vercel (env de produção).

- [ ] **8.** Redeploy do frontend na Vercel.

### Task 0.3D — Remover fallback hardcoded de upload.php (você, depois de 0.3C)

Depois que 0.3C estiver deployado E `pnpm tsx scripts/bulk-import.ts --dry-run` funcionar (usando env), remover o fallback:

**Em upload.php:**
```php
$UPLOAD_TOKEN_ENV = getenv('UPLOAD_TOKEN');
if (!$UPLOAD_TOKEN_ENV) {
    fail('Server misconfigured: UPLOAD_TOKEN missing.', 500);
}

$headerToken = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
$formToken   = $_POST['token'] ?? '';
$token = $headerToken !== '' ? $headerToken : $formToken;

if (!is_string($token) || $token === '' || !hash_equals($UPLOAD_TOKEN_ENV, $token)) {
    fail('Token inválido.', 401);
}
```

- [ ] fallback removido, upload no servidor
- [ ] teste upload de uma imagem via editor → funciona
- [ ] teste `bulk-import.ts --dry-run` → funciona

### Rollback Task 0.3

**Se 0.3D quebrou:** substituir `upload.php` pelo backup, upload continua funcionando com o hardcoded.
**Se 0.3A/B/C quebrou algo:** substituir `upload.php` pelo backup.

---

## Checklist final Fase 0

- [ ] **0.0** Backup dos PHPs feito
- [ ] **0.1** login.php valida aud/iss + GOOGLE_CLIENT_ID setado
- [ ] **0.2A** 3 endpoints destrutivos aceitam X-Session-Token
- [ ] **0.2B** frontend admin/fixes usa X-Session-Token
- [ ] **0.3A** upload.php lê UPLOAD_TOKEN via env com fallback
- [ ] **0.3B** UPLOAD_TOKEN novo gerado e setado na Hostinger
- [ ] **0.3C** frontend/scripts usam env `UPLOAD_TOKEN`
- [ ] **0.3D** fallback hardcoded removido de upload.php
- [ ] Smoke test final: login normal + upload de imagem + edição de questão + delete-bulk como admin → tudo verde
- [ ] Merge do branch `feat/fase-0-seguranca` em `main`
- [ ] Update `AGENTS.md` com resumo do que mudou

## Meta-nota (aprendizado)

O plano original de 21-jul assumia estado que não existia (tabela `sessions` separada, endpoints sem session-token nenhum). Isso gerou retrabalho hoje. Para próximas fases, ANTES de escrever a Fase, medir o estado real com grep/read dos arquivos afetados. O plano executável começa depois da medição, não antes.
