-- BLOP Match — the routine (/api/cron: matching, "have you talked?", review requests and reminders,
-- waiting-list invitation) runs every hour from 08:00 to 21:00 UTC (Lisbon winter time; 09–22 in
-- summer) instead of once a day, so the e-mails always fit and go out close to when they are due.
-- Vercel's daily cron stays as a fallback; every e-mail is logged once, so runs never repeat them.
--
-- Before running this, store the same CRON_SECRET as on Vercel in the vault (never in git):
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'blop-hourly',
  '7 8-21 * * *',
  $$
  select net.http_get(
    url := 'https://blop-match.vercel.app/api/cron',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);

commit;
