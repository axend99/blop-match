-- BLOP Match — initial schema, RLS and helper functions.
-- Data deletion on request = anonymisation: the participant row is kept with personal
-- fields cleared (name='[deleted]', email/whatsapp/instagram null, other_text '{}', active false,
-- deleted_at set), then the auth user is deleted. Matches and the other person's review survive.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text,
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  instagram text,
  city text not null,
  lang text not null check (lang in ('en', 'pt')),
  age_range text not null check (age_range in ('18-24', '25-30', '31-35', '36+')),
  time_in_city text not null check (time_in_city in ('lt6m', '6-24m', '2y+', 'always')),
  origin text not null check (origin in ('this_city', 'same_country', 'other_country')),
  interests text[] not null check (cardinality(interests) between 12 and 24),
  other_text jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- Personal fields may only be empty once the participant has been anonymised.
  constraint participants_personal_data check (
    deleted_at is not null
    or (user_id is not null and email is not null and whatsapp is not null and instagram is not null)
  )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.participants (id),
  b_id uuid not null references public.participants (id),
  type text not null check (type in ('compatible', 'control')),
  score numeric not null,
  shared_items text[] not null,
  shared_count int not null,
  shared_by_category jsonb not null,
  created_at timestamptz not null default now(),
  unique (a_id, b_id),
  check (a_id < b_id)
);

create index matches_b_id_idx on public.matches (b_id);

create table public.review_requests (
  match_id uuid not null references public.matches (id),
  participant_id uuid not null references public.participants (id),
  requested_at timestamptz not null default now(),
  reminded_at timestamptz,
  primary key (match_id, participant_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id),
  reviewer_id uuid not null references public.participants (id),
  contacted boolean not null,
  interest_1_7 smallint not null check (interest_1_7 between 1 and 7),
  who_first text check (who_first in ('me', 'them')),
  comfort_1_7 smallint check (comfort_1_7 between 1 and 7),
  why_not text check (why_not in ('no_time', 'not_interested', 'no_reply', 'shy', 'other')),
  talked boolean,
  flow_1_7 smallint check (flow_1_7 between 1 and 7),
  common_ground_1_7 smallint check (common_ground_1_7 between 1 and 7),
  satisfaction_1_7 smallint check (satisfaction_1_7 between 1 and 7),
  meet_again_1_7 smallint check (meet_again_1_7 between 1 and 7),
  met text check (met in ('yes', 'planned', 'no')),
  comment text,
  next_step boolean generated always as (
    coalesce(meet_again_1_7 >= 5, false) or coalesce(met in ('yes', 'planned'), false)
  ) stored,
  created_at timestamptz not null default now(),
  unique (match_id, reviewer_id),
  -- Conditional questions (SPEC §7): shown fields are required, hidden fields are null.
  constraint reviews_contacted_branch check (
    case when contacted
      then who_first is not null and comfort_1_7 is not null and talked is not null and why_not is null
      else why_not is not null and who_first is null and comfort_1_7 is null and talked is null
    end
  ),
  constraint reviews_talked_branch check (
    case when coalesce(talked, false)
      then flow_1_7 is not null and common_ground_1_7 is not null and satisfaction_1_7 is not null
        and meet_again_1_7 is not null and met is not null
      else flow_1_7 is null and common_ground_1_7 is null and satisfaction_1_7 is null
        and meet_again_1_7 is null and met is null
    end
  )
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  kind text not null check (kind in ('welcome', 'new_match', 'review_open', 'review_reminder')),
  match_id uuid references public.matches (id),
  sent_at timestamptz not null default now(),
  unique nulls not distinct (participant_id, kind, match_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: matches has no policies, so policies
-- cannot read it directly with the caller's role)
-- ---------------------------------------------------------------------------

create function public.my_participant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.participants where user_id = auth.uid()
$$;

create function public.my_match_created_at(p_match uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select m.created_at
  from public.matches m
  join public.participants p on p.id in (m.a_id, m.b_id)
  where m.id = p_match and p.user_id = auth.uid()
$$;

-- Fixed fallback used only by the RLS guard. The app enforces REVIEW_DELAY_DAYS
-- from the environment and writes reviews with the service role.
create function public.review_delay_days()
returns int
language sql
immutable
as $$
  select 3
$$;

-- What a participant may see about their matches: never type, score or email.
-- other_deleted lets the UI show a translated label and hide contacts for anonymised partners.
create function public.get_my_matches()
returns table (
  match_id uuid,
  created_at timestamptz,
  other_name text,
  other_whatsapp text,
  other_instagram text,
  shared_items text[],
  reviewed_by_me boolean,
  other_deleted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.created_at,
    o.name,
    o.whatsapp,
    o.instagram,
    m.shared_items,
    exists (select 1 from public.reviews r where r.match_id = m.id and r.reviewer_id = me.id),
    o.deleted_at is not null
  from public.participants me
  join public.matches m on me.id in (m.a_id, m.b_id)
  join public.participants o on o.id = case when m.a_id = me.id then m.b_id else m.a_id end
  where me.user_id = auth.uid()
  order by m.created_at desc
$$;

revoke execute on function public.my_participant_id() from public, anon;
revoke execute on function public.my_match_created_at(uuid) from public, anon;
revoke execute on function public.review_delay_days() from public, anon;
revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.my_participant_id() to authenticated;
grant execute on function public.my_match_created_at(uuid) to authenticated;
grant execute on function public.review_delay_days() to authenticated;
grant execute on function public.get_my_matches() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security and privileges
-- ---------------------------------------------------------------------------

alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.review_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.email_log enable row level security;

-- participants: read own row; directly update only the language.
-- Profile creation, "leave the study" and other edits go through validated server actions.
revoke insert, update, delete on public.participants from anon, authenticated;
grant select on public.participants to authenticated;
grant update (lang) on public.participants to authenticated;

create policy participants_select_own on public.participants
  for select to authenticated
  using (user_id = auth.uid());

create policy participants_update_own on public.participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- matches, review_requests, email_log: no policies → service role only.

-- reviews: read own; insert only for own match after the delay; never update/delete.
revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
grant insert (
  match_id, reviewer_id, contacted, interest_1_7, who_first, comfort_1_7, why_not, talked,
  flow_1_7, common_ground_1_7, satisfaction_1_7, meet_again_1_7, met, comment
) on public.reviews to authenticated;

create policy reviews_select_own on public.reviews
  for select to authenticated
  using (reviewer_id = public.my_participant_id());

create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = public.my_participant_id()
    and now() >= public.my_match_created_at(match_id) + make_interval(days => public.review_delay_days())
  );
