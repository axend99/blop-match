-- BLOP Match — "Write it for me" on the sign-up form: the AI suggests a sentence for "what I
-- want to talk about". One row per suggestion, only to cap how many each account can ask for.
begin;

create table public.talk_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index talk_suggestions_user on public.talk_suggestions (user_id);
alter table public.talk_suggestions enable row level security;
revoke all on public.talk_suggestions from anon, authenticated;

commit;
