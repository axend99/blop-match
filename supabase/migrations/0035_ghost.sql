-- Ghost accounts: a participant who sees the app like anyone else but is never matched, never shows
-- on the leaderboard and stays out of the "real" figures in /admin (team members checking the
-- participant side). Toggled in /admin → Participantes.
alter table public.participants add column is_ghost boolean not null default false;
