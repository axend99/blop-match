-- BLOP Match — "Have you talked to your match?" e-mail, 1 day after each match (before the
-- review request on day 2). Logged in email_log like the others, once per person and match.
begin;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'new_match', 'match_nudge', 'review_open', 'review_reminder', 'waitlist'));

commit;
