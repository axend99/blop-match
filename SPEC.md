# BLOP Match — Especificação do experimento de compatibilidade

Plataforma web simples para testar se interesses em comum aumentam a interação entre desconhecidos. Sem hardware. As pessoas recebem um link, fazem login, criam o perfil, recebem matches por e-mail, contactam-se por WhatsApp/Instagram e, 3 dias depois, avaliam cada interação. Um painel admin compara matches compatíveis com matches de controlo.

Prazo: em produção até domingo, 25 de outubro de 2026.

---

## 1. Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Propósito | Só amizade (comunicado na divulgação). Sem campo de intenção. |
| Idioma | Inglês por padrão, português opcional (seletor EN/PT em todas as páginas). E-mails no idioma do perfil. |
| Login | Supabase Auth: Google (principal) e magic link por e-mail (alternativa). Sem senhas. |
| Contactos | E-mail (só avisos da plataforma); WhatsApp e Instagram visíveis apenas aos matches. |
| Compatibilidade | Escondida. O participante nunca vê o score nem sabe se o match é de controlo. |
| Matching | Solto, ao nível do item (ex.: `music_rock`). Sem restrição de cidade. |
| Controlo | Cada pessoa: até 3 matches compatíveis + 1 de controlo. |
| Review | Abre 3 dias após o match (`REVIEW_DELAY_DAYS`, padrão 3). |
| Escalas | 1–7 sempre que possível (1 = not at all, 7 = very much). |
| Admin | Em português, restrito a `ADMIN_EMAILS`. |

---

## 2. Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres + Auth (Google + magic link) + RLS. Usar `@supabase/ssr`.
- SMTP (Gmail com senha de app; trocável por domínio próprio) + nodemailer + React Email para e-mails
- Vercel para hosting + Vercel Cron (1x por dia)
- i18n próprio: `lib/i18n/en.ts`, `lib/i18n/pt.ts`, idioma guardado em cookie e no perfil
- Testes: Vitest para `lib/matching.ts` e `lib/stats.ts`

### Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="BLOP Match <you@gmail.com>"
NEXT_PUBLIC_SITE_URL=
CRON_SECRET=
ADMIN_EMAILS=email1@x.com,email2@x.com
ADMIN_ACCESS_TOKEN=
REVIEW_DELAY_DAYS=3
REMINDER_DELAY_DAYS=2
MAX_COMPATIBLE=3
MAX_CONTROL=1
MIN_SHARED_COMPATIBLE=2
```

---

## 3. Páginas e fluxo

| Rota | Acesso | Conteúdo |
| --- | --- | --- |
| `/` | Público | Onboarding: o que é, o que se espera (contactar os matches, conversar, avaliar após 3 dias), duração, privacidade. Botão "Join the experiment". |
| `/login` | Público | "Continue with Google" e "Email me a sign-in link". |
| `/join` | Logado, sem perfil | Formulário de perfil (ver 4). |
| `/me` | Logado, com perfil | Lista de matches + estado da review de cada um. Sem matches: "We'll email you as soon as you get a match." Link "Leave the study". |
| `/me/review/[matchId]` | Logado, participante do match | Formulário de review. Bloqueado até `created_at + REVIEW_DELAY_DAYS`, mostrando a data de abertura. |
| `/privacy` | Público | Texto RGPD (ver 9). |
| `/admin` | `ADMIN_EMAILS` (login normal) ou link de acesso | Painel (ver 8). Em português. |
| `/admin/acesso/<token>` | Quem tem o link | Link partilhado com a equipa: valida `ADMIN_ACCESS_TOKEN` (≥ 32 caracteres), grava um cookie assinado (30 dias) e redireciona para `/admin`. Trocar o token invalida todos os acessos. |
| `/api/cron` | Header `Authorization: Bearer CRON_SECRET` | Rotina diária (ver 6). |

Regras de navegação: um logado sem perfil vai para `/join`; um logado com perfil vai para `/me`.

Cartão de match em `/me`: BLOP da outra pessoa, primeiro nome, até 3 chips dos itens partilhados (ou "Get to know each other!" se nenhum) e o estado da review ("Rate this interaction" ativo só depois do prazo, ou "Reviewed ✓"). Tocar no cartão abre `/me/match/[matchId]` (a "cheat sheet"): "Blop found someone you should meet", BLOP grande, "Nome, faixa etária", "Based in <cidade>", cartão "Wants to talk about" com o texto da pessoa (icebreaker), caixa "Your common ground" com os itens partilhados, "Also likes…" com os outros interesses, botão WhatsApp (`https://wa.me/<número só com dígitos>?text=<mensagem>`, com uma mensagem pré-preenchida no idioma de quem envia: saudação com os primeiros nomes e só o que a outra pessoa quer falar, para a conversa começar nesse tema (se o tema for um interesse que quem envia também marcou, acrescenta "eu também gosto de …"); perfis sem tema usam até 3 interesses em comum; `lib/icebreaker.ts`) e botão Instagram (`https://instagram.com/<handle sem @>`). Nunca mostrar score, tipo do match ou o e-mail da outra pessoa.

Avatar BLOP: cada pessoa tem um BLOP (SVG, `components/Blop.tsx`) com o acessório da categoria em que tem mais interesses (`lib/avatar.ts`).

Todo o design é mobile-first, simples e limpo, com botões grandes.

---

## 4. Perfil

Campos (todos obrigatórios, exceto "outro"):

- `name` (primeiro nome)
- `whatsapp` (com indicativo, ex.: +351…; validar formato E.164)
- `instagram` (handle, sem @)
- `city` (texto livre)
- `lang` (`en` | `pt`)
- `age_range`: `18-24` | `25-30` | `31-35` | `36+`
- `time_in_city`: `lt6m` | `6-24m` | `2y+` | `always`
- `origin`: `this_city` | `same_country` | `other_country`
- `interests`: 3 a 6 itens por categoria (validar no cliente e no servidor)
- `other_text`: um campo livre opcional por categoria (não entra no matching)
- "What I want to talk about" (icebreaker mostrado aos matches, obrigatório no cadastro, não editável depois, não entra no matching): **exatamente um** de `talk_about_code` (um dos interesses que a pessoa marcou) ou `talk_about` (texto livre, até 140 caracteres numa linha)
- `consent`: checkbox obrigatória: "I agree to share my first name, age range, city, interests, WhatsApp and Instagram with my matches, and to take part in this research study. I am 18 or older." + link para `/privacy`

Os interesses são chips clicáveis agrupados por categoria, com um contador "2/6".

### Catálogo de interesses (`lib/interests.ts`)

Formato: `{ code, category, en, pt }`. As categorias são `music`, `sports`, `food` e `hobbies`.

**music:** music_rock Rock/Rock · music_pop Pop/Pop · music_indie Indie/Indie · music_electronic Electronic/Eletrónica · music_hiphop Hip-hop & Rap/Hip-hop e Rap · music_funk Funk/Funk · music_sertanejo Sertanejo/Sertanejo · music_mpb MPB & Samba/MPB e Samba · music_fado Fado/Fado · music_latin Reggaeton & Latin/Reggaeton e Latina · music_jazz Jazz & Blues/Jazz e Blues · music_metal Metal/Metal · music_classical Classical/Clássica · music_kpop K-pop/K-pop

**sports:** sports_football Football/Futebol · sports_padel Padel/Padel · sports_tennis Tennis/Ténis · sports_running Running/Corrida · sports_gym Gym/Ginásio · sports_surf Surf/Surf · sports_cycling Cycling/Ciclismo · sports_basketball Basketball/Basquete · sports_volleyball Volleyball/Vólei · sports_swimming Swimming/Natação · sports_climbing Climbing/Escalada · sports_yoga Yoga & Pilates/Yoga e Pilates · sports_martial Martial arts/Artes marciais

**food:** food_japanese Japanese/Japonesa · food_italian Italian/Italiana · food_brazilian Brazilian/Brasileira · food_portuguese Portuguese/Portuguesa · food_mexican Mexican/Mexicana · food_indian Indian/Indiana · food_veggie Vegetarian & Vegan/Vegetariana e Vegana · food_burgers Burgers/Hambúrguer · food_street Street food/Comida de rua · food_brunch Coffee & Brunch/Café e Brunch · food_wine Wine/Vinho · food_craftbeer Craft beer/Cerveja artesanal

**hobbies:** hob_photo Photography/Fotografia · hob_reading Reading/Leitura · hob_games Video games/Games · hob_travel Travel/Viajar · hob_beach Beach/Praia · hob_hiking Hiking & Nature/Trilhas e natureza · hob_festivals Festivals & Concerts/Festivais e concertos · hob_movies Movies & Series/Cinema e séries · hob_art Art & Museums/Arte e museus · hob_dance Dancing/Dança · hob_instruments Playing music/Tocar instrumentos · hob_volunteer Volunteering/Voluntariado · hob_languages Languages/Idiomas · hob_bars Bars/Bares · hob_clubbing Clubbing/Discoteca · hob_dinners Dinners out/Jantares fora · hob_terraces Terraces & Cafés/Esplanadas · hob_cooking Cooking at home/Cozinhar em casa · hob_knitting Knitting/Tricô

---

## 5. Algoritmo de matching (`lib/matching.ts`)

Funções puras e testadas; a persistência fica num serviço separado.

```
score(A, B) = |I_A ∩ I_B| / |I_A ∪ I_B|        // Jaccard sobre todos os itens
shared(A, B) = I_A ∩ I_B
sharedByCategory(A, B) = { music: n, sports: n, food: n, hobbies: n }
```

`runMatchingFor(person)`:
1. Candidatos = participantes `active = true`, ≠ pessoa, sem match existente com ela, e com vagas no tipo pretendido. Vagas de cada pessoa: até `MAX_COMPATIBLE` compatíveis e `MAX_CONTROL` de controlo.
2. Vagas a preencher na pessoa: a lista de tipos em falta (ex.: `[compatible, compatible, compatible, control]`) é **embaralhada**, para que o controlo não seja sempre o último.
3. Para cada vaga:
   - **compatible:** candidatos com `|shared| >= MIN_SHARED_COMPATIBLE` e vaga compatível livre; escolher o maior score (desempate: quem tem menos matches e depois quem é mais antigo).
   - **control:** candidatos com `|shared| = 0` e vaga de controlo livre; escolher ao acaso. Se não houver ninguém com 0, escolher o de menor score com vaga de controlo. Grava-se sempre o `shared_count` real.
   - Sem candidato: a vaga fica livre para o próximo perfil ou cron.
4. Cada match criado é um registo por par (`a_id < b_id`), com `type`, `score`, `shared_items`, `shared_by_category` e `shared_count`, gravados no momento (snapshot). Conta na vaga do mesmo tipo das duas pessoas.
5. Envia o e-mail "new match" às duas pessoas.

Corre quando um perfil é criado e no cron diário, para todas as pessoas com vagas (ordenadas da mais antiga para a mais recente). Tem de ser idempotente: não pode criar pares duplicados (constraint `unique(a_id, b_id)`).

Testes obrigatórios: score correto; nunca há pares duplicados; respeita os limites por tipo; o controlo prefere 0 partilhados; uma pessoa inativa nunca entra.

---

## 6. E-mails e cron

Todos os e-mails estão em EN/PT conforme `participants.lang`, com um botão principal. Cada envio fica registado em `email_log` para evitar duplicados.

| Tipo (`kind`) | Quando | Conteúdo |
| --- | --- | --- |
| `welcome` | Perfil criado | Obrigado, o que esperar, link para `/me` |
| `new_match` | Match criado | "You have a new match!" + link para `/me` (sem contactos no e-mail) |
| `review_open` | Cron: match com ≥ `REVIEW_DELAY_DAYS` dias, sem pedido enviado a essa pessoa | Link para `/me/review/<matchId>` |
| `review_reminder` | Cron: ≥ `REMINDER_DELAY_DAYS` dias após `review_open`, sem review | Um único lembrete |

`/api/cron` (diário às 09:00 UTC; ver `vercel.json`): 1) matching para quem tem vagas; 2) `review_open`; 3) `review_reminder`. A resposta é um JSON com as contagens.

---

## 7. Review (`/me/review/[matchId]`)

Uma review por pessoa por match. É um formulário de um só ecrã, com as perguntas a aparecerem conforme as respostas. Escalas 1–7 em 7 botões grandes, com os rótulos "Not at all" (1) e "Very much" (7).

| Campo | Pergunta (EN) | Tipo | Mostrar se |
| --- | --- | --- | --- |
| `contacted` | Did you two get in touch? | sim/não | sempre |
| `interest_1_7` | How interesting did this match seem to you? | 1–7 | sempre |
| `who_first` | Who reached out first? | `me` / `them` | contacted = sim |
| `comfort_1_7` | How comfortable did you feel reaching out (or being contacted)? | 1–7 | contacted = sim |
| `why_not` | What stopped you? | `no_time` / `not_interested` / `no_reply` / `shy` / `other` | contacted = não |
| `talked` | Did you have a real conversation? | sim/não | contacted = sim |
| `flow_1_7` | How well did the conversation flow? | 1–7 | talked = sim |
| `common_ground_1_7` | How much did you feel you had in common? | 1–7 | talked = sim |
| `satisfaction_1_7` | Overall, how satisfied are you with this interaction? | 1–7 | talked = sim |
| `meet_again_1_7` | How likely are you to talk or meet again? | 1–7 | talked = sim |
| `met` | Did you meet in person? | `yes` / `planned` / `no` | talked = sim |
| `comment` | Anything else? | texto, opcional | sempre |

Derivado: `next_step = meet_again_1_7 >= 5 OR met IN ('yes','planned')`.

---

## 8. Painel admin (`/admin`, em português)

A lógica de cálculo fica em `lib/stats.ts` (funções puras com testes). Cada percentagem ou média mostra o **n** ao lado. Unidade de análise: a review (uma pessoa a avaliar um match; cada match dá até 2 reviews). Percentagens sobre todas as reviews do grupo (`talked` nulo conta como "não"); médias ignoram respostas em falta. As metas comparam valores sem arredondar. Taxa de resposta = reviews de matches já abertos ÷ (2 × matches já abertos). H3: reviews dos dois grupos; só contam categorias com n ≥ 15 com e sem item partilhado; o valor é a maior diferença (com sinal); "Dados insuficientes" se nenhuma categoria tiver esse n. Usar gráficos simples (Recharts) e tabelas.

1. **Placar das hipóteses:** um cartão por hipótese com o valor atual, a meta e o estado: "Acima da meta", "Abaixo da meta" ou "Dados insuficientes" (n < 15 em algum grupo).

| # | Métrica | Meta |
| --- | --- | --- |
| H0 | % de reviews com `contacted` = sim (total) | ≥ 40% |
| H1 | % `talked` compatível − % `talked` controlo; e satisfação média compatível − controlo | ≥ 15 p.p. e ≥ 1,0 ponto |
| H2 | Spearman ρ entre `shared_count` e `satisfaction_1_7` | ≥ 0,3 |
| H3 | Maior diferença de satisfação média (com item partilhado na categoria − sem), entre categorias | ≥ 0,75 ponto |
| H4 | `common_ground_1_7` compatível − controlo | ≥ 1,0 ponto |

2. **Visão geral:** nº de participantes, de matches (compatível/controlo), de reviews e taxa de resposta.
3. **Funil por grupo:** match → contacto → conversa → próximo passo → encontro (sim/combinado), em % lado a lado para compatível e controlo.
4. **Notas médias 1–7 por grupo:** interesse, conforto, fluidez, coisas em comum, satisfação, vontade de repetir.
5. **Por categoria (H3):** para cada categoria, satisfação média e % de conversa com vs. sem item partilhado nessa categoria, ordenadas pela diferença. Expandir para mostrar o detalhe por item.
6. **Por segmento:** contacto, conversa e satisfação cortados por `age_range`, `time_in_city`, `origin`, `city` e `lang`, com filtro de grupo (todos / compatível / controlo).
7. **Dose-resposta (H2):** satisfação média por `shared_count` (0, 1, 2, 3, 4+).
8. **Motivos de não contacto** (`why_not`) por grupo; **itens mais escolhidos**; respostas "outro".
9. **Tabelas brutas** com exportação CSV: participantes, matches e reviews (cada review junta os dados do match e do perfil de quem respondeu).
10. **Alertas de conteúdo** (`content_flags`): textos livres marcados pela verificação automática (ou que ficaram por verificar), com campo, categoria, razão e o texto; botão "marcar como visto" (`resolved_at`). Mostrar o texto e a razão só como texto.

---

## 9. Dados e segurança

### Tabelas (migração SQL em `supabase/migrations/`)

- `participants`: id uuid pk, user_id uuid unique → auth.users, name, email, whatsapp, instagram, city, lang, age_range, time_in_city, origin, interests text[], other_text jsonb, consent_at timestamptz, active bool default true, created_at
- `matches`: id uuid pk, a_id, b_id → participants, type text check in ('compatible','control'), score numeric, shared_items text[], shared_count int, shared_by_category jsonb, created_at; unique(a_id, b_id), check(a_id < b_id)
- `review_requests`: match_id, participant_id, requested_at, reminded_at; pk(match_id, participant_id)
- `reviews`: id uuid pk, match_id, reviewer_id, os campos da secção 7, created_at; unique(match_id, reviewer_id)
- `email_log`: id, participant_id, kind, match_id null, sent_at

### RLS
- Um participante lê e atualiza só a própria linha em `participants`.
- Dos seus matches, lê apenas: `name`, `whatsapp`, `instagram`, `age_range`, `city`, `interests`, `talk_about`, `talk_about_code` e `shared_items` da outra pessoa (nada disto se ela tiver sido anonimizada). Implementar via view ou função `get_my_matches()` com `security definer`, nunca expondo `type` nem `score`.
- Insere a review apenas dos seus próprios matches e apenas depois do prazo (validar também no servidor).
- Admin, cron e matching usam a service role, só no servidor.

### Privacidade (`/privacy`, EN/PT)
Estudo académico do projeto BLOP (MIET 2026). Dados recolhidos: os do perfil e as reviews. Quem os vê: os matches veem o primeiro nome, faixa etária, cidade, interesses, aquilo de que a pessoa quer falar, WhatsApp e Instagram (nunca o e-mail); a equipa vê tudo para análise. Os dados são guardados até ao fim do estudo e depois anonimizados ou apagados. "Leave the study" desativa o perfil; para eliminar os dados, basta escrever para founders@meetblop.com (anonimização: `name='[deleted]'`, `email`, `whatsapp`, `instagram`, `talk_about` e `talk_about_code` a null, `other_text '{}'`, `active=false`, `deleted_at` preenchido, apagam-se as linhas dessa pessoa em `content_flags`; depois apaga-se o utilizador de auth). Os textos livres (`talk_about`, `other_text`, comentário da review) são verificados por IA (Anthropic, `lib/moderationService.ts`) só para gerar alertas no `/admin`; nada é bloqueado. Idade mínima: 18 anos.

---

## 10. Fases de desenvolvimento e critérios de aceitação

**Fase 1 — Base:** scaffold Next.js + Tailwind; clientes Supabase (browser/server/service); migração SQL + RLS; `lib/interests.ts`; i18n com seletor EN/PT; layout base mobile-first.
✓ `npm run build` passa; a migração aplica-se no Supabase sem erros.

**Fase 2 — Login, onboarding e perfil:** `/`, `/login` (Google + magic link), `/join` com validação, `/privacy`, e-mail `welcome`.
✓ Crio conta com Google e com magic link, preencho o perfil e recebo o e-mail.

**Fase 3 — Matching e `/me`:** `lib/matching.ts` + testes; serviço que persiste os matches e envia `new_match`; página `/me`; "Leave the study".
✓ Testes passam; com 2 perfis compatíveis, ambos veem-se em `/me` e recebem o e-mail.

**Fase 4 — Cron e reviews:** `/api/cron` + `vercel.json`; `review_open` e `review_reminder`; formulário condicional com escalas 1–7.
✓ Com `REVIEW_DELAY_DAYS=0`, chamar o cron envia o pedido, a review fica gravada e não se pode repetir.

**Fase 5 — Admin:** `lib/stats.ts` + testes; `/admin` com os 10 blocos; exportação CSV.
✓ Com dados de seed, o placar e os cortes mostram valores coerentes.

**Fase 6 — Seed, deploy e teste:** `scripts/seed.ts` com 40 participantes falsos (mesclando perfis parecidos e opostos), matching e reviews aleatórias (compatíveis ligeiramente melhores); comando para limpar o seed; deploy na Vercel; lista final das variáveis de ambiente e passos de configuração (Google OAuth redirect, SMTP no Supabase e na Vercel).
✓ O link público funciona no telemóvel de ponta a ponta.
