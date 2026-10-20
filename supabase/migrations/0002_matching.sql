-- BLOP Match — Phase 3: safe match creation and richer match details for participants.
begin;

-- Creates a match if both people are active and both still have a free slot of that type.
-- Locks both participant rows (in id order) so concurrent runs (sign-up + cron) cannot
-- overfill slots. Returns the new match id, or null when the match is no longer possible.
create function public.try_create_match(
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
      where id in (v_a, v_b) and active and deleted_at is null) <> 2 then
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

revoke execute on function public.try_create_match(uuid, uuid, text, numeric, text[], int, jsonb, int, int)
  from public, anon, authenticated;
grant execute on function public.try_create_match(uuid, uuid, text, numeric, text[], int, jsonb, int, int)
  to service_role;

-- get_my_matches now also returns the other person's age range, city and interests
-- (shown on the match detail page; covered by the updated consent text).
-- Still never type, score or email. Anonymised partners return no personal fields.
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
    m.shared_items,
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
