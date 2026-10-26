-- BLOP Match — /admin e-mail counter: how many sign-in link e-mails Supabase sent since a moment
-- (they go through the same Gmail account as the study e-mails). One per person at most, so it is
-- a lower bound. Service role only.
begin;

create function public.login_emails_since(p_since timestamptz) returns integer
language sql security definer set search_path = public, auth as $$
  select (count(*) filter (where confirmation_sent_at > p_since) + count(*) filter (where recovery_sent_at > p_since))::integer
  from auth.users;
$$;
revoke execute on function public.login_emails_since(timestamptz) from public, anon, authenticated;

commit;
