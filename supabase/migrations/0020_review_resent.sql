-- BLOP Match — one-off resend of review requests sent with the old link (before 26/10, which
-- did not bring people back to the form after signing in). Marks each request resent once.
begin;

alter table public.review_requests add column resent_at timestamptz;

commit;
