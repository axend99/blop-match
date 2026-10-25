-- BLOP Match — funnel snapshots for /admin: the funnel totals saved at a moment (e.g. right
-- before changing the home page or the sign-up form), so the panel can compare before × after.
begin;

create table public.funnel_snapshots (
  id uuid primary key default gen_random_uuid(),
  taken_at timestamptz not null default now(),
  label text not null check (char_length(label) between 1 and 120),
  home integer not null,
  login integer not null,
  join_form integer not null,
  accounts integer not null,
  profiles integer not null
);
alter table public.funnel_snapshots enable row level security;
revoke all on public.funnel_snapshots from anon, authenticated;

commit;
