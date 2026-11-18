-- 1) The BLOP experience review, once per person, apart from the review of each match (which no
--    longer asks about the idea). Written by the server (service role); RLS on, no policies.
-- 2) v1 → v2: upgraded_at marks when a v1 person joined v2 (reviewed the profile and chose a
--    password). Their v1 matches stay v1: they don't count for slots, review e-mails or the game.
-- 3) email_log: 'v2_invite', the invitation for v1 people to join v2 (sent from /admin).
begin;

create table public.experience_reviews (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  likes_concept boolean not null,
  best_for text not null check (best_for in ('friendship', 'dating', 'both')),
  personality text not null check (personality in ('introvert', 'extrovert', 'both')),
  party_interest text not null check (party_interest in ('yes', 'maybe', 'no')),
  game_fun_1_7 smallint check (game_fun_1_7 between 1 and 7),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.experience_reviews enable row level security;

alter table public.participants add column upgraded_at timestamptz;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'new_match', 'match_nudge', 'review_open', 'review_reminder', 'waitlist', 'final_call', 'guess_alert', 'v2_invite'));

commit;
