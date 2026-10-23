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
MIN_SHARED_COMPATIBLE=3
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

Cartão de match em `/me`: BLOP da outra pessoa, primeiro nome, até 3 chips dos itens partilhados (ou "Get to know each other!" se nenhum) e o estado da review ("Rate this interaction" ativo só depois do prazo, ou "Reviewed ✓"). Tocar no cartão abre `/me/match/[matchId]` (a "cheat sheet"): "Blop found someone you should meet", BLOP grande, "Nome, idade" (perfis antigos sem idade mostram a faixa), "Based in <cidade>", cartão "Wants to talk about" com o texto da pessoa (icebreaker), caixa "Your common ground" com os itens partilhados, "Also likes…" com os outros interesses, botão WhatsApp (`https://wa.me/<número só com dígitos>?text=<mensagem>`, com uma mensagem pré-preenchida no idioma de quem envia: saudação com os primeiros nomes e só o que a outra pessoa quer falar, para a conversa começar nesse tema (se o tema for um interesse que quem envia também marcou, acrescenta "eu também gosto de …"); perfis sem tema usam até 3 interesses em comum; `lib/icebreaker.ts`) e botão Instagram (`https://instagram.com/<handle sem @>`). Nunca mostrar score, tipo do match ou o e-mail da outra pessoa.

Avatar BLOP: cada pessoa tem um BLOP (imagens em `public/blop/<categoria>.webp`, `components/Blop.tsx`) vestido para a categoria em que tem mais interesses (`lib/avatar.ts`); sem categoria mostra o BLOP simples (`plain.webp`). Há uma imagem para cada uma das 8 categorias.

Todo o design é mobile-first, simples e limpo, com botões grandes.

---

## 4. Perfil

Campos (todos obrigatórios, exceto "outro"):

- `name` (primeiro nome)
- `whatsapp`: seletor de país (Portugal e Brasil no topo) + número com máscara ao escrever; tem de ser um telemóvel válido desse país (`lib/phone.ts`, libphonenumber-js `mobile`); gravado em E.164
- `instagram` (handle, sem @), **opcional**: sem Instagram não há botão de Instagram para os matches nem pergunta de Instagram na review
- `city` (texto livre)
- `lang` (`en` | `pt`)
- `age`: número inteiro de 18 a 99 (campo numérico); `age_range` (`18-24` | `25-30` | `31-35` | `36+`) é derivado e gravado para a análise
- `time_in_city`: `lt6m` | `6-24m` | `2y+` | `always`
- `origin`: `this_city` | `same_country` | `other_country`
- `interests`: sem mínimo por categoria (uma categoria pode ficar vazia), no máximo 5 por categoria, pelo menos 10 no total em pelo menos 3 categorias (validar no cliente e no servidor; contador global no formulário)
- `other_text`: um campo livre opcional por categoria (não entra no matching)
- "What I want to talk about" (icebreaker mostrado aos matches, obrigatório no cadastro, não editável depois, não entra no matching): **exatamente um** de `talk_about_code` (um dos interesses que a pessoa marcou) ou `talk_about` (texto livre, até 140 caracteres numa linha)
- `consent`: checkbox obrigatória: "I agree to share my first name, age, city, interests, what I want to talk about, WhatsApp and Instagram (if given) with my matches, and to take part in this research study. I am 18 or older." + link para `/privacy`

Os interesses são chips clicáveis agrupados por categoria, com um contador "n/5" por categoria e um contador geral fixo ("X escolhidos · pelo menos 10 em 3+ categorias").

### Catálogo de interesses (`lib/interests.ts`)

Formato: `{ code, category, en, pt }`. As 8 categorias, por esta ordem: `music`, `sports` (praticar ou acompanhar), `fitness` (atividade física), `movies` (filmes e séries, por género), `animals`, `food` (cozinhas sempre com "food"/"Comida …"), `activities` (o que gosta de fazer/sair) e `hobbies` (o que pratica). Prefixos: `music_`, `sports_`, `fit_`, `movies_`, `animals_`, `food_`, `act_`, `hob_`. Rótulos curtos, sem parênteses.

**music:** music_rock Rock/Rock · music_pop Pop/Pop · music_indie Indie/Indie · music_electronic Electronic/Eletrónica · music_techno Techno & House/Techno e House · music_hiphop Hip-hop & Rap/Hip-hop e Rap · music_rnb R&B & Soul/R&B e Soul · music_reggae Reggae/Reggae · music_latin Reggaeton & Latin/Reggaeton e Latina · music_afro Kizomba & Afrobeats/Kizomba e Afrobeats · music_funk Funk/Funk · music_sertanejo Sertanejo/Sertanejo · music_mpb MPB/MPB · music_samba Samba & Pagode/Samba e Pagode · music_fado Fado/Fado · music_jazz Jazz & Blues/Jazz e Blues · music_metal Metal/Metal · music_classical Classical/Clássica · music_kpop K-pop/K-pop · music_lofi Lo-fi/Lo-fi

**sports:** sports_football Football/Futebol · sports_basketball Basketball/Basquetebol · sports_volleyball Volleyball/Voleibol · sports_tennis Tennis/Ténis · sports_padel Padel/Padel · sports_surf Surf/Surf · sports_martial Martial arts/Artes marciais · sports_boxing Boxing/Boxe · sports_motorsport Formula 1 & motorsport/Fórmula 1 e desportos motorizados · sports_handball Handball/Andebol · sports_rugby Rugby/Râguebi · sports_skate Skateboarding/Skate

**fitness:** fit_gym Gym/Ginásio · fit_running Running/Corrida · fit_cycling Cycling/Ciclismo · fit_swimming Swimming/Natação · fit_yoga Yoga & Pilates/Yoga e Pilates · fit_climbing Climbing/Escalada · fit_crossfit CrossFit/CrossFit · fit_walking Walking/Caminhadas · fit_calisthenics Calisthenics/Calistenia

**movies:** movies_comedy Comedy/Comédia · movies_drama Drama/Drama · movies_thriller Thriller & suspense/Thriller e suspense · movies_horror Horror/Terror · movies_romcom Romantic comedy/Comédia romântica · movies_scifi Sci-fi/Ficção científica · movies_fantasy Fantasy/Fantasia · movies_action Action/Ação · movies_docs Documentaries/Documentários · movies_anime Anime & animation/Anime e animação · movies_truecrime True crime/True crime · movies_kdrama K-dramas/K-dramas · movies_reality Reality shows/Reality shows

**animals:** animals_dogs Dogs/Cães · animals_cats Cats/Gatos · animals_wildlife Wildlife/Animais selvagens · animals_birds Birds/Aves · animals_horses Horses/Cavalos · animals_marine Marine life/Vida marinha · animals_reptiles Reptiles/Répteis · animals_rodents Rabbits & rodents/Coelhos e roedores

**food:** food_japanese Japanese food/Comida japonesa · food_italian Italian food/Comida italiana · food_brazilian Brazilian food/Comida brasileira · food_portuguese Portuguese food/Comida portuguesa · food_mexican Mexican food/Comida mexicana · food_indian Indian food/Comida indiana · food_chinese Chinese food/Comida chinesa · food_thai Thai food/Comida tailandesa · food_middleeastern Middle Eastern food/Comida do Médio Oriente · food_veggie Vegetarian & vegan food/Comida vegetariana e vegana · food_seafood Seafood/Marisco e peixe · food_burgers Burgers/Hambúrgueres · food_street Street food/Comida de rua · food_desserts Desserts & pastries/Doces e pastelaria · food_brunch Coffee & brunch/Café e brunch · food_wine Wine/Vinho · food_craftbeer Craft beer/Cerveja artesanal · food_cocktails Cocktails/Cocktails

**activities:** act_hiking Hiking & nature/Trilhos e natureza · act_beach Beach/Praia · act_travel Travel/Viajar · act_bars Bars/Bares · act_clubbing Clubbing/Discoteca · act_concerts Concerts & festivals/Concertos e festivais · act_stayin Staying in/Ficar em casa · act_gamenights Game nights/Noites de jogos · act_dinners Dinners out/Jantares fora · act_terraces Terraces & cafés/Esplanadas e cafés · act_museums Museums & exhibitions/Museus e exposições · act_theatre Theatre & stand-up/Teatro e stand-up · act_picnics Picnics & parks/Piqueniques e parques · act_roadtrips Road trips/Road trips · act_volunteer Volunteering/Voluntariado

**hobbies:** hob_cooking Cooking/Cozinhar · hob_knitting Knitting & crochet/Tricô e crochet · hob_dancing Dancing/Dançar · hob_instrument Playing an instrument/Tocar um instrumento · hob_singing Singing/Cantar · hob_photo Photography/Fotografia · hob_videogames Video games/Videojogos · hob_boardgames Board games/Jogos de tabuleiro · hob_reading Reading/Leitura · hob_writing Writing/Escrita · hob_drawing Drawing & painting/Desenho e pintura · hob_crafts Crafts & DIY/Artesanato e DIY · hob_gardening Gardening & plants/Jardinagem e plantas · hob_languages Learning languages/Aprender idiomas · hob_pottery Pottery/Cerâmica

---

## 5. Algoritmo de matching (`lib/matching.ts`)

Funções puras e testadas; a persistência fica num serviço separado.

```
score(A, B) = |I_A ∩ I_B| / |I_A ∪ I_B|        // Jaccard sobre todos os itens
shared(A, B) = I_A ∩ I_B
sharedByCategory(A, B) = { music: n, sports: n, fitness: n, movies: n, animals: n, food: n, activities: n, hobbies: n }
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
| `ig_follow` | Do you follow each other on Instagram now? | `me` / `them` / `both` / `none` | as duas pessoas têm Instagram |
| `comment` | Anything else? | texto, opcional | sempre |

Derivado: `next_step = meet_again_1_7 >= 5 OR met IN ('yes','planned')`.

---

## 8. Painel admin (`/admin`, em português)

A lógica de cálculo fica em `lib/stats.ts` (funções puras com testes). Cada percentagem ou média mostra o **n** ao lado. Unidade de análise: a review (uma pessoa a avaliar um match; cada match dá até 2 reviews). Percentagens sobre todas as reviews do grupo (`talked` nulo conta como "não"); médias ignoram respostas em falta. As metas comparam valores sem arredondar. Taxa de resposta = reviews de matches já abertos ÷ (2 × matches já abertos). H3: reviews dos dois grupos; só contam categorias com n ≥ 15 com e sem item partilhado; o valor é a maior diferença (com sinal); "Dados insuficientes" se nenhuma categoria tiver esse n. Usar gráficos simples (Recharts) e tabelas.

No topo, um filtro **Reais / Seed / Tudo** (`?dados=`, padrão Reais) aplica-se a todos os blocos e às exportações CSV (com colunas `is_seed`); enquanto houver seed, um aviso lembra de o limpar antes de divulgar.

Abas: **Painel**, **Verificação** (`/admin/verificacao`: "Perfis por verificar" — perfis novos em que a IA marcou o nome ou os textos, ou falhou — com Aprovar, Verificar de novo e Banir; "Denúncias por ver" com Arquivar e Banir) e **Participantes** (`/admin/participantes`: cada pessoa com perfil, contactos, estado e os seus matches — com quem, compatível/controlo, itens em comum, review de cada lado e toques; pesquisa por nome/e-mail; em cada match ainda por avaliar, o botão "Abrir avaliação agora" recua a data do match para a review abrir já e envia o e-mail de review às duas pessoas — atalho para testers). No painel, "Como ler este painel" (definições: compatível, controlo, review, n, p.p., ρ, dados insuficientes) e uma linha de descrição em cada bloco; cada hipótese diz em linguagem simples o que testa e como se calcula.

1. **Amostra** (primeiro bloco): participantes (ativos), matches (compatível/controlo), matches por pessoa (média e 0/1/2/3/4+), reviews e taxa de resposta; composição em % por faixa etária, tempo na cidade, origem, cidade e idioma; % de matches com ≥ 1 item em comum por categoria e com o mesmo perfil por característica, compatível vs controlo. Base: pessoas não anonimizadas e os matches entre elas.
2. **Placar das hipóteses:** um cartão por hipótese com o valor atual, a meta e o estado: "Acima da meta", "Abaixo da meta" ou "Dados insuficientes" (n < 15 em algum grupo).

| # | Métrica | Meta |
| --- | --- | --- |
| H0 | % de reviews com `contacted` = sim (total) | ≥ 40% |
| H1 | % `talked` compatível − % `talked` controlo; e satisfação média compatível − controlo | ≥ 15 p.p. e ≥ 1,0 ponto |
| H2 | Spearman ρ entre `shared_count` e `satisfaction_1_7` | ≥ 0,3 |
| H3 | Maior diferença de satisfação média (com item partilhado na categoria − sem), entre categorias | ≥ 0,75 ponto |
| H4 | `common_ground_1_7` compatível − controlo | ≥ 1,0 ponto |

3. **Funil por grupo:** match → contacto → conversa → próximo passo → encontro (sim/combinado), em % lado a lado para compatível e controlo.
4. **Notas médias 1–7 por grupo:** interesse, conforto, fluidez, coisas em comum, satisfação, vontade de repetir.
5. **Por categoria (H3):** para cada categoria, satisfação média e % de conversa com vs. sem item partilhado nessa categoria, ordenadas pela diferença. Expandir para mostrar o detalhe por item.
6. **Por segmento:** contacto, conversa e satisfação cortados por `age_range`, `time_in_city`, `origin`, `city` e `lang`, com filtro de grupo (todos / compatível / controlo).
7. **Dose-resposta (H2):** satisfação média por `shared_count` (0, 1, 2, 3, 4+).
8. **Motivos de não contacto** (`why_not`) por grupo; **itens mais escolhidos**; respostas "outro".
9. **Tabelas brutas** com exportação CSV: participantes, matches e reviews (cada review junta os dados do match e do perfil de quem respondeu).
10. **Alertas de conteúdo** (`content_flags`): textos livres marcados pela verificação automática (ou que ficaram por verificar), com campo, categoria, razão e o texto; botão "marcar como visto" (`resolved_at`). Mostrar o texto e a razão só como texto.
11. **Cliques nos botões de contacto** (mostrado logo a seguir ao funil, como "3b"; `contact_clicks`, primeiro toque por match, pessoa e canal): % de lados de match que tocaram em WhatsApp/Instagram (todos, por grupo, por canal) e o cruzamento com a review (tocou e contactou; tocou e não contactou = barreira, com motivos; não tocou e contactou, separado por quem tomou a iniciativa; nenhum dos dois; de quem tocou, quantos conversaram). Unidade: lado do match; só matches criados depois do início do rastreio e sem pessoas anonimizadas; só toques anteriores à review entram no cruzamento. A % de toques no Instagram conta só os lados em que a outra pessoa tem Instagram. Mostra também "Já se seguem no Instagram?" por grupo. Os CSV trazem a hora do primeiro toque, se foi antes da review e `ig_follow`.

---

## 9. Dados e segurança

### Tabelas (migração SQL em `supabase/migrations/`)

- `participants`: id uuid pk, user_id uuid unique → auth.users, name, email, whatsapp, instagram, city, lang, age smallint (18–99), age_range, time_in_city, origin, interests text[], other_text jsonb, consent_at timestamptz, active bool default true, is_seed bool default false (dados falsos do `scripts/seed.ts`; nunca têm `user_id` nem `email`), created_at
- `matches`: id uuid pk, a_id, b_id → participants, type text check in ('compatible','control'), score numeric, shared_items text[], shared_count int, shared_by_category jsonb, created_at; unique(a_id, b_id), check(a_id < b_id)
- `review_requests`: match_id, participant_id, requested_at, reminded_at; pk(match_id, participant_id)
- `reviews`: id uuid pk, match_id, reviewer_id, os campos da secção 7, created_at; unique(match_id, reviewer_id)
- `email_log`: id, participant_id, kind (`welcome` | `new_match` | `review_open` | `review_reminder` | `waitlist`), match_id null, sent_at
- `waitlist_clicks`: participant_id, source (`email` | `button`), created_at; unique(participant_id, source). Lista de espera da app BLOP: o cron envia o convite (`waitlist`) 5 dias depois do cadastro a quem continua no estudo com e-mail (pendentes incluídos); `/me` tem um cartão com o botão; os dois links passam por `/go/waitlist`, que conta o toque e redireciona para `WAITLIST_URL` (sem essa variável não há e-mail nem botão). Bloco 8b do admin mostra convites e toques.
- `participants.pending_review` (bool): perfil novo à espera da verificação (IA do nome e dos textos; se marcar algo ou falhar, espera por um admin) ou pessoa denunciada; não recebe matches novos (`lib/matchingService.ts` e `try_create_match`). Só volta quando não há denúncias abertas nem alertas de perfil por ver (`lib/verification.ts`).
- `reports`: id, match_id, reporter_id, reported_id (on delete set null), reason (`harassment` | `sexual` | `threat` | `spam` | `fake` | `unsafe` | `other`), details ≤ 1000, created_at, resolved_at, resolution (`dismissed` | `banned`); unique(match_id, reporter_id). Feitas em `/me/report/[matchId]` (link no match, na review e nos e-mails de match/review); os admins recebem um e-mail curto.
- `banned_emails`: email (minúsculas), reason, banned_at. O endereço exato banido é recusado no login e no cadastro. Uma variação da mesma caixa de correio (`+etiqueta`, pontos no Gmail; `lib/emailCanonical.ts`) de um e-mail banido, ou de outro perfil ativo, não é recusada: o perfil novo fica pendente com um alerta "E-mail" (`banned_mailbox` / `same_mailbox`, com o nome do outro perfil) para o admin aprovar ou banir.

### RLS
- Um participante lê e atualiza só a própria linha em `participants`.
- Dos seus matches, lê apenas: `name`, `whatsapp`, `instagram`, `age`, `age_range`, `city`, `interests`, `talk_about`, `talk_about_code` e `shared_items` da outra pessoa (nada disto se ela tiver sido anonimizada). Implementar via view ou função `get_my_matches()` com `security definer`, nunca expondo `type` nem `score`.
- Insere a review apenas dos seus próprios matches e apenas depois do prazo (validar também no servidor).
- Admin, cron e matching usam a service role, só no servidor.

### Privacidade (`/privacy`, EN/PT)
Estudo académico do projeto BLOP (MIET 2026). Dados recolhidos: os do perfil, as reviews, os toques nos botões de contacto (não as mensagens) e no link da lista de espera da app BLOP. Quem os vê: os matches veem o primeiro nome, idade, cidade, interesses, aquilo de que a pessoa quer falar, WhatsApp e Instagram (nunca o e-mail); a equipa vê tudo para análise. Os dados são guardados até ao fim do estudo e depois anonimizados ou apagados. "Leave the study" desativa o perfil; para eliminar os dados, basta escrever para founders@meetblop.com (anonimização: `name='[deleted]'`, `email`, `whatsapp`, `instagram`, `talk_about` e `talk_about_code` a null, `other_text '{}'`, `active=false`, `deleted_at` preenchido, apagam-se as linhas dessa pessoa em `content_flags`, `contact_clicks` e `waitlist_clicks`; depois apaga-se o utilizador de auth). O primeiro nome e os textos livres (`talk_about`, `other_text`, comentário da review) são verificados por IA (Anthropic, `lib/moderationService.ts`); o nome tem de parecer um primeiro nome real (`not_a_name` para usernames/pseudónimos). Um perfil novo marcado (ou cuja verificação falhou) fica pendente até um admin aprovar; os comentários de reviews só geram alertas. Regras de conduta e responsabilidade na política de privacidade; denúncias guardadas só para a equipa; e-mails banidos guardados durante o estudo. Idade mínima: 18 anos.

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

**Fase 5 — Admin:** `lib/stats.ts` + testes; `/admin` com os 11 blocos; exportação CSV.
✓ Com dados de seed, o placar e os cortes mostram valores coerentes.

**Fase 6 — Seed, deploy e teste:** `scripts/seed.ts` com 100 participantes falsos (mesclando perfis parecidos e opostos; `is_seed = true`, inativos, sem conta nem e-mail, por isso nenhum fluxo automático lhes toca), matching e reviews aleatórias (compatíveis ligeiramente melhores) e toques de contacto; `npm run seed:clean` para limpar o seed (aborta se houver matches entre seed e pessoas reais); guia em `docs/CONFIGURACAO.md`; deploy na Vercel; lista final das variáveis de ambiente e passos de configuração (Google OAuth redirect, SMTP no Supabase e na Vercel).
✓ O link público funciona no telemóvel de ponta a ponta.
