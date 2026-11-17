-- BLOP Match v2 — cohorts and the password game.
-- cohort: everyone who joined before v2 is 'v1' (no e-mails, no new matches); new sign-ups are 'v2'.
-- password: one secret word each v2 participant chooses after the profile. Only the owner reads
-- it (RLS on participants: own row); the match sees it only after both reviews (server side).
-- password_guess: in the review, the word the reviewer thinks was the other person's password.
begin;

alter table public.participants add column cohort text not null default 'v1' check (cohort in ('v1', 'v2'));
alter table public.participants alter column cohort set default 'v2';
alter table public.participants add column password text check (char_length(password) between 2 and 20);

alter table public.reviews add column password_guess text check (char_length(password_guess) <= 40);

commit;
