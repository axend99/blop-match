# BLOP Match — configuração

Guia para pôr (ou voltar a pôr) o BLOP Match no ar. Produção: https://blop-match.vercel.app

## 1. Variáveis de ambiente

Ficam na Vercel (Project → Settings → Environment Variables) e, para correr localmente ou o seed, em `.env.local` (nunca no git; modelo em `.env.example`).

| Variável | O que é | Onde se obtém |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço: **só no servidor**, ignora o RLS | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | Verificação dos textos livres por IA (só gera alertas no `/admin`) | console.anthropic.com → API Keys |
| `SMTP_HOST`, `SMTP_PORT` | `smtp.gmail.com`, `465` | — |
| `SMTP_USER`, `SMTP_PASS` | Conta `blopmatch@gmail.com` e a **senha de app** (não a senha normal) | Google Account → Security → App passwords |
| `EMAIL_FROM` | Remetente, ex. `BLOP Match <blopmatch@gmail.com>` | — |
| `NEXT_PUBLIC_SITE_URL` | `https://blop-match.vercel.app` (links dos e-mails) | — |
| `WAITLIST_URL` | Link da lista de espera da app BLOP (convite por e-mail 5 dias depois do cadastro e botão em `/me`); vazio = desligado | o dono |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID do cliente Web do Google (não é segredo). **Só em Production**: ativa o botão oficial do Google no `/login`, que mostra `blop-match.vercel.app` em vez do endereço do Supabase | Google Cloud → Credentials |
| `CRON_SECRET` | Segredo que a Vercel envia ao chamar `/api/cron` | gerar: `openssl rand -hex 32` |
| `ADMIN_EMAILS` | E-mails com acesso ao `/admin` (separados por vírgula) | — |
| `ADMIN_ACCESS_TOKEN` | Token do link de acesso ao `/admin` sem login (≥ 32 caracteres) | gerar: `openssl rand -hex 32` |
| `REVIEW_DELAY_DAYS` | Dias entre o match e o pedido de review (2; no dia 1 vai o e-mail "Já falaste com o teu match?") | — |
| `REMINDER_DELAY_DAYS` | Dias entre o pedido e o lembrete (3: o lembrete chega 5 dias depois do match) | — |
| `MAX_COMPATIBLE`, `MAX_CONTROL`, `MIN_SHARED_COMPATIBLE` | Regras do matching (3, 1, 9): compatível = pelo menos 9 pontos (1 por interesse em comum + 1 se a diferença de idade for de até 5 anos), também na análise | — |

Depois de mudar uma variável na Vercel, é preciso fazer **Redeploy**.

## 2. Supabase

1. **Migrações**: no SQL Editor, correr por ordem os ficheiros de `supabase/migrations/` (`0001_init` → `0011_waitlist`). Todas já estão aplicadas em produção.
2. **Authentication → URL Configuration**: Site URL `https://blop-match.vercel.app`; Redirect URLs `https://blop-match.vercel.app/**` e `http://localhost:3000/**`.
3. **Authentication → Providers → Google**: ativo, com o Client ID e o Client Secret do cliente **Web** do Google Cloud (passo 3).
4. **Authentication → Emails → SMTP Settings**: Custom SMTP ativo — host `smtp.gmail.com`, porta `465`, utilizador `blopmatch@gmail.com` (atenção a erros como `gmaill.com`), senha de app, remetente `blopmatch@gmail.com`, nome `BLOP Match`.
5. **Authentication → Emails → Templates** (Magic Link e Confirm signup): o link tem de ser
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`

## 3. Google Cloud (login com Google)

1. APIs & Services → Credentials → Create credentials → OAuth client ID → tipo **Web application** (não "Desktop").
2. Authorized redirect URI: `https://<projeto>.supabase.co/auth/v1/callback` (o URL do Supabase + `/auth/v1/callback`).
3. No mesmo cliente, **Authorized JavaScript origins**: `https://blop-match.vercel.app` e `http://localhost:3000` (para o botão oficial do Google).
4. OAuth consent screen / Branding: nome "BLOP Match", e-mail de suporte, domínio `blop-match.vercel.app`; **Publish app** (em "Testing" só os utilizadores de teste conseguem entrar).

## 4. Gmail

A conta `blopmatch@gmail.com` precisa de verificação em 2 passos ativa para criar a senha de app. A mesma senha de app vai para o Supabase (SMTP do login) e para a Vercel (`SMTP_PASS`, e-mails do estudo). Limite do Gmail: ~500 e-mails por dia.

## 5. Vercel

- Variáveis da secção 1 em **Production** (e Preview, se quiser testar previews).
- `/api/cron` (matching dos que ficaram sem pares, e-mail "Já falaste com o teu match?", pedidos e lembretes de review, convite da lista de espera) corre **de hora a hora, das 08:00 às 21:00 UTC**, pelo agendador do Supabase (`pg_cron` + `pg_net`, migração `0021_hourly_jobs`; o `CRON_SECRET` fica no vault do Supabase como `cron_secret`). O cron diário da Vercel (`vercel.json`, 09:00 UTC) fica como reserva. Cada e-mail é registado uma vez, por isso as execuções nunca repetem envios. Em previews o cron não faz nada, porque os previews usam a mesma base de dados.
- Se mudar o `CRON_SECRET` na Vercel, atualizar também o vault: `select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<novo>');`
- Domínio: `blop-match.vercel.app` (Settings → Domains).

## 6. Acesso ao `/admin`

- Quem está em `ADMIN_EMAILS` entra no `/admin` depois de fazer login (Google ou link mágico).
- O resto da equipa usa o link `https://blop-match.vercel.app/admin/acesso/<ADMIN_ACCESS_TOKEN>`: grava um cookie válido 30 dias só para o `/admin`. Não partilhar fora da equipa.
- **Revogar o link**: gerar um novo `ADMIN_ACCESS_TOKEN` na Vercel e fazer Redeploy. O link antigo e todos os cookies emitidos com ele deixam de funcionar.

## 7. Dados de seed (demonstração)

Participantes falsos para ver o `/admin` com números. São gravados com `is_seed = true`, **inativos**, sem conta e sem e-mail: o matching, o cron e os e-mails nunca lhes tocam, e nunca recebem matches com pessoas reais.

```bash
npm run seed        # 100 participantes, matches, reviews, toques e 3 alertas de exemplo
npm run seed:clean  # apaga tudo o que é seed (e só isso)
```

Ambos leem `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` e mostram o host do Supabase antes de escrever. No `/admin`, o filtro **Reais / Seed / Tudo** escolhe que dados aparecer (padrão: Reais).

## 8. Anonimizar uma pessoa (pedido de eliminação)

No SQL Editor, trocando o e-mail:

```sql
with p as (select id, user_id from participants where lower(email) = lower('pessoa@exemplo.com'))
, del_flags as (delete from content_flags where participant_id in (select id from p))
, del_clicks as (delete from contact_clicks where participant_id in (select id from p))
, del_waitlist as (delete from waitlist_clicks where participant_id in (select id from p))
update participants set
  name = '[deleted]', email = null, whatsapp = null, instagram = null,
  talk_about = null, talk_about_code = null, other_text = '{}',
  active = false, deleted_at = now()
where id in (select id from p)
returning user_id;
```

Depois, em Authentication → Users, apagar o utilizador com o `user_id` devolvido. Os matches e as reviews ficam (sem dados pessoais) para a análise; as denúncias que a pessoa fez ou recebeu também ficam (só a equipa as vê).

**Banir** (alguém com comportamento abusivo) é diferente: faz-se no `/admin` (aba Verificação, ficha em Participantes ou alerta), apaga a pessoa e os matches dela e bloqueia o e-mail durante o estudo.

## 8b. Teste automático com 10 participantes (Playwright)

```bash
npm run e2e        # 10 contas blopmatch+e2e01…10@gmail.com fazem o percurso completo em produção
npm run e2e:clean  # apaga essas contas e tudo o que está ligado a elas
```

Precisa de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente. As contas ficam inativas no fim (não recebem matches de quem se inscrever depois). Os números de WhatsApp são fictícios (EUA 555-01xx).

## 8c. Recomeçar os dados

`npm run reset:data` lista o que seria apagado (todos os participantes, matches, reviews e as contas de login ligadas a eles ou às contas e2e; nunca contas de `ADMIN_EMAILS`) e grava uma cópia em CSV em `reset-backup/` (fora do git). `npm run reset:data -- --apply` apaga. Depois, `npm run seed` se quiser dados de demonstração.

## 9. Antes de divulgar

1. `npm run seed:clean` e `npm run e2e:clean`, e confirmar no `/admin` (filtro Tudo) que já não há aviso de seed.
2. Fazer o percurso completo no telemóvel: login com Google e com link mágico, cadastro, e-mail de boas-vindas, ver o match, botões de WhatsApp/Instagram, sair.
3. Confirmar que os e-mails chegam (e não vão para spam) em Gmail e Outlook.
4. Confirmar que o Google OAuth está publicado (não em "Testing").
5. Rever o `/admin` com o filtro Reais: sem participantes de teste esquecidos.
