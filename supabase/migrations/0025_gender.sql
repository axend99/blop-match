-- BLOP Match — gender for the sample breakdown in /admin.
-- `gender`: optional, self-reported at sign-up (from this migration on; earlier participants are null).
-- `gender_estimate`: estimated by the team from the first name, for the sample that was never asked
-- (analysis only, never shown to participants). Both are kept on anonymisation, like age and city.
begin;

alter table public.participants
  add column gender text check (gender in ('woman', 'man', 'non_binary', 'undisclosed')),
  add column gender_estimate text check (gender_estimate in ('woman', 'man', 'unclear'));

commit;
