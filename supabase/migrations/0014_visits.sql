-- BLOP Match — visit funnel in /admin: how many browser sessions reached the home page, the
-- login page and the sign-up form, per day (Lisbon time). Anonymous counts only, no cookies:
-- the browser remembers for the session that a step was already counted.
begin;

create table public.visit_steps (
  day date not null,
  step text not null check (step in ('home', 'login', 'join')),
  sessions integer not null default 0,
  primary key (day, step)
);
alter table public.visit_steps enable row level security;
revoke all on public.visit_steps from anon, authenticated;

create function public.bump_visit(p_step text) returns void
language sql security definer set search_path = public as $$
  insert into visit_steps (day, step, sessions)
  values ((now() at time zone 'Europe/Lisbon')::date, p_step, 1)
  on conflict (day, step) do update set sessions = visit_steps.sessions + 1;
$$;
revoke execute on function public.bump_visit(text) from public, anon, authenticated;

commit;
