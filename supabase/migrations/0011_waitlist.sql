-- BLOP Match — invitation to the BLOP app waiting list: an e-mail 5 days after sign-up and a
-- button on /me. Taps go through /go/waitlist, which records them (first per person and source).
begin;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'new_match', 'review_open', 'review_reminder', 'waitlist'));

create table public.waitlist_clicks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  source text not null check (source in ('email', 'button')),
  created_at timestamptz not null default now(),
  unique (participant_id, source)
);
alter table public.waitlist_clicks enable row level security;
revoke all on public.waitlist_clicks from anon, authenticated;

commit;
