# Backlog — pedidos do produto a encaixar nas próximas fases

## Matches imediatos e área de matches (pedido de 20/10/2026) — feito na Fase 3

1. **Match logo após o cadastro.** Quando a pessoa termina o perfil, o matching corre na hora
   (`runMatchingFor` no fim de `createProfile`, já marcado em `app/join/actions.ts`).
   Se já houver pessoas compatíveis, os matches acontecem de imediato, para os dois lados.
   O cron diário continua a preencher as vagas que ficarem livres.
   - Ponto em aberto: com poucos inscritos no início, pode não haver candidatos. Definir se
     basta o cron diário ou se o matching também corre a cada novo perfil para as vagas de
     quem já estava inscrito (o novo perfil é candidato para quem está à espera).
2. **E-mail `new_match`** às duas pessoas quando o match é criado (já no SPEC §6).
3. **Área de matches em `/me`:** um cartão por match (primeiro nome + avatar do personagem BLOP).
4. **Detalhe do match (ao tocar no cartão):** contactos (WhatsApp, Instagram) + uma
   **"cheat sheet"** com o que as duas pessoas têm em comum e o grau de abordagem sugerido.
   - O utilizador vai enviar uma imagem de referência da cheat sheet. Esperar por ela antes de desenhar.
   - Cuidado com o SPEC: nunca mostrar `type` nem `score` nem revelar se é controlo.
     O "grau de abordagem" tem de se basear só nos itens partilhados (ex.: nº e categorias
     em comum), nunca no tipo do match.

## Identidade visual

- Avatar BLOP — feito na Fase 3 em SVG (`components/Blop.tsx`), um acessório por categoria.
  Plano B se o protótipo não agradar: uma imagem por categoria em `public/blop/<categoria>.webp`.
- Ilustrações de estado em `public/blop/`: `looking.webp` (sem matches) e `thinking.webp` (0 em comum, 404).

## Pendências (decididas a 21/10/2026)

- **Imagens do BLOP:** por agora fica o BLOP em SVG; o dono pode mandar mais tarde as 5 imagens
  (`base`, `music`, `sports`, `food`, `hobbies`, PNG transparente, quadrado, mesmo enquadramento).
- **E-mails de review a quem saiu do estudo:** não recebem (pode avaliar pelo `/me`). Aprovado.
- **Review de match com parceiro anonimizado:** permitido, com título genérico. O primeiro nome
  só desaparece quando a pessoa pede para apagar os dados (anonimização); quem só sai do estudo
  continua a aparecer pelo primeiro nome.
- **"Leave the study"** saiu do `/me`: fica no fim da página "About the study" (`/about`),
  pequeno e sem destaque; link "About the study" no rodapé.
