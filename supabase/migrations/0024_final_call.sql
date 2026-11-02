-- BLOP Match — end of the study: one last e-mail ("final_call") to everyone with reviews still to
-- send. Logged once per person like the others (match_id is null).
begin;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'new_match', 'match_nudge', 'review_open', 'review_reminder', 'waitlist', 'final_call'));

commit;
