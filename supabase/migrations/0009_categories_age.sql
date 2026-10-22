-- BLOP Match — 8 interest categories (no minimum per category: 10 to 40 items overall)
-- and the exact age (18–99). age_range stays, derived by the app, for the analysis.
-- get_my_matches() also returns the other person's age.
begin;

alter table public.participants drop constraint participants_interests_check;
alter table public.participants add constraint participants_interests_count
  check (cardinality(interests) between 10 and 40);

alter table public.participants add column age smallint check (age between 18 and 99);

drop function public.get_my_matches();

create function public.get_my_matches()
returns table (
  match_id uuid,
  created_at timestamptz,
  other_name text,
  other_whatsapp text,
  other_instagram text,
  shared_items text[],
  reviewed_by_me boolean,
  other_deleted boolean,
  other_age_range text,
  other_city text,
  other_interests text[],
  other_talk_about text,
  other_talk_about_code text,
  other_age smallint
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
    case when o.deleted_at is null then m.shared_items else '{}'::text[] end,
    exists (select 1 from public.reviews r where r.match_id = m.id and r.reviewer_id = me.id),
    o.deleted_at is not null,
    case when o.deleted_at is null then o.age_range end,
    case when o.deleted_at is null then o.city end,
    case when o.deleted_at is null then o.interests else '{}'::text[] end,
    case when o.deleted_at is null then o.talk_about end,
    case when o.deleted_at is null then o.talk_about_code end,
    case when o.deleted_at is null then o.age end
  from public.participants me
  join public.matches m on me.id in (m.a_id, m.b_id)
  join public.participants o on o.id = case when m.a_id = me.id then m.b_id else m.a_id end
  where me.user_id = auth.uid()
  order by m.created_at desc
$$;

revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.get_my_matches() to authenticated;

commit;
