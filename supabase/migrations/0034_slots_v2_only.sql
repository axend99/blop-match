-- try_create_match counted every match for the slots, v1 ones included, so people who joined v2
-- from v1 had full slots and every new match was refused. Slots now count only matches created
-- since `p_counted_since` (the app passes the end of v1, V1_ENDS_AT), as lib/matchingService.ts does.
begin;

drop function if exists public.try_create_match(uuid, uuid, text, numeric, text[], integer, jsonb, integer, integer);

create function public.try_create_match(
  p_a uuid, p_b uuid, p_type text, p_score numeric, p_shared text[], p_shared_count integer, p_by_cat jsonb,
  p_max_compatible integer, p_max_control integer, p_counted_since timestamptz default '2026-11-03T09:00:00Z'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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

  if (select count(*) from public.matches where type = p_type and v_a in (a_id, b_id) and created_at >= p_counted_since) >= v_max
     or (select count(*) from public.matches where type = p_type and v_b in (a_id, b_id) and created_at >= p_counted_since) >= v_max then
    return null;
  end if;

  insert into public.matches (a_id, b_id, type, score, shared_items, shared_count, shared_by_category)
  values (v_a, v_b, p_type, p_score, p_shared, p_shared_count, p_by_cat)
  on conflict (a_id, b_id) do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.try_create_match(uuid, uuid, text, numeric, text[], int, jsonb, int, int, timestamptz)
  from public, anon, authenticated;
grant execute on function public.try_create_match(uuid, uuid, text, numeric, text[], int, jsonb, int, int, timestamptz)
  to service_role;

commit;
