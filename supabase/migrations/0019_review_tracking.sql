-- BLOP Match — review progress in /admin: taps on the review e-mail buttons (first per person,
-- match and e-mail) and the first time each person opens the review form of a match.
begin;

create table public.review_clicks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  source text not null check (source in ('open', 'reminder')),
  created_at timestamptz not null default now(),
  unique (match_id, participant_id, source)
);
alter table public.review_clicks enable row level security;
revoke all on public.review_clicks from anon, authenticated;

create table public.review_views (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, participant_id)
);
alter table public.review_views enable row level security;
revoke all on public.review_views from anon, authenticated;

commit;
