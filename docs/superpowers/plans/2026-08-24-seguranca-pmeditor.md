# Plano de Segurança — PMEditor (2026-08-24)

Levantamento inicial baseado em varredura do backend PHP (`php/guardafiguras/api/`),
do frontend Next.js (`src/`) e da forma como os tokens são distribuídos. O objetivo
deste plano é priorizar por **impacto real x custo de correção**, não fazer uma
auditoria acadêmica.

Legenda de severidade:

- **CRÍTICO** — comprometimento direto do banco/conta; explorável hoje sem esforço.
- **ALTO** — comprometimento condicionado (ex.: precisa vazar algo, precisa CSRF).
- **MÉDIO** — hardening que fecha uma classe inteira de bug futuro.
- **BAIXO** — higiene.

---

## 1. Achados

### 1.1 CRÍTICO — Token de escrita da API está no bundle público do site
`src/lib/questions.ts:20`, `src/lib/baseTexts.ts:9`

O token `X-Questions-Token` é lido de `NEXT_PUBLIC_QUESTIONS_TOKEN`. Tudo prefixado
com `NEXT_PUBLIC_*` no Next.js **é enviado para o navegador** — logo, qualquer
pessoa que abrir o site tem o token. Esse mesmo token permite:

- `questoes/create.php` — criar qualquer questão.
- `questoes/update.php:46` — o comentário do próprio código diz: *“Autenticado via
  questions token — acesso admin garantido”*, ou seja, o token pula a checagem de
  role e vira admin equivalente.
- `questoes/propose.php`, `questoes/delete-*`, `base_texts/*`, `provas/*` etc.

Ataque prático: abrir o site, `document.cookie`/DevTools → copiar o valor →
apagar/reescrever todo o banco de questões via `curl`. Não precisa de login.

### 1.2 CRÍTICO — Token de upload hardcoded no código-fonte do frontend
`src/components/editor/ImageUpload.tsx:24`

```
const UPLOAD_TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";
```

Mesmo problema, mais explícito: string literal no bundle. Permite upload não
autenticado para `upload.php` (5 MB por arquivo, sem quota por usuário — só
rate-limit por IP). Casado com um typo/imagem WebP construída pra parecer HTML,
serve como cache de conteúdo hospedado no seu domínio.

### 1.3 CRÍTICO — Credenciais de banco versionadas no repositório
`php/guardafiguras/api/questoes/config/database.php:15-18`
`php/guardafiguras/api/upload.php:164-168` (duplicadas!)

```
$db   = 'u824839049_questoes';
$user = 'u824839049_adminQuest';
$pass = 'adminQuest123';
```

- Senha fraca (`adminQuest123`), presente **duas vezes** no código.
- Se o repo virar público em algum momento, ou se um zip do projeto vazar, o
  banco está aberto (Hostinger normalmente aceita conexão externa, ou pelo menos
  por phpMyAdmin).
- Mesmo mantendo o repo privado, versionar segredo é anti-pattern:
  qualquer colaborador (Claude Code, outra IA, colega) acaba com cópia local.

### 1.4 CRÍTICO — Login Google não valida `aud` (client_id)
`php/guardafiguras/api/users/login.php:38-53`

O endpoint chama `https://oauth2.googleapis.com/tokeninfo?id_token=...` e aceita
qualquer token cujo `sub` exista. **Não checa `aud`**. Isso significa que um ID
token emitido para qualquer outra aplicação Google do usuário (uma extensão
maliciosa, um site de terceiros que ele usou o "Sign in with Google") pode ser
apresentado ao seu endpoint e o servidor entrega uma sessão de 30 dias em nome
daquele usuário.

Pior: se o token vier de um app cujo escopo o atacante controla, é login como
qualquer conta Google. É o tipo de bug que aparece em CTF de OAuth.

### 1.5 ALTO — CORS `Access-Control-Allow-Origin: *` em endpoints autenticados
Todos os endpoints (`create.php`, `update.php`, `login.php`, `profile.php`,
`upload.php`, `provas/*`, `turmas/*`, `admin/stats.php`, …).

Combinado com o item 1.1 e 1.2, qualquer site pode chamar sua API do navegador
da vítima. Não é CSRF clássico (o token não é cookie, é header), mas facilita
exfiltração / abuso via JS de terceiros carregado em qualquer aba.

### 1.6 ALTO — Session token de 30 dias sem rotação
`login.php:62`, `profile.php:22-35`

- Vida útil enorme (30 dias) sem refresh/rotate.
- Guardado em `localStorage` no frontend (ver `LoginButton.tsx`) → acessível a
  qualquer XSS.
- Sem endpoint de logout que invalide o token no servidor (a coluna
  `session_token` fica lá até expirar naturalmente).

### 1.7 ALTO — `?debug=1` expõe mensagem de exceção
`questoes/create.php:28,33,564-569` e padrão repetido em outros arquivos.

`?debug=1` na query string faz o handler devolver `message` do PDOException.
Isso vaza estrutura de tabela, nomes de colunas, e às vezes dados
(`Duplicate entry '...' for key ...`). Basta o atacante saber que o flag existe
(agora que este documento existe, considere público).

### 1.8 MÉDIO — `LIKE` com input não escapado (SQL LIKE, não injection)
`questoes/list.php:149-152`

```
$where[] = 'LOWER(q.tags_json) LIKE :tags';
$params[':tags'] = '%' . strtolower($tags) . '%';
```

Não é SQLi (é prepared), mas se o input contiver `%` ou `_` a busca vira
wildcard. Só afeta relevância; sem impacto de segurança direto. Fica na lista
como higiene.

### 1.9 MÉDIO — Upload aceita conteúdo por MIME mas serve arquivo por extensão
`upload.php:98-130`

O MIME check está correto (usa `finfo`), a extensão é derivada do MIME, e o
nome é o hash sha256 — bom. Mas o diretório `/uploads/` fica servindo direto
via Apache. Se em algum momento alguém alterar o mapeamento para permitir
`image/svg+xml`, tem XSS armazenado via SVG. Sugestão: bloquear
`Content-Disposition` inline para SVG, ou nunca aceitar SVG.

### 1.10 MÉDIO — `error_log()` de mensagens de PDO em produção
Vários arquivos. Não é problema em si, mas somado ao `?debug=1` mostra que a
higiene de erro não é uniforme. Vale um util `report_error()` central.

### 1.11 BAIXO — `Access-Control-Allow-Headers` permissivo
Já coberto pelo item 1.5; listado só para hardening final.

---

## 2. Plano de ação (ordem sugerida)

### Fase A — Estancar sangramento (1–2 horas)
Objetivo: cortar o pior sem quebrar o app.

1. **Rodar a senha do banco no painel Hostinger** e mover para variável de
   ambiente / arquivo fora do docroot. Remover as duas cópias hardcoded.
2. **Rotar o `X-Questions-Token`** para um novo valor secreto e:
   - Fazer `update.php` **não** mais aceitar esse token como bypass de admin
     (só session token de admin passa).
   - Deixar o token novo apenas em **scripts locais** (`bulk-import`, `check-*`)
     que rodam do seu terminal, lendo de `.env.local` já ignorado pelo git.
3. **Rotar o `UPLOAD_TOKEN`** e mudar `upload.php` para exigir também
   `X-Session-Token` válido (usuário logado). Remover a constante do bundle
   frontend; o frontend passa a mandar o session token do usuário.
4. **Adicionar validação de `aud` no `login.php`** conferindo o `client_id` da
   sua app Google Cloud Console. Rejeitar se não bater. Rejeitar também se
   `exp` estiver expirado ou `iss` não for `accounts.google.com` /
   `https://accounts.google.com`.
5. **Desligar o `?debug=1`** em produção (só liga se
   `getenv('APP_ENV') === 'dev'`).

Após Fase A: repo/local não expõe mais nada crítico; API não pode ser abusada
por qualquer visitante anônimo.

### Fase B — Modelo de auth consistente (meio dia)
Objetivo: acabar com o modelo "token compartilhado" de vez.

6. **Rota pública real vs. rota autenticada**:
   - Leitura (`list.php`, `get.php`, `base_texts/list.php`): pode continuar
     pública ou exigir sessão — decidir.
   - Escrita: **sempre** session token, sempre passa por
     `require_admin_or_owner()` central.
7. **Utilitário `require_session($pdo, $requireAdmin = false)`** compartilhado
   entre todos os endpoints — remove ~40 blocos duplicados e evita o próximo
   endpoint esquecendo checagem.
8. **Rotação de session token** no login e a cada X dias; endpoint `logout.php`
   que faz `UPDATE user_profiles SET session_token=NULL`.
9. **CORS restrito** ao(s) origin(s) da Vercel (produção + preview) + localhost
   em dev. Substituir `*` por whitelist.

### Fase C — Hardening (algumas horas)
10. Cabeçalhos padrão em toda resposta: `X-Content-Type-Options: nosniff`
    (já em alguns), `Referrer-Policy: no-referrer`, `Permissions-Policy`.
11. Bloquear SVG no upload; adicionar `Content-Disposition: attachment` em
    tipos não-imagem se um dia forem aceitos.
12. Escape de `%` e `_` no filtro por tags (`list.php`).
13. Log de erro centralizado que **nunca** vaza `PDOException::getMessage()`
    ao cliente, mesmo em dev.
14. Revisar todos os endpoints ainda não abertos aqui (`fix.php`,
    `batch-merge.php`, `promote-variant.php`, `link-base-text.php`, admin
    routes) aplicando o mesmo padrão.

### Fase D — Defesa em profundidade (futuro)
15. Content-Security-Policy no Next.js (proibir `unsafe-eval`, restringir
    hosts de imagem).
16. Migrar `NEXT_PUBLIC_QUESTIONS_TOKEN` restante (se ainda houver) para
    endpoints server-side do Next.js (API routes) que assinam a chamada com o
    token real do lado do servidor. Elimina o token do navegador para sempre.
17. Auditoria de dependências (npm audit + composer/PHP) — recorrente.
18. Backup automatizado do banco (fora do escopo estrito de segurança mas
    relacionado a resiliência).

---

## 3. O que **NÃO** foi encontrado (bom sinal)

- Não foram vistos `eval()`, `unserialize()` de input, ou `system()`/`exec()`.
- SQL usa PDO com prepared statements — não achei concatenação de query com
  input do usuário nos arquivos varridos.
- KaTeX é usado em `dangerouslySetInnerHTML` mas com `trust: false` (default);
  não é XSS trivial.
- React auto-escape cobre o resto do frontend.

---

## 4. Fora de escopo deste plano

- Rate-limiting/DoS (o `ratelimit.php` já existe; ajuste fino é outra
  conversa).
- Backups.
- LGPD / retenção de dados de e-mail dos usuários.
- Compliance formal (OWASP ASVS etc.).
