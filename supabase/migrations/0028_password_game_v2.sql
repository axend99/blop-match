-- BLOP Match v2 — the password game, gamified.
-- password_guesses: guess the match's password at any time, up to 3 tries per match (attempt 1–3).
--   is_right is decided on save (translations count, lib/guessCheck.ts); null when the AI check
--   failed (the app then compares the words). Only the server reads it (RLS on, no policies).
-- nickname: random "Violet Flamingo"-style key, shown on the leaderboard unless the person opts in
--   to show their first name (leaderboard_show_name).
-- email_log: new kind 'guess_alert' ("X tried to guess your password").
begin;

alter table public.participants add column nickname text unique;
alter table public.participants add column leaderboard_show_name boolean not null default false;

create table public.password_guesses (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  guesser_id uuid not null references public.participants (id) on delete cascade,
  attempt smallint not null check (attempt between 1 and 3),
  guess text not null check (char_length(guess) between 1 and 40),
  is_right boolean,
  created_at timestamptz not null default now(),
  unique (match_id, guesser_id, attempt)
);
alter table public.password_guesses enable row level security;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'new_match', 'match_nudge', 'review_open', 'review_reminder', 'waitlist', 'final_call', 'guess_alert'));

commit;
