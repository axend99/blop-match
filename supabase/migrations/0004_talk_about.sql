-- BLOP Match — "What I want to talk about" (icebreaker shown on the match page) and the
-- move of "Cooking at home" from food to hobbies (food_cooking → hob_cooking).
-- Anonymisation (data deletion request) now clears: name='[deleted]', email, whatsapp,
-- instagram, talk_about = null, other_text '{}', active false, deleted_at set; then the auth user is deleted.
begin;

do $$
begin
  if exists (select 1 from public.participants where 'food_cooking' = any(interests))
     or exists (select 1 from public.matches where 'food_cooking' = any(shared_items)) then
    raise exception 'food_cooking is still in use: migrate those rows to hob_cooking first';
  end if;
end
$$;

-- Nullable for profiles created before this field; required for new sign-ups by the app.
alter table public.participants
  add column talk_about text check (talk_about is null or char_length(talk_about) between 1 and 140);

-- Same as 0003 plus other_talk_about (still nothing for anonymised partners).
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
  other_talk_about text
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
    case when o.deleted_at is null then o.talk_about end
  from public.participants me
  join public.matches m on me.id in (m.a_id, m.b_id)
  join public.participants o on o.id = case when m.a_id = me.id then m.b_id else m.a_id end
  where me.user_id = auth.uid()
  order by m.created_at desc
$$;

revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.get_my_matches() to authenticated;

commit;
