-- BLOP Match — profile verification, bans and reports.
-- * pending_review: new profiles wait for the AI check (and, if something is flagged or the
--   check fails, for an admin); reported people are paused. Pending people get no new matches.
-- * banned_emails: e-mails of removed people, kept during the study so they cannot come back.
-- * reports: a participant reports one of their matches; only the team sees them.
-- * ban_participant(): removes a person and everything linked to them in one transaction.
begin;

alter table public.participants add column pending_review boolean not null default false;
create index participants_pending_idx on public.participants (id) where pending_review;

-- Same function as in 0002, plus: neither person may be pending.
create or replace function public.try_create_match(
  p_a uuid,
  p_b uuid,
  p_type text,
  p_score numeric,
  p_shared text[],
  p_shared_count int,
  p_by_cat jsonb,
  p_max_compatible int,
  p_max_control int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid := least(p_a, p_b);
  v_b uuid := greatest(p_a, p_b);
  v_max int := case p_type when 'compatible' then p_max_compatible when 'control' then p_max_control end;
  v_id uuid;
begin
  if p_a = p_b or v_max is null then
    return null;
  end if;

  perform 1 from public.participants where id = v_a for update;
  perform 1 from public.participants where id = v_b for update;

  if (select count(*) from public.participants
      where id in (v_a, v_b) and active and deleted_at is null and not pending_review) <> 2 then
    return null;
  end if;

  if (select count(*) from public.matches where type = p_type and v_a in (a_id, b_id)) >= v_max
     or (select count(*) from public.matches where type = p_type and v_b in (a_id, b_id)) >= v_max then
    return null;
  end if;

  insert into public.matches (a_id, b_id, type, score, shared_items, shared_count, shared_by_category)
  values (v_a, v_b, p_type, p_score, p_shared, p_shared_count, p_by_cat)
  on conflict (a_id, b_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

create table public.banned_emails (
  email text primary key check (email = lower(email)),
  reason text,
  banned_at timestamptz not null default now()
);
alter table public.banned_emails enable row level security;
revoke all on public.banned_emails from anon, authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete set null,
  reporter_id uuid references public.participants (id) on delete set null,
  reported_id uuid references public.participants (id) on delete set null,
  reason text not null check (reason in ('harassment', 'sexual', 'threat', 'spam', 'fake', 'unsafe', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('dismissed', 'banned')),
  unique (match_id, reporter_id)
);
create index reports_open_idx on public.reports (reported_id) where resolved_at is null;
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- Removes a person (never seed, never anonymised) and everything linked to them; the lock is the
-- one try_create_match takes, so no match can be created meanwhile. Returns the auth user id,
-- deleted afterwards by the app.
create function public.ban_participant(p_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_user uuid;
  v_seed boolean;
  v_matches uuid[];
begin
  select lower(email), user_id, is_seed into v_email, v_user, v_seed
  from public.participants where id = p_id for update;
  if not found or v_seed or v_email is null then
    raise exception 'cannot ban this participant';
  end if;

  insert into public.banned_emails (email, reason) values (v_email, p_reason)
  on conflict (email) do update set reason = excluded.reason, banned_at = now();

  update public.reports set resolution = 'banned', resolved_at = now()
  where reported_id = p_id and resolved_at is null;

  v_matches := array(select id from public.matches where p_id in (a_id, b_id));

  delete from public.content_flags where participant_id = p_id or match_id = any(v_matches);
  delete from public.contact_clicks where participant_id = p_id or match_id = any(v_matches);
  delete from public.reviews where reviewer_id = p_id or match_id = any(v_matches);
  delete from public.review_requests where participant_id = p_id or match_id = any(v_matches);
  delete from public.email_log where participant_id = p_id or match_id = any(v_matches);
  delete from public.matches where id = any(v_matches);
  delete from public.participants where id = p_id;

  return v_user;
end;
$$;

revoke execute on function public.ban_participant(uuid, text) from public, anon, authenticated;
grant execute on function public.ban_participant(uuid, text) to service_role;

commit;
