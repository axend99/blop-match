-- BLOP Match — get_my_matches no longer returns shared items for anonymised partners
-- (SPEC §9: nothing about a deleted person reaches their former matches).
begin;

create or replace function public.get_my_matches()
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
  other_interests text[]
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
    case when o.deleted_at is null then o.interests else '{}'::text[] end
  from public.participants me
  join public.matches m on me.id in (m.a_id, m.b_id)
  join public.participants o on o.id = case when m.a_id = me.id then m.b_id else m.a_id end
  where me.user_id = auth.uid()
  order by m.created_at desc
$$;

revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.get_my_matches() to authenticated;

commit;
