-- BLOP Match — invitations to try BLOP Match, sent from /admin to people on the BLOP waiting
-- list (who are not participants yet). One row per mailbox (canonical address, see
-- lib/emailCanonical.ts), so nobody is invited twice.
begin;

create table public.invite_emails (
  email text primary key,
  sent_at timestamptz not null default now()
);
alter table public.invite_emails enable row level security;
revoke all on public.invite_emails from anon, authenticated;

commit;
